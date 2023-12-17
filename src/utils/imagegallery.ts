import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { arrowLeftIcon, arrowRightIcon } from "./icons.js";

function preventPinchZoom(event: TouchEvent): void {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}
document.addEventListener("touchstart", preventPinchZoom, { passive: false });

export function togglePinchZoom(enable: boolean): void {
    if (enable) {
        document.removeEventListener("touchstart", preventPinchZoom);
    } else {
        document.addEventListener("touchstart", preventPinchZoom, { passive: false });
    }
}

@customElement("image-gallery")
export class ImageGallery extends LitElement {
    @property()
    images: { url: string; altText?: string }[] = [];

    @property()
    imageIndex = 0;

    @property()
    isScrolling = false;

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    connectedCallback(): void {
        togglePinchZoom(true);
    }

    disconnectedCallback(): void {
        togglePinchZoom(false);
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        (this.renderRoot.children[0] as HTMLElement).addEventListener("scroll", () => {
            this.isScrolling = true;
            this.debounceScroll();
        });
        if (this.imageIndex > 0) {
            const galleryContainer = this.renderRoot.children[0] as HTMLElement;
            galleryContainer.scrollLeft = galleryContainer.clientWidth * this.imageIndex;
        }

        history.pushState(history.state, "", location.href);
    }

    render() {
        return html`
            <div
                class="fixed scrollbar-hide top-0 left-0 w-full h-full overflow-none flex snap-x overflow-x-auto backdrop-blur z-10 fill-primary"
                @click=${() => this.close()}
            >
                ${this.images.map(
                    (image, index) => html`
                        <div class="flex-none w-full h-full relative snap-center flex justify-center items-center">
                            ${this.images.length > 1 && index > 0 && !this.isScrolling
                                ? html`<button @click=${(ev: MouseEvent) =>
                                      this.scrollPrevious(
                                          ev
                                      )} class="animate-fade animate-duration-100 absolute left-4 top-4 h-full flex"><i class="icon !w-8 !h-8">${arrowLeftIcon}</button>`
                                : nothing}
                            ${this.images.length > 1 && index < this.images.length - 1 && !this.isScrolling
                                ? html`<button @click=${(ev: MouseEvent) =>
                                      this.scrollNext(
                                          ev
                                      )} class="animate-fade animate-duration-100 absolute right-4 top-4 h-full flex"><i class="icon !w-8 !h-8">${arrowRightIcon}</button>`
                                : nothing}
                            <img src="${image.url}" alt="${image.altText ?? ""}" class="max-w-full max-h-full object-contain" />
                        </div>
                    `
                )}
            </div>
        `;
    }

    close() {
        history.back();
        this.remove();
    }

    scrollNext(ev: MouseEvent) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        const galleryContainer = this.renderRoot.children[0] as HTMLElement;

        if (galleryContainer) {
            galleryContainer.scrollTo({ left: galleryContainer.scrollLeft + galleryContainer.clientWidth, behavior: "smooth" });
            this.isScrolling = true;
            this.debounceScroll();
        }
    }

    scrollPrevious(ev: MouseEvent) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        const galleryContainer = this.renderRoot.children[0] as HTMLElement;

        if (galleryContainer) {
            galleryContainer.scrollTo({ left: galleryContainer.scrollLeft - galleryContainer.clientWidth, behavior: "smooth" });
            this.isScrolling = true;
            this.debounceScroll();
        }
    }

    scrollTimeout = 0;
    debounceScroll() {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = window.setTimeout(() => {
            this.isScrolling = false;
        }, 100);
    }
}
