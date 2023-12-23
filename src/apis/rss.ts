import { Api, RssItem } from "../api.js";
import { Stream } from "../utils/streams.js";

export class RssStream extends Stream<RssItem> {
    constructor(urls: string[]) {
        super(async (cursor?: string, limit?: number, notify?: boolean) => {
            const result = await Api.rss(urls, cursor);
            if (result instanceof Error) return result;
            return result;
        });
    }

    getItemKey(item: RssItem): string {
        return item.id.toString();
    }

    getItemDate(item: RssItem): Date {
        return new Date(item.published);
    }
}
