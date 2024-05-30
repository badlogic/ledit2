import { RssItem, RssResult } from "../api";
import { StreamPage } from "../utils/streams";
import * as fs from "fs";
import * as csv from "fast-csv";

if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
}
const baseDir = "data/";

async function rss(urls: string[], cursor?: string): Promise<StreamPage<RssItem> | Error> {
    try {
        const lastPublished = cursor ? cursor.split("|")[0] : undefined;
        const lastId = cursor ? cursor.split("|")[1] : undefined;
        const url =
            "rss?" +
            urls.map((url) => "url=" + encodeURIComponent(url)).join("&") +
            (lastPublished ? "&lastPublished=" + lastPublished : "") +
            (lastId ? "&lastId=" + lastId : "");

        const result = await fetch("https://ledit.marioslab.io/api/" + url);
        if (!result.ok) {
            const json = (await result.json()) as any;
            return new Error("Couldn't get all RSS feeds");
        }
        const response = (await result.json()) as RssResult;
        return { items: response.items, cursor: response.nextLastPublished + "|" + response.nextLastId };
    } catch (e) {
        console.log("Couldn't get RSS feeds", e);
        return new Error("Couldn't get all RSS feeds");
    }
}

async function getRssItems() {
    console.log("Getting RSS items");
    const dataFile = baseDir + "standard.json";
    if (fs.existsSync(dataFile)) {
        return JSON.parse(fs.readFileSync(dataFile, "utf-8")) as RssItem[];
    }
    const articles = [];
    let cursor: string | undefined;
    let i = 0;
    do {
        const page = await rss(["https://derstandard.at/rss"], cursor);
        if (page instanceof Error) throw page;
        cursor = page.cursor;
        articles.push(...page.items);
        console.log("RSS page " + ++i);
    } while (cursor && i < 140);
    fs.writeFileSync(dataFile, JSON.stringify(articles, null, 2), "utf-8");
    return articles;
}

async function getHtml(rssItems: RssItem[]) {
    console.log("Getting HTML");
    const htmls = [];
    for (const item of rssItems) {
        const htmlFile = baseDir + "/" + item.id + ".html";
        if (fs.existsSync(htmlFile)) {
            htmls.push(fs.readFileSync(htmlFile, "utf-8"));
            continue;
        }
        const resp = await fetch(item.link);
        if (resp.status == 404 || resp.status == 500) {
            console.log(resp.status + " for " + item.link);
            htmls.push(item.content);
            continue;
        }
        if (!resp.ok) {
            throw new Error("Could not fetch " + item.link + "\n\n" + (await resp.text()));
        }
        const html = await resp.text();
        htmls.push(html);
        fs.writeFileSync(htmlFile, html, "utf-8");
        console.log(`HTML page ${htmls.length}/${rssItems.length}`);
    }
    return htmls;
}

type StandardItem = RssItem & { postsCount: number };

async function getPostCounts(rssItems: RssItem[]) {
    console.log("Fetching post counts");
    const dataFile = baseDir + "standard-counts.json";
    if (fs.existsSync(dataFile)) {
        return JSON.parse(fs.readFileSync(dataFile, "utf-8")) as StandardItem[];
    }
    const extractId = (url: string) => {
        const segments = url.split("/");
        for (let segment of segments) {
            if (/^\d+$/.test(segment)) {
                return segment;
            }
        }
        return null;
    };

    const items: StandardItem[] = [];
    for (const item of rssItems) {
        const articleId = extractId(item.link);
        let count = 0;
        const headers = {
            "Content-Type": "application/json",
            "x-apollo-operation-name": "GetForumInfo",
            "apollo-require-preflight": "true",
        };

        if (articleId == null) {
            console.log("Could not extract article id for " + item.link);
        } else if (item.link.includes("jetzt/livebericht")) {
            console.log("Skipping live report " + item.link);
        } else {
            const endpointUrl = `https://capi.ds.at/forum-serve-graphql/v1/?operationName=GetForumInfo&variables=%7B%22contextUri%22%3A%22https%3A%2F%2Fwww.derstandard.at%2Fstory%2F${articleId}%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22cb2d9227f7b2dfcce257d248adef0aa7d251a0b127fb5387af46abdd9103a53e%22%7D%7D`;
            const resp = await fetch(endpointUrl, { headers });
            if (!resp.ok) {
                console.log("Could not get post count for " + item.link + "\n" + (await resp.text()));
            } else {
                try {
                    count = (await resp.json()).data.getForumByContextUri.totalPostingCount;
                } catch (e) {
                    console.log(e);
                    console.log("Could not get post count for " + item.link);
                    console.log(endpointUrl);
                }
            }
        }
        items.push({ ...item, postsCount: count });
        console.log(`Post counts ${items.length}/${rssItems.length}`);
    }
    items.sort((a, b) => b.postsCount - a.postsCount);
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), "utf-8");
    return items;
}

(async () => {
    const rssItems = await getRssItems();
    console.log(rssItems.length);
    const htmls = await getHtml(rssItems);
    console.log(htmls.length);
    const standardItems = await getPostCounts(rssItems);
    console.log(standardItems.length);

    const schilling = [];
    const comments = [];
    for (const item of standardItems) {
        if ((item.title && item.title.includes("Schilling")) || (item.content && item.content.includes("Schilling"))) {
            schilling.push(item);
            comments.push({
                title: item.title,
                link: item.link,
                count: item.postsCount,
                isSchilling: true,
                date: new Date(item.published).toISOString().split("T")[0],
            });
        } else {
            comments.push({
                title: item.title,
                link: item.link,
                count: item.postsCount,
                isSchilling: false,
                date: new Date(item.published).toISOString().split("T")[0],
            });
        }
    }
    fs.writeFileSync(baseDir + "schilling.json", JSON.stringify(schilling, null, 2), "utf-8");
    fs.writeFileSync(baseDir + "counts.json", JSON.stringify(comments, null, 2), "utf-8");

    const csvStream = csv.format({ headers: true });
    const writableStream = fs.createWriteStream(baseDir + "counts.csv");
    csvStream.pipe(writableStream);
    comments.forEach((comment) => {
        csvStream.write(comment);
    });
    csvStream.end();
})();
