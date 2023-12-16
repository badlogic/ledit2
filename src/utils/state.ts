import { TemplateResult } from "lit";
import { Key, pathToRegexp } from "path-to-regexp";
import { StreamView } from "./streamviews.js";
import { dom } from "./ui-components.js";

export class Route<T extends HTMLElement> {
    readonly regexp: RegExp;
    readonly keys: Key[] = [];

    constructor(
        readonly path: string,
        readonly renderPage: () => TemplateResult | T,
        readonly requiresAuth = false,
        readonly reusePage: (page: T) => boolean = () => true
    ) {
        this.regexp = pathToRegexp(this.path, this.keys);
    }
}

export class Router {
    pageStack: { route: Route<any>; page: HTMLElement; srcollTop: number; display: string }[] = [];
    routes: Route<any>[] = [];
    authProvider = () => true;
    rootRoute = "/";
    notFoundRoot = "/404";
    currPage = 0;

    constructor() {
        window.addEventListener("popstate", (ev) => this.handleNavigation(ev));
        this.currPage = history.state?.page ?? 0;
    }

    setAuthProvider(authProvider: () => boolean) {
        this.authProvider = authProvider;
    }

    setRootRoute(path: string) {
        if (!this.matchRoute(path)) throw new Error("No Route defined for path " + path);
        this.rootRoute = path;
    }

    setNotFoundRoot(path: string) {
        if (!this.matchRoute(path)) throw new Error("No Route defined for path " + path);
        this.notFoundRoot = path;
    }

    addRoute<T extends HTMLElement>(
        path: string,
        renderPage: () => TemplateResult | T,
        requiresAuth = false,
        reusePage: (page: T) => boolean = () => true
    ) {
        const route = new Route(path, renderPage, requiresAuth, reusePage);
        if (this.routes.some((other) => other.path == route.path)) throw new Error(`Route ${route.path}} already defined`);
        this.routes.push(route);
    }

    replace(path: string) {
        const page = this.pageStack.pop();
        page?.page.remove();
        this.navigateTo(path);
        history.replaceState({ page: history.state?.page ?? this.pageStack.length }, "", path);
    }

    replaceUrl(path: string) {
        history.replaceState({ page: history.state?.page ?? this.pageStack.length }, "", path);
    }

    push(path: string, page?: HTMLElement) {
        const route = this.matchRoute(path);
        if (!route) {
            this.navigateTo("/404");
        } else {
            this.navigateTo(path, page);
        }
        this.currPage++;
        history.pushState({ page: this.pageStack.length }, "", path);
    }

    pop() {
        this.currPage--;
        history.back();
    }

    popAll(path: string) {
        if (this.pageStack.length == 0) {
            this.currPage = 1;
            this.replace(path);
            return;
        }

        this.disableNavigation = true;
        while (this.pageStack.length > 0) {
            this.pageStack.pop()?.page.remove();
        }
        const popState = () => {
            if (history.state && history.state.page == 1) {
                window.removeEventListener("popstate", popState);
                this.replace(path);
                this.currPage = 1;
                this.disableNavigation = false;
            } else {
                history.back();
            }
        };
        window.addEventListener("popstate", popState);
        history.back();
    }

    top() {
        return this.pageStack.length > 0 ? this.pageStack[this.pageStack.length - 1] : undefined;
    }

    private navigateTo(path: string, prerenderedPage?: HTMLElement) {
        const route = this.matchRoute(path);
        if (!route) {
            this.navigateTo("/404");
            return;
        }
        if (route.route.requiresAuth && !this.authProvider()) {
            this.navigateTo(this.rootRoute);
            return;
        }
        const lastPage = this.top();
        if (lastPage && lastPage.route == route.route && route.route.reusePage(lastPage.page)) {
            console.log("Re-using existing page");
        } else {
            const page = prerenderedPage ?? route.route.renderPage();
            if (lastPage) {
                lastPage.srcollTop = document.documentElement.scrollTop;
                lastPage.display = lastPage.page.style.display;
                const streamViews = Array.from(lastPage.page.querySelectorAll("*")).filter((el) => el instanceof StreamView) as StreamView<any>[];
                for (const streamView of streamViews) streamView.disableIntersector = true;
                lastPage.page.style.display = "none";
            }
            const pageDom = page instanceof HTMLElement ? page : dom(page)[0];
            this.pageStack.push({ route: route.route, page: pageDom, srcollTop: 0, display: pageDom.style.display });
            document.body.append(pageDom);
        }
    }

    disableNavigation = false;
    private handleNavigation(ev: PopStateEvent) {
        if (this.disableNavigation) return;
        if (ev.state.page > this.currPage || !ev.state) {
            this.currPage = ev.state.page;
            // Forward
            const route = this.matchRoute(location.pathname);
            if (!route) {
                this.navigateTo("/404");
                return;
            }
            if ((route.route.requiresAuth && !this.authProvider()) || (!this.authProvider() && ev.state.page > 1)) {
                this.popAll(this.rootRoute);
            } else {
                this.navigateTo(location.pathname + location.search + location.hash);
            }
        } else {
            this.currPage = ev.state.page;
            // Backward
            const page = this.pageStack.pop();
            page?.page.remove();
            queueMicrotask(() => {
                const page = this.top();
                if (page) {
                    const streamViews = Array.from(page.page.querySelectorAll("*")).filter((el) => el instanceof StreamView) as StreamView<any>[];
                    for (const streamView of streamViews) streamView.disableIntersector = false;
                    page.page.style.display = page.display;
                    queueMicrotask(() => (document.documentElement.scrollTop = page.srcollTop));
                } else {
                    this.navigateTo(location.pathname);
                }
            });
        }
    }

    private matchRoute(path: string) {
        path = new URL("https://foo.bar" + path).pathname;
        for (const route of this.routes) {
            const match = route.regexp.exec(path);
            if (match) {
                const params: any = {};
                route.keys.forEach((key: Key, index) => {
                    params[key.name] = match[index + 1];
                });
                return { route, params };
            }
        }
        return null;
    }
}

export const router = new Router();
