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
                const url =
                    "https://www.reddit.com/r/" +
                    encodeURIComponent(subreddits) +
                    "/" +
                    sortType +
                    "/.json?" +
                    sortParam +
                    "&" +
                    (cursor ? "after=" + cursor : "");
                const response = await Api.proxyJson<RedditPosts>(url);
                if (response instanceof Error) throw response;
                const page = response;
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

export type RedditSubreddits = {
    data: {
        after: string;
        children: { kind: string; data: RedditSubreddit }[];
    };
};

export type RedditSubreddit = {
    display_name: string; //"programming"
    header_img: string; //"https://b.thumbs.redditmedia.com/2rTE46grzsr-Ll3Q.png",
    title: string; // "programming",
    subscribers: number; // 5777279,
    name: string; // "t5_2fwo",
    community_icon: string; // "https://styles.redditmedia.com/t5_2fwo/styles/communityIcon_1bqa1ibfp8q11.png?width=256&amp;s=45361614cdf4a306d5510b414d18c02603c7dd3c",
    description: string; // "/r/programming is a reddit for discussion and news about [computer programming](http://en.wikipedia.org/wiki/Computer_programming)\n\n****\n**Guidelines**\n\n* Please keep submissions on topic and of high quality.\n* That means no image posts, no memes, no politics\n* Just because it has a computer in it doesn't make it programming. If there is no code in your link, it probably doesn't belong here.\n* Direct links to app demos (unrelated to programming) will be removed.\n* No surveys.\n* Please follow proper [reddiquette](https://www.reddit.com/help/reddiquette).\n\n****\n**Info**\n\n* Do you have a question? Check out /r/learnprogramming, /r/cscareerquestions, or [Stack Overflow](https://stackoverflow.com/).\n* Do you have something funny to share with fellow programmers? Please take it to /r/ProgrammerHumor/.\n* For posting job listings, please visit /r/forhire or /r/jobbit.\n* Check out our [faq](http://www.reddit.com/r/programming/wiki/faq).  It could use some updating.\n* Are you interested in promoting your own content?  STOP!  [Read this first](https://www.reddit.com/wiki/selfpromotion).\n\n****\n**Related reddits**\n\n* /r/technology\n* /r/ProgrammerTIL\n* /r/learnprogramming\n* /r/askprogramming\n* /r/coding\n* /r/compsci\n* /r/dailyprogrammer\n* /r/netsec\n* /r/webdev\n* /r/web_design\n* /r/gamedev\n* /r/cscareerquestions\n* /r/reverseengineering\n* /r/startups\n* /r/techsupport\n\n**[Specific languages](https://www.reddit.com/r/programming/wiki/faq#wiki_what_language_reddits_are_there.3F)**",
    description_html: string; // "&lt;!-- SC_OFF --&gt;&lt;div class=\"md\"&gt;&lt;p&gt;&lt;a href=\"/r/programming\"&gt;/r/programming&lt;/a&gt; is a reddit for discussion and news about &lt;a href=\"http://en.wikipedia.org/wiki/Computer_programming\"&gt;computer programming&lt;/a&gt;&lt;/p&gt;\n\n&lt;hr/&gt;\n\n&lt;p&gt;&lt;strong&gt;Guidelines&lt;/strong&gt;&lt;/p&gt;\n\n&lt;ul&gt;\n&lt;li&gt;Please keep submissions on topic and of high quality.&lt;/li&gt;\n&lt;li&gt;That means no image posts, no memes, no politics&lt;/li&gt;\n&lt;li&gt;Just because it has a computer in it doesn&amp;#39;t make it programming. If there is no code in your link, it probably doesn&amp;#39;t belong here.&lt;/li&gt;\n&lt;li&gt;Direct links to app demos (unrelated to programming) will be removed.&lt;/li&gt;\n&lt;li&gt;No surveys.&lt;/li&gt;\n&lt;li&gt;Please follow proper &lt;a href=\"https://www.reddit.com/help/reddiquette\"&gt;reddiquette&lt;/a&gt;.&lt;/li&gt;\n&lt;/ul&gt;\n\n&lt;hr/&gt;\n\n&lt;p&gt;&lt;strong&gt;Info&lt;/strong&gt;&lt;/p&gt;\n\n&lt;ul&gt;\n&lt;li&gt;Do you have a question? Check out &lt;a href=\"/r/learnprogramming\"&gt;/r/learnprogramming&lt;/a&gt;, &lt;a href=\"/r/cscareerquestions\"&gt;/r/cscareerquestions&lt;/a&gt;, or &lt;a href=\"https://stackoverflow.com/\"&gt;Stack Overflow&lt;/a&gt;.&lt;/li&gt;\n&lt;li&gt;Do you have something funny to share with fellow programmers? Please take it to &lt;a href=\"/r/ProgrammerHumor/\"&gt;/r/ProgrammerHumor/&lt;/a&gt;.&lt;/li&gt;\n&lt;li&gt;For posting job listings, please visit &lt;a href=\"/r/forhire\"&gt;/r/forhire&lt;/a&gt; or &lt;a href=\"/r/jobbit\"&gt;/r/jobbit&lt;/a&gt;.&lt;/li&gt;\n&lt;li&gt;Check out our &lt;a href=\"http://www.reddit.com/r/programming/wiki/faq\"&gt;faq&lt;/a&gt;.  It could use some updating.&lt;/li&gt;\n&lt;li&gt;Are you interested in promoting your own content?  STOP!  &lt;a href=\"https://www.reddit.com/wiki/selfpromotion\"&gt;Read this first&lt;/a&gt;.&lt;/li&gt;\n&lt;/ul&gt;\n\n&lt;hr/&gt;\n\n&lt;p&gt;&lt;strong&gt;Related reddits&lt;/strong&gt;&lt;/p&gt;\n\n&lt;ul&gt;\n&lt;li&gt;&lt;a href=\"/r/technology\"&gt;/r/technology&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/ProgrammerTIL\"&gt;/r/ProgrammerTIL&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/learnprogramming\"&gt;/r/learnprogramming&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/askprogramming\"&gt;/r/askprogramming&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/coding\"&gt;/r/coding&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/compsci\"&gt;/r/compsci&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/dailyprogrammer\"&gt;/r/dailyprogrammer&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/netsec\"&gt;/r/netsec&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/webdev\"&gt;/r/webdev&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/web_design\"&gt;/r/web_design&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/gamedev\"&gt;/r/gamedev&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/cscareerquestions\"&gt;/r/cscareerquestions&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/reverseengineering\"&gt;/r/reverseengineering&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/startups\"&gt;/r/startups&lt;/a&gt;&lt;/li&gt;\n&lt;li&gt;&lt;a href=\"/r/techsupport\"&gt;/r/techsupport&lt;/a&gt;&lt;/li&gt;\n&lt;/ul&gt;\n\n&lt;p&gt;&lt;strong&gt;&lt;a href=\"https://www.reddit.com/r/programming/wiki/faq#wiki_what_language_reddits_are_there.3F\"&gt;Specific languages&lt;/a&gt;&lt;/strong&gt;&lt;/p&gt;\n&lt;/div&gt;&lt;!-- SC_ON --&gt;",
    public_description_html: string; // "&lt;!-- SC_OFF --&gt;&lt;div class=\"md\"&gt;&lt;p&gt;Computer Programming&lt;/p&gt;\n&lt;/div&gt;&lt;!-- SC_ON --&gt;",
    id: string; // "2fwo",
    url: string; // "/r/programming/",
    created_utc: number; // 1141150769,
};

export class RedditSearchStream extends Stream<RedditSubreddit> {
    constructor(query: string) {
        super(async (cursor?: string, limit?: number, notify?: boolean) => {
            try {
                const response = await fetch(
                    `https://www.reddit.com/subreddits/search.json?q=${query}&include_over_18=on&${cursor ? "after=" + cursor : ""}`
                );
                if (!response.ok) throw new Error(await response.text());
                const page = (await response.json()) as RedditSubreddits;
                if (!page || !page.data || !page.data.children) throw new Error("No data in response");
                const subreddits: RedditSubreddit[] = [];
                for (const subreddit of page.data.children) {
                    if (subreddit.kind != "t5") continue;
                    subreddits.push(subreddit.data);
                }
                return { items: subreddits, cursor: page.data.after };
            } catch (e) {
                return error("Couldn't fetch page " + cursor + " for subreddit query " + query, e);
            }
        });
    }

    getItemKey(item: RedditSubreddit): string {
        return item.id;
    }
    getItemDate(item: RedditSubreddit): Date {
        return new Date(item.created_utc);
    }
}
