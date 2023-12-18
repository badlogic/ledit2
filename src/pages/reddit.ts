import { customElement, property } from "lit/decorators.js";
import { StreamView } from "../utils/streamviews.js";
import { RedditComment, RedditComments, RedditPost, RedditSearchStream, RedditSorting, RedditStream, RedditSubreddit } from "../apis/reddit.js";
import { LitElement, PropertyValueMap, TemplateResult, html, nothing } from "lit";
import { router } from "../utils/routing.js";
import { formatDate, formatNumber, getTimeDifference, unescapeHtml } from "../utils/utils.js";
import { pageContainerStyle } from "../utils/styles.js";
import {
    closeButton,
    dom,
    fixLinksAndVideos,
    getScrollParent,
    isMobileBrowser,
    isSafariBrowser,
    onVisibilityChange,
    onVisibleOnce,
    renderError,
    renderTopbar,
} from "../app.js";
import { closeIcon, eyeClosedIcon, eyeOpenIcon, infoIcon, plusIcon, replyIcon, searchIcon, speechBubbleIcon } from "../utils/icons.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { map } from "lit/directives/map.js";
import DOMPurify from "dompurify";
import videojs from "video.js";
import { Store } from "../utils/store.js";

const postDomCache = new Map<string, HTMLElement>();
let lastPostBoundingRect: DOMRect | undefined;

function renderRedditTextContent(content?: string) {
    if (!content) return html`${nothing}`;
    return html`<div class="flex flex-col gap-2">
        <div id="selfpost">${unsafeHTML(unescapeHtml(content))}</div>
    </div>`;
}

export function onAddedToDom(element: Element, callback: () => void) {
    const checkForInsertion = () => {
        if (element.isConnected) {
            callback();
        } else {
            requestAnimationFrame(checkForInsertion);
        }
    };
    checkForInsertion();
}

export function onTapped(element: HTMLElement, callback: (ev: Event) => void) {
    let touchStartY = 0;

    element.addEventListener("touchstart", (event) => {
        touchStartY = event.touches[0].clientY;
    });

    element.addEventListener("touchend", (event) => {
        if (Math.abs(event.changedTouches[0].clientY - touchStartY) < 16) {
            callback(event);
        }
    });
}

export function safeHTML(uHtml: string | null): TemplateResult {
    if (!uHtml) uHtml = "";
    uHtml = DOMPurify.sanitize(uHtml, { ADD_ATTR: ["x-id"], ADD_TAGS: ["video-js", "iframe"] });
    const stringArray: any = [uHtml];
    stringArray.raw = [uHtml];
    return html(stringArray as TemplateStringsArray);
}

export function intersectsViewport(element: Element | null) {
    if (element == null) return false;
    var rect = element.getBoundingClientRect();
    var windowHeight = window.innerHeight || document.documentElement.clientHeight;
    var windowWidth = window.innerWidth || document.documentElement.clientWidth;
    var verticalVisible = rect.top <= windowHeight && rect.bottom >= 0;
    var horizontalVisible = rect.left <= windowWidth && rect.right >= 0;
    return verticalVisible && horizontalVisible;
}

const listenersToRemoveOnPageClose: { event: string; listener: () => void }[] = [];
export function enableYoutubePause(videoElement: HTMLIFrameElement) {
    const youtubePause = () => {
        if (videoElement && !intersectsViewport(videoElement)) {
            videoElement.contentWindow?.postMessage('{"event":"command","func":"' + "pauseVideo" + '","args":""}', "*");
        }
    };
    listenersToRemoveOnPageClose.push({ event: "scroll", listener: youtubePause });
    document.addEventListener("scroll", youtubePause);
}

@customElement("video-player")
export class VideoPlayer extends LitElement {
    @property()
    videoDesc?: { width: number; height: number; urls: string[] };

    @property()
    loop = false;

    observer?: IntersectionObserver;

