// Long term review. It sits after CALM_CSS in STYLES and uses only its tokens, so light, dark and any accent colour just work.
//
// One bold thing: "This week" is the dark surface from DESIGN.md (the featured block). Everything else is quiet:
// hairline-ruled lists instead of cards, serif headings at weight 400, coral only on the main button and the current week.
// Weeks are the only thing numbered, because they really are a sequence.

const SERIF = `"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`;
const SANS = `"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;

export const LONGTERM_CSS = `
.hr .lt{padding-bottom:32px}
.hr .lt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.hr .lt-h2{font-family:${SERIF};font-weight:400;font-size:22px;line-height:1.2;letter-spacing:-.015em;margin:0 0 4px;color:var(--ink);text-wrap:balance}
.hr .lt-sec{margin-top:40px}
.hr .lt-sub{margin:0 0 14px;color:var(--muted);font-size:14px;line-height:1.5;max-width:56ch}

/* ───── setup: one question at a time ───── */
.hr .lt-wiz{max-width:560px}
.hr .lt-prog{height:3px;border-radius:3px;background:var(--line);margin:18px 0 30px;overflow:hidden}
.hr .lt-prog i{display:block;height:100%;width:var(--p,25%);background:var(--ink);transition:width .3s var(--ease)}
.hr .lt-q{font-family:${SERIF};font-weight:400;font-size:28px;line-height:1.15;letter-spacing:-.02em;margin:0 0 8px;color:var(--ink);text-wrap:balance;outline:0}
.hr .lt-help{margin:0 0 20px;color:var(--muted);font-size:15px;line-height:1.5;max-width:46ch}
.hr .lt-choices{border-top:1px solid var(--line)}
.hr .lt-choice{position:relative;display:flex;gap:14px;align-items:flex-start;padding:16px 4px;border-bottom:1px solid var(--line);cursor:pointer;min-height:44px}
.hr .lt-choice input{appearance:none;-webkit-appearance:none;flex:none;width:20px;height:20px;margin:2px 0 0;border:1.5px solid var(--line-strong);border-radius:50%;background:var(--paper);display:grid;place-content:center;cursor:pointer}
.hr .lt-choice input::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--accent-strong);transform:scale(0);transition:transform .15s var(--ease)}
.hr .lt-choice input:checked{border-color:var(--accent-strong)}
.hr .lt-choice input:checked::after{transform:scale(1)}
.hr .lt-choice b{display:block;font-weight:500;font-size:16px;color:var(--ink)}
.hr .lt-choice small{display:block;margin-top:2px;color:var(--muted);font-size:14px;line-height:1.45}
@media (hover:hover){.hr .lt-choice:hover{background:var(--wash)}}

.hr .lt-grades{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.hr .lt-pillGroup{display:flex;flex-wrap:wrap;gap:8px}
.hr .lt-pill{position:relative;display:block;cursor:pointer}
.hr .lt-pill input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.hr .lt-pill span{display:grid;place-items:center;min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--paper);font-size:15px;font-weight:500;color:var(--body);transition:background-color .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease)}
.hr .lt-grades .lt-pill span{padding:0;font-size:16px}
.hr .lt-pill input:checked+span{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.hr .lt-pill input:focus-visible+span{outline:2px solid var(--accent-ink);outline-offset:2px}
@media (hover:hover){.hr .lt-pill input:not(:checked)+span:hover{background:var(--wash);color:var(--ink)}}

.hr .lt-quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.hr .lt-field{display:grid;gap:6px;max-width:260px}
.hr .lt-field>span{font-size:14px;color:var(--muted)}
.hr .lt-sum{margin:16px 0 0;min-height:22px;font-size:15px;line-height:1.45;color:var(--body)}
.hr .lt-sum.bad{color:var(--danger)}
.hr .lt-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:28px}
.hr .lt-count{margin-left:auto;color:var(--muted);font-size:13px}
.hr .lt-skip{background:none;border:0;padding:0 2px;min-height:44px;color:var(--muted);font-size:14px;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line-strong)}
.hr .lt-skip:hover{color:var(--ink)}

