import { DomNode, FormatOptions, RecursiveCallback, convert } from "html-to-text";
import { BlockTextBuilder } from "html-to-text/lib/block-text-builder.js";
import { Pool } from "pg";
import Parser from "rss-parser";

export interface FeedItem {
    id?: number;
    title: string;
    link: string;
    content: string;
    image: string;
    published: number; // UTC timestamp
    feedUrl: string;
}

export async function fetchAndNormalizeFeed(url: string): Promise<FeedItem[] | Error> {
    try {
        const response = await fetch(url);
        if (!response.ok) return new Error("Failed to fetch feed " + url + "\n" + (await response.text()));
        const feedData = await response.text();
        const parser = new Parser();
        const feed = await parser.parseString(feedData);

        // Formatter to ignore content
        const ignoreContent = () => "";

        const formatLink = (elem: DomNode, walk: RecursiveCallback, builder: BlockTextBuilder, formatOptions: any) => {
            if (elem.children && elem.children.length) {
                walk(elem.children, builder);
            }
            // Add additional logic for link formatting if necessary
        };

        let firstImageUrl = "";
        const images: string[] = [];
        const firstImage = (elem: DomNode, walk: RecursiveCallback, builder: BlockTextBuilder, formatOptions: any) => {
            if (firstImageUrl.length == 0) firstImageUrl = elem.attribs.src;
            images.push(elem.attribs.src);
        };

        const convertOptions = {
            wordwrap: 130,
            formatters: {
                ignoreContent,
                formatLink,
                firstImage,
            },
            selectors: [
                { selector: "figcaption", format: "ignoreContent" },
                { selector: "img", format: "firstImage" },
                { selector: "a", format: "formatLink" },
            ],
        };
        const convertItem = (
            item: {
                [key: string]: any;
            } & Parser.Item
        ): FeedItem => {
            firstImageUrl = "";
            images.length = 0;
            let content = item.content
                ? convert(item.content, convertOptions)
                : item["content:encoded"]
                ? convert(item["content:encoded"], convertOptions)
                : item.description
                ? convert(item.description, convertOptions)
                : "";

            content = content.replace(/(\r?\n|\r){2,}/g, "\n\n");
            return {
                title: item.title ?? "",
                link: item.link ?? "",
                image: firstImageUrl ?? "",
                content: content,
                feedUrl: url,
                published: new Date(item.pubDate ?? new Date().getTime()).getTime(),
            };
        };

        return (feed.items || []).map((item) => convertItem(item)).filter((item) => item.title.length > 0 && item.link.length > 0);
    } catch (error) {
        console.log("Failed to fetch feed " + url, error);
        return new Error("Failed to fetch feed " + url + (error instanceof Error ? "\n" + error.message : ""));
    }
}

export class FeedDatabase {
    private pool: Pool;
    private pollInterval: number;

    constructor(pool: Pool, pollIntervalSeconds: number = 60 * 15) {
        this.pool = pool;
        this.pollInterval = pollIntervalSeconds * 1000;
    }

    public async initialize(): Promise<void> {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS feed_items (
                id SERIAL PRIMARY KEY,
                feed_url VARCHAR(1024) NOT NULL,
                title TEXT,
                link TEXT NOT NULL,
                content TEXT,
                image TEXT,
                published TIMESTAMP,
                CONSTRAINT unique_feed_item UNIQUE(feed_url, link)
            )
        `);

        // Creating indices for faster query performance
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_feed_url ON feed_items (feed_url);
        `);
        // Index on the 'published' column for ordering by date
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_published ON feed_items (published);
        `);
        // Index on the 'id' column for keyset pagination
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_id ON feed_items (id);
        `);
    }

    async addFeedItems(items: FeedItem[]): Promise<void> {
        const query = `
            INSERT INTO feed_items (feed_url, title, link, content, image, published)
            VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6))
            ON CONFLICT (feed_url, link)
            DO NOTHING
        `;

        for (const item of items) {
            await this.pool.query(query, [item.feedUrl, item.title, item.link, item.content, item.image, item.published / 1000]);
        }
    }

    async getFeedItems(urls: string[], limit: number, lastPublished?: number, lastId?: number): Promise<FeedItem[]> {
        let query = `
            SELECT id, feed_url, title, link, content, image, published
            FROM feed_items
            WHERE feed_url = ANY($1)
        `;

        const params: (string[] | Date | number)[] = [urls];

        if (lastPublished && lastId) {
            query += ` AND (published < TO_TIMESTAMP($2) OR (published = TO_TIMESTAMP($2) AND id < $3))`;
            params.push(lastPublished, lastId);
            query += `
            ORDER BY published DESC, id DESC
            LIMIT $4
        `;
        } else {
            query += `
            ORDER BY published DESC, id DESC
            LIMIT $2
        `;
        }

        params.push(limit);

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    async hasFeedItems(urls: string[]): Promise<Map<string, boolean>> {
        const query = `
            SELECT DISTINCT feed_url
            FROM feed_items
            WHERE feed_url = ANY($1)
        `;
        const result = await this.pool.query(query, [urls]);

        const hasItemsMap = new Map<string, boolean>();
        urls.forEach((url) => hasItemsMap.set(url, false));
        result.rows.forEach((row) => hasItemsMap.set(row.feed_url, true));

        return hasItemsMap;
    }

    public async poll(): Promise<void> {
        try {
            const feedUrlsResult = await this.pool.query("SELECT DISTINCT feed_url FROM feed_items");
            const feedUrls = feedUrlsResult.rows.map((row) => row.feed_url);

            for (const url of feedUrls) {
                const items = await fetchAndNormalizeFeed(url); // Define this function
                if (items instanceof Error) throw items;
                await this.addFeedItems(items.map((item) => ({ ...item, feedUrl: url })));
            }
        } catch (error) {
            console.error("Error during polling:", error);
        } finally {
            setTimeout(() => this.poll(), this.pollInterval);
        }
    }
}