    disableAutoPause = false;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        const videoDiv = this.querySelector("video-js")! as HTMLElement;
        if ((videoDiv as any).player) {
            (videoDiv as any).player.dispose()(videoDiv as any).player = null;
        }
        this.setupVideoPlayer();
    }

    setupVideoPlayer() {
        const videoDiv = this.querySelector("video-js")! as HTMLElement;
        if (!videoDiv) return;
        if ((videoDiv as any).player) return;
        const player = videojs(videoDiv, {});
        (videoDiv as any).player = player;

        // Toggle pause/play on click
        const togglePlay = function (ev: Event) {
            if ((ev.target as HTMLElement).tagName != "VIDEO") return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
        };
        onTapped(this, togglePlay);
        this.observer = onVisibilityChange(
            this,
            () => {},
            () => {
                if (this.disableAutoPause) return;
                if (!player.paused()) {
                    player.pause();
                }
            }
        );
    }

    connectedCallback(): void {
        super.connectedCallback();
    }

    render() {
        if (!this.videoDesc) return html`${nothing}`;
        return dom(html`
            <div class="flex justify-center w-full cursor-pointer" style="position: relative; display: block;">
                <video-js
                    controls
                    class="video-js w-full h-auto max-h-[70vh]"
                    style="aspect-ratio: ${this.videoDesc.width / this.videoDesc.height};"
                    ?loop=${this.loop}
                    data-setup="{}"
                    playsinline
                >
                    ${this.videoDesc.urls.map((url) => html`<source src="${unescapeHtml(url)}" />`)}
                </video-js>
            </div>
        `)[0];
    }

    dispose() {
        this.observer?.unobserve(this);
        (this.querySelector("video-js") as any)?.player.dispose();
    }
}

@customElement("reddit-stream-view")
export class RedditStreamView extends StreamView<RedditPost> {
    @property()
    hideSeen = false;

    constructor() {
        super();
        this.wrapItem = false;
    }

    renderItem(item: RedditPost, polledItems: boolean): TemplateResult {
        let hide = "";
        if (this.hideSeen) {
            const seen = Store.getSeen();
            if (seen.has(item.data.id)) hide = "hidden";
        }
        const postDom = dom(html`<div>
            <div class="${hide} py-4 border-b border-divider">
                <reddit-post .post=${item}></reddit-post>
            </div>
        </div>`)[0];
        postDomCache.set(item.data.id, postDom.children[0] as HTMLElement);
        return html`${postDom}`;
    }
}

