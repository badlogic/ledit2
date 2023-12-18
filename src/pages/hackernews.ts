import { LitElement, PropertyValueMap, TemplateResult, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { RedditSorting, RedditStream } from "../apis/reddit.js";
import { fixLinksAndVideos, renderError, dom, renderTopbar, closeButton } from "../app.js";
import { eyeOpenIcon, eyeClosedIcon, speechBubbleIcon, replyIcon } from "../utils/icons.js";
import { router } from "../utils/routing.js";
import { Store } from "../utils/store.js";
import { pageContainerStyle } from "../utils/styles.js";
import {
    HackerNewsComment,
    HackerNewsPost,
    HackerNewsSorting,
    HackerNewsStream,
    RawHackerNewsPost,
    getHackerNewsComments,
    getHackerNewsItem,
    rawToHackerNewsPost,
} from "../apis/hackernews.js";
import { StreamView } from "../utils/streamviews.js";
import { error, formatNumber, getTimeDifference } from "../utils/utils.js";
import { map } from "lit/directives/map.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";

@customElement("hackernews-post")
export class HackerNewsPostView extends LitElement {
    @property()
    post?: HackerNewsPost;

    @property()
    noDrillDown = false;

    @property()
    showContent = false;

    @property()
    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties);
        fixLinksAndVideos(this);
    }

    render() {
        const post = this.post;
        if (!post) return renderError("Post does not exist");

        return html`<div class="py-2 border-b border-divider flex flex-col cursor-pointer" @click=${() => {
            router.push("/hn/comments/" + post.id);
        }}>
            <div class="flex flex-col">
                <a href="${post.url}" class="px-4 text-black dark:text-white font-semibold">${post.title}</a>
                <div class="px-4 flex text-xs text-muted-fg gap-1 break-word">
                    <span>${formatNumber(post.points)} pts</span>
                    <span>•</span>
                    <a class="text-muted-fg" href="https://news.ycombinator.com/user?id=${post.author}">${post.author}</a>
                    <span>•</span>
                    <span>${getTimeDifference(post.createdAt * 1000)}
                </div>
            </div>
            ${this.showContent ? html`<div class="px-4">${unsafeHTML(post.content)}</div>` : nothing}
            <div class="px-4 flex gap-4 items-center -mb-1">
                <a href="/hn/comments/${post.id}" @click=${(ev: Event) => {
            if (this.noDrillDown) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
            }
        }} class="text-primary h-8 flex items-center gap-1 text-sm"><i class="icon w-4 h-4 fill-primary">${speechBubbleIcon}</i>${
            post.numComments
        }</a>
                <a href="https://news.ycombinator.com/item?id=${
                    post.id
                }" class="text-primary h-8 flex items-center gap-1"><i class="icon w-4 h-4 fill-primary">${replyIcon}</i><span>Reply</span></a>
            </div>
        </div>`;
    }
}

@customElement("hackernews-stream-view")
export class HackerNewsStreamView extends StreamView<HackerNewsPost> {
    constructor() {
        super();
        this.wrapItem = false;
    }

    renderItem(item: HackerNewsPost, polledItems: boolean): TemplateResult {
        return html`<hackernews-post .post=${item}></hackernews-post>`;
    }
}

@customElement("hackernews-page")
export class HackerNewsPage extends LitElement {
    @property()
    sorting: HackerNewsSorting;

    @property()
    hideSeen = false;

    constructor() {
        super();
        const params = router.getCurrentParams();
        this.sorting = (params?.get("sorting") as HackerNewsSorting) ?? "topstories";
        document.title = "ledit - hn/" + this.sorting;
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinksAndVideos(this);
    }

