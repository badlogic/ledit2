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

const upload = multer({ storage: multer.memoryStorage() });

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
            const urls: string[] = [];
            if (typeof req.query.url == "string") {
                urls.push(req.query.url);
            }
            if (Array.isArray(req.query.url)) {
                urls.push(...(req.query.url as string[]));
            }
            const promises: Promise<FeedItem[]>[] = [];
            for (const url of urls) {
                promises.push(fetchAndNormalizeFeed(url));
            }
            const responses = await Promise.all(promises);
            res.json(responses);
        } catch (e) {
            error("Couldn't fetch rss " + req.query.url, e);
            res.status(400).json(e);
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

async function fetchAndNormalizeFeed(url: string): Promise<FeedItem[]> {
    try {
        const response = await fetch(url);
        const feedData = await response.text();
        const parser = new Parser();
        const feed = await parser.parseString(feedData);

        const customFormat = (elem: DomNode, walk: RecursiveCallback, builder: BlockTextBuilder, formatOptions: FormatOptions) => {
            walk(elem.children, builder);
            return "";
        };

        return (feed.items || []).map((item) => ({
            title: item.title || "",
            link: item.link || "",
            content: item.content
                ? convert(item.content, {
                      wordwrap: 130,
                      formatters: {
                          image: customFormat,
                      },
                  })
                : item["content:encoded"]
                ? convert(item["content:encoded"], { wordwrap: 130 })
                : item.description
                ? convert(item.description, { wordwrap: 130 })
                : "",
        }));
    } catch (error) {
        console.error("Error fetching or parsing feed:", error);
        throw error;
    }
}

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
