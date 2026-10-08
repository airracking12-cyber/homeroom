// The plane. While `go` is false the screen is plain white (the app is loading underneath it). When `go` turns true the plane
// crosses the screen on a gentle climb, trailing a contrail, and wipes the white away so the app is left behind it.
// onMid fires once when the plane is past 60% of the way: that is the cue to start the walkthrough, while it is still in the air.

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

const lerp = (a, b, t) => a + (b - a) * t;

export default function PlaneFlight({ go, onMid, onDone, sound }) {
  const calm = useReducedMotion();
  const sky = useRef(null);
  const jet = useRef(null);
  const trail = useRef(null);
  const grad = useRef(null);
  const edge = useRef(null);
  const cb = useRef({ onMid, onDone });
  useEffect(() => { cb.current = { onMid, onDone }; });

  useEffect(() => {
    if (!go) return undefined;
    const el = sky.current;
    let mid = false;
    if (calm) {
      const t1 = setTimeout(() => { cb.current.onMid(); }, 120);
      el.style.opacity = "0";
      const t2 = setTimeout(() => cb.current.onDone(), 480);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    try { if (sound) sound.play("whoosh"); } catch { /* sound is optional */ }
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const pts = [];
    const pos = (t) => {
      const w = W(), h = H(), jw = Math.max(120, Math.min(w * 0.34, 210)); // the same size .obJet gets from CSS (an SVG has no offsetWidth)
      const x = lerp(-jw * 1.15, w + jw * 0.3, t);
      const climb = t * t * (3 - 2 * t); // smoothstep
      const y = lerp(h * 0.66, h * 0.34, climb) + Math.sin(t * Math.PI * 2) * h * 0.012;
      return [x, y, jw];
    };
    const controls = animate(0, 1, {
      duration: 2.5,
      ease: [0.45, 0.02, 0.25, 1],
      onUpdate: (t) => {
        const [x, y, jw] = pos(t);
        const [x2, y2] = pos(Math.min(1, t + 0.01));
        const ang = Math.max(-18, Math.min(8, (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI));
        const nose = x + jw * 0.92;
        jet.current.style.transform = `translate(${x}px,${y - jw * 0.19}px) rotate(${ang}deg)`;
        el.style.clipPath = `inset(0 0 0 ${Math.max(0, nose)}px)`;
        edge.current.style.transform = `translateX(${Math.max(0, nose)}px)`;
        pts.push([x + jw * 0.1, y]);
        if (pts.length > 140) pts.shift();
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
        trail.current.setAttribute("d", d);
        grad.current.setAttribute("x1", String(x + jw * 0.1));
        grad.current.setAttribute("x2", String(x - W() * 0.5));
        if (!mid && t > 0.58) { mid = true; cb.current.onMid(); }
      },
      onComplete: () => cb.current.onDone(),
    });
    return () => controls.stop();
  }, [go, calm, sound]);

  return (
    <>
    <div className="obSky" ref={sky} data-go={go ? 1 : 0} data-calm={calm ? 1 : 0} aria-hidden="true">
      {!go && <div className="obWait"><i /><i /><i /></div>}
      <div className="obEdge" ref={edge} style={{ visibility: go ? "visible" : "hidden" }} />
    </div>
    {/* the plane has its own layer: the white above is clipped away behind it, and the plane must not be clipped with it */}
    <div className="obFlight" aria-hidden="true">
      {go && (
        <>
          <svg className="obTrail" aria-hidden="true">
            <defs>
              <linearGradient id="obTrailG" ref={grad} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-400" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity=".95" />
                <stop offset=".35" stopColor="#d9e4ea" stopOpacity=".75" />
                <stop offset="1" stopColor="#d9e4ea" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path ref={trail} d="" fill="none" stroke="url(#obTrailG)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="obJet" ref={jet} viewBox="0 0 170 64" fill="none" style={{ transform: "translate(-400px,0)" }}>
            <path d="M20 30 8 6h15l24 24Z" fill="var(--accent)" />
            <path d="M72 38 50 62h17l36-24Z" fill="var(--accent)" opacity=".82" />
            <path d="M8 34c0-8 14-11 36-11h82c22 0 36 6 36 11s-14 11-36 11H44C22 45 8 42 8 34Z" fill="#fff" stroke="#1f1e1b" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M12 38c10 3 24 4 34 4h80c18 0 30-3 36-8-6 7-18 11-36 11H44c-14 0-26-2-32-7Z" fill="#1f1e1b" opacity=".06" />
            <g fill="#1f1e1b" opacity=".7">{[34, 48, 62, 76, 90, 104].map((cx) => <circle key={cx} cx={cx} cy="33" r="2.5" />)}</g>
            <path d="M130 27h12c6 0 12 3 13 7h-25Z" fill="#1f1e1b" opacity=".78" />
            <path d="M70 38 56 54h14l22-16Z" fill="#fff" stroke="#1f1e1b" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </>
      )}
    </div>
    </>
  );
}