@customElement("reddit-post")
export class RedditPostView extends LitElement {
    @property()
    post?: RedditPost;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinksAndVideos(this);
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        onVisibleOnce(
            this,
            () => {
                const seen = new Set<string>(Store.getSeen());
                seen.add(this.post!.data.id);
                Store.setSeen(seen);
            },
            "0px",
            0
        );
    }

    renderContent(redditPost: RedditPost): TemplateResult | HTMLElement | undefined {
        const post = redditPost.data;

        // Self post, show text, dim it, cap vertical size, and make it expand on click.
        if (post.is_self) {
            const selfContent = dom(html`<div class="px-4 flex flex-col">${renderRedditTextContent(post.selftext_html)}</div>`)[0];
            onVisibleOnce(selfContent, () => {
                const maxHeight = 150;
                if (selfContent.clientHeight > 150) {
                    const selfPost = selfContent.querySelector<HTMLElement>("#selfpost")!;
                    selfPost.classList.add("overflow-hidden");
                    selfPost.classList.add("text-muted-fg");
                    selfPost.style.maxHeight = maxHeight + "px";
                    const showMore = dom(
                        html`<span class="text-primary text-center -mt-6 bg-[#fff]/70 dark:bg-[#111]/50 backdrop-blur-[8px]">Show more</span>`
                    )[0];
                    selfContent.append(showMore);
                    let expanded = false;
                    const expand = (ev: Event) => {
                        ev.stopPropagation();
                        selfPost.classList.toggle("text-muted-fg");
                        showMore.classList.toggle("hidden");
                        selfPost.style.maxHeight = !expanded ? "" : maxHeight + "px";
                        expanded = !expanded;
                    };
                    selfContent.addEventListener("click", expand);
                }
            });
            return selfContent;
        }

        const postsWidth = document.body.clientWidth > 640 ? 640 : document.body.clientWidth;
        const showGallery = (ev: Event, imageUrls: string[]) => {
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const gallery = dom(html`<image-gallery
                .images=${imageUrls.map((url) => {
                    return { url };
                })}
            ></image-gallery>`)[0];
            router.pushModal(gallery);
        };

        // Gallery FIXME label isn't properly aligned
        if (post.is_gallery && post.media_metadata && post.gallery_data) {
            type image = { x: number; y: number; u: string };
            const images: image[] = [];
            for (const imageKey of post.gallery_data.items) {
                if (post.media_metadata[imageKey.media_id].p) {
                    let image: image | null = null;
                    for (const img of post.media_metadata[imageKey.media_id].p) {
                        image = img;
                        if (img.x > postsWidth) break;
                    }
                    if (image) images.push(image);
                }
            }
            const imageUrls = images.map((img) => unescapeHtml(img.u)!);
            const imgDom = dom(html`<div class="relative" @click=${(ev: Event) => showGallery(ev, imageUrls)}>
                <img class="md:px-4 max-h-[50vh]" src="${imageUrls[0]}" />
                <div class="absolute left-0 bottom-0 disable-pointer-events text-xs p-2 bg-[#111]/80 text-white">${imageUrls.length} images</div>
            </div>`)[0];
            return imgDom;
        }

        // Reddit hosted video
        if (post.secure_media && post.secure_media.reddit_video) {
            const embed = { width: post.secure_media.reddit_video.width, height: post.secure_media.reddit_video.height, urls: [] as string[] };
            if (post.secure_media.reddit_video.dash_url) embed.urls.push(unescapeHtml(post.secure_media.reddit_video.dash_url)!);
            if (post.secure_media.reddit_video.hls_url) embed.urls.push(unescapeHtml(post.secure_media.reddit_video.hls_url)!);
            if (post.secure_media.reddit_video.fallback_url) embed.urls.push(unescapeHtml(post.secure_media.reddit_video.fallback_url)!);
            // return renderVideo(embed, false);
            return html`<video-player class="w-full md:px-4" .videoDesc=${embed} .loop=${false}></video-player>`;
        }

        // External embed like YouTube Vimeo
        if (post.secure_media_embed && post.secure_media_embed.media_domain_url) {
            const embed = post.secure_media_embed;
            const embedWidth = postsWidth;
            const embedHeight = Math.floor((embed.height / embed.width) * embedWidth);
            if (embed.content.includes("iframe")) {
                const embedUrl = unescapeHtml(
                    embed.content
                        .replace(`width="${embed.width}"`, "")
                        .replace(`height="${embed.height}"`, "")
                        .replace("position:absolute;", "")
                        .replace(";iframe", `;iframe class="w-full h-full" `)
                );
                const embedHtml = safeHTML(embedUrl!);
                let embedDom = dom(html`<div class="md:px-4 w-full" style="aspect-ratio: ${embedWidth}/${embedHeight};">${embedHtml}</div>`)[0];
                // Make YouTube videos stop if they scroll out of frame.
                if (embed.content.includes("youtube")) {
                    // Pause when out of view
                    const videoElement = embedDom.querySelector("iframe") as HTMLIFrameElement;
                    enableYoutubePause(videoElement);
                    return embedDom;
                }
            } else {
                return dom(
                    html`<div class="md:px-4 w-full" style="aspect-ratio: ${embedWidth}/${embedHeight};">
                        <iframe width="${embedWidth}" height="${embedHeight}" src="${unescapeHtml(embed.media_domain_url)}"></iframe>
                    </div>`
                )[0];
            }
        }

        // Plain old .gif
        if (post.url.endsWith(".gif")) {
            return dom(
                html`<img
                        class="md:px-4 max-h-[50vh]"
                        src="${unescapeHtml(post.url)}"
                        @click=${(ev: Event) => showGallery(ev, [unescapeHtml(post.url)])}
                    />
                    />`
            )[0];
        }

        // Image, pick the one that's one size above the current posts width so pinch zooming
        // in shows more pixels.
        if (post.preview && post.preview.images && post.preview.images.length > 0) {
            let image: { url: string; width: number; height: number } | null = null;
            for (const img of post.preview.images[0].resolutions) {
                image = img;
                if (img.width >= postsWidth) break;
            }
            if (!image) return document.createElement("div");
            if (!post.preview.reddit_video_preview?.fallback_url)
                return html`<img
                    class="md:px-4 max-h-[50vh]"
                    src="${unescapeHtml(image.url)}"
                    @click=${(ev: Event) => showGallery(ev, [unescapeHtml(image!.url)])}
                />`;
            const video = { width: post.preview.reddit_video_preview.width, height: post.preview.reddit_video_preview.height, urls: [] as string[] };
            if (post.preview.reddit_video_preview.dash_url) video.urls.push(unescapeHtml(post.preview.reddit_video_preview.dash_url)!);
            if (post.preview.reddit_video_preview.hls_url) video.urls.push(unescapeHtml(post.preview.reddit_video_preview.hls_url)!);
            if (post.preview.reddit_video_preview.fallback_url) video.urls.push(unescapeHtml(post.preview.reddit_video_preview.fallback_url)!);
            //return renderVideo(video, post.preview.reddit_video_preview.is_gif);
            return html`<video-player class="w-full md:px-4" .videoDesc=${video} .loop=${post.preview.reddit_video_preview.is_gif}></video-player>`;
        }

        // Fallback to thumbnail which is super low-res.
        const missingThumbnailTags = new Set<String>(["self", "nsfw", "default", "image", "spoiler"]);
        const thumbnailUrl = post.thumbnail.includes("://") ? post.thumbnail : "";
        if (post.thumbnail && !missingThumbnailTags.has(post.thumbnail)) {
            return html`
                <img
                    class="md:px-4 max-h-[50vh]"
                    src="${unescapeHtml(thumbnailUrl)}"
                    @click=${(ev: Event) => showGallery(ev, [unescapeHtml(thumbnailUrl)])}
                />
            `;
        }
        return undefined;
    }

    render() {
        if (!this.post) return html`<div class="mt-12"><loading-spinner></loading-spinner></div>`;
        const params = router.getCurrentParams();
        const post = this.post.data;
        const content = this.renderContent(this.post);

        return html`<div class="flex flex-col ${content ? "gap-1" : ""} cursor-pointer" @click=${(ev: Event) => {
            this.showComments(ev, true);
        }}>
            <div class="flex flex-col ${content ? "mb-2" : ""}">
                <a href="${post.url}" class="px-4 text-black dark:text-white font-semibold">${unescapeHtml(post.title)}</a>
                <div class="px-4 flex text-xs text-muted-fg gap-1 break-word">
                    <span>${formatNumber(post.score)} pts</span>
                    <span>•</span>
                    ${
                        post.subreddit != params?.get("subreddit")
                            ? html`<a href="/r/${post.subreddit}" class="text-muted-fg">r/${post.subreddit}</a><span>•</span>`
                            : nothing
                    }
                    <a class="text-muted-fg" href="https://old.reddit.com/u/${post.author}">${post.author}</a>
                    <span>•</span>
                    <span>${getTimeDifference(post.created_utc * 1000)}
                </div>
            </div>
            ${content ? html`<div class="flex items-center justify-center w-full">${content}</div>` : nothing}
            <div class="px-4 flex gap-4 items-center -mb-2 text-sm">
                <a href="/r/comments${post.permalink}" @click=${(ev: Event) =>
            this.showComments(ev)} class="text-primary h-8 flex items-center gap-1">
                    <i class="icon w-4 h-4 fill-primary">${speechBubbleIcon}</i>${post.num_comments}
                </a>
                <a href="https://old.reddit.com/r/${post.subreddit + "/comments/" + post.id}" class="text-primary h-8 flex items-center gap-1">
                    <i class="icon w-4 h-4 fill-primary">${replyIcon}</i><span>Reply</span>
                </a>
            </div>
        </div>`;
    }

    showComments(ev: Event, push = false) {
        console.log(this.getBoundingClientRect());
        lastPostBoundingRect = this.getBoundingClientRect();

        if (push && !this.querySelector("video-js")) {
            router.push("/r/comments" + this.post?.data.permalink);
            return;
        }
    }
}

