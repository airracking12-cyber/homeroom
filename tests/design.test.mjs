// The dorm-room design system's rules, read from the real stylesheets and entry files, so they can't quietly drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = (f) => readFileSync(new URL("../src/styles/" + f, import.meta.url), "utf8");
const FILES = readdirSync(new URL("../src/styles/", import.meta.url)).filter((f) => f.endsWith(".css"));
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
const ALL = FILES.map((f) => strip(css(f))).join("\n");
const SCREENS = FILES.filter((f) => f !== "tokens.css").map((f) => strip(css(f))).join("\n");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("tokens, base, components, layout, motion, room and one stylesheet per area exist", () => {
  for (const f of ["tokens.css", "base.css", "components.css", "layout.css", "motion.css", "room.css", "screens-auth.css", "screens-track.css", "screens-review.css", "screens-prepare.css", "screens-class.css", "screens-settings.css"]) assert.ok(FILES.includes(f), f);
});

test("type: a rounded handwritten-feel heading font and a clean body font, both self-hosted, with graceful fallbacks", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--font-display: "Patrick Hand", [^;]*ui-rounded[^;]*sans-serif;/);
  assert.match(tk, /--font-body: "Inter Variable"[^;]*system-ui[^;]*sans-serif;/);
  assert.match(tk, /@import "@fontsource\/patrick-hand\/index\.css"/);
  assert.match(tk, /@import "@fontsource-variable\/inter/);
  assert.match(css("base.css"), /h1, h2 \{[^}]*font-weight: 400;/);
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(ALL + html), "no Google Fonts link: fonts are bundled, so they also load offline");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.dependencies["@fontsource/patrick-hand"], "the heading font is a dependency (bundled by Vite)");
});

test("the radius scale is soft: 12 control, 16 card, 24 large, pill", () => {
  assert.match(css("tokens.css"), /--r-control: 12px; --r-card: 16px; --r-large: 24px; --r-pill: 999px/);
});

test("spacing and display sizes stay app-sized", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--fs-display: 34px;/);
  assert.match(tk, /@media \(min-width: 1024px\) \{[^}]*--fs-display: 46px/);
  assert.match(tk, /--section: 24px;/); assert.match(tk, /--pad-card: 16px;/);
  assert.match(tk, /@media \(min-width: 768px\) \{[^}]*--section: 32px; --pad-card: 20px/);
  const big = [...SCREENS.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])).filter((n) => n > 46 && ![72, 60, 56, 52].includes(n));
  assert.deepEqual(big, [], "no heading bigger than the display size (the timer, scores and credit name are the exceptions)");
});

test("colour, shadow, spacing and radius live in tokens only: no raw colours, no raw shadows in components", () => {
  const raw = [...SCREENS.matchAll(/(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/g)].map((m) => m[1]);
  assert.deepEqual(raw, [], "raw colour outside tokens.css");
  // a box-shadow must be a token, an inset ring, a 0-blur ring, or the button lip that uses --accent-edge
  const bad = [];
  for (const m of SCREENS.matchAll(/box-shadow:\s*([^;}]+)[;}]/g)) {
    const v = m[1].trim();
    if (/^var\(--shadow-[a-z]+\)$/.test(v) || /^var\(--overlay-shadow\)$/.test(v) || v === "none" || /^inset 0 0 0 \d+px var\(--[a-z-]+\)$/.test(v) || /^0 [12]px 0 var\(--accent-edge\)$/.test(v) || /^0 0 0 \d+px var\(--[a-z-]+\)(, 0 0 0 \d+px var\(--[a-z-]+\))?$/.test(v)) continue;
    bad.push(v);
  }
  assert.deepEqual(bad, [], "a box-shadow that is not a design token");
  for (const t of ["--shadow-paper", "--shadow-note", "--shadow-float", "--overlay-shadow"]) assert.ok(css("tokens.css").includes(t + ":"), t);
});

test("motion: only transform and opacity animate (no animated shadow, filter, size, position or colour)", () => {
  const kf = [...ALL.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  assert.ok(kf.length >= 8);
  for (const [, name, body] of kf) {
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== "animation-timing-function");
    for (const p of props) assert.ok(p === "transform" || p === "opacity", `@keyframes ${name} animates ${p}`);
  }
  for (const m of ALL.matchAll(/transition:\s*([^;}]+);/g)) {
    for (const part of m[1].split(/,(?![^(]*\))/)) assert.match(part.trim(), /^(transform|opacity)\b/, `transition on something other than transform/opacity: ${part.trim()}`);
  }
  assert.ok(!/transition:\s*all\b/.test(ALL));
  assert.ok(!/(^|[^-])filter\s*:|backdrop-filter/.test(ALL), "no filter or blur anywhere");
});

