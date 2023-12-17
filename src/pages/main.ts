import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Api } from "../api.js";
import { closeButton, fixLinksAndVideos, renderError, renderTopbar } from "../app.js";
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
        fixLinksAndVideos(this);
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
                    <a
                        href="r/AdviceAnimals+AskReddit+askscience+assholedesign+aww+battlestations+bestof+BetterEveryLoop+blackmagicfuckery+boardgames+BuyItForLife+Damnthatsinteresting+dataisbeautiful+DesignDesign+DIY+diyelectronics+DrugNerds+europe+explainlikeimfive+facepalm+fatFIRE+fightporn+Fitness+funny+Futurology+gadgets+gaming+GifRecipes+gifs+GiftIdeas+history+homeautomation+Hue+IAmA+IllegalLifeProTips+INEEEEDIT+instant_regret+interestingasfuck+InternetIsBeautiful+Jokes+JusticeServed+kitchens+LifeProTips+maybemaybemaybe+mildlyinfuriating+mildlyinteresting+mildlyvagina+movies+news+NintendoSwitch+nottheonion+oddlysatisfying+OldSchoolCool+pcmasterrace+photoshopbattles+pics+PoliticalHumor+ProgrammerHumor+PublicFreakout+rarepuppers+recipes+rickandmorty+RoomPorn+running+science+Showerthoughts+slatestarcodex+space+spicy+technology+technologyconnections+television+therewasanattempt+todayilearned+UnethicalLifeProTips+Unexpected+UpliftingNews+videos+watchpeoplealmostdie+Wellthatsucks+Whatcouldgowrong+whitepeoplegifs+woahdude+worldnews+WTF"
                        >r/ledit mix</a
                    >
                    <a href="r/videos">r/videos</a>
                    <a href="r/austria">r/austria</a>
                    <a href="r/malelivingspace">r/malelivingspace</a>
                </div>
            </div>
        </div>`;
    }
}
