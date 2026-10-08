// Styles for the first-run ticket and the plane. The stage is pure white on purpose (the brief starts on a blank white screen),
// so the ticket carries its own light palette and does not follow dark mode. Only the accent comes from the app.
export const OB_CSS = `
.ob{--ob-ink:#1f1e1b;--ob-mute:#77736a;--ob-line:#e6e1d3;--ob-paper:#fbf8f0;--ob-paper2:#f4efe3;--ob-stamp:#2f5566;
  position:fixed;inset:0;z-index:200;background:#fff;color:var(--ob-ink);overflow-y:auto;overflow-x:hidden;display:flex;justify-content:center;
  padding:max(28px,env(safe-area-inset-top)) 20px max(28px,env(safe-area-inset-bottom));font-family:"Inter",-apple-system,"Segoe UI",sans-serif}
.ob::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:0;animation:obGlow 1.6s .5s ease-out forwards;
  background:radial-gradient(60% 42% at 50% 0%,color-mix(in srgb,var(--accent) 9%,transparent),transparent 72%),radial-gradient(50% 40% at 50% 100%,rgba(47,85,102,.07),transparent 72%)}
@keyframes obGlow{to{opacity:1}}
.obCol{position:relative;width:100%;max-width:392px;margin:auto 0;display:flex;flex-direction:column;align-items:stretch}
.obWords{min-height:98px;text-align:center;display:flex;align-items:flex-end;justify-content:center;margin-bottom:26px}
.obH{font-family:"Fraunces","Iowan Old Style",Georgia,serif;font-weight:400;font-size:clamp(30px,8vw,38px);line-height:1.08;letter-spacing:-.028em;margin:0 0 8px}
.obSub{margin:0;color:var(--ob-mute);font-size:15px;line-height:1.45;text-wrap:balance}
.obTicket{position:relative;perspective:900px}
.obPaper{filter:drop-shadow(0 1px 1px rgba(31,30,27,.07)) drop-shadow(0 10px 18px rgba(31,30,27,.07)) drop-shadow(0 28px 40px rgba(47,85,102,.09))}
.obBody{position:relative;padding:20px 22px 22px;border-radius:22px 22px 0 0;background:
  radial-gradient(120% 70% at 0% 0%,#fffdf8,transparent 60%),linear-gradient(180deg,var(--ob-paper),var(--ob-paper2));
  -webkit-mask:radial-gradient(circle 11px at 0 100%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 100%,#0000 97%,#000) right/51% 100% no-repeat;
  mask:radial-gradient(circle 11px at 0 100%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 100%,#0000 97%,#000) right/51% 100% no-repeat}
.obBody::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:.5;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .4 0 0 0 .1 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.obBody::after{content:"";position:absolute;left:18px;right:18px;bottom:0;border-bottom:2px dashed #d8d1bf}
.obHead{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--ob-mute);font-weight:500}
.obAir{display:inline-flex;align-items:center;gap:7px;color:var(--ob-ink);font-weight:600}
.obRoute{display:flex;align-items:center;gap:10px;margin:16px 0 18px;color:var(--ob-mute)}
.obRoute b{font-family:"Fraunces",Georgia,serif;font-weight:500;font-size:34px;letter-spacing:-.02em;color:var(--ob-ink);line-height:1}
.obRoute i{flex:1;height:0;border-top:1.5px dashed #cfc7b2}
.obLab{font-size:12px;font-weight:500;color:var(--ob-mute);margin-bottom:5px}
.obClass{margin-top:2px}
.obName{width:100%;border:0;border-bottom:1.5px solid #d6cfbb;background:none;border-radius:0;padding:4px 0 7px;font-family:"Fraunces",Georgia,serif;font-size:26px;letter-spacing:-.015em;color:var(--ob-ink);transition:border-color .25s,box-shadow .25s}
.obName::placeholder{color:#bdb6a4}
.obName:focus{outline:0;border-color:var(--accent);box-shadow:0 2px 0 0 color-mix(in srgb,var(--accent) 40%,transparent)}
.obName:read-only{border-bottom-color:transparent}
.obHint{margin:7px 0 0;font-size:12.5px;color:var(--ob-mute);line-height:1.35}
.obHint.bad{color:#b4432f}
.obGate{font-size:17px;font-weight:600;padding:3px 0 2px}
.obClass{position:relative;z-index:3}
.obClass .field{margin:0}.obClass .field>label,.obClass .field>.meta{display:none}
.obClass .chips{gap:8px}
.obClass .chip{padding:7px 13px;font-size:14px}
.obRow{position:relative;display:flex;justify-content:space-between;align-items:flex-end;min-height:122px;margin-top:20px}
.obGrid{display:grid;gap:11px;padding-bottom:6px}
.obGrid>div{display:flex;flex-direction:column}
.obGrid small{font-size:12px;color:var(--ob-mute);margin-bottom:1px}
.obGrid b{font-size:14px;font-weight:600;white-space:nowrap}
.obZone{position:relative;width:118px;height:118px;display:grid;place-items:center;pointer-events:none;flex:none}
.obZoneRing{width:92px;height:92px;border-radius:50%;border:1.6px dashed #cdc5af}
.obInk{position:absolute;mix-blend-mode:multiply;filter:drop-shadow(0 0 .4px var(--ob-stamp))}
.obRipple{position:absolute;width:92px;height:92px;border-radius:50%;border:2px solid var(--ob-stamp)}
.obDrop{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--ob-stamp)}
.obStamp{position:absolute;right:19px;bottom:49px;width:80px;height:112px;padding:0;border:0;background:none;cursor:grab;z-index:4;touch-action:manipulation;transform-origin:50% 100%;filter:drop-shadow(0 14px 10px rgba(31,30,27,.18))}
.obStamp:active{cursor:grabbing}
.obStamp[data-ready="0"]{cursor:not-allowed;opacity:.5!important;filter:none}
.obStamp:focus-visible,.obStub:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:14px}
.obStampFlat{position:absolute;right:8px;bottom:40px;border:0;border-radius:12px;padding:10px 14px;background:var(--ob-stamp);color:#fff;font-weight:600;font-size:14px}
.obStampFlat:disabled{opacity:.4}
.obFly{position:relative;margin-top:0;z-index:2}
.obStubWrap{touch-action:pan-y;cursor:default}
.obStub[data-live="1"]{cursor:grab}
.obStub{position:relative;height:92px;border-radius:0 0 22px 22px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:linear-gradient(180deg,#f1ecdd,#ece6d5);
  -webkit-mask:radial-gradient(circle 11px at 0 0,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 0,#0000 97%,#000) right/51% 100% no-repeat;
  mask:radial-gradient(circle 11px at 0 0,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 0,#0000 97%,#000) right/51% 100% no-repeat}
.obStubInfo{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.obStub small{font-size:12px;font-weight:500;color:var(--ob-mute)}
.obBars{display:block;width:150px;height:30px;border-radius:2px;opacity:.85;
  background:repeating-linear-gradient(90deg,#1f1e1b 0 2px,transparent 2px 4px,#1f1e1b 4px 5px,transparent 5px 8px,#1f1e1b 8px 11px,transparent 11px 13px,#1f1e1b 13px 14px,transparent 14px 17px)}
.obPull{font-size:13px;font-weight:600;color:var(--accent);display:inline-flex;align-items:center;gap:6px}
.obPull::after{content:"";width:16px;height:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E") center/contain no-repeat}
.obErr{margin:16px 0 0;text-align:center;color:#b4432f;font-size:14px}
.obFoot{min-height:44px;margin-top:22px;display:flex;justify-content:center;gap:20px}
.obLink{background:none;border:0;padding:10px 6px;font-size:14px;color:var(--ob-mute);cursor:pointer;font-family:inherit;transition:color .2s}
.obLink:hover{color:var(--ob-ink)}
@media (max-height:700px){.obWords{min-height:78px;margin-bottom:16px}.obRoute{margin:12px 0}}

/* the plane */
.obSky{position:fixed;inset:0;z-index:300;overflow:hidden;pointer-events:auto;background:#fff;will-change:clip-path}
.obSky[data-go="1"]{pointer-events:none}
.obSky[data-calm="1"]{transition:opacity .45s ease}
.obFlight{position:fixed;inset:0;z-index:301;pointer-events:none;overflow:hidden}
.obEdge{position:absolute;top:0;bottom:0;width:140px;margin-left:-140px;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9))}
.obTrail{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.obJet{position:absolute;left:0;top:0;width:min(34vw,210px);min-width:120px;height:auto;filter:drop-shadow(0 18px 14px rgba(31,30,27,.14));will-change:transform}
.obWait{position:absolute;left:50%;top:50%;translate:-50% -50%;display:flex;gap:6px;opacity:0;animation:obWaitIn .6s 1.4s forwards}
.obWait i{width:6px;height:6px;border-radius:50%;background:#cfc8b6;animation:obDot 1.2s infinite}
.obWait i:nth-child(2){animation-delay:.16s}.obWait i:nth-child(3){animation-delay:.32s}
@keyframes obWaitIn{to{opacity:1}}
@keyframes obDot{0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.ob::before{animation-duration:.01s}}
`;