test("the four reusable animations (unpack, pop-in, stick, glow) and the celebration are each defined exactly once, in motion.css", () => {
  const defs = (n) => (ALL.match(new RegExp(`@keyframes\\s+${n}\\s*\\{`, "g")) || []).length;
  for (const n of ["unpack", "pop-in", "stick", "glow", "confetti"]) { assert.equal(defs(n), 1, `${n} defined once`); assert.match(css("motion.css"), new RegExp(`@keyframes\\s+${n}\\s*\\{`)); }
  for (const cls of [".unpack", ".pop-in", ".stick", ".glow-layer", ".celebrate"]) assert.ok(css("motion.css").includes(cls), cls);
  // nothing else may define its own entrance: every keyframes name in the app is on this list
  const names = [...ALL.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).sort();
  const CINEMA_ONLY = ["bar-in", "clap", "cine-out", "curtain", "cut-text", "flash-bloom", "fly-to", "mote", "prop-fly", "ring-hit", "ring-in", "strand-in", "sub-in", "tape-rip", "title-away", "title-line"];
  assert.deepEqual(names, ["confetti", "fade-in", "glow", "indet", "pop-in", "shake", "shimmer", "stick", "sync-sweep", "unpack", ...CINEMA_ONLY].sort());
  // the film's own animations live in cinema.css and nowhere else, and the ones above live in motion.css or their own screen
  for (const n of CINEMA_ONLY) assert.match(css("cinema.css"), new RegExp(`@keyframes\\s+${n}\\s*\\{`), `${n} belongs to the film`);
});

test("glow is built as an opacity-animated layer, and decoration never takes taps or sits in front of controls", () => {
  assert.match(css("motion.css"), /@keyframes glow \{\s*from \{ opacity: 0\.55; \}\s*to\s*\{ opacity: 1; \}/);
  assert.match(css("motion.css"), /\.glow-layer \{[^}]*pointer-events: none/);
  for (const sel of [".topbar::before, .topbar::after", ".celebrate"]) {
    const m = css(sel.startsWith(".topbar") ? "room.css" : "motion.css").match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*\\}"));
    assert.ok(m && /pointer-events: none/.test(m[0]), `${sel} is pointer-events: none`);
  }
});

test("no ALL-CAPS beyond the small eyebrow label", () => {
  const caps = [...ALL.matchAll(/([.\w\-]+)[^{}]*\{[^}]*text-transform:\s*uppercase/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(caps)], [".eyebrow"], "uppercase is only the small eyebrow label");
});

