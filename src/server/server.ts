import bodyParser from "body-parser";
import cheerio from "cheerio";
import * as chokidar from "chokidar";
import compression from "compression";
import cors from "cors";
import express, { request } from "express";
import * as fs from "fs";
import * as http from "http";
import { Pool } from "pg";
import WebSocket, { WebSocketServer } from "ws";
import { error, sleep } from "../utils/utils.js";
import { FeedDatabase, fetchAndNormalizeFeed } from "./feed-database.js";

const port = process.env.PORT ?? 3333;

const dbName = process.env.DATABASE;
if (!dbName) {
    console.error("Environment variable DATABASE missing");
    process.exit(-1);
}
const dbUser = process.env.DATABASE_USER;
if (!dbUser) {
    console.error("Environment variable DATABASE_USER missing");
    process.exit(-1);
}
const dbPassword = process.env.DATABASE_PASSWORD;
if (!dbPassword) {
    console.error("Environment variable DATABASE_PASSWORD missing");
    process.exit(-1);
}

const pool = new Pool({
    host: "db",
    database: dbName,
    user: dbUser,
    password: dbPassword,
    port: 5432,
});

(async () => {
    const result = await connectWithRetry(5, 3000);
    if (result instanceof Error) {
        process.exit(-1);
    }

    if (!fs.existsSync("docker/data")) {
        fs.mkdirSync("docker/data");
    }

    const feedDb = new FeedDatabase(pool);
    await feedDb.initialize();
    feedDb.poll();

    const app = express();
    app.set("json spaces", 2);
    app.use(cors());
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get("/api/json", async (req, res) => {
        try {
            const url = req.query.url as string;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Couldn't fetch " + url);
            res.json(await response.json());
        } catch (e) {
            error("Couldn't JSON proxy " + req.query.url, e);
            res.status(400).json(e);
        }
    });

    app.get("/api/favicon", async (req, res) => {
        try {
            const domain = req.query.domain as string;
            if (!domain) {
                return res.status(400).send("Domain parameter is required");
            }

            const protocol = "https://"; // or 'http://' depending on your requirement
            const url = `${protocol}${domain}`;

            const requestOptions = {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            };

            const response = await fetch(url, requestOptions);
            const html = await response.text();
            const $ = cheerio.load(html);

            interface Favicon {
                url: string;
                size: number;
            }

            const favicons: Favicon[] = [];

            $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((i, elem) => {
                const href = $(elem).attr("href");
                const sizes = $(elem).attr("sizes");
                if (href) {
                    let faviconUrl = href.startsWith("http") ? href : `${protocol}${href.startsWith("//") ? href.substring(2) : domain + href}`;
                    if (!faviconUrl.startsWith("http")) {
                        faviconUrl = "https://" + domain + "/" + faviconUrl;
                    }
                    const size = sizes
                        ? Math.max(
                              ...sizes.split(" ").map((s) => {
                                  const [width, height] = s.split("x").map(Number);
                                  return width * height;
                              })
                          )
                        : 0;
                    favicons.push({ url: faviconUrl, size });
                }
            });

            // Check for default favicon.ico at the root of the domain
            if (favicons.length == 0) {
                const defaultFaviconUrl = `${protocol}${domain}/favicon.ico`;
                try {
                    const defaultFaviconResponse = await fetch(defaultFaviconUrl);
                    if (defaultFaviconResponse.ok) {
                        // only add if the request was successful
                        favicons.push({ url: defaultFaviconUrl, size: 0 }); // Size 0 as default
                    }
                } catch (error) {
                    console.log(`No default favicon found at ${defaultFaviconUrl}`);
                }
            }

            // Sort by size, descending
            const sortedFavicons = favicons.sort((a, b) => b.size - a.size);

            res.json({ icons: sortedFavicons.map((favicon) => favicon.url) });
        } catch (error) {
            console.error(error);
            res.status(500).send("An error occurred while fetching favicons");
        }
    });

    app.get("/api/rss", async (req, res) => {
        try {
            if (!req.query.url) {
                throw new Error("Parameter 'url' is mandatory");
            }

            const urls = Array.isArray(req.query.url) ? (req.query.url as string[]) : [req.query.url as string];
            const lastPublished = req.query.lastPublished ? parseInt(req.query.lastPublished as string) : undefined;
            const lastId = req.query.lastId ? parseInt(req.query.lastId as string) : undefined;
            const limit = 25;

            // Ensure all URLs have their latest items fetched and stored
            const hasItemsMap = await feedDb.hasFeedItems(urls);
            for (const url of urls) {
                if (!hasItemsMap.get(url)) {
                    const newItems = await fetchAndNormalizeFeed(url);
                    if (newItems instanceof Error) throw newItems;
                    await feedDb.addFeedItems(newItems.map((item) => ({ ...item, feedUrl: url })));
                }
            }

            // Fetch paginated items from the database
            const items = await feedDb.getFeedItems(urls, limit, lastPublished, lastId);

            let nextLastPublished: number | undefined = undefined,
                nextLastId: number | undefined = 0;
            if (items.length > 0) {
                const lastItem = items[items.length - 1];
                nextLastPublished = new Date(lastItem.published).getTime() / 1000;
                nextLastId = lastItem.id!;
            }

            res.json({
                items,
                nextLastPublished,
                nextLastId,
            });
        } catch (e) {
            console.error("Error in /api/rss endpoint", e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    const server = http.createServer(app);
    server.listen(port, async () => {
        console.log(`App listening on port ${port}`);
    });

    setupLiveReload(server);
})();

async function connectWithRetry(maxRetries = 5, interval = 2000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const client = await pool.connect();
            try {
                const result = await client.query("SELECT NOW()");
                console.log("Query result:", result.rows);
                return undefined; // Successful connection, exit the function
            } finally {
                client.release();
            }
        } catch (err) {
            console.error("Connection attempt failed:", err);
            retries++;
            if (retries === maxRetries) {
                return new Error("Failed to connect to the database after retries");
            }
            await sleep(interval);
        }
    }
}

type FeedItem = {
    title: string;
    link: string;
    content: string;
};

function setupLiveReload(server: http.Server) {
    const wss = new WebSocketServer({ server });
    const clients: Set<WebSocket> = new Set();
    wss.on("connection", (ws: WebSocket) => {
        clients.add(ws);
        ws.on("close", () => {
            clients.delete(ws);
        });
    });

    chokidar.watch("html/", { ignored: /(^|[\/\\])\../, ignoreInitial: true }).on("all", (event, path) => {
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`File changed: ${path}`);
            }
        });
    });
    console.log("Initialized live-reload");
}
