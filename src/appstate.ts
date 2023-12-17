import { State } from "./utils/state.js";
import { Subreddit } from "./utils/store.js";

export type StateObjects = {
    subreddits: Subreddit[];
};

export class AppState extends State<StateObjects> {}
export const state = new AppState();
