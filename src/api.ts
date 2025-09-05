import { FeedItem } from "./server/feed-database.js";
import { JsonValue } from "./server/key-value-store.js";
import { StreamPage } from "./utils/streams.js";
import { error } from "./utils/utils.js";

function apiBaseUrl() {
    if (typeof location === "undefined") return "http://localhost:3333/api/";
    return location.href.includes("localhost") || location.href.includes("192.168.1") ? `http://${location.hostname}:3333/api/` : "/api/";
}

export async function apiGet<T>(endpoint: string, base = apiBaseUrl()) {
    try {
        const result = await fetch(base + endpoint);
        if (!result.ok) throw new Error();
        return (await result.json()) as T;
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export async function apiPost<T>(endpoint: string, params: URLSearchParams | FormData) {
    let headers: HeadersInit = {};
    let body: string | FormData;

    if (params instanceof URLSearchParams) {
        headers = { "Content-Type": "application/x-www-form-urlencoded" };
        body = params.toString();
    } else {
        body = params;
    }
    try {
        const result = await fetch(apiBaseUrl() + endpoint, {
            method: "POST",
            headers: headers,
            body: body,
        });
        if (!result.ok) throw new Error();
        return (await result.json()) as T;
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export function toUrlBody(params: JsonValue) {
    const urlParams = new URLSearchParams();
    for (const key in params) {
        const value = params[key];
        const type = typeof value;
        if (type === "string" || type === "number" || type === "boolean") {
            urlParams.append(key, value.toString());
        } else if (typeof value === "object") {
            urlParams.append(key, JSON.stringify(value));
        } else {
            throw new Error("Unsupported value type: " + typeof value);
        }
    }
    return urlParams;
}

export interface RssItem {
    id: number;
    title: string;
    link: string;
    content: string;
    image: string;
    published: string; // ISO date
    feed_url: string;
}

export type RssResult = {
    items: RssItem[];
    nextLastPublished: number;
    nextLastId: number;
};

export class RssError extends Error {
    constructor(message: string, readonly errorUrls: string[]) {
        super(message);
    }
}

// biome-ignore lint/complexity/noStaticOnlyClass: fuck off
export class Api {
    static async proxyJson<T>(url: string, cursor?: string): Promise<T | Error> {
        try {
            const response = await apiGet<T>("json?url=" + encodeURIComponent(url));
            if (response instanceof Error) throw response;
            return response;
        } catch (e) {
            return error("Couldn't proxy json request to " + url, e);
        }
    }

    static async rss(urls: string[], cursor?: string): Promise<StreamPage<RssItem> | RssError> {
        try {
            const lastPublished = cursor ? cursor.split("|")[0] : undefined;
            const lastId = cursor ? cursor.split("|")[1] : undefined;
            const url =
                "rss?" +
                urls.map((url) => "url=" + encodeURIComponent(url)).join("&") +
                (lastPublished ? "&lastPublished=" + lastPublished : "") +
                (lastId ? "&lastId=" + lastId : "");

            const result = await fetch(apiBaseUrl() + url);
            if (!result.ok) {
                const json = (await result.json()) as any;
                return new RssError("Couldn't get all RSS feeds", json ?? []);
            }
            const response = (await result.json()) as RssResult;
            return { items: response.items, cursor: response.nextLastPublished + "|" + response.nextLastId };
        } catch (e) {
            console.log("Couldn't get RSS feeds", e);
            return new RssError("Couldn't get all RSS feeds", []);
        }
    }

    static async getFavIcons(domain: string) {
        try {
            const url = "favicon?domain=" + encodeURIComponent(domain);
            const response = await apiGet<{ icons: string[] }>(url);
            if (response instanceof Error) throw response;
            return response.icons;
        } catch (e) {
            return error("Couldn't get favicons for " + domain, e);
        }
    }
}
