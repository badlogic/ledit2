import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Api } from "../api.js";
import { closeButton, fixLinks, renderError, renderTopbar } from "../app.js";
import { i18n } from "../utils/i18n.js";
import { router } from "../utils/routing.js";
import { pageContainerStyle } from "../utils/styles.js";
import { settingsIcon } from "../utils/icons.js";

@customElement("main-page")
export class MainPage extends LitElement {
    @property()
    isLoading = false;

    @property()
    message?: string;

    @property()
    error?: string;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    updated() {
        fixLinks(this);
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
    }

    render() {
        if (this.isLoading) return html`<loading-spinner></loading-spinner>`;
        if (this.error) return renderError(this.error);
        return html`<div class="${pageContainerStyle}">
            <div class="relative flex flex-col gap-4 mt-4">
                <h2 class="text-center">ledit</h2>
                <div class="absolute -top-4 right-0 flex items-center">
                    <theme-toggle class="w-10 h-10"></theme-toggle>
                    <a href="/settings" class="w-10 h-10 flex items-center justify-center"
                        ><i class="icon w-6 h-6 fill-black dark:fill-white">${settingsIcon}</i></a
                    >
                </div>
                <div class="flex flex-col gap-2">
                    <a href="r/videos">r/videos</a>
                    <a href="r/austria">r/austria</a>
                </div>
            </div>
        </div>`;
    }
}
