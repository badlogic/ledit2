import { LitElement, PropertyValueMap, html, render } from "lit";
import { closeButton, renderTopbar } from "../app.js";
import { customElement, property } from "lit/decorators.js";
import { pageContainerStyle, pageContentStyle } from "../utils/styles.js";
import { Store } from "../utils/store.js";
import { error } from "../utils/utils.js";

type Version = { date: string; commit: string };

@customElement("settings-page")
export class SettingsPage extends LitElement {
    @property()
    version?: Version;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        (async () => {
            const response = await fetch("/version.json");
            if (!response) {
                error("Couldn't fetch version.json");
            }
            this.version = (await response.json()) as Version;
        })();
    }

    render() {
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar("Settings", closeButton())}
            <div class="${pageContentStyle}">
                <div class="flex flex-col gap-2 px-4 mt-4 border-b border-divider pb-4">
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
                <div class="px-4 mt-4 text-xs border-b border-divider pb-4">
                    Build: ${this.version?.date}<br />
                    <a href="https://github.com/badlogic/ledit/commit/">${this.version?.commit}</a>
                </div>
                <div class="text-center text-xs italic my-4 pb-4 flex flex-col gap-4">
                    <div>
                        <a href="https://ledit.marioslab.io" target="_blank">ledit</a>
                        is lovingly made by
                        <a href="https://bsky.app/profile/badlogic.bsky.social" target="_blank">Mario Zechner</a><br />
                    </div>
                    <div>
                        Ledit does not collect any personal identifiable information<br />
                        Viewing videos or images from 3rd parties, such as Reddit or YouTube,<br />
                        may result in you being tracked by these sites<br />
                    </div>
                    <a href="https://github.com/badlogic/skychat" target="_blank">Source code</a>
                </div>
            </div>
        </div>`;
    }
}
