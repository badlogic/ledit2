import { LitElement, html, render } from "lit";
import { closeButton, renderTopbar } from "../app.js";
import { customElement } from "lit/decorators.js";
import { pageContainerStyle } from "../utils/styles.js";

@customElement("settings-page")
export class SettingsPage extends LitElement {
    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    render() {
        return html`<div class="${pageContainerStyle}">
            ${renderTopbar("Settings", closeButton())}
            <div class="flex gap-2 px-4"><theme-toggle class="self-start"></theme-toggle></div>
        </div>`;
    }
}
