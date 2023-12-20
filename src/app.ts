import { LitElement, PropertyValueMap, html } from "lit";
import { customElement } from "lit/decorators.js";
import { i18n } from "./utils/i18n.js";
import { setupLiveReload } from "./utils/live-reload.js";
import { renderError } from "./utils/ui-components.js";
import { router } from "./utils/routing.js";
import { RedditCommentsPage, RedditPage } from "./pages/reddit.js";
export * from "./pages/index.js";
export * from "./utils/ui-components.js";

setupLiveReload();

@customElement("app-main")
export class App extends LitElement {
    constructor() {
        super();
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        router.addRoute("/", () => html`<main-page></main-page>`);
        router.addRoute(
            "/404",
            () =>
                html`<div class="w-screen h-screen flex items-center justify-center">
                    <div class="w-[320px]">${renderError(i18n("Whoops, that page doesn't exist"))}</div>
                </div>`
        );
        router.addRoute("/settings", () => html`<settings-page></settings-page>`);
        router.addRoute(
            "/r/:subreddit/:sorting?",
            () => html`<reddit-page></reddit-page>`,
            false,
            (page) => {
                const oldPage = page as RedditPage;
                const params = router.getCurrentParams();
                const subreddit = params?.get("subreddit");
                return oldPage.subreddit == subreddit;
            }
        );
        router.addRoute(
            "/r/comments/r/:subreddit/comments/:id/:title",
            () => html`<reddit-comments-page></reddit-comments-page>`,
            false,
            (page) => {
                const oldPage = page as RedditCommentsPage;
                const permalink = RedditCommentsPage.getPermalinkFromHref();
                return oldPage.permalink == permalink;
            }
        );
        router.addRoute("/new/subreddit", () => html`<subreddit-editor></subreddit-editor>`);
        router.addRoute("/edit/subreddit/:label", () => html`<subreddit-editor></subreddit-editor>`);
        router.addRoute("/search/reddit/:query?", () => html`<subreddit-search></subreddit-search>`);

        router.addRoute("/hn/comments/:id", () => html`<hackernews-comments-page></hackernews-comments-page>`);
        router.addRoute("/hn/:sorting?", () => html`<hackernews-page></hackernews-page>`);

        router.setRootRoute("/");
        router.setNotFoundRoot("/404");
        router.setOutlet(document.querySelector<HTMLElement>("main")!);
        router.replace(location.pathname);
    }
}