@customElement("reddit-page")
export class RedditPage extends LitElement {
    subreddit?: string;

    @property()
    sorting: RedditSorting;

    @property()
    hideSeen = false;

    constructor() {
        super();
        const params = router.getCurrentParams();
        this.subreddit = params?.get("subreddit");
        this.sorting = (params?.get("sorting") as RedditSorting) ?? "hot";
        document.title = "ledit - r/" + this.subreddit;
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinksAndVideos(this);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        const streamView = this.querySelector("reddit-stream-view") as RedditStreamView;
        for (const page of streamView.renderedPages) {
            for (const player of Array.from(page.container.querySelectorAll("video-js"))) {
                if ((player as any).player) {
                    (player as any).player.dispose();
                }
            }
        }
        postDomCache.clear();
        for (const listener of listenersToRemoveOnPageClose) {
            document.removeEventListener(listener.event, listener.listener);
        }
    }

    render() {
        if (!this.subreddit) return html`<div>${renderError("Whoops, this subreddit doesn't exist")}</div>`;

        router.replaceUrl("/r/" + this.subreddit + "/" + this.sorting);

        const sortValues: { label: string; value: RedditSorting }[] = [
            { label: "Hot", value: "hot" },
            { label: "New", value: "new" },
            { label: "Rising", value: "rising" },
            { label: "Top today", value: "top-today" },
            { label: "Top week", value: "top-week" },
            { label: "Top month", value: "top-month" },
            { label: "Top year", value: "top-year" },
            { label: "Top all time", value: "top-alltime" },
        ];
        const buttons = html`<select-box
                class="pl-2 ml-auto rounded"
                .values=${sortValues}
                .selected=${this.sorting}
                .change=${(value: RedditSorting) => (this.sorting = value)}
            ></select-box
            ><button class="-mr-2 w-10 h-10 flex items-center justify-center" @click=${() => (this.hideSeen = !this.hideSeen)}>
                <i class="icon w-5 h-5">${!this.hideSeen ? eyeOpenIcon : eyeClosedIcon}</i>
            </button>`;

        const stream = dom(
            html`<reddit-stream-view .hideSeen=${this.hideSeen} .stream=${new RedditStream(this.subreddit, this.sorting)}></reddit-stream-view>`
        );

        const subreddit = Store.getSubreddits()!.find((sub) => sub.subreddits.join("+") == this.subreddit);

        return html`<div class="${pageContainerStyle}">
            ${renderTopbar("r/" + (subreddit ? subreddit.label : this.subreddit), closeButton(), buttons)} ${stream}
        </div> `;
    }
}

