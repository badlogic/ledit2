import { LitElement, html, render } from "lit";
import { closeButton, renderTopbar } from "../app.js";
import { customElement } from "lit/decorators.js";
import { pageContainerStyle, pageContentStyle } from "../utils/styles.js";
import { Store } from "../utils/store.js";

@customElement("settings-page")
export class SettingsPage extends LitElement {
    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    render() {
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar("Settings", closeButton())}
            <div class="${pageContentStyle}">
                <div class="flex flex-col gap-2 px-4 mt-4">
                    <slide-button
                        .checked=${Store.getCollapseSeen()}
                        .text=${"Collapse seen posts"}
                        @changed=${(ev: CustomEvent) => Store.setCollapseSeen(ev.detail.value)}
                    ></slide-button>
                    <slide-button
                        .checked=${Store.getUsersClickable()}
                        .text=${"Users clickable"}
                        @changed=${(ev: CustomEvent) => Store.setUsersClickable(ev.detail.value)}
                    ></slide-button>
                </div>
            </div>
        </div>`;
    }
}
