import { encodeHTML } from "entities";
import { error, unescapeHtml } from "../utils/utils.js";
import { Stream } from "../utils/streams.js";

export interface RawHackerNewsPost {
    by: string;
    descendants: number;
    id: number;
    kids: number[];
    score: number;
    time: number;
    title: string;
    type: string;
    url: string;
    text: string;
}

export interface RawHackerNewsComment {
    created_at_i: number;
    parent_id: number;
    objectID: string;
    comment_text: string;
    author: string;
    replies: RawHackerNewsComment[] | undefined;
}

export interface HackerNewsPost {
    id: number;
    url: string;
    title: string;
    author: string;
    authorUrl: string;
    createdAt: number;
    numComments: number;
    points: number;
    content: string | null;
    raw: RawHackerNewsPost;
}

export interface HackerNewsComment {
    url: string;
    author: string;
    authorUrl: string;
    createdAt: number;
    content: string;
    replies: HackerNewsComment[];
    raw: RawHackerNewsComment;
}

export async function getHackerNewsItem<T>(id: string): Promise<T> {
    const response = await fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json");
    return (await response.json()) as T;
}

export function rawToHackerNewsPost(rawPost: RawHackerNewsPost) {
    return {
        id: rawPost.id,
        url: rawPost.url ?? "https://news.ycombinator.com/item?id=" + rawPost.id,
        title: rawPost.title,
        author: rawPost.by,
        authorUrl: `https://news.ycombinator.com/user?id=${rawPost.by}`,
        createdAt: rawPost.time,
        numComments: rawPost.descendants ?? 0,
        points: rawPost.score,
        content: rawPost.text ? unescapeHtml(encodeHTML("<p>" + rawPost.text)) : "",
        raw: rawPost,
    } as HackerNewsPost;
}

function rawToHnComment(rawComment: RawHackerNewsComment) {
    return {
        url: `https://news.ycombinator.com/item?id=${rawComment.objectID}`,
        author: rawComment.author,
        authorUrl: `https://news.ycombinator.com/user?id=${rawComment.author}`,
        createdAt: rawComment.created_at_i,
        content: unescapeHtml(encodeHTML("<p>" + rawComment.comment_text)) ?? "",
        replies: [] as HackerNewsComment[],
        raw: rawComment,
    } as HackerNewsComment;
}

export type HackerNewsSorting = "topstories" | "newstories" | "askstories" | "showstories" | "jobstories";

export class HackerNewsStream extends Stream<HackerNewsPost> {
    constructor(sorting: HackerNewsSorting) {
        super(async (cursor?: string, limit?: number, notify?: boolean) => {
            try {
                const response = await fetch("https://hacker-news.firebaseio.com/v0/" + sorting + ".json");
                const storyIds = (await response.json()) as number[];
                let startIndex = cursor ? Number.parseInt(cursor) : 0;
                const requests: Promise<RawHackerNewsPost>[] = [];
                for (let i = startIndex; i < Math.min(storyIds.length, startIndex + 25); i++) {
                    requests.push(getHackerNewsItem(storyIds[i].toString()));
                }

                const hnPosts = await Promise.all(requests);
                const posts: HackerNewsPost[] = [];
                for (const hnPost of hnPosts) {
                    posts.push(rawToHackerNewsPost(hnPost));
                }

                return {
                    items: posts,
                    cursor: posts.length == 0 ? undefined : (startIndex + 25).toString(),
                };
            } catch (e) {
                console.error(e);
                return new Error("Couldn't load Hackernews posts.");
            }
        });
    }

    getItemKey(item: HackerNewsPost): string {
        return item.id.toString();
    }
    getItemDate(item: HackerNewsPost): Date {
        return new Date(item.createdAt * 1000);
    }
}

export async function getHackerNewsComments(post: HackerNewsPost) {
    try {
        // Use algolia to get all comments in one go
        const rawPost = post.raw;
        let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + rawPost.id + "&hitsPerPage=" + rawPost.descendants);
        const data = await response.json();
        const hits: RawHackerNewsComment[] = [...data.hits];
        const lookup = new Map<string, RawHackerNewsComment>();

        // Build up the comment tree
        for (const hit of hits) {
            lookup.set(hit.objectID, hit);
        }
        for (const hit of hits) {
            const parent = lookup.get(hit.parent_id.toString());
            if (!parent) continue;
            if (!parent.replies) parent.replies = [];
            parent.replies.push(hit);
        }

        // Use the "official" API to get the sorting for each fucking node and reorder the
        // replies.
        //
        // We used the official API to get the post. It's kids are in order. We build up
        // the root of the true again based on that order.
        const roots: RawHackerNewsComment[] = [];
        if (rawPost.kids) {
            for (const rootId of rawPost.kids) {
                const root = lookup.get(rootId.toString());
                if (root) roots.push(root);
            }
        }

        // Next, we traverse the comment tree. Any comment with more than 1 reply
        // gets its replies re-ordered based on the official API response.
        const sortReplies = async (hnComment: RawHackerNewsComment) => {
            if (!hnComment.replies) return;
            if (hnComment.replies.length > 1) {
                const info = (await getHackerNewsItem(hnComment.objectID)) as { kids: number[] | undefined };
                hnComment.replies = [];
                if (info.kids) {
                    for (const kid of info.kids) {
                        const kidComment = lookup.get(kid.toString());
                        if (kidComment) hnComment.replies.push(kidComment);
                    }
                }
            }
            for (const reply of hnComment.replies) {
                await sortReplies(reply);
            }
        };

        const promises = [];
        for (const root of roots) {
            promises.push(sortReplies(root));
        }
        await Promise.all(promises);

        const convertComment = (hnComment: RawHackerNewsComment) => {
            const comment: HackerNewsComment = rawToHnComment(hnComment);
            if (hnComment.replies) {
                for (const reply of hnComment.replies) {
                    comment.replies.push(convertComment(reply));
                }
            }

            return comment;
        };
        const comments = roots.map((root) => convertComment(root));
        return comments;
    } catch (e) {
        return error("Could not load comments.", e);
    }
}