@customElement("reddit-comments-page")
export class RedditCommentsPage extends LitElement {
    @property()
    isLoading = true;

    @property()
    error?: string;

    permalink: string;
    post?: RedditPost;
    postDom?: { originalParent: HTMLElement; postDom: HTMLElement };
    comments: RedditComment[] = [];

    constructor() {
        super();
        this.permalink = RedditCommentsPage.getPermalinkFromHref();
        document.title = "ledit - comments";
        const postId = this.permalink.split("/")[3];
        const postDom = postDomCache.get(postId);
        if (postDom) {
            this.postDom = { originalParent: postDom.parentElement as HTMLElement, postDom: postDom };
        }
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.load();
        if (this.postDom && lastPostBoundingRect && lastPostBoundingRect.top < 0) {
            getScrollParent(this)!.scrollTop = -lastPostBoundingRect.top - (isMobileBrowser() && isSafariBrowser() ? -40 : 0);
        } else {
            getScrollParent(this)!.scrollTop = 0;
        }
        lastPostBoundingRect = undefined;
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        fixLinksAndVideos(this);
    }

    disconnectedCallback(): void {
        if (this.postDom) {
            this.postDom.originalParent.append(this.postDom.postDom);
            setTimeout(() => {
                const player = this.postDom?.postDom.querySelector<VideoPlayer>("video-player");
                if (player) player.disableAutoPause = false;
            }, 1000);
        }
    }

