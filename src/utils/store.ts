export type DevPreferences = {
    enabled: boolean;
};

export type SynologyPreferences = {
    downloadsFolder: string;
};

export type Theme = "dark" | "light";

export type Subreddit = { label: string; subreddits: string[] };

export type Settings = {
    theme: Theme;
    devPrefs: DevPreferences;
    subreddits: Subreddit[];
    seen: string[];
    collapseSeen: boolean;
    usersClickable: boolean;
};

export type StoreKey = "user" | "settings";

export class Store {
    static memory = new Map<string, any>();

    static {
        let settings: Settings | undefined = Store.get<Settings>("settings");
        settings = settings ?? ({} as Settings);

        settings.theme = settings.theme ?? "dark";

        settings.devPrefs = settings.devPrefs ?? ({} as DevPreferences);
        settings.devPrefs.enabled = settings.devPrefs.enabled ?? false;

        settings.subreddits = settings.subreddits ?? [
            // prettier-ignore
            { label: "ledit_mix", subreddits: ["AdviceAnimals", "AskReddit", "askscience", "assholedesign", "aww", "battlestations", "bestof", "BetterEveryLoop", "blackmagicfuckery", "boardgames", "BuyItForLife", "Damnthatsinteresting", "dataisbeautiful", "DesignDesign", "DIY", "diyelectronics", "DrugNerds", "europe", "explainlikeimfive", "facepalm", "fatFIRE", "fightporn", "Fitness", "funny", "Futurology", "gadgets", "gaming", "GifRecipes", "gifs", "GiftIdeas", "history", "homeautomation", "Hue", "IAmA", "IllegalLifeProTips", "INEEEEDIT", "instant_regret", "interestingasfuck", "InternetIsBeautiful", "Jokes", "JusticeServed", "kitchens", "LifeProTips", "maybemaybemaybe", "mildlyinfuriating", "mildlyinteresting", "mildlyvagina", "movies", "news", "NintendoSwitch", "nottheonion", "oddlysatisfying", "OldSchoolCool", "pcmasterrace", "photoshopbattles", "pics", "PoliticalHumor", "ProgrammerHumor", "PublicFreakout", "rarepuppers", "recipes", "rickandmorty", "RoomPorn", "running", "science", "Showerthoughts", "slatestarcodex", "space", "spicy", "technology", "technologyconnections", "television", "therewasanattempt", "todayilearned", "UnethicalLifeProTips", "Unexpected", "UpliftingNews", "videos", "watchpeoplealmostdie", "Wellthatsucks", "Whatcouldgowrong", "whitepeoplegifs", "woahdude", "worldnews", "WTF"] },
            { label: "programming", subreddits: ["programming", "programminglanguages"] },
            { label: "gifs", subreddits: ["gifs"] },
            { label: "videos", subreddits: ["videos"] },
        ];

        settings.seen = settings.seen ?? [];
        settings.collapseSeen = settings.collapseSeen ?? false;
        settings.usersClickable = settings.usersClickable ?? false;

        Store.set<Settings>("settings", settings);
    }

    private static get<T>(key: StoreKey): T | undefined {
        try {
            let memResult = this.memory.get(key);
            if (memResult) return memResult as T;
            memResult = localStorage.getItem(key) ? (JSON.parse(localStorage.getItem(key)!) as T) : undefined;
            this.memory.set(key, memResult);
            return memResult;
        } catch (e) {
            localStorage.removeItem(key);
            return undefined;
        }
    }

    private static set<T>(key: StoreKey, value: T | undefined) {
        if (value == undefined) {
            localStorage.removeItem(key);
            this.memory.delete(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
            this.memory.set(key, value);
        }
        return value;
    }

    static getTheme() {
        return Store.get<Settings>("settings")?.theme;
    }

    static setTheme(theme: Theme) {
        Store.set("settings", { ...Store.get<Settings>("settings"), theme });

        return theme;
    }

    static getDevPrefs() {
        return Store.get<Settings>("settings")?.devPrefs;
    }

    static setDevPrefs(devPrefs: DevPreferences) {
        Store.set("settings", { ...Store.get<Settings>("settings"), devPrefs });
    }

    static getSubreddits() {
        return Store.get<Settings>("settings")?.subreddits;
    }

    static setSubreddits(subreddits: Subreddit[]) {
        Store.set<Settings>("settings", { ...Store.get<Settings>("settings")!, subreddits });
    }

    static seenSet = new Set<string>();
    static getSeen() {
        if (this.seenSet.size == 0) {
            this.seenSet = new Set<string>(Store.get<Settings>("settings")!.seen);
        }
        return this.seenSet;
    }

    static setSeen(seenSet: Set<string>) {
        this.seenSet = seenSet;
        Store.set<Settings>("settings", { ...Store.get<Settings>("settings")!, seen: Array.from(seenSet) });
    }

    static getCollapseSeen(): boolean {
        return Store.get<Settings>("settings")?.collapseSeen ?? false;
    }

    static setCollapseSeen(collapseSeen: boolean) {
        Store.set<Settings>("settings", { ...Store.get<Settings>("settings")!, collapseSeen });
    }

    static getUsersClickable(): boolean {
        return Store.get<Settings>("settings")?.usersClickable ?? false;
    }

    static setUsersClickable(usersClickable: boolean) {
        Store.set<Settings>("settings", { ...Store.get<Settings>("settings")!, usersClickable });
    }
}

const theme = Store.getTheme();
if (theme == "dark") document.documentElement.classList.add("dark");
else document.documentElement.classList.remove("dark");