    render() {
        router.replaceUrl("/hn/" + this.sorting);

        const sortValues: { label: string; value: HackerNewsSorting }[] = [
            { label: "Top", value: "topstories" },
            { label: "New", value: "newstories" },
            { label: "Ask", value: "askstories" },
            { label: "Show", value: "showstories" },
            { label: "Jobs", value: "jobstories" },
        ];
        const buttons = html`<select-box
                class="pl-2 ml-auto rounded"
                .values=${sortValues}
                .selected=${this.sorting}
                .change=${(value: HackerNewsSorting) => (this.sorting = value)}
            ></select-box
            ><button class="-mr-2 w-10 h-10 flex items-center justify-center" @click=${() => (this.hideSeen = !this.hideSeen)}>
                <i class="icon w-5 h-5">${!this.hideSeen ? eyeOpenIcon : eyeClosedIcon}</i>
            </button>`;

        const stream = dom(
            html`<hackernews-stream-view .hideSeen=${this.hideSeen} .stream=${new HackerNewsStream(this.sorting)}></hackernews-stream-view>`
        );
        return html`<div class="${pageContainerStyle}">${renderTopbar("Hackernews", closeButton(), buttons)} ${stream}</div> `;
    }
}

@customElement("hackernews-comments-page")
export class HackerNewsCommentsPage extends LitElement {
    @property()
    isLoading = true;

    @property()
    error?: string;

    postId?: string;
    post?: HackerNewsPost;
    comments: HackerNewsComment[] = [];

    constructor() {
        super();
        this.postId = router.getCurrentParams()?.get("id");
        document.title = "ledit - comments";
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.load();
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        fixLinksAndVideos(this);
    }

    async load() {
        try {
            if (!this.postId) throw new Error();
            const rawPost = await getHackerNewsItem<RawHackerNewsPost>(this.postId);
            if (!rawPost) throw new Error();
            this.post = rawToHackerNewsPost(rawPost);
            this.requestUpdate();
            const comments = await getHackerNewsComments(this.post);
            if (comments instanceof Error) throw comments;
            this.comments = comments;
        } catch (e) {
            error("Couldn't load comments", e);
            this.error = "Couldn't load comments";
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        return html`<div class="${pageContainerStyle} overflow-auto">
            ${renderTopbar("Comments", closeButton())} ${this.error ? renderError(this.error) : nothing}
            ${this.post ? html`<hackernews-post .post=${this.post} .showContent=${true} .noDrillDown=${true}></hackernews-post>` : nothing}
            ${this.isLoading ? html`<div class="mt-12"><loading-spinner></loading-spinner></div>` : nothing}
            <div class="px-4 -mt-1">
                ${this.comments
                    ? map(
                          this.comments,
                          (comment) =>
                              html`<hackernews-comment .comment=${comment} .isRoot=${true} .opAuthor=${this.post?.author}></hackernews-comment>`
                      )
                    : nothing}
            </div>
        </div>`;
    }
}

@customElement("hackernews-comment")
export class HackerNewsCommentView extends LitElement {
    @property()
    comment?: HackerNewsComment;

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
        const comment = this.comment;
        if (!comment) return html`${nothing}`;
        const replies = comment.replies;
        const commentDom = dom(html`<div
            class="min-w-[300px] flex flex-col cursor-pointer ${this.isRoot ? "mt-4" : "mt-4 ml-2 pl-2 border-l border-divider"}"
        >
            <div class="text-xs flex items-center gap-1">
                <a class="font-semibold whitespace-nowrap ${
                    this.opAuthor == comment.author ? "text-primary" : "text-blue-400"
                }" href="https://news.ycombinator.com/user?id=${comment.author}"
                    >${comment.author}</span
                >
                <span class="text-muted-fg whitespace-nowrap">•</span>
                <span class="text-muted-fg whitespace-nowrap">${getTimeDifference(comment.createdAt * 1000)}</span>
                <span class="text-muted-fg whitespace-nowrap">•</span>
                <a href="${comment.url}" class="whitespace-nowrap text-muted-fg flex items-center"
                    ><i class="icon w-4 h-4 fill-muted-fg">${replyIcon}</i><span>Reply</span></a
                >
                <div id="numReplies" class="flex gap-1 items-center hidden">
                    <span class="text-muted-fg whitespace-nowrap">${replies ? "•" : ""}</span>
                    <span class="text-muted-fg whitespace-nowrap">${replies ? replies.length + " replies" : ""}</span>
                </div>
            </div>
            <div class="">${unsafeHTML(comment.content)}</div>
            <div id="replies">
                ${
                    replies
                        ? map(replies, (reply) => html`<hackernews-comment .comment=${reply} .opAuthor=${this.opAuthor}></hackernews-comment>`)
                        : nothing
                }
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
