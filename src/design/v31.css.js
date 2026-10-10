// v31: the visual upgrade. It sits on top of v30 and uses the same tokens, so the theme, accent colour and dark mode all carry through.
// What changes, in order of how much you will notice it:
//  1. an ambient canvas (three soft colour glows and a hint of paper grain) instead of one flat cream
//  2. one shared depth language for cards and rows: a lit top edge, a close shadow and a soft far shadow
//  3. the Tasks greeting is a real hero card (glow, arcs, a bigger ring) rather than text on the page
//  4. controls with body: raised primary buttons, sunken segmented tracks, chips that lift
//  5. calmer chrome: a frosted rail whose active item has an accent edge, a tab bar with a lit rim
//  6. motion: pages and lists arrive in a short stagger; everything honours "reduce motion"
// Delete this import (see App.jsx STYLES) to go back to v30's look.
export const V31_CSS = `
.hr{
  --lit:inset 0 1px 0 rgba(255,255,255,.85);
  --depth-1:var(--lit),0 1px 2px rgba(60,40,20,.05),0 10px 26px -14px rgba(60,40,20,.16);
  --depth-2:var(--lit),0 2px 4px rgba(60,40,20,.06),0 18px 38px -16px rgba(60,40,20,.24);
  --glow-a:color-mix(in srgb,var(--accent) 10%,transparent);
  --glow-b:rgba(107,163,209,.10);
  --glow-c:rgba(95,139,109,.09);
  font-feature-settings:"cv11","ss03","calt";
}
.hr[data-theme="dark"]{
  --lit:inset 0 1px 0 rgba(255,255,255,.07);
  --depth-1:var(--lit),0 1px 2px rgba(0,0,0,.4),0 12px 28px -14px rgba(0,0,0,.6);
  --depth-2:var(--lit),0 2px 4px rgba(0,0,0,.45),0 22px 42px -16px rgba(0,0,0,.7);
  --glow-a:color-mix(in srgb,var(--accent) 12%,transparent);
  --glow-b:rgba(107,163,209,.08);
  --glow-c:rgba(95,139,109,.07);
}

/* 1 · the canvas */
.hr{background-image:radial-gradient(920px 540px at 6% -10%,var(--glow-a),transparent 62%),radial-gradient(780px 520px at 100% 2%,var(--glow-b),transparent 60%),radial-gradient(720px 620px at 72% 112%,var(--glow-c),transparent 62%);background-attachment:fixed}
.hr .scroll{scroll-behavior:smooth}

/* 2 · depth: the same card language everywhere */
.hr .row,.hr .card,.hr .v3-note,.hr .v3-card,.hr .v3-subj,.hr .v3-up,.hr .v3-stats,.hr .v3-docSec,.hr .v3-scope,.hr .v3-tech,.hr .v3-detailStats,.hr .sk{box-shadow:var(--depth-1)}
@media (hover:hover){
  .hr .row:hover,.hr .v3-note:hover,.hr .v3-card:hover,.hr .v3-subj:hover,.hr .v3-scope:hover,.hr .v3-tech:hover{box-shadow:var(--depth-2)}
}
.hr .card{border-radius:24px;background:linear-gradient(180deg,color-mix(in srgb,var(--paper) 100%,transparent),color-mix(in srgb,var(--paper) 94%,var(--wash)))}
.hr .row{border-radius:20px;background:linear-gradient(180deg,var(--paper),color-mix(in srgb,var(--paper) 95%,var(--wash)))}

/* 3 · the Tasks hero card */
.hr .heroCard.spot{position:relative;overflow:hidden;margin-top:6px;padding:22px 22px 20px;border:1px solid color-mix(in srgb,var(--accent) 14%,var(--line));border-radius:28px;background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 10%,var(--paper)) 0%,var(--paper) 58%),var(--paper);box-shadow:var(--depth-2)}
.hr .heroCard.spot::before{content:"";position:absolute;right:-70px;top:-90px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 22%,transparent),transparent 68%);pointer-events:none}
.hr .heroCard.spot::after{content:"";position:absolute;right:-34px;bottom:-120px;width:260px;height:260px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--accent) 14%,transparent);box-shadow:0 0 0 22px color-mix(in srgb,var(--accent) 5%,transparent),0 0 0 46px color-mix(in srgb,var(--accent) 3%,transparent);pointer-events:none}
.hr .heroCard.spot>*{position:relative;z-index:1}
.hr .heroCard .h1{font-size:clamp(28px,5vw,38px);letter-spacing:-.032em;line-height:1.06;text-wrap:balance}
.hr .heroCard .sub{color:var(--muted);max-width:34ch}
.hr .heroCard .ring{filter:drop-shadow(0 6px 14px color-mix(in srgb,var(--accent) 22%,transparent))}
.hr .heroCard .ring .bg{stroke:color-mix(in srgb,var(--accent) 12%,var(--line))}
.hr .heroChips .streak{background:color-mix(in srgb,var(--paper) 80%,transparent);border:1px solid color-mix(in srgb,var(--accent) 16%,var(--line));backdrop-filter:blur(6px)}
.hr .heroDate{display:inline-flex;align-items:center;gap:8px}
.hr .heroDate::before{content:"";width:18px;height:2px;border-radius:1px;background:var(--accent)}

/* the day groups */
.hr .group>h2,.hr .group>h3,.hr .group>.gh,.hr .group>.ghead{display:flex;align-items:center;gap:10px;font-size:20px;letter-spacing:-.02em}
.hr .group>h2 small,.hr .group>h3 small,.hr .group>.gh small,.hr .group>.ghead small{display:inline-grid;place-items:center;min-width:24px;height:22px;padding:0 8px;border-radius:999px;background:var(--wash);color:var(--muted);font:600 12px/1 "Inter",system-ui,sans-serif}

/* 4 · controls with body */
.hr .btn{letter-spacing:-.005em}
.hr .btn.accent{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 84%,#fff),var(--accent) 78%);box-shadow:inset 0 1px 0 rgba(255,255,255,.34),inset 0 -1px 0 rgba(0,0,0,.1),0 10px 22px -10px color-mix(in srgb,var(--accent) 80%,transparent)}
@media (hover:hover){.hr .btn.accent:not(:disabled):hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -1px 0 rgba(0,0,0,.1),0 14px 28px -10px color-mix(in srgb,var(--accent) 85%,transparent);transform:translateY(-1px)}}
.hr .btn.ghost{background:color-mix(in srgb,var(--paper) 82%,transparent);border:1px solid color-mix(in srgb,var(--line) 85%,transparent);box-shadow:var(--lit),0 1px 2px rgba(60,40,20,.05)}
.hr .seg{background:color-mix(in srgb,var(--wash) 88%,var(--line));box-shadow:inset 0 1px 2px rgba(60,40,20,.1),inset 0 0 0 1px color-mix(in srgb,var(--line) 60%,transparent)}
.hr .seg .slider{box-shadow:var(--lit),0 1px 3px rgba(60,40,20,.18),0 4px 10px -4px rgba(60,40,20,.18)}
.hr[data-theme="dark"] .seg{box-shadow:inset 0 1px 3px rgba(0,0,0,.45)}
.hr .chip{box-shadow:var(--lit),0 1px 2px rgba(60,40,20,.05);transition:transform .3s var(--spring),box-shadow .25s var(--ease),border-color .2s,background .2s}
@media (hover:hover){.hr .chip:hover{transform:translateY(-1px)}}
.hr .chip:active{transform:scale(.96)}
.hr .input,.hr textarea.input{background:color-mix(in srgb,var(--paper) 90%,transparent);box-shadow:inset 0 1px 2px rgba(60,40,20,.06)}
.hr .input:focus,.hr textarea.input:focus{box-shadow:0 0 0 4px var(--accent-soft),inset 0 1px 2px rgba(60,40,20,.04)}
.hr .check{background:var(--paper);box-shadow:inset 0 1px 2px rgba(60,40,20,.08)}
@media (hover:hover){.hr .check:hover{border-color:var(--accent);box-shadow:0 0 0 5px var(--accent-soft)}}

/* 5 · chrome */
.hr .rail{background:linear-gradient(180deg,color-mix(in srgb,var(--paper) 74%,transparent),color-mix(in srgb,var(--paper) 42%,transparent));box-shadow:1px 0 0 rgba(255,255,255,.5) inset}
.hr .rail .slider::before{content:"";position:absolute;left:5px;top:24%;bottom:24%;width:3.5px;border-radius:3px;background:var(--accent)}
.hr .side{background:linear-gradient(180deg,color-mix(in srgb,var(--paper) 60%,transparent),color-mix(in srgb,var(--paper) 36%,transparent))}
.hr .tabs{box-shadow:var(--lit),0 1px 0 rgba(255,255,255,.4),0 18px 38px -14px rgba(60,40,20,.34),0 4px 10px -2px rgba(60,40,20,.12)}
.hr[data-theme="dark"] .tabs{box-shadow:var(--lit),0 18px 38px -14px rgba(0,0,0,.75)}
.hr .tab[aria-current="page"],.hr .tab[aria-pressed="true"]{color:var(--accent)}
.hr .sheet{border-radius:30px 30px 0 0;box-shadow:0 -24px 60px -20px rgba(40,24,8,.4),var(--lit)}
.hr .overlay{backdrop-filter:blur(3px) saturate(1.1)}

/* 6 · motion: a short stagger when a page or list arrives (pieces still being unboxed keep their own animation) */
@keyframes v31In{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}
.hr .scroll>:not([data-rv]):not(.sheet):nth-child(-n+9),.hr .group:not([data-rv])>.row:nth-child(-n+8),.hr .v3-list>*:nth-child(-n+8),.hr .v3-subjGrid>*:nth-child(-n+8){animation:v31In .6s var(--ease) both}
.hr .scroll>:nth-child(2){animation-delay:.04s}.hr .scroll>:nth-child(3){animation-delay:.08s}.hr .scroll>:nth-child(4){animation-delay:.12s}.hr .scroll>:nth-child(5){animation-delay:.16s}.hr .scroll>:nth-child(6){animation-delay:.2s}.hr .scroll>:nth-child(7){animation-delay:.24s}
.hr .group>.row:nth-child(2),.hr .v3-list>*:nth-child(2),.hr .v3-subjGrid>*:nth-child(2){animation-delay:.05s}
.hr .group>.row:nth-child(3),.hr .v3-list>*:nth-child(3),.hr .v3-subjGrid>*:nth-child(3){animation-delay:.1s}
.hr .group>.row:nth-child(4),.hr .v3-list>*:nth-child(4),.hr .v3-subjGrid>*:nth-child(4){animation-delay:.15s}
.hr .group>.row:nth-child(n+5),.hr .v3-list>*:nth-child(n+5),.hr .v3-subjGrid>*:nth-child(n+5){animation-delay:.2s}
@media (prefers-reduced-motion:reduce){.hr .scroll>*,.hr .group>.row,.hr .v3-list>*,.hr .v3-subjGrid>*{animation:none!important}}

/* phones: a slightly more compact hero so the list starts sooner */
@media (max-width:520px){
  .hr .heroCard.spot{padding:18px 18px 16px;border-radius:24px}
  .hr .heroCard .h1{font-size:28px}
  .hr .heroCard .sub{max-width:none}
}
`;
