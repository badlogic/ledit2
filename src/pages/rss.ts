import { LitElement, PropertyValueMap, TemplateResult, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { router } from "../utils/routing.js";
import { closeButton, dom, fixLinksAndVideos, onVisibleOnce, renderError, renderTopbar } from "../utils/ui-components.js";
import { eyeOpenIcon, eyeClosedIcon } from "../utils/icons.js";
import { pageContainerStyle, pageContentStyle } from "../utils/styles.js";
import { StreamView } from "../utils/streamviews.js";
import { Api, RssItem } from "../api.js";
import { RssFeed, Store } from "../utils/store.js";
import { RssStream } from "../apis/rss.js";
import { getTimeDifference } from "../utils/utils.js";
import { safeHTML } from "./reddit.js";
import { state } from "../appstate.js";

const favIcons = new Map<string, Promise<string[] | Error>>();

async function getFavIcon(domain: string) {
    if (favIcons.has(domain)) return favIcons.get(domain)!;
    const promise = Api.getFavIcons(domain);
    favIcons.set(domain, promise);
    return promise;
}

@customElement("rss-item")
export class RssItemView extends LitElement {
    @property()
    item?: RssItem;

    @property()
    expanded = false;

    @property()
    favIcon?: string;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        onVisibleOnce(
            this,
            () => {
                const seen = new Set<string>(Store.getSeen());
                seen.add(this.item!.id.toString());
                Store.setSeen(seen);
            },
            "0px",
            0
        );
        (async () => {
            if (!this.item) return;
            const domain = this.getBaseDomain(this.item.feed_url);
            const result = await getFavIcon(domain);
            this.favIcon = result instanceof Error ? undefined : result[0];
        })();
    }
    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        fixLinksAndVideos(this);
    }

    getBaseDomain(url: string): string {
        try {
            const parsedUrl = new URL(url);
            const parts = parsedUrl.hostname.split(".");
            if (parts.length > 2) {
                return parts.slice(-2).join("."); // Get the last two parts
            }
            return parsedUrl.hostname;
        } catch (error) {
            console.error("Invalid URL:", error);
            return "";
        }
    }

    render() {
        const item = this.item;
        if (!item) return renderError("RSS/Atom item does not exist");
        const collapse = Store.getCollapseSeen() && Store.getSeen().has(item.id.toString()) && !this.expanded;
        const domain = this.getBaseDomain(item.feed_url);

        if (collapse)
            return html`<div class="py-4 border-b border-divider flex flex-col cursor-pointer" @click=${() => (this.expanded = true)}>
            <div class="flex flex-col gap-2">
                <div class="px-4 flex text-xs text-muted-fg gap-1 break-word">
                ${
                    this.favIcon
                        ? html`<img
                              class="w-5 h-5 rounded-sm mr-1"
                              src="${this.favIcon}"
                              @error=${(event: Event) => {
                                  const imgElement = event.target as HTMLImageElement;
                                  imgElement.style.display = "none";
                              }}
                          />`
                        : nothing
                }
                    <span class="text-muted-fg">${item.title}</a>
                </div>
            </div>
        </div>`;

        return html`<div class="py-4 border-b border-divider flex flex-col gap-2 cursor-pointer" @click=${() => {
            window.open(this.item?.link, "_blank");
        }}>
            <div class="flex flex-col gap-1">
                <div class="px-4 flex items-center text-xs text-muted-fg gap-1 break-word">
                    ${
                        this.favIcon
                            ? html`<img
                                  class="w-5 h-5 rounded-sm mr-1"
                                  src="${this.favIcon}"
                                  @error=${(event: Event) => {
                                      const imgElement = event.target as HTMLImageElement;
                                      imgElement.style.display = "none";
                                  }}
                              />`
                            : nothing
                    }
                    <span>${domain}</span>
                    <span>•</span>
                    <span>${getTimeDifference(new Date(item.published))}
                </div>
                <a href="${item.link}" class="${collapse ? "text-muted-fg" : "text-black dark:text-white"} px-4 font-semibold">${item.title}</a>
            </div>
            <div class="px-4 flex flex-col sm:flex-row gap-2 items-center">
                ${item.image.length > 0 ? html`<img class="max-h-[300px] sm:max-w-[150px] rounded" src="${item.image}" />` : nothing}
                <div class="line-clamp-5 text-sm">
                    ${safeHTML(item.content)}
                </div>
            </div>
        </div>`;
    }
}

@customElement("rss-stream-view")
export class RssStreamView extends StreamView<RssItem> {
    @property()
    hideSeen = false;

    constructor() {
        super();
        this.wrapItem = false;
    }

    renderItem(item: RssItem, polledItems: boolean): TemplateResult {
        let hide = "";
        if (this.hideSeen) {
            const seen = Store.getSeen();
            if (seen.has(item.id.toString())) hide = "hidden";
        }
        return html`<rss-item class="${hide}" .item=${item}></rss-item>`;
    }
}

