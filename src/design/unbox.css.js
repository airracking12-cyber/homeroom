// The unboxing, v31. While the welcome tour runs, the app is a parcel:
//   1. A kraft-paper lid with a ribbon and a label covers the screen. The tape is cut, the lid slides open.
//   2. Every piece of the app that has not been shown yet is wrapped in tissue paper (some tied with the clay ribbon),
//      sitting exactly where the piece will be.
//   3. When the tour reaches a piece, a sheet of that same paper lifts off it, with a sheen across it, and the real
//      piece settles into place underneath.
// The wrapped look itself is generated per piece in App.jsx (UNBOX_CSS); the paper, ribbon, lid and the lifting sheet live here.
export const UNBOX_LOOK_CSS = `
.hr{
  --wrap:linear-gradient(135deg,rgba(255,255,255,.66) 0%,rgba(255,255,255,0) 36%),linear-gradient(315deg,rgba(120,92,58,.12) 0%,rgba(120,92,58,0) 46%),repeating-linear-gradient(112deg,rgba(120,92,58,.06) 0 1px,transparent 1px 15px),repeating-linear-gradient(28deg,rgba(255,255,255,.4) 0 1px,transparent 1px 23px),linear-gradient(#EBE3D3,#E0D6C1);
  --ribbon:linear-gradient(90deg,transparent calc(50% - 10px),color-mix(in srgb,var(--accent) 82%,#fff) calc(50% - 10px) calc(50% + 10px),transparent calc(50% + 10px)),linear-gradient(90deg,transparent calc(50% - 10px),rgba(255,255,255,.34) calc(50% - 10px) calc(50% - 6px),transparent calc(50% - 6px)),linear-gradient(90deg,transparent calc(50% + 6px),rgba(0,0,0,.12) calc(50% + 6px) calc(50% + 10px),transparent calc(50% + 10px));
  --wrap-ribbon:var(--ribbon),var(--wrap);
  --wrap-sh:inset 0 1px 0 rgba(255,255,255,.75),inset 0 -1px 0 rgba(120,92,58,.16),0 12px 24px -14px rgba(80,58,30,.42),0 2px 5px rgba(80,58,30,.13);
  --kraft:repeating-linear-gradient(95deg,rgba(90,60,25,.055) 0 1px,transparent 1px 7px),repeating-linear-gradient(8deg,rgba(255,255,255,.09) 0 2px,transparent 2px 11px),linear-gradient(160deg,#D9C29D,#C8AC81);
}
.hr[data-theme="dark"]{
  --wrap:linear-gradient(135deg,rgba(255,255,255,.09) 0%,rgba(255,255,255,0) 36%),linear-gradient(315deg,rgba(0,0,0,.22) 0%,rgba(0,0,0,0) 46%),repeating-linear-gradient(112deg,rgba(255,255,255,.035) 0 1px,transparent 1px 15px),repeating-linear-gradient(28deg,rgba(255,255,255,.03) 0 1px,transparent 1px 23px),linear-gradient(#3B352C,#322D25);
  --wrap-sh:inset 0 1px 0 rgba(255,255,255,.1),inset 0 -1px 0 rgba(0,0,0,.35),0 12px 24px -14px rgba(0,0,0,.7),0 2px 5px rgba(0,0,0,.3);
  --kraft:repeating-linear-gradient(95deg,rgba(0,0,0,.06) 0 1px,transparent 1px 7px),repeating-linear-gradient(8deg,rgba(255,255,255,.05) 0 2px,transparent 2px 11px),linear-gradient(160deg,#9A8260,#85704F);
}

/* the sheet that lifts off a piece: the same paper as the wrapped piece, in the same spot */
.tourSheet{position:fixed;z-index:3;pointer-events:none;overflow:hidden;border-radius:var(--r,12px);background:var(--wrap);box-shadow:var(--wrap-sh);transform-origin:100% 100%;will-change:transform,opacity,clip-path;animation:tourPeel 1.5s cubic-bezier(.5,.05,.2,1) var(--d,0ms) both}
.tourSheet[data-big="1"]{background:var(--wrap-ribbon)}
.tourSheet::after{content:"";position:absolute;inset:-10%;background:linear-gradient(105deg,transparent 34%,rgba(255,255,255,.78) 50%,transparent 66%);transform:translateX(-130%);animation:tourSheen 1.15s ease-out calc(var(--d,0ms) + 80ms) both}
@keyframes tourPeel{
  0%{opacity:1;transform:none;clip-path:inset(0 0 0 0 round var(--r,12px))}
  14%{opacity:1;transform:translate(0,-1px) rotate(-.3deg) scale(1.004);clip-path:inset(0 0 0 0 round var(--r,12px))}
  100%{opacity:0;transform:translate(26px,-58px) rotate(-9deg) scale(1.05);clip-path:inset(0 0 0 100% round var(--r,12px))}
}
@keyframes tourSheen{to{transform:translateX(130%)}}

/* the real piece, once unwrapped: it rises a little and settles, a beat after its paper starts to lift */
@keyframes unboxPop{
  0%{opacity:0;scale:.94;translate:0 18px;filter:blur(5px) brightness(1.08)}
  60%{opacity:1;scale:1.012;translate:0 -2px;filter:blur(0) brightness(1.03)}
  100%{opacity:1;scale:1;translate:0 0;filter:blur(0) brightness(1)}
}

/* the lid: two halves of kraft paper, a ribbon across the seams, and a label that is lifted off first */
.tourLid{position:fixed;inset:0;z-index:6;overflow:hidden;pointer-events:auto}
.lidHalf{position:absolute;top:0;bottom:0;width:50.5%;background:var(--kraft);transition:transform 1.55s cubic-bezier(.7,0,.2,1)}
.lidL{left:0;box-shadow:inset -14px 0 22px -14px rgba(60,38,12,.55),6px 0 24px rgba(40,24,8,.28);transform-origin:0 100%}
.lidR{right:0;box-shadow:inset 14px 0 22px -14px rgba(60,38,12,.55),-6px 0 24px rgba(40,24,8,.28);transform-origin:100% 100%}
.lidHalf::before{content:"";position:absolute;left:0;right:0;top:calc(46% - 34px);height:68px;background:linear-gradient(180deg,rgba(255,255,255,.3) 0 4px,transparent 4px 60px,rgba(0,0,0,.14) 60px 64px,transparent 64px),color-mix(in srgb,var(--accent) 84%,#fff);box-shadow:0 3px 8px rgba(60,30,10,.25)}
.lidHalf::after{content:"";position:absolute;top:0;bottom:0;width:68px;background:linear-gradient(90deg,rgba(255,255,255,.3) 0 4px,transparent 4px 60px,rgba(0,0,0,.14) 60px 64px,transparent 64px),color-mix(in srgb,var(--accent) 84%,#fff);box-shadow:0 0 8px rgba(60,30,10,.25)}
.lidL::after{right:-34px;clip-path:inset(0 34px 0 0)}
.lidR::after{left:-34px;clip-path:inset(0 0 0 34px)}
.tourLid[data-s="open"] .lidL{transform:translateX(-104%) rotate(-2.4deg)}
.tourLid[data-s="open"] .lidR{transform:translateX(104%) rotate(2.4deg)}
.lidLabel{position:absolute;left:50%;top:46%;z-index:3;transform:translate(-50%,-50%) rotate(-2deg);padding:20px 28px 18px;min-width:230px;border-radius:16px;background:#FBF7EE;color:#1C1B19;text-align:center;border:1.5px dashed rgba(60,38,12,.28);box-shadow:0 18px 34px -14px rgba(40,24,8,.55),0 3px 8px rgba(40,24,8,.2);transition:transform .7s cubic-bezier(.5,0,.2,1),opacity .55s ease;animation:lidIn .9s cubic-bezier(.2,.8,.2,1) backwards}
.lidLabel b{display:block;font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:30px;letter-spacing:-.025em;line-height:1.1}
.lidLabel small{display:block;margin-top:7px;font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#7B7467;white-space:nowrap}
.lidLabel i{display:block;margin:10px auto 0;width:44px;height:2px;border-radius:1px;background:var(--accent)}
.tourLid[data-s="tape"] .lidLabel,.tourLid[data-s="open"] .lidLabel{opacity:0;transform:translate(-50%,-92%) rotate(-7deg) scale(1.08)}
@keyframes lidIn{from{opacity:0;transform:translate(-50%,-40%) rotate(-5deg) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) rotate(-2deg) scale(1)}}
.tourLid[data-s="closed"]::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(40,24,8,.28));pointer-events:none}

@media (prefers-reduced-motion:reduce){.tourLid,.tourSheet{display:none}}
`;
