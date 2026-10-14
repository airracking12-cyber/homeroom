// The redesign layer. It is appended after the app's own stylesheet (see STYLES in App.jsx), so everything here wins on equal
// specificity and nothing in the original needs to be edited or deleted. Delete this file's import to go back to v26.
//
// Direction: the same calm, warm paper, but with depth and restraint.
//  - one quiet atmosphere (a sage mist and a clay glow) instead of three coloured blobs and a dot grid
//  - surfaces that sit at different heights: cards are soft, rows are flatter, sheets and menus float
//  - one radius per level of hierarchy, and layered shadows with a tint of the page colour instead of grey
//  - labels in sentence case, numerals that line up, calmer focus and selection states
export const REDESIGN_CSS = `
/* ── tokens ── */
.hr{--bg:#F4F2EB;--paper:#FFFEFB;--ink:#1D1C19;--muted:#6B685E;--faint:#A19D90;--line:#E8E4D8;--wash:#EDEADF;--body:#3A3934;
  --mist:#D9E4DF;--glass:rgba(244,242,235,.78);
  --r-sm:12px;--r-md:18px;--r-lg:24px;--r-xl:32px;
  --shadow-sm:0 1px 1px rgba(52,42,22,.04),0 2px 6px -1px rgba(52,42,22,.05);
  --shadow:0 1px 2px rgba(52,42,22,.05),0 10px 28px -10px rgba(52,42,22,.18),0 2px 8px -2px rgba(52,42,22,.06);
  --shadow-lg:0 2px 4px rgba(52,42,22,.05),0 30px 70px -20px rgba(40,32,14,.34),0 12px 24px -12px rgba(40,32,14,.14)}
.hr[data-theme="dark"]{--bg:#141413;--paper:#1D1C1A;--ink:#F3F0E8;--muted:#A9A599;--faint:#77746A;--line:#2C2A26;--wash:#24221F;--body:#DAD7CD;
  --mist:#22302C;--glass:rgba(20,20,19,.78);
  --shadow-sm:0 1px 1px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.25);--shadow:0 12px 30px -12px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.3);--shadow-lg:0 34px 80px -24px rgba(0,0,0,.85)}
.hr{font-feature-settings:"cv11","ss03";font-variant-numeric:tabular-nums}
.hr p,.hr .sub,.hr .rowTitle{text-wrap:pretty}
.hr h1,.hr .h1,.hr .tourH{text-wrap:balance}
.hr ::selection{background:color-mix(in srgb,var(--accent) 22%,transparent)}
.hr :focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 75%,var(--ink));outline-offset:3px;border-radius:10px}

/* ── atmosphere: quiet, and only at the edges ── */
.bgfx::after{display:none}
.bgfx i{filter:blur(96px);animation-duration:46s}
.bgfx i:nth-child(1){width:620px;height:620px;right:-200px;top:-260px;background:color-mix(in srgb,var(--accent) 13%,transparent)}
.bgfx i:nth-child(2){width:560px;height:560px;left:-120px;bottom:-280px;background:var(--mist);opacity:.8}
.bgfx i:nth-child(3){display:none}

/* ── navigation ── */
.rail{background:color-mix(in srgb,var(--paper) 62%,transparent);border-right:1px solid color-mix(in srgb,var(--line) 70%,transparent);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4)}
.nav{border-radius:var(--r-md)}
.nav[aria-current="page"]{background:color-mix(in srgb,var(--accent) 9%,var(--paper));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 16%,transparent),var(--shadow-sm)}
.tabs{bottom:calc(12px + env(safe-area-inset-bottom));border-radius:26px;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:var(--glass);box-shadow:var(--shadow-lg);backdrop-filter:blur(28px) saturate(1.6);-webkit-backdrop-filter:blur(28px) saturate(1.6)}
.tab{border-radius:20px}
.hdrBtn,.avatar,.searchPill{border-color:color-mix(in srgb,var(--line) 85%,transparent);box-shadow:var(--shadow-sm)}
.searchPill{border-radius:var(--r-md)}

/* ── surfaces ── */
.card{border-radius:var(--r-lg);border-color:color-mix(in srgb,var(--line) 70%,transparent);box-shadow:var(--shadow-sm)}
.card h4,.col h4{font-size:14px;font-weight:550;letter-spacing:0;text-transform:none;color:var(--muted)}
.row{border-radius:var(--r-md);border-color:color-mix(in srgb,var(--line) 75%,transparent);padding:16px 18px;transition:border-color .25s var(--ease),box-shadow .35s var(--ease),transform .35s var(--ease),background .25s}
@media (hover:hover){.row:hover{border-color:var(--accent-line);box-shadow:var(--shadow);transform:translateY(-1px)}}
.swipe{border-radius:var(--r-md);box-shadow:none}
.rowTitle{font-size:15.5px;letter-spacing:-.005em}
.rowMeta{margin-top:5px}
.col{border-radius:var(--r-lg);background:color-mix(in srgb,var(--wash) 55%,transparent)}
.heroCard{border-bottom-color:color-mix(in srgb,var(--line) 70%,transparent)}
.heroCard .h1{letter-spacing:-.03em}
.ring .fg{stroke-width:7}
.ring .bg{stroke-width:7;stroke:color-mix(in srgb,var(--line) 85%,transparent)}
.streak{background:color-mix(in srgb,var(--accent) 10%,var(--paper));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 16%,transparent)}
.chip{border-color:color-mix(in srgb,var(--line) 85%,transparent);box-shadow:var(--shadow-sm)}
.chip[aria-pressed="true"]{box-shadow:0 0 0 1px var(--ink) inset,var(--shadow-sm)}
.seg,.ico{background:color-mix(in srgb,var(--wash) 85%,transparent);box-shadow:inset 0 1px 2px rgba(52,42,22,.06)}
.ico button[aria-pressed="true"]{box-shadow:0 1px 2px rgba(52,42,22,.1),0 2px 6px -1px rgba(52,42,22,.1)}
.note,.ann{border-radius:var(--r-md)}
.fcard{border-radius:var(--r-xl);box-shadow:var(--shadow)}
.opt,.suggest button{border-radius:var(--r-md)}

/* ── controls ── */
.btn{border-radius:var(--r-md);letter-spacing:-.003em;box-shadow:0 1px 1px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1)}
.btn.ghost{box-shadow:var(--shadow-sm);background:var(--paper)}
.btn.accent{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#fff),var(--accent));box-shadow:0 1px 1px rgba(0,0,0,.1),0 8px 18px -8px color-mix(in srgb,var(--accent) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.22)}
.small{border-radius:var(--r-sm)}
.input,.composer textarea,.cmtIn textarea{border-radius:var(--r-md);border-color:color-mix(in srgb,var(--line) 90%,transparent);background:var(--paper);box-shadow:inset 0 1px 2px rgba(52,42,22,.04)}
.input:focus,.composer textarea:focus{box-shadow:0 0 0 4px var(--accent-soft),inset 0 1px 2px rgba(52,42,22,.03)}
.fab{border-radius:22px;box-shadow:0 14px 30px -10px color-mix(in srgb,var(--accent) 75%,transparent),0 2px 6px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.28)}
.check{border-color:color-mix(in srgb,var(--faint) 85%,transparent)}

/* ── sheets, menus, toasts float higher and softer ── */
.scrim{background:rgba(24,20,12,.34);backdrop-filter:blur(8px)}
.sheet{border-radius:var(--r-xl) var(--r-xl) 0 0;box-shadow:var(--shadow-lg)}
@media (min-width:760px){.sheet{border-radius:var(--r-xl)}}
.toast{border-radius:var(--r-md);box-shadow:var(--shadow-lg);backdrop-filter:blur(14px)}

/* ── the walkthrough sits above the plane, so its first card can arrive while the plane is still crossing ── */
.tour{z-index:320}
.tourBurst{z-index:322}
.tourCard{border-radius:28px;border-color:color-mix(in srgb,var(--line) 70%,transparent);box-shadow:var(--shadow-lg);padding:22px 24px 16px}
.tourH{font-size:24px;letter-spacing:-.025em}
.tourHole{box-shadow:0 0 0 100vmax rgba(28,22,12,.5)}
.tourDo{font-weight:600}

/* ── scrollbars ── */
.hr .scroll,.hr .side,.hr .sheet,.hr .msgs{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--faint) 45%,transparent) transparent}

@media (prefers-reduced-motion:reduce){.bgfx i{animation:none}.row:hover{transform:none}}
`;
