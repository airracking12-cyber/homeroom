// Self-hosted fonts. They are aliased to the names the rest of the app (and the boarding pass) already use,
// so "Fraunces" and "Inter" resolve everywhere without a request to Google. Variable files: one download covers every weight.
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import frauncesExt from "@fontsource-variable/fraunces/files/fraunces-latin-ext-opsz-normal.woff2?url";
import frauncesItalic from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2?url";
import inter from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interExt from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const face = (family, url, style, range) =>
  `@font-face{font-family:"${family}";font-style:${style};font-weight:100 900;font-display:swap;src:url(${url}) format("woff2-variations");unicode-range:${range}}`;

export const FONTS_CSS = [
  face("Fraunces", fraunces, "normal", LATIN),
  face("Fraunces", frauncesExt, "normal", EXT),
  face("Fraunces", frauncesItalic, "italic", LATIN),
  face("Inter", inter, "normal", LATIN),
  face("Inter", interExt, "normal", EXT),
].join("\n");