@customElement("rss-page")
export class RssPage extends LitElement {
    @property()
    hideSeen = false;

    @property()
    urls: string[] = [];

    constructor() {
        super();
        const params = router.getCurrentParams();
        const id = decodeURIComponent(params?.get("id") ?? "");
        const feed = Store.getRssFeeds()?.find((feed) => feed.label == id);
        this.urls = feed?.feeds ?? (id.split("|").length > 1 ? id.split("|") : [id]);
        document.title = "ledit - rss/" + (feed?.label ?? params?.get("id"));
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinksAndVideos(this);
    }

    render() {
        const params = router.getCurrentParams();
        router.replaceUrl("/rss/" + params?.get("id"));

        const buttons = html`<button
            class="ml-auto -mr-2 w-10 h-10 flex items-center justify-center"
            @click=${() => (this.hideSeen = !this.hideSeen)}
        >
            <i class="icon w-5 h-5">${!this.hideSeen ? eyeOpenIcon : eyeClosedIcon}</i>
        </button>`;

        const id = decodeURIComponent(params?.get("id") ?? "");
        const feed = Store.getRssFeeds()?.find((feed) => feed.label == id || feed.feeds.join("|") == id);
        const stream = dom(html`<rss-stream-view .hideSeen=${this.hideSeen} .stream=${new RssStream(this.urls)}></hackernews-stream-view>`);
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar(feed ? feed.label : "RSS/Atom", closeButton(), buttons)}
            <div class="${pageContentStyle}">${stream}</div>
        </div> `;
    }
}

@customElement("rssfeed-editor")
export class RssFeedEditor extends LitElement {
    @property()
    isLoading = false;

    @property()
    error?: string;

    @property()
    label = "";

    @property()
    feeds = "";

    rssFeed?: RssFeed;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        const params = router.getCurrentParams();
        if (params?.get("label")) {
            const label = decodeURIComponent(params.get("label")!);
            const feed = Store.getRssFeeds()!.find((feed) => feed.label == label);
            if (!feed) {
                this.error = "Rss feed '" + label + "' does not exist";
            } else {
                this.rssFeed = feed;
            }
        }
    }

    updated() {
        fixLinksAndVideos(this);
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.handleInput(false);
    }

    render() {
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar(this.rssFeed ? "Edit RSS/Atom Feed" : "New RSS/Atom feed", closeButton())}
            <div class="${pageContentStyle} gap-4">
                ${this.error ? renderError(this.error) : nothing}
                <div class="flex flex-col gap-1 px-4">
                    <span class="text-muted-fg font-semibold text-sm">Label</span>
                    <input
                        id="label"
                        class="rounded bg-transparent ring-1 ring-divider outline-none px-2 py-1"
                        id="label"
                        @input=${() => this.handleInput()}
                        placeholder="RSS/Atom feed label shown on main page"
                        value="${this.rssFeed?.label}"
                    />
                </div>
                <div class="flex flex-col gap-1 px-4">
                    <span class="text-muted-fg font-semibold text-sm">RSS/Atom feeds</span>
                    <textarea
                        id="subreddits"
                        class="rounded bg-transparent ring-1 ring-divider outline-none resize-none p-2"
                        @input=${() => this.handleInput()}
                        rows="5"
                        placeholder="List of RSS/Atom feed URLs, one per line"
                    >
${this.rssFeed?.feeds.join("\n")}</textarea
                    >
                </div>
                <button
                    class="self-start btn ml-4"
                    ?disabled=${this.label.length == 0 || this.feeds.length == 0 || this.error}
                    @click=${() => this.save()}
                >
                    Save
                </button>
            </div>
        </div>`;
    }

    handleInput(checkExists = true) {
        const labelElement = this.querySelector<HTMLInputElement>("#label")!;
        const subredditsElement = this.querySelector<HTMLTextAreaElement>("#subreddits")!;

        this.label = labelElement.value;
        this.feeds = subredditsElement.value;

        if (checkExists && this.label != this.rssFeed?.label) {
            if (Store.getRssFeeds()!.some((feed) => feed.label == this.label)) {
                this.error = `RSS/Atom feed with label '${this.label}' already exists`;
            } else {
                this.error = undefined;
            }
        }
    }

    save() {
        if (this.rssFeed) {
            this.rssFeed.label = this.label;
            this.rssFeed.feeds = this.feeds.split("\n");
            Store.setSubreddits(Store.getSubreddits()!);
        } else {
            const newFeed = { label: this.label, feeds: this.feeds.split("\n") };
            Store.setRssFeeds([...Store.getRssFeeds()!, newFeed]);
        }
        state.update("rssfeeds", Store.getRssFeeds()!);
        router.pop();
    }
}
