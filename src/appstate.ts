import { State } from "./utils/state.js";
import { RssFeed, Subreddit } from "./utils/store.js";

export type StateObjects = {
    subreddits: Subreddit[];
    rssfeeds: RssFeed[];
};

export class AppState extends State<StateObjects> {}
export const state = new AppState();
