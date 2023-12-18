import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Api } from "../api.js";
import { closeButton, fixLinksAndVideos, renderError, renderTopbar } from "../app.js";
import { i18n } from "../utils/i18n.js";
import { router } from "../utils/routing.js";
import { pageContainerStyle } from "../utils/styles.js";
import { minusIcon, pencilIcon, plusIcon, searchIcon, settingsIcon } from "../utils/icons.js";
import { map } from "lit/directives/map.js";
import { Store, Subreddit } from "../utils/store.js";
import { state } from "../appstate.js";

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
        return html`<div class="${pageContainerStyle}">
            <div class="relative flex flex-col gap-4 mt-4">
                <h2 class="text-center">ledit</h2>
                <div class="absolute -top-4 right-0 flex items-center">
                    <theme-toggle class="w-10 h-10"></theme-toggle>
                </div>
                <div class="w-full max-w-[480px] mx-auto flex flex-col">
                    <div class="flex flex-col pb-4 border-b border-divider">
                        <h2 class="text-muted-fg flex items-center pl-4">
                            <span>Reddit</span>
                            <button class="ml-auto -mr-1 w-10 h-10 flex items-center justify-center" @click=${() => this.search()}>
                                <i class="icon w-5 h-5 fill-primary">${searchIcon}</i>
                            </button>
                            <button class="w-10 h-10 flex items-center justify-center" @click=${() => this.newSubreddit()}>
                                <i class="icon w-6 h-6 fill-primary">${plusIcon}</i>
                            </button>
                        </h2>
                        <div class="flex flex-col">
                            ${map(
                                subreddits,
                                (subreddit) => html`
                                    <div class="flex items-center hover:bg-muted rounded py-2 pl-4 pr-2 gap-2 cursor-pointer">
                                        <a class="flex-grow truncate" href="/r/${subreddit.subreddits.join("+")}">${subreddit.label}</a>
                                        <button
                                            class="ml-auto w-6 h-6 flex items-center justify-center"
                                            @click=${() => this.editSubreddit(subreddit)}
                                        >
                                            <i class="icon w-5 h-5 fill-primary">${pencilIcon}</i>
                                        </button>
                                        <button
                                            class="ml-auto w-6 h-6 flex items-center justify-center"
                                            @click=${() => this.deleteSubreddit(subreddit)}
                                        >
                                            <i class="icon w-6 h-6 fill-primary">${minusIcon}</i>
                                        </button>
                                    </div>
                                `
                            )}
                        </div>
                    </div>
                    <div class="flex flex-col pt-4">
                        <h2 class="text-muted-fg flex items-center pl-4">
                            <a href="/hn">Hackernews</a>
                        </h2>
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

@customElement("subreddit-editor")
export class SubredditEditor extends LitElement {
    @property()
    isLoading = false;

    @property()
    error?: string;

    @property()
    label = "";

    @property()
    subreddits = "";

    subreddit?: Subreddit;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        const params = router.getCurrentParams();
        if (params?.get("label")) {
            const subreddit = Store.getSubreddits()!.find((subreddit) => subreddit.label == params.get("label"));
            if (!subreddit) {
                this.error = "Subreddit '" + params.get("label") + "' does not exist";
            } else {
                this.subreddit = subreddit;
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
            ${renderTopbar(this.subreddit ? "Edit Subreddit" : "New Subreddit", closeButton())}
            <div class="relative flex flex-col gap-4 mt-4 px-4">
                ${this.error ? renderError(this.error) : nothing}
                <div class="flex flex-col gap-1">
                    <span class="text-muted-fg font-semibold text-sm">Label</span>
                    <input
                        id="label"
                        class="rounded bg-transparent ring-1 ring-divider outline-none px-2 py-1"
                        id="label"
                        @input=${() => this.handleInput()}
                        placeholder="Subreddit label shown on main page"
                        value="${this.subreddit?.label}"
                    />
                </div>
                <div class="flex flex-col gap-1">
                    <span class="text-muted-fg font-semibold text-sm">Subreddits</span>
                    <textarea
                        id="subreddits"
                        class="rounded bg-transparent ring-1 ring-divider outline-none resize-none p-2"
                        @input=${() => this.handleInput()}
                        rows="5"
                        placeholder="List of subreddits, one per line"
                    >
${this.subreddit?.subreddits.join("\n")}</textarea
                    >
                </div>
                <button
                    class="self-start btn"
                    ?disabled=${this.label.length == 0 || this.subreddits.length == 0 || this.error}
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
        this.subreddits = subredditsElement.value;

        if (checkExists) {
            if (Store.getSubreddits()!.some((subreddit) => subreddit.label == this.label)) {
                this.error = `Subreddit with label '${this.label}' already exists`;
            } else {
                this.error = undefined;
            }
        }
    }

    save() {
        if (this.subreddit) {
            this.subreddit.label = this.label;
            this.subreddit.subreddits = this.subreddits.split("\n");
            Store.setSubreddits(Store.getSubreddits()!);
        } else {
            const newSubreddit = { label: this.label, subreddits: this.subreddits.split("\n") };
            Store.setSubreddits([...Store.getSubreddits()!, newSubreddit]);
        }
        state.update("subreddits", Store.getSubreddits()!);
        router.pop();
    }
}
