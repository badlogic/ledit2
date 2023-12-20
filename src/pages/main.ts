import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Api } from "../api.js";
import { SubredditView, closeButton, fixLinksAndVideos, renderError, renderTopbar } from "../app.js";
import { i18n } from "../utils/i18n.js";
import { router } from "../utils/routing.js";
import { pageContainerStyle, pageContentStyle } from "../utils/styles.js";
import { favIcon, linkIcon, minusIcon, pencilIcon, plusIcon, searchIcon, settingsIcon } from "../utils/icons.js";
import { map } from "lit/directives/map.js";
import { Store, Subreddit } from "../utils/store.js";
import { state } from "../appstate.js";
import { HackerNewsSorting } from "../apis/hackernews.js";
import { RedditSubreddit } from "../apis/reddit.js";

@customElement("main-page")
export class MainPage extends LitElement {
    @property()
    error?: string;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinksAndVideos(this);
    }

    unsubscribe = () => {};
    connectedCallback(): void {
        super.connectedCallback();
        this.unsubscribe = state.subscribe("subreddits", () => {
            this.requestUpdate();
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unsubscribe();
    }

    render() {
        if (this.error) return renderError(this.error);
        const subreddits = Store.getSubreddits()!;
        const hnTopics: { label: string; value: string }[] = [
            { label: "Top Stories", value: "/hn/topstories" },
            { label: "New", value: "/hn/newstories" },
            { label: "Ask Hackernews", value: "/hn/askstories" },
            { label: "Show Hackernews", value: "/hn/showstories" },
            { label: "Jobs", value: "/hn/jobstories" },
        ];

        const cardStyle = `flex flex-col border-t sm:border border-divider sm:rounded-md sm:fancy-shadow overflow-x-clip`;
        const cardTitleStyle = `text-muted-fg h-10 flex items-center pl-4 border-b border-divider`;
        const cardItemStyle = `flex items-center gap-2 pl-4 pr-2 border-b border-divider last:border-none hover:bg-muted cursor-pointer`;

        return html`<div class="${pageContainerStyle}">
            <div class="relative flex flex-col sm:gap-2 w-full max-w-[480px] mx-auto">
                <div class="flex items-center">
                    <div class="self-center text-lg font-semibold px-2 text-primary text-center flex gap-1 items-center justify-center">
                        <i class="icon w-10 h-10 fill-primary">${favIcon}</i><span>ledit</span>
                    </div>
                    <div class="ml-auto flex">
                        <a href="/settings" class="w-10 h-10 flex items-center justify-center"
                            ><i class="icon w-5 h-5 fill-black dark:fill-white">${settingsIcon}</i></a
                        >
                        <theme-toggle class="w-10 h-10"></theme-toggle>
                    </div>
                </div>
                <div class="w-full mx-auto flex flex-col sm:gap-4">
                    <div class="${cardStyle}">
                        <h2 class="${cardTitleStyle}">
                            <span>Reddit</span>
                            <button class="w-10 h-10 flex items-center justify-center" @click=${() => this.newSubreddit()}>
                                <i class="icon w-6 h-6 fill-primary">${plusIcon}</i>
                            </button>
                        </h2>
                        ${map(
                            subreddits,
                            (subreddit) => html`
                                <div class="${cardItemStyle}">
                                    <a class="flex-grow truncate py-2" href="/r/${subreddit.subreddits.join("+")}">${subreddit.label}</a>
                                    <button class="ml-auto w-6 h-6 flex items-center justify-center" @click=${() => this.editSubreddit(subreddit)}>
                                        <i class="icon w-5 h-5 fill-primary">${pencilIcon}</i>
                                    </button>
                                    <button class="ml-auto w-6 h-6 flex items-center justify-center" @click=${() => this.deleteSubreddit(subreddit)}>
                                        <i class="icon w-6 h-6 fill-primary">${minusIcon}</i>
                                    </button>
                                </div>
                            `
                        )}
                    </div>
                    <div class="${cardStyle}">
                        <h2 class="${cardTitleStyle}">
                            <span>Hackernews</span>
                        </h2>
                        ${map(
                            hnTopics,
                            (topic) => html`
                                <div class="${cardItemStyle}">
                                    <a class="flex-grow truncate py-2" href="${topic.value}">${topic.label}</a>
                                </div>
                            `
                        )}
                    </div>
                </div>
            </div>
        </div>`;
    }

    newSubreddit() {
        router.push("/new/subreddit");
    }

    editSubreddit(subreddit: Subreddit) {
        router.push("/edit/subreddit/" + encodeURIComponent(subreddit.label));
    }

    deleteSubreddit(subreddit: Subreddit) {
        Store.setSubreddits(Store.getSubreddits()!.filter((other) => other != subreddit));
        state.update("subreddits", Store.getSubreddits()!);
    }

    search() {
        router.push("/search/reddit");
    }
}