test("every interactive element has hover (on devices that hover), a visible focus state, and a pressed state", () => {
  assert.match(css("base.css"), /:focus-visible \{ outline: 2px solid var\(--focus\)/);
  const comp = css("components.css");
  assert.match(comp, /@media \(hover: hover\) \{[^}]*\.btn-primary:hover/);
  for (const sel of [".btn:active", ".chip:active", ".seg label:active", ".check:active", ".row-btn:active", ".fab:active", ".nav-item:active", ".day:active", ".seat:active"]) assert.ok(ALL.includes(sel), `${sel} pressed state`);
  assert.ok(!/(^|\n)[^@\n{]*:hover[^{]*\{/.test(comp.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}/g, "")), "hover styling is only inside (hover: hover)");
  // the press answers inside 100ms
  assert.match(css("tokens.css"), /--dur-press: 60ms/);
  assert.match(css("motion.css"), /\.chip, \.row-btn, \.nav-item[^{]*\{\s*transition: transform var\(--dur-press\)/);
});

test("touch targets are at least 44px on touch devices", () => {
  const comp = css("components.css");
  assert.match(css("tokens.css"), /--touch: 44px/);
  assert.match(comp, /@media \(pointer: coarse\) \{ \.btn \{ min-height: var\(--touch\)/);
  assert.match(comp, /\.chip \{ min-height: var\(--touch\)/);
  assert.match(comp, /\.check \{[^}]*width: var\(--touch\); height: var\(--touch\)/s);
  assert.match(comp, /\.input, \.textarea, \.select \{[^}]*min-height: 44px/s);
  assert.match(css("layout.css"), /\.nav-item \{[^}]*min-height: var\(--nav-h\)/s);
});

test("reduced motion is respected (instant, or a plain fade) and zoom is not blocked", () => {
  assert.match(css("base.css"), /prefers-reduced-motion: reduce/);
  const mo = css("motion.css");
  assert.match(mo, /prefers-reduced-motion: reduce\) \{[^}]*\.unpack, \.pop-in, \.stick[^{]*\{ animation: fade-in 160ms linear both !important/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale/);
  assert.match(html, /viewport-fit=cover/);
});

test("dynamic viewport units and safe areas are used, and plain 100vh always has a dvh partner", () => {
  assert.match(ALL, /100dvh/); assert.match(ALL, /env\(safe-area-inset-bottom/); assert.match(ALL, /env\(safe-area-inset-top/);
  for (const m of ALL.matchAll(/([^;{}\n]*\b100vh\b[^;{}\n]*;)([^;{}\n]*;)?/g)) assert.ok(/100dvh/.test(m[0]) || /100vh;\s*(?:\/\*[^*]*\*\/)?\s*$/.test(m[0]), `100vh without a dvh partner: ${m[0].trim()}`);
});

test("colour scheme: follows the system, can be forced, and theme-color is set for both", () => {
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /theme-color" content="#f8f1e3" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /theme-color" content="#1e1712" media="\(prefers-color-scheme: dark\)"/);
  const tk = css("tokens.css");
  assert.match(tk, /--canvas: #f8f1e3/); assert.match(tk, /--canvas: #1e1712/);
  assert.match(tk, /color-scheme: light dark/); assert.match(tk, /:root\[data-theme="dark"\]/); assert.match(tk, /:root\[data-theme="light"\]/);
});

test("layout: content is capped around 1200px, and the page can never scroll sideways", () => {
  assert.match(css("tokens.css"), /--content-max: 1200px/);
  assert.match(css("layout.css"), /\.page \{[^}]*max-width: var\(--content-max\)/s);
  assert.match(css("base.css"), /overflow-wrap: anywhere/);
});

test("one accent: buttons with text use the deeper accent fill, and the bright accent is never small text", () => {
  assert.doesNotMatch(SCREENS, /color:\s*var\(--accent\)\s*[;}]/, "the bright accent is never used as text colour");
  assert.match(css("components.css"), /\.btn-primary \{ background: var\(--accent-fill\); color: var\(--on-accent\)/);
  assert.ok(!/--coral/.test(ALL + css("tokens.css")), "the old coral token is gone");
});

test("the room is cozy at the edges: string lights sit in the reserved top strip, never over the bar's controls", () => {
  assert.match(css("tokens.css"), /--lights-h: 18px/);
  assert.match(css("layout.css"), /\.topbar \{[^}]*padding: calc\(env\(safe-area-inset-top, 0px\) \+ var\(--lights-h\)\)/s);
  assert.match(css("room.css"), /\.topbar::before, \.topbar::after \{[^}]*height: var\(--lights-h\)/s);
});

test("the old look is gone: no inline hex, no CSS-in-JS style strings, no emoji used as icons", () => {
  const files = readdirSync(new URL("../src/app/", import.meta.url), { recursive: true }).filter((f) => /\.jsx?$/.test(f));
  assert.ok(files.length > 15);
  for (const f of files) {
    const t = readFileSync(new URL("../src/app/" + f, import.meta.url), "utf8");
    assert.ok(!/<style>|_CSS\b|dangerouslySetInnerHTML/.test(t), `${f}: no inline stylesheet`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(t.replace(/[\u2713\u2192\u2190\u00b7\u2013\u2014\u2018\u2019\u201c\u201d]/g, "")), `${f}: no emoji as icons`);
  }
  assert.ok(!readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").includes("CALM_CSS"));
});

test("one icon set: only lucide-react", () => {
  for (const f of readdirSync(new URL("../src/app/", import.meta.url), { recursive: true }).filter((x) => /\.jsx$/.test(x))) {
    const t = readFileSync(new URL("../src/app/" + f, import.meta.url), "utf8");
    for (const m of t.matchAll(/import[^;]*from "([^"]+)"/g)) assert.ok(!/react-icons|heroicons|fontawesome|phosphor|@tabler/i.test(m[1]), `${f} imports ${m[1]}`);
  }
});

test("skeletons, not spinners: nothing rotates and loading shows the shape of what is coming", () => {
  assert.ok(!/\bspin\b/.test(ALL), "no spinner animation or class in the stylesheets");
  assert.ok(!/export const Spinner/.test(readFileSync(new URL("../src/app/ui.jsx", import.meta.url), "utf8")));
  assert.ok(!/rotate\(360deg\)/.test(ALL));
  assert.match(css("components.css"), /\.skel::after \{[^}]*animation: shimmer/);
});