    async load() {
        const commentsUrl = "https://www.reddit.com/" + this.permalink + ".json?limit=15000";
        try {
            const response = await fetch(commentsUrl);
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (data.length < 2) return new Error("Could not load comments for " + this.permalink);
            if (!data[0] || !data[0].data || !data[0].data.children || !data[0].data.children[0])
                return new Error("Could not load comments for " + this.permalink);
            const post = data[0].data.children[0] as RedditPost;
            const redditComments = data[1] as RedditComments;
            if (!redditComments || !redditComments.data || !redditComments.data.children) {
                return new Error(`Could not load comments.`);
            }

            const comments: RedditComment[] = [];
            for (const comment of redditComments.data.children) {
                if (comment.data.author == undefined) {
                    continue;
                }
                comments.push(comment);
            }
            if (!this.postDom) this.post = post;
            this.comments = comments;
        } catch (e) {
            this.error = "Couldn't load comments";
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        const player = this.postDom?.postDom.querySelector<VideoPlayer>("video-player");
        if (player) {
            player.disableAutoPause = true;
        }
        return html`<div class="${pageContainerStyle} overflow-auto -mt-4 mb-4">
            ${renderTopbar("Comments", closeButton())} ${this.error ? renderError(this.error) : nothing}
            ${this.postDom ? this.postDom.postDom : nothing}
            ${!this.postDom && this.post ? html`<reddit-post class="mt-4 pb-4 border-b border-divider" .post=${this.post}></reddit-post>` : nothing}
            ${this.isLoading
                ? html`<div class="mt-4 flex items-center justify-center gap-2">
                      <loading-spinner></loading-spinner><span>Loading comments</span>
                  </div>`
                : nothing}
            <div class="px-4">
                ${this.comments
                    ? map(
                          this.comments,
                          (comment) => html`<reddit-comment .comment=${comment} .isRoot=${true} .opAuthor=${this.post?.data.author}></reddit-comment>`
                      )
                    : nothing}
            </div>
            ${this.postDom && lastPostBoundingRect && lastPostBoundingRect.top < 0 ? html`<div class="w-full h-screen"></div>` : nothing}
        </div>`;
    }

    static getPermalinkFromHref() {
        const tokens = location.pathname.split("/");
        tokens.shift();
        tokens.shift();
        tokens.shift();
        return tokens.join("/");
    }
}

@customElement("reddit-comment")
export class RedditCommentView extends LitElement {
    @property()
    comment?: RedditComment;

    @property()
    parentLink?: string;

    @property()
    isRoot = false;

    @property()
    opAuthor?: string;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        fixLinksAndVideos(this);
    }

    render() {
        let redditComment = this.comment;
        if (!redditComment) return html`${nothing}`;
        if (redditComment.kind == "more") {
            return html`<a href="https://www.reddit.com${this.parentLink}" class="flex items-center gap-1"> More replies on Reddit </a>`;
        }
        const comment = redditComment.data;
        const replies = comment.replies != undefined && comment.replies != "" ? comment.replies : undefined;
        if ((comment.replies = "")) {
            console.log("wat");
        }
        const commentDom = dom(html`<div
            class="min-w-[300px] flex flex-col cursor-pointer ${this.isRoot ? "mt-4" : "mt-4 ml-2 pl-2 border-l border-divider"}"
        >
            <div class="text-xs flex items-center gap-1">
                <a
                    href="https://old.reddit.com/u/${comment.author}"
                    class="font-semibold whitespace-nowrap ${this.opAuthor == comment.author ? "text-primary" : ""}"
                    >${comment.author}</a
                >
                <span class="text-muted-fg whitespace-nowrap">•</span>
                <span class="text-muted-fg whitespace-nowrap">${getTimeDifference(comment.created_utc * 1000)}</span>
                <span class="text-muted-fg whitespace-nowrap">•</span>
                <span class="text-muted-fg whitespace-nowrap">${formatNumber(comment.score)} pts</span>
                <span class="text-muted-fg whitespace-nowrap">•</span>
                <a href="https://old.reddit.com/${comment.permalink}" class="whitespace-nowrap text-muted-fg flex items-center"
                    ><i class="icon w-4 h-4 fill-muted-fg">${replyIcon}</i><span>Reply</span></a
                >
                <div id="numReplies" class="flex gap-1 items-center hidden">
                    <span class="text-muted-fg whitespace-nowrap">${replies ? "•" : ""}</span>
                    <span class="text-muted-fg whitespace-nowrap">${replies ? replies.data.children.length + " replies" : ""}</span>
                </div>
            </div>
            <div class="">${renderRedditTextContent(comment.body_html)}</div>
            <div id="replies">
                ${replies
                    ? map(
                          replies.data.children,
                          (reply) =>
                              html`<reddit-comment .comment=${reply} .parentLink=${comment.permalink} .opAuthor=${this.opAuthor}></reddit-comment>`
                      )
                    : nothing}
            </div>
        </div>`)[0];
        const repliesDom = commentDom.querySelector("#replies");
        const numRepliesDom = commentDom.querySelector("#numReplies");
        commentDom.addEventListener("click", (ev) => {
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            repliesDom!.classList.toggle("hidden");
            numRepliesDom!.classList.toggle("hidden");
        });
        return commentDom;
    }
}

