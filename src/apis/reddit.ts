import { Api } from "../api.js";
import { Stream } from "../utils/streams.js";
import { error } from "../utils/utils.js";

export interface RedditPosts {
    kind: "listing";
    data: {
        after: string;
        children: RedditPost[];
    };
}

export interface RedditPost {
    data: {
        author: string;
        created_utc: number;
        domain: string;
        is_created_from_ads_ui: boolean;
        is_reddit_media_domain: boolean;
        is_video: boolean;
        is_self: boolean;
        is_gallery: boolean;
        id: string;
        num_comments: number;
        over_18: boolean;
        permalink: string;
        selftext_html: string;
        gallery_data: {
            items: { media_id: string; id: number }[];
        };
        media_metadata: {
            [key: string]: {
                status: string;
                p: {
                    x: number;
                    y: number;
                    u: string;
                }[];
            };
        };
        preview: {
            enabled: boolean;
            images: {
                resolutions: {
                    url: string;
                    width: number;
                    height: number;
                }[];
            }[];
            reddit_video_preview: {
                dash_url: string;
                hls_url: string;
                fallback_url: string;
                is_gif: boolean;
                width: number;
                height: number;
            } | null;
            source: {
                url: string;
                width: number;
                height: number;
            };
        };
        secure_media: {
            reddit_video: {
                fallback_url: string;
                width: number;
                height: number;
                dash_url: string;
                hls_url: string;
            };
        };
        secure_media_embed: {
            content: string;
            width: number;
            height: number;
            media_domain_url: string;
        };
        score: number;
        subreddit: string;
        subreddit_id: string;
        thumbnail: string;
        title: string;
        ups: number;
        downs: number;
        url: string;
    };
}

export interface RedditComment {
    data: {
        author: string;
        created_utc: number;
        body_html: string;
        score: number;
        permalink: string;
        replies: RedditComments | "" | undefined;
    };
    kind: "t1" | "more";
}

export interface RedditComments {
    data: {
        children: RedditComment[];
    };
    kind: "Listing";
}

export type RedditSorting = "hot" | "new" | "rising" | "top-today" | "top-week" | "top-month" | "top-year" | "top-alltime";

export class RedditStream extends Stream<RedditPost> {
    constructor(subreddits: string, sort: RedditSorting) {
        super(async (cursor?: string, limit?: number, notify?: boolean) => {
            try {
                const sortType = sort.split("-")[0];
                const sortParam = sort.split("-")[1] ? "t=" + sort.split("-")[1] : "";
                const response = await fetch(
                    "https://www.reddit.com/r/" +
                        encodeURIComponent(subreddits) +
                        "/" +
                        sortType +
                        "/.json?" +
                        sortParam +
                        "&" +
                        (cursor ? "after=" + cursor : "")
                );
                if (!response.ok) throw new Error(await response.text());
                const page = (await response.json()) as RedditPosts;
                if (!page || !page.data || !page.data.children) throw new Error("No data in response");
                const posts: RedditPost[] = [];
                for (const post of page.data.children) {
                    posts.push(post);
                }
                return { items: posts, cursor: page.data.after };
            } catch (e) {
                return error("Couldn't fetch page " + cursor + " for subreddit " + subreddits, e);
            }
        });
    }

    getItemKey(item: RedditPost): string {
        return item.data.id;
    }
    getItemDate(item: RedditPost): Date {
        return new Date(item.data.created_utc);
    }
}
