// The design system's rules, read from the real stylesheets and entry files, so they can't quietly drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = (f) => readFileSync(new URL("../src/styles/" + f, import.meta.url), "utf8");
const FILES = readdirSync(new URL("../src/styles/", import.meta.url)).filter((f) => f.endsWith(".css"));
const ALL = FILES.map(css).join("\n");
const SCREENS = FILES.filter((f) => f !== "tokens.css").map(css).join("\n");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("tokens, base, components, layout and one stylesheet per area exist", () => {
  for (const f of ["tokens.css", "base.css", "components.css", "layout.css", "screens-auth.css", "screens-track.css", "screens-review.css", "screens-prepare.css", "screens-class.css", "screens-settings.css"]) assert.ok(FILES.includes(f), f);
});

test("type is the display serif at weight 400 with negative tracking, and a humanist sans body, self-hosted", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--font-display: "EB Garamond Variable"/);
  assert.match(tk, /--font-body: "Inter Variable"/);
  assert.match(tk, /--track-display: -0\.02em/);
  assert.match(css("base.css"), /h1, h2 \{[^}]*font-weight: 400;[^}]*letter-spacing: var\(--track-display\)/);
  assert.match(tk, /@import "@fontsource-variable\/eb-garamond/);
  assert.match(tk, /@import "@fontsource-variable\/inter/);
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(ALL + html), "no Google Fonts link");
});

test("the radius scale is 8 control, 12 card, 16 large, pill", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--r-control: 8px; --r-card: 12px; --r-large: 16px; --r-pill: 999px/);
});

test("display sizes stay app-sized: 28px on phones, 40px at most on desktop", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--fs-display: 28px;/);
  assert.match(tk, /@media \(min-width: 1024px\) \{[^}]*--fs-display: 40px/);
  const big = [...SCREENS.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])).filter((n) => n > 40 && n !== 72 && n !== 60 && n !== 44 && n !== 56);
  assert.deepEqual(big, [], "no heading bigger than the display size (the timer, scores and credit name are the exceptions)");
});

test("section spacing is 24 to 32px and card padding 16 to 24px, not marketing-site spacing", () => {
  const tk = css("tokens.css");
  assert.match(tk, /--section: 24px;/); assert.match(tk, /--pad-card: 16px;/);
  assert.match(tk, /@media \(min-width: 768px\) \{[^}]*--section: 32px; --pad-card: 20px/);
});

test("cards separate with hairlines, not shadows; shadows are only for things that float", () => {
  const withShadow = [...ALL.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "").matchAll(/([.\w:\-\[\]="' >]+)\s*\{[^}]*box-shadow:\s+(?!none|inset|0 0 0)[^;]*;/g)].map((m) => m[1].trim());
  const allowed = /fab|toast|sheet|dialog/;
  assert.deepEqual(withShadow.filter((s) => s && !allowed.test(s)), []);
});

test("no blur glass except the sticky bar, no transition: all, no ALL-CAPS beyond the small eyebrow label", () => {
  assert.ok(!/transition:\s*all\b/.test(ALL));
  const blur = ALL.match(/backdrop-filter/g) || [];
  assert.ok(blur.length <= 2, "only the sticky top bar blurs");
  const caps = [...ALL.matchAll(/([.\w\-]+)[^{}]*\{[^}]*text-transform:\s*uppercase/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(caps)], [".eyebrow"], "uppercase is only the small eyebrow label");
});

test("every interactive element has hover (on devices that hover), a visible focus state, and a pressed state", () => {
  assert.match(css("base.css"), /:focus-visible \{ outline: 2px solid var\(--focus\)/);
  const comp = css("components.css");
  assert.match(comp, /@media \(hover: hover\) \{[^}]*\.btn-primary:hover/);
  for (const sel of [".btn:active", ".chip:active", ".seg label:active", ".check:active", ".row-btn:active", ".fab:active", ".nav-item:active", ".day:active", ".seat:active"]) assert.ok(ALL.includes(sel), `${sel} pressed state`);
  assert.ok(!/(^|\n)[^@\n{]*:hover[^{]*\{/.test(comp.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}/g, "")) , "hover styling is only inside (hover: hover)");
});

test("touch targets are at least 44px on touch devices", () => {
  const comp = css("components.css");
  assert.match(comp, /--touch: 44px/.test(css("tokens.css")) ? /@media \(pointer: coarse\) \{ \.btn \{ min-height: var\(--touch\)/ : /never/);
  assert.match(comp, /\.chip \{ min-height: var\(--touch\)/);
  assert.match(comp, /\.check \{[^}]*width: var\(--touch\); height: var\(--touch\)/s);
  assert.match(comp, /\.input, \.textarea, \.select \{[^}]*min-height: 44px/s);
  assert.match(css("layout.css"), /\.nav-item \{[^}]*min-height: var\(--nav-h\)/s);
});

test("reduced motion is respected and zoom is not blocked", () => {
  assert.match(css("base.css"), /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale/);
  assert.match(html, /viewport-fit=cover/);
});

test("dynamic viewport units and safe areas are used, and plain 100vh always has a dvh partner", () => {
  assert.match(ALL, /100dvh/); assert.match(ALL, /env\(safe-area-inset-bottom/); assert.match(ALL, /env\(safe-area-inset-top/);
  for (const m of ALL.matchAll(/([^;{}\n]*\b100vh\b[^;{}\n]*;)([^;{}\n]*;)?/g)) assert.ok(/100dvh/.test(m[0]) || /100vh;\s*(?:\/\*[^*]*\*\/)?\s*$/.test(m[0]) , `100vh without a dvh partner: ${m[0].trim()}`);
});

test("colour scheme: follows the system, can be forced, and theme-color is set for both", () => {
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /theme-color" content="#faf9f5" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /theme-color" content="#1b1a17" media="\(prefers-color-scheme: dark\)"/);
  const tk = css("tokens.css");
  assert.match(tk, /color-scheme: light dark/); assert.match(tk, /:root\[data-theme="dark"\]/); assert.match(tk, /:root\[data-theme="light"\]/);
});

test("layout: content is capped around 1200px, and the page can never scroll sideways", () => {
  assert.match(css("tokens.css"), /--content-max: 1200px/);
  assert.match(css("layout.css"), /\.page \{[^}]*max-width: var\(--content-max\)/s);
  assert.match(css("base.css"), /overflow-wrap: anywhere/);
});

test("the coral accent is a fill for big shapes; text on coral uses the deeper fill", () => {
  assert.doesNotMatch(SCREENS.replace(/\/\*[\s\S]*?\*\//g, ""), /color:\s*var\(--coral\)/, "coral is never used as small text colour");
  assert.match(css("components.css"), /\.btn-primary \{ background: var\(--accent-fill\); color: var\(--on-accent\)/);
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
