import { unsafeCSS } from "lit";

// @ts-ignore
import globalCssTxt from "../../html/build/styles-bundle.css";

export const globalStyles = [unsafeCSS(globalCssTxt)];

export const pageContainerStyle = "flex flex-col w-full max-w-[640px] min-h-full mx-auto";
