// "Calm": the one design layer for the whole app. It comes after the app's own stylesheet in STYLES (App.jsx) and replaces
// the old redesign, v30 and v31 layers. The boarding pass, plane and unboxing keep their own files and are not touched here.
//
// Idea: light surfaces are for planning, dark surfaces are for focusing.
//  - The page is a warm paper planner: cream canvas, serif headings, lists ruled with hairlines instead of a stack of cards.
//  - The focus timer and every study session sit on the dark surface, so starting to study feels like lowering the lights.
//  - Coral is scarce: the main button, the active tab icon, the weekly ring and a finished check. Subject colours do the rest.
//  - Depth comes from colour blocks, not shadows. Only sheets and toasts float.
// Tokens come from DESIGN.md. Two are nudged so small text passes WCAG AA: muted text, and the fill behind white button labels.

const SERIF = `"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`;
const SANS = `"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;

// The dark palette is used three times: the dark theme, the study stage, and the focus timer card.
const DARK = `--bg:#181715;--paper:#1F1E1B;--soft:#1F1E1B;--wash:#252320;--strong:#2E2B27;--ink:#FAF9F5;--body:#D8D5CC;--muted:#A09D96;--faint:#8F8C84;--line:#33302B;--line-soft:#2A2825;--line-strong:#443F39;--accent-strong:var(--accent);--accent-ink:var(--accent);--accent-on:#1A1714;--danger:#E58A74;--danger-on:#1A1714;--errbg:#33201C;--ok:#7FB08D;--okbg:#1C2A21;--glass:rgba(24,23,21,.94);--shadow:0 1px 2px rgba(0,0,0,.4);--shadow-lg:0 30px 70px -24px rgba(0,0,0,.85);color-scheme:dark`;