.hr .lt-wait{max-width:560px;padding:12px 0}
.hr .lt-wait p{margin:0 0 6px;color:var(--muted);font-size:15px;line-height:1.5}
.hr .lt-bar{position:relative;height:2px;margin:18px 0 0;background:var(--line);border-radius:2px;overflow:hidden}
.hr .lt-bar::after{content:"";position:absolute;inset:0 auto 0 0;width:34%;background:var(--ink);animation:ltSlide 1.6s var(--ease) infinite}
@keyframes ltSlide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
.hr .lt-fail{max-width:560px}
.hr .lt-fail p{margin:0 0 16px;color:var(--body);font-size:15px;line-height:1.5}

/* ───── the plan ───── */
.hr .lt-plans{display:flex;flex-wrap:wrap;gap:8px;margin:-6px 0 22px}
.hr .lt-plans .chip{max-width:100%}
.hr .lt-chipText{display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hr .lt-note{margin:0 0 24px;padding:2px 0 2px 14px;border-left:2px solid var(--line-strong);color:var(--body);font-size:15px;line-height:1.55;max-width:60ch}
.hr .lt-note b{font-weight:500;color:var(--ink)}
.hr .lt-src{margin:-10px 0 24px;padding-left:16px;font-size:14px;line-height:1.5;color:var(--muted);max-width:60ch}
.hr .lt-src a{color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.hr .lt-note button{display:inline;background:none;border:0;padding:0;min-height:0;color:var(--accent-ink);font-size:15px;line-height:inherit;text-decoration:underline;text-underline-offset:3px}

.hr .lt-run{display:flex;gap:3px;height:8px;margin:0 0 8px}
.hr .lt-run i{flex:1;min-width:2px;border-radius:2px;background:var(--line-strong)}
.hr .lt-run i.past{background:var(--muted)}
.hr .lt-run i.now{background:var(--accent-strong)}
.hr .lt-runBox{margin-bottom:24px}
.hr .lt-runCap{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)}
.hr .lt-pace{margin:10px 0 0;font-size:14px;color:var(--body)}

/* This week: the dark surface, the one bold thing on the page */
.hr .lt-now{background:#181715;color:#FAF9F5;border-radius:var(--r-md);padding:24px}
.hr[data-theme="dark"] .lt-now{background:#252320;border:1px solid #33302B}
.hr .lt-nowHead{margin-bottom:6px}
.hr .lt-now .lt-h2{color:#FAF9F5;font-size:24px;margin:0}
.hr .lt-nowSub{margin:4px 0 0;font-size:14px;color:#A09D96}
.hr .lt-items{list-style:none;margin:14px 0 0;padding:0}
.hr .lt-it{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;border-top:1px solid #33302B}
.hr .lt-itMain{display:flex;gap:14px;align-items:flex-start;padding:14px 0;cursor:pointer;min-height:44px;min-width:0}
.hr .lt-itMain input{appearance:none;-webkit-appearance:none;flex:none;width:22px;height:22px;margin:1px 0 0;border:1.5px solid #8F8C84;border-radius:50%;background:transparent;display:grid;place-content:center;cursor:pointer;transition:background-color .15s var(--ease),border-color .15s var(--ease)}
.hr .lt-itMain input:checked{background:#DB8566;border-color:#DB8566}
.hr .lt-itMain input:checked::after{content:"";width:5px;height:10px;margin-top:-2px;border:solid #181715;border-width:0 2px 2px 0;transform:rotate(45deg)}
.hr .lt-itMain input:focus-visible{outline:2px solid #FAF9F5;outline-offset:3px}
.hr .lt-itText{min-width:0}
.hr .lt-itText b{display:block;font-weight:500;font-size:16px;line-height:1.35;color:#FAF9F5;overflow-wrap:anywhere}
.hr .lt-itText small{display:flex;align-items:center;gap:7px;margin-top:3px;font-size:14px;color:#A09D96}
.hr .lt-dot{flex:none;width:8px;height:8px;border-radius:50%}
.hr .lt-itMins{padding:14px 0;font-size:14px;color:#A09D96;font-variant-numeric:tabular-nums;white-space:nowrap}
.hr .lt-it.done .lt-itText b{color:#A09D96;text-decoration:line-through;text-decoration-color:#6C6962}
.hr .lt-itActions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:0 20px;margin:-10px 0 4px 36px}
.hr .lt-itActions button,.hr .lt-lsBtn{background:none;border:0;padding:0;min-height:44px;font-size:14px;color:#E8A58C;text-decoration:underline;text-underline-offset:3px}
.hr .lt-itLesson{grid-column:1/-1;margin:0 0 14px 36px;padding:2px 0 4px 14px;border-left:2px solid #4A463F}
.hr .lt-ls{font-size:15px;line-height:1.55;color:#E8E4D8;max-width:62ch}
.hr .lt-ls p{margin:0 0 12px}
.hr .lt-ls h3{margin:16px 0 6px;font-size:14px;font-weight:500;color:#FAF9F5}
.hr .lt-ls h3:first-child{margin-top:4px}
.hr .lt-ls ul{margin:0 0 12px;padding-left:18px;list-style:disc}
.hr .lt-ls li{margin:0 0 4px}
.hr .lt-qa{border-top:1px solid #33302B}
.hr .lt-qa:last-of-type{border-bottom:1px solid #33302B;margin-bottom:12px}
.hr .lt-qa summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 0;cursor:pointer;list-style:none;color:#FAF9F5}
.hr .lt-qa summary::-webkit-details-marker{display:none}
.hr .lt-qa summary::after{content:"";flex:none;width:7px;height:7px;border:solid #A09D96;border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-2px);transition:transform .18s var(--ease)}
.hr .lt-qa[open] summary::after{transform:rotate(-135deg) translate(-2px,-1px)}
.hr .lt-qa p{margin:0 0 12px;padding:10px 12px;border-radius:var(--r-sm);background:#252320}
.hr .lt-now .lt-pill span{background:transparent;border-color:#8F8C84;color:#E8E4D8}
.hr .lt-now .lt-pill input:checked+span{background:#FAF9F5;border-color:#FAF9F5;color:#181715}
.hr .lt-now .lt-pill input:focus-visible+span{outline-color:#FAF9F5}
@media (hover:hover){.hr .lt-now .lt-pill input:not(:checked)+span:hover{background:#252320;color:#FAF9F5}}
.hr .lt-ls .lt-lsNote{margin:16px 0 0;font-size:13px;color:#A09D96}
.hr .lt-nowFoot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;margin-top:2px;padding-top:14px;border-top:1px solid #33302B;font-size:14px;color:#A09D96}
.hr .lt-nowFoot b{font-weight:500;color:#FAF9F5}
.hr .lt-how{margin-top:10px;font-size:14px;color:#A09D96}
.hr .lt-how summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:#E8A58C;text-decoration:underline;text-underline-offset:3px;list-style:none}
.hr .lt-how summary::-webkit-details-marker{display:none}
.hr .lt-how dl{margin:0 0 6px;display:grid;gap:10px}
.hr .lt-how dt{font-weight:500;color:#FAF9F5}
.hr .lt-how dd{margin:2px 0 0;line-height:1.5}
.hr .lt-rest{margin:14px 0 0;font-family:${SERIF};font-size:20px;line-height:1.3;letter-spacing:-.01em;color:#FAF9F5}
.hr .lt-rest small{display:block;margin-top:6px;font-family:${SANS};font-size:14px;color:#A09D96;letter-spacing:0}
.hr .lt-now :focus-visible{outline-color:#FAF9F5}

/* later weeks */
.hr .lt-weeks{margin:10px 0 0;padding:0;list-style:none;border-top:1px solid var(--line)}
.hr .lt-week{border-bottom:1px solid var(--line)}
.hr .lt-week summary{display:grid;grid-template-columns:minmax(0,1fr) auto 12px;column-gap:14px;row-gap:2px;align-items:center;min-height:56px;cursor:pointer;list-style:none;padding:10px 2px}
.hr .lt-week summary::-webkit-details-marker{display:none}
.hr .lt-week summary::after{content:"";grid-column:3;grid-row:1/3;width:7px;height:7px;border:solid var(--muted);border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-2px);transition:transform .18s var(--ease)}
.hr .lt-week[open] summary::after{transform:rotate(-135deg) translate(-2px,-1px)}
.hr .lt-wk{grid-column:1;grid-row:1;font-weight:500;font-size:15px;color:var(--ink)}
.hr .lt-wkSub{display:inline;margin-left:10px;font-weight:400;font-size:13px;color:var(--muted)}
.hr .lt-wkSubj{grid-column:1;grid-row:2;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.4;color:var(--body)}
.hr .lt-wkMins{grid-column:2;grid-row:1/3;font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.hr .lt-wkItems{list-style:none;margin:0;padding:2px 2px 14px 2px;display:grid;gap:10px}
.hr .lt-wkItems li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;font-size:14px;color:var(--body)}
.hr .lt-wkItems span:first-child{display:flex;gap:9px;align-items:baseline;min-width:0}
.hr .lt-wkItems .lt-dot{transform:translateY(-1px)}
.hr .lt-wkItems em{font-style:normal;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.hr .lt .btn.small{min-height:44px}
.hr .lt-more{margin-top:8px}

/* make it fit you, and what this covers */
.hr .lt-panel{border-top:1px solid var(--line)}
.hr .lt-panel:last-of-type{border-bottom:1px solid var(--line)}
.hr .lt-panel>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;cursor:pointer;list-style:none;font-family:${SERIF};font-size:20px;letter-spacing:-.01em;color:var(--ink)}
.hr .lt-panel>summary::-webkit-details-marker{display:none}
.hr .lt-panel>summary::after{content:"";flex:none;width:8px;height:8px;border:solid var(--muted);border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-2px);transition:transform .18s var(--ease)}
.hr .lt-panel[open]>summary::after{transform:rotate(-135deg) translate(-2px,-1px)}
.hr .lt-panelBody{padding:2px 0 22px;display:grid;gap:22px}
.hr .lt-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}
.hr .lt-rowName{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:500;color:var(--ink);min-width:0}
.hr .lt-rowName .lt-dot{width:10px;height:10px}
.hr .lt-conf{display:grid;gap:8px;padding:8px 0}
.hr .lt-label{margin:0 0 8px;font-size:15px;font-weight:500;color:var(--ink)}
.hr .lt-hint{margin:10px 0 0;font-size:14px;line-height:1.5;color:var(--muted);max-width:56ch}
.hr .lt-hint.warn{color:var(--ink)}

.hr .lt-subj{border-top:1px solid var(--line);padding-top:6px}
.hr .lt-subj:first-child{border-top:0;padding-top:0}
.hr .lt-subjHead{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}
.hr .lt-subjHead small{font-weight:400;color:var(--muted);font-size:14px}
.hr .lt-topics{list-style:none;margin:0;padding:0}
.hr .lt-topics li{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;border-top:1px solid var(--line-soft);font-size:15px;color:var(--body)}
.hr .lt-topics li span{min-width:0;overflow-wrap:anywhere}
.hr .lt-topics li em{font-style:normal;margin-left:8px;font-size:13px;color:var(--muted);white-space:nowrap}
.hr .lt-x{flex:none;display:grid;place-items:center;width:44px;height:44px;margin-right:-10px;background:none;border:0;border-radius:var(--r-sm);color:var(--muted)}
@media (hover:hover){.hr .lt-x:hover{color:var(--danger);background:var(--wash)}}
.hr .lt-add{display:flex;gap:8px;margin-top:8px}
.hr .lt-add .input{flex:1;min-width:0}
.hr .lt-opts{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-top:32px}
.hr .lt-danger{background:none;border:0;padding:0 2px;min-height:44px;font-size:14px;color:var(--danger);text-decoration:underline;text-underline-offset:3px}

.hr .lt-done{padding:8px 0 0}
.hr .lt-done p{margin:0 0 14px;color:var(--body);font-size:15px;line-height:1.55;max-width:56ch}

/* six tabs on a 320px phone: keep "Long term" on one line */
@media (max-width:359px){
  .hr .tabs .tab{font-size:11px;letter-spacing:-.01em;white-space:nowrap}
  .hr .lt-grades{grid-template-columns:repeat(5,minmax(0,1fr))}
}
@media (min-width:600px){
  .hr .lt-conf{grid-template-columns:minmax(0,1fr) auto;align-items:center}
}
@media (max-width:519px){
  .hr .lt-itLesson{margin-left:0;padding-left:12px}
}
@media (min-width:768px){
  .hr .lt-now{padding:32px}
}
@media (prefers-reduced-motion:reduce){
  .hr .lt-prog i,.hr .lt-choice input::after,.hr .lt-pill span,.hr .lt-itMain input,.hr .lt-week summary::after,.hr .lt-panel>summary::after,.hr .lt-qa summary::after{transition:none}
  .hr .lt-bar::after{animation:none;width:50%;transform:none}
}
`;