@customElement("subreddit-view")
export class SubredditView extends LitElement {
    @property()
    subreddit?: RedditSubreddit;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties);
        fixLinksAndVideos(this);
    }

    render() {
        const sub = this.subreddit;
        if (!sub) return html`${nothing}`;

        const inBookmark = Store.getSubreddits()?.some((other) => other.subreddits.includes(sub.url.replaceAll("/r/", "")));

        return html`<div class="w-full p-4 border-b border-divider flex">
            <div class="w-full flex flex-col">
                <div class="w-full flex items-center">
                    <a href="${sub.url}" class="truncate">${sub.title}</a>
                    ${inBookmark
                        ? nothing
                        : html`<button class="ml-auto -mr-2 w-10 h-10 flex items-center justify-center" @click=${() => this.newSubreddit()}>
                              <i class="icon w-6 h-6 fill-primary">${plusIcon}</i>
                          </button>`}
                </div>
                <div class="flex gap-2 text-xs text-muted-fg">
                    <span class="flex gap-2 text-xs text-muted-fg">${sub.url.substring(1)}</span>
                    <span>${formatNumber(sub.subscribers)} subscribers</span>
                    <span>${getTimeDifference(sub.created_utc * 1000)}</span>
                </div>
                ${renderRedditTextContent(sub.public_description_html)}
            </div>
        </div>`;
    }

    newSubreddit() {
        const newSubreddit = { label: this.subreddit!.title, subreddits: [this.subreddit!.url.replaceAll("/r/", "")] };
        const subs = Store.getSubreddits()!;
        subs.unshift(newSubreddit);
        Store.setSubreddits(subs);
        this.requestUpdate();
    }
}

@customElement("reddit-search-stream-view")
export class RedditSearchStreamView extends StreamView<RedditSubreddit> {
    constructor() {
        super();
        this.wrapItem = false;
    }

    renderItem(item: RedditSubreddit, polledItems: boolean): TemplateResult {
        return html`<subreddit-view .subreddit=${item}></subreddit-view>`;
    }
}

@customElement("subreddit-search")
export class SubredditSearchPage extends LitElement {
    @property()
    results: any[] = [];

    @property()
    initialQuery = "";

    constructor() {
        super();
        const params = router.getCurrentParams();
        if (params?.has("query")) {
            this.initialQuery = params.get("query")!;
        }
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        if (this.initialQuery.length > 0) {
            this.handleSearch();
        }
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties);
        fixLinksAndVideos(this);
    }

    render() {
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar("Search Subreddits", closeButton())}
            <div class="w-full px-4 pt-4">
                <div class="search flex gap-2 px-4">
                <i class="icon w-5 h-5">${searchIcon}</i>
                <input id="search" class="flex-grow" placeholder="Topics, keywords, ..." @input=${() => this.handleSearch()} value=${
            this.initialQuery
        }/>
                <button><i class="ml-auto icon w-5 h-5" @click=${() => {
                    this.querySelector<HTMLInputElement>("#search")!.value = "";
                    this.handleSearch();
                }}>${closeIcon}</i></div>
            </div>
            <div id="results"></div>
            <div class="pt-4"><loading-spinner class="hidden"></loading-spinner></div>
        </div>`;
    }

    timeoutId = 0;
    handleSearch() {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(async () => {
            this.querySelector("loading-spinner")?.classList.remove("hidden");
            await this.search();
            this.querySelector("loading-spinner")?.classList.add("hidden");
        }, 200) as any as number;
    }

    search() {
        const results = this.querySelector("#results")!;
        const query = (this.querySelector<HTMLInputElement>("#search")?.value ?? "").trim();
        if (query.length == 0) {
            results.innerHTML = "";
            router.replaceUrl("/search/reddit");
            return;
        }

        const stream = dom(html`<reddit-search-stream-view .stream=${new RedditSearchStream(query)}></reddit-search-stream-view>`)[0];
        results.innerHTML = "";
        results.append(stream);

        router.replaceUrl("/search/reddit/" + encodeURIComponent(query));
    }
}