export const CALM_CSS = `
/* ═══ tokens ═══ */
.hr{--bg:#FAF9F5;--paper:#FDFCF9;--soft:#F5F0E8;--wash:#EFE9DE;--strong:#E8E0D2;--ink:#141413;--body:#3D3D3A;--muted:#67655F;--faint:#716D64;--line:#E6DFD8;--line-soft:#EBE6DF;--line-strong:#D3CABD;--accent-strong:#B4573A;--accent-ink:#A8482A;--accent-active:#9C4A30;--accent-on:#FFFFFF;--danger:#B4432F;--danger-on:#FFFFFF;--errbg:#FBEEEA;--ok:#38724C;--okbg:#EAF3EC;--glass:rgba(250,249,245,.94);--r-xs:6px;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--shadow-sm:none;--shadow:0 1px 2px rgba(20,20,19,.06);--shadow-lg:0 24px 60px -24px rgba(20,20,19,.38);--ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.3,.64,1);--maxw:760px;color-scheme:light}
.hr[data-theme="dark"]{${DARK}}
.hr[data-focus="1"]{${DARK}}
.hr .focusCard{${DARK}}

/* ═══ base ═══ */
.hr{font-family:${SANS};font-size:16px;line-height:1.55;color:var(--ink);background:var(--bg);accent-color:var(--accent);caret-color:var(--accent)}
.hr p,.hr .sub,.hr .rowTitle{text-wrap:pretty}
.hr h1,.hr .h1,.hr h2,.hr h3{text-wrap:balance}
.hr button,.hr a,.hr input,.hr textarea,.hr select{touch-action:manipulation}
.hr ::selection{background:color-mix(in srgb,var(--accent) 24%,transparent)}
.hr :focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px;border-radius:var(--r-sm)}
.hr input:focus-visible,.hr textarea:focus-visible{outline-offset:1px}
.hr .bgfx{display:none}
.serif{font-family:${SERIF};letter-spacing:-.012em;font-weight:400}
.hr .meta{font-size:14px;color:var(--muted)}
.hr .h1{font-family:${SERIF};font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-.022em;margin:6px 0 6px;color:var(--ink);background:none;-webkit-text-fill-color:currentColor}
@media (min-width:760px){.hr .h1{font-size:40px}}
.hr .sub{color:var(--muted);margin:0 0 6px}
.hr .sectionTitle{font-family:${SERIF};font-weight:400;font-size:22px;margin:32px 0 12px}
.hr .page{animation:calmFade .22s var(--ease) both}
@keyframes calmFade{from{opacity:0}to{opacity:1}}
.hr .scroll{padding-bottom:calc(104px + env(safe-area-inset-bottom));scroll-behavior:auto}
@media (min-width:760px){.hr .scroll{padding-bottom:72px}}
.hr .err{color:var(--danger);font-size:14px}

/* ═══ buttons, inputs, chips ═══ */
.hr .btn:not(.newBtn){display:inline-flex}
.hr .btn{align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border:1px solid transparent;border-radius:var(--r-sm);font-size:15px;font-weight:500;letter-spacing:0;background:var(--ink);color:var(--bg);box-shadow:none;transition:background-color .18s var(--ease),transform .14s var(--ease),border-color .18s,opacity .18s}
.hr .btn:not(:disabled):active{transform:scale(.98)}
.hr .btn.accent{background:var(--accent-strong);color:var(--accent-on);overflow:visible}
.hr .btn.accent::after{display:none}
.hr .btn.accent:not(:disabled):active{background:var(--accent-active)}
.hr[data-theme="dark"] .btn.accent:not(:disabled):active,.hr[data-focus="1"] .btn.accent:not(:disabled):active{background:color-mix(in srgb,var(--accent) 84%,#000)}
.hr .btn.ghost{background:transparent;color:var(--ink);border-color:var(--line-strong)}
.hr .btn.ghost:not(:disabled):active{background:var(--wash)}
.hr .btn.danger{background:var(--danger);color:var(--danger-on)}
.hr .btn.small,.hr .small.btn{min-height:36px;padding:0 14px;font-size:14px;border-radius:var(--r-sm)}
.hr .btn:disabled{opacity:.45}
@media (hover:hover){.hr .btn.ghost:hover{background:var(--wash)}.hr .btn.accent:not(:disabled):hover{background:var(--accent-active)}}
.hr .input,.hr textarea.input{min-height:44px;padding:10px 14px;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--paper);font-size:16px;line-height:1.4;transition:border-color .18s,box-shadow .18s;box-shadow:none;transform:none}
.hr .input::placeholder{color:var(--faint)}
.hr .input:focus,.hr textarea.input:focus{border-color:var(--accent-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent);outline:0}
.hr .field label,.hr .v3-field>label{display:block;font-size:14px;font-weight:500;color:var(--body);margin-bottom:8px}
.hr .back{display:inline-flex;align-items:center;gap:2px;min-height:44px;padding:0 6px 0 0;margin-left:-4px;border:0;background:none;color:var(--muted);font-size:14px;font-weight:500}
@media (hover:hover){.hr .back:hover{color:var(--ink)}}
.hr .iconBtn{width:44px;height:44px;border-radius:var(--r-sm);color:var(--muted)}
.hr .chip{min-height:36px;padding:0 14px;border:1px solid var(--line-strong);background:transparent;border-radius:999px;font-size:14px;font-weight:500;color:var(--body);box-shadow:none;transform:none;transition:background-color .18s,border-color .18s,color .18s}
.hr .chip:active{transform:scale(.97)}
@media (hover:hover){.hr .chip:hover{background:var(--wash);border-color:var(--line-strong);color:var(--ink)}}
.hr .chip[aria-pressed="true"]{background:var(--wash);border-color:var(--ink);color:var(--ink);box-shadow:none;transform:none}
.hr .chips{padding:10px 0 6px;gap:8px}
.hr .seg,.hr .ico{background:var(--wash);border-radius:var(--r-sm);padding:3px;box-shadow:none}
.hr .seg button{min-height:36px;padding:0 14px;border-radius:6px;font-size:14px;font-weight:500;color:var(--muted)}
.hr .seg button[aria-pressed="true"]{color:var(--ink)}
.hr .seg .slider{background:var(--paper);border-radius:6px;box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(20,20,19,.06)}
.hr[data-theme="dark"] .seg .slider,.hr[data-focus="1"] .seg .slider,.hr .focusCard .seg .slider{background:var(--strong);box-shadow:none}
.hr .ico button{width:40px;height:36px;border-radius:6px}
.hr .ico button[aria-pressed="true"]{background:var(--paper);color:var(--ink);box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(20,20,19,.06)}
.hr .badge,.hr .filterBtn .fcount{background:var(--accent-strong);color:var(--accent-on)}
.hr .pill{border-radius:999px;font-size:13px}
.hr .dot{width:8px;height:8px;margin-right:7px}

/* ═══ shell: rail, header, phone tab bar ═══ */
.hr .rail{background:var(--bg);border-right:1px solid var(--line);backdrop-filter:none;padding:24px 12px 18px;gap:2px}
.hr .railLogo .logoFull,.hr .mark{font-family:${SERIF};font-weight:400;font-size:24px;letter-spacing:-.025em}
.hr .railLogo .logoMini{border-radius:var(--r-md);background:var(--ink);color:var(--bg);font-size:24px}
.hr .nav{border-radius:var(--r-sm);color:var(--muted);font-weight:500;transition:color .18s,background-color .18s}
@media (hover:hover){.hr .nav:hover{background:var(--soft);color:var(--ink)}}
.hr .nav[aria-current="page"]{color:var(--ink);font-weight:600}
.hr .nav[aria-current="page"] svg{color:var(--accent-ink)}
.hr .nav .slider,.hr .rail>.slider{background:var(--wash);border-radius:var(--r-sm)}
.hr .head{padding-top:18px;padding-bottom:10px;transition:none}
.hr .main[data-scrolled="1"] .head{box-shadow:0 1px 0 var(--line)}
.hr .classChip{background:var(--wash);border-radius:999px;color:var(--body);font-size:14px;padding:4px 12px}
.hr .classChip i{border-left-color:var(--line-strong);color:var(--accent-ink)}
.hr .hdrBtn,.hr .avatar{box-shadow:none;border:1px solid var(--line-strong);background:transparent;width:44px;height:44px;color:var(--body)}
.hr .avatar{border-radius:50%;font-family:${SERIF};background:var(--wash);border-color:transparent}
.hr .nav.acct .avatar{width:36px;height:36px}
@media (hover:hover){.hr .hdrBtn:hover{background:var(--wash);color:var(--ink)}}
.hr .searchPill{min-height:44px;border-radius:var(--r-sm);box-shadow:none;border-color:var(--line-strong);background:var(--paper);color:var(--muted);font-size:15px}
@media (hover:hover){.hr .searchPill:hover{border-color:var(--ink);box-shadow:none}}
.hr .kbd{background:var(--wash);border-radius:var(--r-xs);color:var(--muted)}
.hr .newBtn{min-height:44px;border-radius:var(--r-sm);box-shadow:none}
@media (max-width:759px){
  .hr .head{padding:max(14px,env(safe-area-inset-top)) 12px 6px 20px}
  .hr .hdrRight{gap:0}
  .hr .hdrBtn{border-color:transparent;width:44px;height:44px;border-radius:var(--r-sm)}
  .hr .avatar{width:36px;height:36px;margin:0 4px}
}
@media (min-width:1180px){.hr.app{grid-template-columns:264px minmax(0,1fr) 360px}.hr.app[data-wide="1"]{grid-template-columns:264px minmax(0,1fr)}}
.hr .side{background:var(--bg);border-left:1px solid var(--line);backdrop-filter:none;padding:26px 24px 36px;gap:28px}

/* the phone's tab bar is docked to the bottom edge: nothing floats over the content */
.hr .tabs{left:0;right:0;bottom:0;gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom));border:0;border-top:1px solid var(--line);border-radius:0;background:var(--bg);box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
.hr .tab{min-height:52px;padding:6px 0 5px;border-radius:var(--r-md);font-size:12px;font-weight:500;color:var(--muted);gap:2px}
.hr .tab[aria-current="page"]{color:var(--ink);font-weight:600}
.hr .tab[aria-current="page"] svg{color:var(--accent-ink);transform:none}
.hr .tab:active{background:var(--wash)}
.hr .tabs .slider{background:var(--wash);border-radius:var(--r-md)}
.hr .fab{right:20px;bottom:calc(76px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:var(--r-lg);background:var(--accent-strong);color:var(--accent-on);box-shadow:0 8px 20px -8px rgba(20,20,19,.45)}
.hr .fab:active{transform:scale(.94)}
.hr .toast{bottom:calc(84px + env(safe-area-inset-bottom));border-radius:var(--r-md);box-shadow:var(--shadow-lg);backdrop-filter:none}
@media (min-width:760px){.hr .toast{bottom:28px}}
.hr .tabs,.hr .fab{transition:opacity .2s var(--ease),transform .25s var(--ease)}
.hr:has(.overlay[data-show="1"]) .tabs{opacity:0;pointer-events:none;transform:translateY(16px)}
.hr:has(.overlay[data-show="1"]) .fab{opacity:0;pointer-events:none;transform:scale(.85)}

/* ═══ Tasks: greeting, quick actions, filters ═══ */
.hr .heroCard{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:6px 0 22px;padding:0;border:0;border-radius:0;background:none;box-shadow:none}
.hr .heroCard::before,.hr .heroCard.spot::before,.hr .heroCard.spot::after{display:none}
.hr .heroDate{font-size:14px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)}
.hr .heroDate::before{display:none}
.hr .heroCard .h1{font-size:28px;margin:4px 0 6px}
@media (min-width:760px){.hr .heroCard .h1{font-size:40px}.hr .heroCard{margin:10px 0 26px}}
.hr .heroCard .sub{margin:0;font-size:16px;line-height:1.5;max-width:34ch}
.hr .heroBody>*{animation:none}
.hr .heroChips{margin-top:12px}
.hr .streak{background:var(--wash);color:var(--body);font-weight:500;box-shadow:none;padding:5px 12px;font-size:14px}
.hr .streak svg{color:var(--accent-ink)}
.hr .streak.quiet{color:var(--muted)}
.hr .ring .bg{stroke:var(--strong);stroke-width:7}
.hr .ring .fg{stroke:var(--accent);stroke-width:7}
.hr .ring[data-bump="1"] .fg{filter:none}
.hr .ring .lbl b{font-family:${SERIF};font-size:24px}
.hr .ring .lbl span{font-size:11px}
.hr .note,.hr .ann{background:var(--wash);border:0;border-radius:var(--r-md);box-shadow:none;padding:12px 8px 12px 16px;margin:0 0 12px;animation:none}
.hr .note p,.hr .ann p{font-size:15px}
.hr .note p span{color:var(--ink);font-weight:600}
.hr .ann p{font-family:${SERIF};font-size:18px}
.hr .quickRow{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}
.hr .quickRow .btn{min-height:40px;padding:0 14px;border-radius:999px;background:transparent;border:1px solid var(--line-strong);color:var(--ink);font-size:14px;font-weight:500;box-shadow:none}
.hr .quickRow .btn svg{color:var(--accent-ink);margin-right:0!important}
@media (hover:hover){.hr .quickRow .btn:hover{background:var(--wash)}}
@media (max-width:759px){.hr .quickRow{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:none;mask-image:none;margin-right:-20px;padding-right:20px}.hr .quickRow::-webkit-scrollbar{display:none}.hr .quickRow .btn{flex:none;white-space:nowrap}}
.hr .filterBtn span{display:inline}
@media (max-width:519px){.hr .filterBtn span{display:none}}
.hr .fpanel .fin{gap:12px}

/* ═══ Tasks: the list is ruled like a planner page ═══ */
.hr .group{display:block;margin-top:34px}
.hr .group:first-of-type{margin-top:22px}
.hr .group>h3{display:flex;align-items:baseline;gap:10px;margin:0 0 4px;font-family:${SERIF};font-weight:400;font-size:22px;letter-spacing:-.015em;color:var(--ink)}
.hr .group>h3 small{background:none;padding:0;border-radius:0;font-family:${SANS};font-size:14px;font-weight:500;color:var(--muted)}
.hr .swipe{position:relative;margin:0 -12px;border-radius:var(--r-md);background:var(--bg);box-shadow:none;transform:none}
.hr .swipe:not(.leaving):not(.fresh){animation:none}
.hr .swipe::before{display:none}
.hr .swipe::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:1px;background:var(--line-soft);z-index:3;pointer-events:none}
.hr .swipe:last-child::after{display:none}
.hr .group>.swipe:last-of-type::after{display:none}
@media (hover:hover){.hr .swipe:hover{box-shadow:none;transform:none}}
.hr .under{background:var(--wash);color:var(--body);border-radius:var(--r-md)}
.hr .row{gap:14px;padding:14px 12px;border:0;border-radius:var(--r-md);background:var(--bg);box-shadow:none;animation:none;transition:background-color .15s;will-change:auto}
@media (hover:hover){.hr .row:hover{background:var(--soft);box-shadow:none;transform:none;border-color:transparent}}
.hr .row:active{transform:none;background:var(--wash)}
.hr .row[data-sel="1"]{background:var(--wash);box-shadow:none;border:0}
.hr .rowTitle{font-size:16px;font-weight:500;line-height:1.35;letter-spacing:0;white-space:normal;overflow:visible;text-overflow:clip;width:auto;max-width:100%;background:none;transition:color .3s}
.hr .rowTitle[data-done="1"]{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--faint);text-decoration-thickness:1px}
.hr .rowMeta{margin-top:4px;gap:2px 14px;font-size:14px;color:var(--muted)}
.hr .rowRight{gap:2px;font-size:14px}
.hr .due{background:none;padding:0;font-size:14px;font-weight:500;color:var(--muted)}
.hr .due[data-tone="today"]{background:none;color:var(--accent-ink);font-weight:600}
.hr .due[data-tone="late"]{background:none;color:var(--danger);font-weight:600}
.hr .due[data-tone="done"]{color:var(--faint)}
.hr .pri[data-p="High"]{color:var(--accent-ink);font-size:13px}
.hr .check{position:relative;width:24px;height:24px;margin-top:1px;border:1.5px solid var(--faint);background:none;box-shadow:none}
.hr .check::after{content:"";position:absolute;inset:-10px;border-radius:50%}
.hr .check[data-s="done"]{background:var(--accent);border-color:var(--accent);color:var(--accent-on);box-shadow:none}
.hr .check[data-s="progress"]{border-color:var(--accent);background:linear-gradient(90deg,var(--accent) 50%,transparent 50%)}
@media (hover:hover){.hr .check:hover{border-color:var(--accent-ink)}}
.hr .swipe.fresh .row{animation:calmFresh 1.8s var(--ease) both}
@keyframes calmFresh{0%,30%{background:color-mix(in srgb,var(--accent) 14%,var(--bg))}100%{background:var(--bg)}}

/* the board: columns are quiet trays, cards sit in them */
.hr .board{gap:16px}
.hr .col{background:var(--soft);border:1px solid transparent;border-radius:var(--r-lg);padding:14px 12px}
.hr .col[data-over="1"]{background:color-mix(in srgb,var(--accent) 10%,var(--soft));border-color:var(--accent)}
.hr .col h4{margin:2px 8px 8px;font-size:14px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--body)}
.hr .col .swipe{margin:8px 0 0;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-md)}
.hr .col .swipe::after{display:none}
.hr .col .row{background:var(--paper);padding:12px 14px}
.hr .colEmpty,.hr .dragHint{color:var(--muted)}

/* the calendar */
.hr .calHead{color:var(--muted);font-size:13px}
.hr .day{border-radius:var(--r-md);min-height:56px}
.hr .day[data-sel="1"]{background:var(--wash);border-color:transparent;box-shadow:none}
@media (hover:hover){.hr .day:hover{background:var(--soft)}}
.hr .day[data-today="1"] .num{background:var(--accent-strong);color:var(--accent-on)}

/* ═══ side panel: quiet sections, one dark card for the timer ═══ */
.hr .side .card{background:none;border:0;border-radius:0;padding:0;box-shadow:none;animation:none}
.hr .card h4{margin:0 0 12px;font-family:${SERIF};font-weight:400;font-size:20px;letter-spacing:-.01em;text-transform:none;color:var(--ink)}
.hr .card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:none;padding:20px;animation:none}
@media (hover:hover){.hr .card:hover,.hr .stat:hover{transform:none;box-shadow:none;border-color:var(--line)}}
.hr .side .card.focusCard{background:var(--bg);color:var(--ink);border-radius:var(--r-lg);padding:20px}
.hr .focusCard h4{color:var(--ink)}
.hr .focusCard .ring .bg{stroke:var(--strong)}
.hr .focusCard .btn.ghost{border-color:var(--line-strong)}
.hr .mini{padding:12px 0;border-bottom:1px solid var(--line-soft);font-size:15px}
@media (hover:hover){.hr .mini:hover{transform:none}}
.hr .mini:last-child{border-bottom:0}
.hr .sbar .t{height:4px;background:var(--strong);border-radius:2px}
.hr .sbar .t i{border-radius:2px}
.hr .sbar>div:first-child{font-size:15px}
.hr .gbar{height:4px;background:var(--strong)}
.hr .gbar i{background:var(--accent)}

/* ═══ sheets ═══ */
.hr .scrim{background:rgba(20,20,19,.42);backdrop-filter:none}
.hr .sheet{background:var(--bg);border-radius:var(--r-xl) var(--r-xl) 0 0;box-shadow:var(--shadow-lg);padding:12px 22px calc(28px + env(safe-area-inset-bottom))}
@media (min-width:760px){.hr .sheet{border-radius:var(--r-lg);border:1px solid var(--line);padding:26px 28px 30px}}
.hr .grab::before{background:var(--line-strong)}
.hr .sheetHead h3,.hr .sheetHead h2{font-family:${SERIF};font-weight:400;font-size:24px;letter-spacing:-.015em}
.hr .tourCard{border-radius:var(--r-lg)}

/* ═══ Done, Ask, subjects ═══ */
.hr .doneHero{background:var(--wash);border:0;border-radius:var(--r-lg);box-shadow:none;padding:22px 24px}
.hr .doneHero b{font-family:${SERIF};font-size:40px;font-weight:400}
.hr .msg.me{background:var(--wash);color:var(--ink);border-radius:16px 16px 4px 16px;padding:11px 16px}
.hr .msg.ai{font-family:${SERIF};font-size:18px;line-height:1.6}
.hr .added{border-left:2px solid var(--line-strong);color:var(--muted)}
.hr .composer{background:var(--bg);backdrop-filter:none;border-top:1px solid var(--line)}
.hr .composer textarea{border-radius:var(--r-md);border-color:var(--line-strong);background:var(--paper);box-shadow:none}
.hr .composer textarea:focus{border-color:var(--accent-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.hr .send{width:44px;height:44px;border-radius:var(--r-md);background:var(--accent-strong);color:var(--accent-on)}
.hr .send:disabled{background:var(--wash);color:var(--faint)}
.hr .suggest{display:flex;flex-direction:column;align-items:stretch;gap:0;margin-top:24px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper);overflow:hidden}
.hr .suggest>button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;text-align:left;border:0;border-radius:0;background:none;box-shadow:none;padding:12px 16px;font-size:16px;color:var(--ink)}
.hr .suggest>button+button{border-top:1px solid var(--line-soft)}
.hr .suggest>button::after{content:"\\2192";flex:none;color:var(--faint)}
@media (hover:hover){.hr .suggest>button:hover{background:var(--soft);transform:none}.hr .suggest>button:hover::after{color:var(--accent-ink)}}
.hr .subjHead{min-height:52px}
.hr .mcIcon,.hr .introIcon{border-radius:var(--r-md)}
.hr .opt{border-radius:var(--r-md);box-shadow:none}

/* ═══ page header (shared by Review, Data and the rest) ═══ */
.hr .v3-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:8px 0 22px}
.hr .v3-head>div{min-width:0}
.hr .v3-eyebrow{display:none}
.hr .v3-head .h1{margin:0}
.hr .v3-lede{margin:8px 0 0;color:var(--muted);line-height:1.5;max-width:46ch;font-size:16px}
.hr .v3-headBtn{flex:none;gap:8px}
@media (max-width:520px){.hr .v3-headBtn{display:none}}
.hr .v3-h{display:flex;align-items:baseline;gap:10px;margin:36px 0 14px;font-family:${SERIF};font-weight:400;font-size:22px;letter-spacing:-.015em;line-height:1.2}
.hr .v3-h small{font-family:${SANS};font-size:14px;color:var(--muted);font-weight:500}
.hr .v3-field{margin-bottom:20px}
.hr .v3-opt{font-weight:400;color:var(--faint);margin-left:6px}
.hr .v3-hint{font-size:14px;color:var(--muted);margin:10px 2px 0}
.hr .v3-tags{display:flex;flex-wrap:wrap;gap:8px}
.hr .v3-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--wash);color:var(--body);font-size:13px;font-weight:500}
.hr .v3-tag[data-warn="1"]{background:var(--errbg);color:var(--danger)}
.hr .v3-link{border:0;background:none;color:var(--accent-ink);padding:10px 6px;min-height:40px;font-size:14px;font-weight:600;border-radius:var(--r-sm)}
@media (hover:hover){.hr .v3-link:hover{text-decoration:underline;text-underline-offset:3px}}
.hr .v3-sheetFoot{position:sticky;bottom:-8px;display:flex;align-items:center;justify-content:space-between;gap:14px;margin:22px -22px -10px;padding:14px 22px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bg) 30%)}
.hr .v3-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--line-strong);border-top-color:var(--accent);animation:spin .8s linear infinite;display:block}

/* ═══ one list shape: notes, reviewers, upcoming ═══ */
.hr .v3-list{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--line)}
.hr .v3-note{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:14px 4px;border:0;border-bottom:1px solid var(--line);background:none;border-radius:0;box-shadow:none;transition:background-color .15s;min-height:64px}
@media (hover:hover){.hr .v3-note:hover{background:var(--soft);box-shadow:none;transform:none;border-color:var(--line)}}
.hr .v3-note:active{background:var(--wash);transform:none}
.hr .v3-noteIcon{flex:none;width:40px;height:40px;border-radius:var(--r-md);display:grid;place-items:center;background:var(--wash);color:var(--body)}
.hr .v3-noteIcon[data-kind="ai"]{background:var(--wash);color:var(--accent-ink)}
.hr .v3-noteIcon[data-kind="reviewer"]{background:var(--okbg);color:var(--ok)}
.hr .v3-noteMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hr .v3-noteMain>b{font-weight:500;font-size:16px;letter-spacing:0}
.hr .v3-noteMeta{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:14px;color:var(--muted)}
.hr .v3-noteState{flex:none;font-size:13px;font-weight:500;color:var(--muted);background:var(--wash);border-radius:999px;padding:3px 12px}
.hr .v3-noteState[data-ready="1"]{color:var(--ok);background:var(--okbg)}
.hr .v3-noteGo{color:var(--faint)}
.hr .v3-snip{margin:2px 4px 0;font-size:14px;color:var(--muted)}

/* ═══ Review ═══ */
.hr .rv{padding-bottom:48px}
.hr .rv-tabs{margin:2px 0 26px}
.hr .rv-next{border-radius:var(--r-lg);background:var(--wash);padding:24px 24px 22px}
.hr .rv-next[data-tone="empty"]{background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.hr .rv-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--paper);color:var(--body);font-size:13px;font-weight:500;line-height:1.4}
.hr .rv-badge[data-urgent="1"]{background:var(--accent-strong);color:var(--accent-on)}
.hr .rv-next h2{font-family:${SERIF};font-weight:400;font-size:28px;line-height:1.14;letter-spacing:-.02em;margin:14px 0 8px}
.hr .rv-next p{margin:0;color:var(--body);max-width:46ch}
.hr .rv-facts{display:flex;flex-wrap:wrap;gap:4px 22px;margin:14px 0 0;font-size:14px;color:var(--muted)}
.hr .rv-facts b{color:var(--ink);font-weight:600}
.hr .rv-acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:20px}
.hr .rv-scope{display:flex;align-items:center;gap:16px;width:100%;margin-top:26px;padding:16px 0;text-align:left;background:none;border:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);border-radius:0;min-height:72px}
.hr .rv-scopeMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hr .rv-scopeMain small{font-size:13px;color:var(--muted)}
.hr .rv-scopeMain b{font-weight:500;font-size:16px;overflow-wrap:anywhere}
.hr .rv-scopeMain span{font-size:14px;color:var(--muted)}
.hr .rv-scopeChange{flex:none;font-size:14px;font-weight:600;color:var(--accent-ink)}
@media (hover:hover){.hr .rv-scope:hover .rv-scopeChange{text-decoration:underline;text-underline-offset:3px}}
.hr .rv-h{font-family:${SERIF};font-weight:400;font-size:22px;letter-spacing:-.015em;margin:40px 0 14px;line-height:1.2}
.hr .rv-goals .seg{display:flex;width:100%}
.hr .rv-goals .seg button{flex:1;padding:0 4px;white-space:nowrap}
.hr .rv-goalHelp{font-size:15px;color:var(--muted);margin:14px 2px 16px}
.hr .rv-techs{display:flex;flex-direction:column;gap:10px}
.hr .rv-tech{border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper);transition:border-color .2s var(--ease),background-color .2s}
.hr .rv-tech[data-on="1"]{border-color:var(--ink)}
@media (hover:hover){.hr .rv-tech[data-on="0"]:hover{border-color:var(--line-strong);background:var(--soft)}}
.hr .rv-techHit{display:flex;align-items:flex-start;gap:14px;width:100%;padding:16px;text-align:left;background:none;border:0;border-radius:var(--r-md);min-height:72px}
.hr .rv-techIcon{flex:none;width:40px;height:40px;border-radius:var(--r-md);display:grid;place-items:center;background:var(--wash);color:var(--body);transition:background-color .2s,color .2s}
.hr .rv-tech[data-on="1"] .rv-techIcon{background:var(--accent-strong);color:var(--accent-on)}
.hr .rv-techBody{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.hr .rv-techTop{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px}
.hr .rv-techTop b{font-family:${SERIF};font-weight:400;font-size:20px;letter-spacing:-.012em;line-height:1.25}
.hr .rv-time{font-size:13px;color:var(--muted)}
.hr .rv-rec{font-style:normal;font-size:12px;font-weight:600;color:var(--accent-ink);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:999px;padding:2px 10px}
.hr .rv-techTip{font-size:15px;line-height:1.5;color:var(--body)}
.hr .rv-techGo{padding:0 16px 16px 70px;animation:calmFade .25s var(--ease) both}
@media (max-width:520px){.hr .rv-techGo{padding-left:16px}.hr .rv-techGo .btn{width:100%}}
.hr .rv-up{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.hr .rv-upRow{display:flex;align-items:center;gap:14px;min-height:60px;padding:12px 4px;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);border-radius:0}
@media (hover:hover){.hr .rv-upRow:hover{background:var(--soft)}}
.hr .rv-upRow .dot{flex:none;margin:0}
.hr .rv-upMain{flex:1;min-width:0;display:flex;flex-direction:column}
.hr .rv-upMain b{font-weight:500;font-size:16px}
.hr .rv-upMain small{font-size:14px;color:var(--muted)}
.hr .rv-upDue{flex:none;font-size:14px;font-weight:500;color:var(--muted)}
.hr .rv-upDue.soon{color:var(--accent-ink);font-weight:600}
.hr .rv-prep{display:flex;align-items:center;gap:12px;margin-top:14px;padding:14px 16px;border-radius:var(--r-md);background:var(--soft);box-shadow:inset 0 0 0 1px var(--line);font-size:15px;color:var(--body)}

/* reviewers library */
.hr .rv-make{display:grid;grid-template-columns:1fr;gap:12px}
@media (min-width:640px){.hr .rv-make{grid-template-columns:1fr 1fr}}
.hr .rv-makeCard{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px;text-align:left;border:0;border-radius:var(--r-lg);background:var(--wash);color:var(--ink);min-height:132px;transition:background-color .15s}
.hr .rv-makeCard svg{color:var(--accent-ink);margin-bottom:6px}
.hr .rv-makeCard b{font-family:${SERIF};font-weight:400;font-size:20px;letter-spacing:-.012em}
.hr .rv-makeCard span{font-size:15px;color:var(--body);line-height:1.45}
.hr .rv-makeCard:active{background:var(--strong)}
@media (hover:hover){.hr .rv-makeCard:hover{background:var(--strong)}}
.hr .rv-makeCard[data-main="1"]{background:var(--accent-strong);color:var(--accent-on)}
.hr .rv-makeCard[data-main="1"] svg,.hr .rv-makeCard[data-main="1"] span{color:var(--accent-on)}
.hr .rv-makeCard[data-main="1"]:active{background:var(--accent-active)}
@media (hover:hover){.hr .rv-makeCard[data-main="1"]:hover{background:var(--accent-active)}}
.hr .rv-group{margin-top:34px}
.hr .rv-groupHead{display:flex;align-items:center;gap:10px;margin:0 0 4px;font-family:${SERIF};font-weight:400;font-size:20px;letter-spacing:-.012em}
.hr .rv-groupHead small{font-family:${SANS};font-size:14px;color:var(--muted)}

/* reader */
.hr .v3-reader{padding-bottom:40px;max-width:68ch}
.hr .v3-readActs{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}

/* a reviewer, set like a printed study sheet: numbered sections, terms on hairlines, no boxes */
.hr .v3-doc{display:block;counter-reset:sec}
.hr .v3-docTitle{font-family:${SERIF};font-size:32px;font-weight:400;line-height:1.12;letter-spacing:-.022em;margin:4px 0 8px}
.hr .v3-docSec{padding:0;margin-top:32px;border:0;background:none;box-shadow:none;border-radius:0}
.hr .v3-docSec:first-of-type{margin-top:20px}
.hr .v3-docH{display:flex;align-items:baseline;gap:12px;margin:0 0 12px;font-family:${SERIF};font-weight:400;font-size:24px;letter-spacing:-.018em;line-height:1.2}
.hr .v3-docH::before{counter-increment:sec;content:counter(sec);flex:none;min-width:1ch;font-style:italic;font-size:16px;color:var(--accent-ink)}
.hr .v3-term{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;padding:12px 0;border-top:1px solid var(--line)}
.hr .v3-docH+.v3-term{border-top:0;padding-top:2px}
.hr .v3-term b{font-weight:600;font-size:16px;color:var(--ink)}
.hr .v3-term span{font-size:16px;line-height:1.6;color:var(--body)}
@media (min-width:640px){.hr .v3-term{grid-template-columns:minmax(120px,30%) minmax(0,1fr);gap:20px}}
.hr .v3-point{position:relative;margin:0;padding:6px 0 6px 20px;font-size:16px;line-height:1.6;color:var(--body)}
.hr .v3-point::before{content:"";position:absolute;left:4px;top:17px;width:6px;height:6px;border-radius:50%;background:var(--accent)}
.hr .v3-para{margin:0;padding:6px 0;font-size:16px;line-height:1.7;color:var(--body)}

/* ═══ the study stage: lights down, paper cards on a dark desk ═══ */
.hr[data-focus="1"] .run{max-width:600px;margin:0 auto;padding:4px 0 56px}
.hr[data-focus="1"] .run .h1{font-size:28px;margin:16px 0 4px}
@media (min-width:760px){.hr[data-focus="1"] .run .h1{font-size:32px}}
.hr[data-focus="1"] .run .sub{margin-bottom:20px}
.hr .runTop{display:flex;align-items:center;justify-content:space-between;gap:12px}
.hr .runStep{font-size:14px;font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums}
.hr .runBar{height:4px;margin:4px 0 0;background:var(--strong);border-radius:2px}
.hr .runBar i{background:var(--accent);border-radius:2px}
.hr[data-focus="1"] .fc,.hr[data-focus="1"] .runCard,.hr[data-focus="1"] .opt,.hr[data-focus="1"] .mBtn,.hr[data-focus="1"] .runDone{--paper:#FAF9F5;--ink:#141413;--body:#3D3D3A;--muted:#67655F;--faint:#716D64;--wash:#EFE9DE;--soft:#F5F0E8;--strong:#E8E0D2;--line:#E6DFD8;--line-soft:#EBE6DF;--line-strong:#D3CABD;--accent-strong:#B4573A;--accent-ink:#A8482A;--accent-on:#FFFFFF;--ok:#38724C;--okbg:#EAF3EC;--danger:#B4432F;--errbg:#FBEEEA;color-scheme:light;background:var(--paper);color:var(--ink)}
.hr[data-focus="1"] .fc{border:0;border-radius:var(--r-lg);box-shadow:none;min-height:240px;padding:32px 28px;font-family:${SERIF};font-size:24px;line-height:1.35;letter-spacing:-.012em}
.hr[data-focus="1"] .runCard{border:0;border-radius:var(--r-lg);padding:24px}
.hr[data-focus="1"] .opt{border:1px solid var(--line);min-height:52px;padding:14px 16px}
.hr[data-focus="1"] .rateRow{gap:10px}
.hr[data-focus="1"] .runDone{border:0;border-radius:var(--r-lg);padding:28px}
.hr[data-focus="1"] .btn.ghost{color:var(--ink);border-color:var(--line-strong)}
.hr[data-focus="1"] .fbOk{color:var(--ok)}
.hr[data-focus="1"] .fbBad{color:var(--danger)}

/* a study session owns the screen: the page header and tabs step aside, labels on the card are small sans, the answer is serif */
.hr[data-focus="1"] .v3-head,.hr[data-focus="1"] .rv-tabs{display:none}
.hr[data-focus="1"] .fc small{font-family:${SANS};font-size:13px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)}
.hr[data-focus="1"] .fc em{font-family:${SANS};font-size:13px;color:var(--muted)}
.hr[data-focus="1"] .fc span.serif{font-size:28px;line-height:1.25}
.hr[data-focus="1"] .fc[data-flip="1"] span.serif{font-size:22px;line-height:1.45}
.hr[data-focus="1"] .rateRow .btn small{font-size:13px;opacity:.8}
@media (max-width:520px){.hr .v3-lede{display:none}.hr .rv-tabs{margin-bottom:18px}.hr .v3-head{margin-bottom:14px}.hr .rv-next{padding:20px 18px}.hr .rv-scope{margin-top:20px}.hr .rv-h{margin-top:32px}}

.hr[data-focus="1"] .run>.back{display:flex;justify-content:center;margin:18px auto 0}

/* ═══ Data ═══ */
.hr .v3-stats{display:grid;grid-template-columns:repeat(4,1fr);border:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:none;border-radius:0;box-shadow:none}
.hr .v3-stats>div{display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:16px 4px 14px 16px}
.hr .v3-stats>div:first-child{padding-left:0}
.hr .v3-stats>div+div{border-left:1px solid var(--line)}
.hr .v3-stats b{font-family:${SERIF};font-weight:400;font-size:32px;letter-spacing:-.02em;line-height:1.1}
.hr .v3-stats span{font-size:13px;color:var(--muted)}
.hr .v3-add{display:flex;align-items:center;gap:16px;margin-top:16px;padding:18px;border:1.5px dashed var(--line-strong);border-radius:var(--r-lg);background:var(--soft);transition:background-color .2s,border-color .2s}
.hr .v3-add[data-over="1"]{background:color-mix(in srgb,var(--accent) 12%,var(--soft));border-color:var(--accent);transform:none}
.hr .v3-addIcon{flex:none;width:48px;height:48px;border-radius:var(--r-md);display:grid;place-items:center;background:var(--accent-strong);color:var(--accent-on);box-shadow:none}
.hr .v3-add>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hr .v3-add b{display:block;font-weight:600;font-size:16px}
.hr .v3-add span{display:block;font-size:14px;color:var(--muted);line-height:1.45}
@media (max-width:520px){.hr .v3-add{flex-wrap:wrap}.hr .v3-add>.btn{width:100%}}
.hr .v3-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:22px 0 6px}
.hr .v3-search{flex:1;min-width:220px;display:flex;align-items:center;gap:10px;padding:0 6px 0 14px;height:44px;border:1px solid var(--line-strong);background:var(--paper);border-radius:var(--r-sm);color:var(--faint);transition:border-color .2s,box-shadow .2s}
.hr .v3-search:focus-within{border-color:var(--accent-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.hr .v3-search input{flex:1;min-width:0;border:0;background:none;outline:0;font-size:16px;height:100%;color:var(--ink)}
.hr .v3-nudge{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:14px 0 0;padding:12px 16px;border-radius:var(--r-md);background:var(--wash);border:0;font-size:15px;line-height:1.45;color:var(--body)}
.hr .v3-nudge b{color:var(--ink)}
.hr .v3-crumb{display:flex;align-items:center;gap:12px;margin:10px 0 2px;font-size:14px;color:var(--muted)}
.hr .v3-subjGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (min-width:600px){.hr .v3-subjGrid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
.hr .v3-subj{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:132px;padding:18px 18px 16px;text-align:left;border:0;border-radius:var(--r-md);background:var(--soft);box-shadow:none;transition:background-color .15s}
@media (hover:hover){.hr .v3-subj:hover{background:var(--wash);box-shadow:none;transform:none;border-color:transparent}}
.hr .v3-subj:active{background:var(--wash);transform:none}
.hr .v3-subjBar{width:28px;height:4px;border-radius:2px;background:var(--c);margin-bottom:6px}
.hr .v3-subj>b{font-family:${SERIF};font-size:22px;font-weight:400;line-height:1.15;letter-spacing:-.015em;padding-right:22px}
.hr .v3-subjMeta{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--body);font-weight:500}
.hr .v3-subjTopics{font-size:14px;color:var(--muted);line-height:1.4}
.hr .v3-subjGo{position:absolute;top:18px;right:16px;color:var(--faint)}
.hr .v3-tag .dot{margin:0}
.hr .v3-subjHead{display:flex;align-items:center;gap:14px;margin:8px 0 16px}
.hr .v3-subjHead h2{font-family:${SERIF};font-size:32px;font-weight:400;margin:0;line-height:1.1;letter-spacing:-.022em}
.hr .v3-subjDot{flex:none;width:6px;align-self:stretch;min-height:40px;border-radius:3px;background:var(--c)}
.hr .v3-subjActs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px}
.hr .v3-topic{margin-top:32px}
.hr .v3-topicHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:6px}
.hr .v3-topicHead h3{display:flex;align-items:baseline;gap:10px;margin:0;font-family:${SERIF};font-weight:400;font-size:22px;letter-spacing:-.015em}
.hr .v3-topicHead h3 small{font-family:${SANS};font-size:14px;color:var(--muted)}
.hr .v3-empty{padding:48px 8px}
.hr .v3-nacts{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.hr .v3-fileBtn{display:flex;align-items:center;gap:12px;width:100%;margin-top:6px;padding:12px 14px;text-align:left;border:1px solid var(--line-strong);background:var(--paper);border-radius:var(--r-sm);color:var(--ink);min-height:52px}
.hr .v3-fileBtn>svg{color:var(--accent-ink)}
.hr .v3-fileBtn b{font-weight:600;font-size:15px}
.hr .v3-fileBtn em{font-style:normal;font-size:14px;color:var(--muted)}
.hr .v3-drop{display:flex;align-items:center;gap:14px;width:100%;margin-bottom:14px;padding:16px;text-align:left;border:1.5px dashed var(--line-strong);border-radius:var(--r-md);background:var(--soft);transition:background-color .2s,border-color .2s}
.hr .v3-drop[data-over="1"]{background:color-mix(in srgb,var(--accent) 12%,var(--soft));border-color:var(--accent)}
.hr .v3-dropIcon{flex:none;width:44px;height:44px;border-radius:var(--r-md);display:grid;place-items:center;background:var(--wash);color:var(--accent-ink)}
.hr .v3-dropText b{font-weight:600;font-size:15px}
.hr .v3-dropText span{font-size:14px;color:var(--muted)}
.hr .v3-file{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:var(--okbg);color:var(--ok);font-size:13px;font-weight:500}
.hr .v3-fileNote{font-size:14px;color:var(--muted)}
.hr .v3-detailStats{display:grid;grid-template-columns:repeat(3,1fr);margin:20px 0;border:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:none;border-radius:0}
.hr .v3-detailStats>div{display:flex;flex-direction:column;align-items:flex-start;padding:14px 4px 12px 16px}
.hr .v3-detailStats>div:first-child{padding-left:0}
.hr .v3-detailStats>div+div{border-left:1px solid var(--line)}
.hr .v3-detailStats b{font-family:${SERIF};font-weight:400;font-size:28px;line-height:1.1}
.hr .v3-detailStats span{font-size:13px;color:var(--muted)}
.hr .v3-matCard{border-radius:0}
.hr .v3-matCard[data-open="1"]>.v3-note{border-bottom-color:transparent}
.hr .v3-matBody{padding:8px 4px 24px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:none}

@media (max-width:520px){
  .hr .rv-next{padding:20px 18px 18px}
  .hr .rv-next h2{font-size:24px}
  .hr .v3-stats b{font-size:28px}
  .hr .v3-docTitle{font-size:28px}
}
/* touch screens: every control is at least 44px, mouse screens keep the tighter sizes */
@media (pointer:coarse){
  .hr .seg button,.hr .chip,.hr .btn.small,.hr .small.btn,.hr .ico button,.hr .filterBtn{min-height:44px}
  .hr .ico button{width:44px}
  .hr .avatar,.hr .iconBtn,.hr .hdrBtn,.hr .note button.iconBtn,.hr .ann button.iconBtn{width:44px;height:44px}
  .hr .v3-link{min-height:44px}
  .hr .quickRow .btn{min-height:44px}
}
@media (prefers-reduced-motion:reduce){
  .hr .page,.hr .rv-techGo,.hr .swipe.fresh .row{animation:none}
  .hr .btn,.hr .chip,.hr .tabs,.hr .fab{transition:none}
}
`;
