import bodyParser from "body-parser";
import * as chokidar from "chokidar";
import compression from "compression";
import cors from "cors";
import express from "express";
import * as fs from "fs";
import * as http from "http";
import multer from "multer";
import WebSocket, { WebSocketServer } from "ws";
import { error, sleep } from "../utils/utils.js";
import { FeedData, extract } from "@extractus/feed-extractor";
import Parser from "rss-parser";
import { DomNode, FormatOptions, RecursiveCallback, convert } from "html-to-text";
import { BlockTextBuilder } from "html-to-text/lib/block-text-builder.js";
import { Pool } from "pg";
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
    feedDb.initialize();
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
                nextLastPublished = new Date(lastItem.published).getTime();
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
