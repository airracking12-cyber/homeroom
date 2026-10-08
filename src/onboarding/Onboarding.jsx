// The first-run ticket: blank white, stamp it, tear off the stub, then take off.
// The visible flow is BLANK > STAMP > TEAR; the plane and the walkthrough are in PlaneFlight.jsx and the Tour (App.jsx).
//
// Props (a drop-in for the old BoardingPass):
//   classes, setClasses, classPicker(value, onPick)  the class chooser lives in App.jsx, so it is handed in
//   onSubmit(name, classId)  saves the profile, returns an error string or null
//   onTakeoff(name, classId) called once the stub is gone and the ticket has left the screen
//   onSignOut                the only way out of a first run that isn't through it
//   replay, name, classLabel, onSkip  a voluntary replay from the account menu: prefilled, and may be closed
//   sound                    the app's Sound object (play("stamp"), ...)

import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Plane } from "lucide-react";
import { EVENT, PHASE, reduce, tearCompletes } from "./machine.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* not supported */ } };

// A torn edge: alternating points along the seam. `top` makes the matching edge for the stub.
const zig = (top) => {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const x = top ? (i / n) * 100 : 100 - (i / n) * 100;
    const out = (i % 2) * (3 + ((i * 7) % 3));
    pts.push(`${x}% ${top ? out + "px" : `calc(100% - ${out}px)`}`);
  }
  return top
    ? `polygon(${pts.join(",")},100% 100%,0 100%)`
    : `polygon(0 0,100% 0,${pts.join(",")})`;
};
const BODY_TORN = zig(false);
const STUB_TORN = zig(true);

function StampTool({ disabled }) {
  return (
    <svg viewBox="0 0 80 112" width="80" height="112" aria-hidden="true" focusable="false">
      <ellipse cx="40" cy="106" rx="30" ry="4.5" fill="rgba(31,30,27,.16)" />
      <rect x="10" y="84" width="60" height="18" rx="6" fill="#3a3834" />
      <rect x="14" y="98" width="52" height="7" rx="3.5" fill="var(--ob-stamp)" opacity={disabled ? 0.35 : 0.9} />
      <path d="M31 84V56c0-6 4-9 9-9s9 3 9 9v28Z" fill="#5a5750" />
      <rect x="22" y="76" width="36" height="9" rx="4.5" fill="#46433d" />
      <circle cx="40" cy="26" r="20" fill="#d9a07f" />
      <circle cx="40" cy="26" r="20" fill="url(#obKnob)" />
      <defs>
        <radialGradient id="obKnob" cx="35%" cy="28%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="17" rx="7" ry="4" fill="#fff" opacity=".45" transform="rotate(-30 32 17)" />
    </svg>
  );
}

function Ink({ gate, date }) {
  return (
    <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true" focusable="false">
      <defs>
        <filter id="obRough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <filter id="obWorn">
          <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="9" result="t" />
          <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        <path id="obArcTop" d="M 20 66 A 46 46 0 0 1 112 66" />
        <path id="obArcBot" d="M 14 66 A 52 52 0 0 0 118 66" />
      </defs>
      <g filter="url(#obWorn)"><g filter="url(#obRough)" fill="none" stroke="var(--ob-stamp)" style={{ color: "var(--ob-stamp)" }}>
        <circle cx="66" cy="66" r="60" strokeWidth="3.4" />
        <circle cx="66" cy="66" r="53" strokeWidth="1.2" />
        <circle cx="66" cy="66" r="31" strokeWidth="1.2" />
        <text fill="currentColor" stroke="none" fontSize="10.5" fontWeight="700" letterSpacing="2.6" textAnchor="middle" fontFamily="Inter,sans-serif"><textPath href="#obArcTop" startOffset="50%">HOMEROOM AIR</textPath></text>
        <text fill="currentColor" stroke="none" fontSize="10" fontWeight="700" letterSpacing="2.4" textAnchor="middle" fontFamily="Inter,sans-serif"><textPath href="#obArcBot" startOffset="50%" side="right">CHECKED IN</textPath></text>
        <text x="66" y="73" fill="currentColor" stroke="none" fontSize="23" fontWeight="500" textAnchor="middle" fontFamily="Fraunces,Georgia,serif">{gate}</text>
        <text x="66" y="86" fill="currentColor" stroke="none" fontSize="7.5" fontWeight="600" letterSpacing="1" textAnchor="middle" fontFamily="Inter,sans-serif">{date}</text>
      </g></g>
    </svg>
  );
}

export default function Onboarding({
  classes, classPicker, replay, name, classLabel, onSubmit, onTakeoff, onSignOut, onSkip, sound,
}) {
  const calm = useReducedMotion();
  const [phase, send] = useReducer(reduce, PHASE.BLANK);
  const [uname, setUname] = useState(replay ? name || "" : "");
  const [cls, setCls] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [inked, setInked] = useState(false); // the stamp has landed
  const [torn, setTorn] = useState(false); // the stub has come away
  const [gone, setGone] = useState(false); // the ticket is leaving
  const [dragging, setDragging] = useState(false);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const play = (n) => { try { if (sound) sound.play(n); } catch { /* sound is optional */ } };

  const u = uname.trim().toLowerCase();
  const nameOk = /^[a-z0-9_.]{3,20}$/.test(u);
  const gate = replay ? classLabel : (classes.find((c) => c.id === cls) || {}).label;
  const ready = replay || (nameOk && !!cls);
  const gateCode = (gate || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "---";
  const [today] = useState(() => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }));

  // 1. BLANK: a plain white beat, then the ticket arrives.
  useEffect(() => {
    const t = setTimeout(() => send(EVENT.ARRIVED), calm ? 150 : 900);
    return () => clearTimeout(t);
  }, [calm]);

  // Replays may be closed with Escape. A first run can't be.
  useEffect(() => {
    if (!replay) return undefined;
    const k = (e) => { if (e.key === "Escape" && phase !== PHASE.PLANE_ANIMATION && !torn) onSkip(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [replay, phase, torn, onSkip]);

  // 2. STAMP: press the stamp.
  const stamp = async () => {
    if (!ready || busy || inked || phase !== PHASE.STAMP) return;
    setErr("");
    if (!replay) {
      setBusy(true);
      const e = await onSubmit(u, cls);
      setBusy(false);
      if (e) { setErr(e); play("err"); return; }
    }
    setInked(true); play("stamp"); buzz([14, 30, 10]);
    later(() => send(EVENT.STAMPED), calm ? 400 : 1100);
  };

  // 3. TEAR: drag the stub along the perforation.
  const seamRef = useRef(null);
  const x = useMotionValue(0);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = seamRef.current;
    if (!el) return undefined;
    const set = () => setW(el.offsetWidth || 340);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [phase]);
  const rotate = useTransform(x, (v) => clamp((v / w) * 16, -16, 16));
  const lift = useTransform(x, (v) => Math.abs(v) * 0.1);
  const originX = useTransform(x, (v) => (v >= 0 ? "0%" : "100%"));
  const seam = useTransform(x, (v) => clamp(Math.abs(v) / (w * 0.9), 0, 1));
  useEffect(() => {
    let last = 0;
    return seam.on("change", (p) => {
      if ((last < 0.25 && p >= 0.25) || (last < 0.5 && p >= 0.5)) buzz(6);
      last = p;
    });
  }, [seam]);

  const finishTear = (dir) => {
    if (torn) return;
    setTorn(true); setDragging(true);
    buzz(30); play("rip"); later(() => play("rip"), 90); later(() => play("whoosh"), 520);
    send(EVENT.TORN);
    animate(x, dir * w * 1.1, { duration: calm ? 0.1 : 0.38, ease: [0.3, 0, 0.5, 1] });
    later(() => setGone(true), calm ? 150 : 650);
    later(() => onTakeoff(u, cls), calm ? 350 : 1350);
  };
  const onDragEnd = (_e, info) => {
    const dir = x.get() >= 0 ? 1 : -1;
    const p = seam.get();
    if (tearCompletes(p, info.velocity.x * dir)) finishTear(dir);
    else {
      animate(x, 0, { type: "spring", stiffness: 520, damping: 36, onComplete: () => setDragging(false) });
    }
  };
  const onStubKey = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finishTear(1); }
  };

  const tearing = dragging || torn;
  const showTicket = phase !== PHASE.BLANK;
  const heading = torn ? "Boarding now" : phase === PHASE.TEAR ? "Tear off the stub" : "Stamp the ticket";
  const sub = torn ? "Safe travels."
    : phase === PHASE.TEAR ? "Pull it along the dotted line."
      : inked ? "You're checked in."
        : replay ? "Press the stamp." : ready ? "Press the stamp to check in." : "Add your name and class, then press the stamp.";

  return (
    <div className="ob" data-phase={phase} role={replay ? "dialog" : "main"} aria-modal={replay ? "true" : undefined} aria-label="Boarding pass">
      <AnimatePresence>
        {showTicket && (
          <motion.div className="obCol" key="col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <motion.div className="obWords" aria-live="polite" layout="position" transition={{ layout: { type: "spring", stiffness: 170, damping: 26 } }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={heading} initial={{ opacity: 0, y: calm ? 0 : 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: calm ? 0 : -10, filter: "blur(6px)" }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
                  <h1 className="obH">{heading}</h1>
                  <p className="obSub">{sub}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <motion.div className="obTicket" layout="position" initial={{ opacity: 0, y: calm ? 0 : 56, rotate: calm ? 0 : -2.5, scale: 0.96 }}
              animate={gone ? { opacity: 0, y: calm ? 0 : -36, scale: 0.97 } : { opacity: 1, y: 0, rotate: 0, scale: 1 }}
              transition={gone ? { duration: 0.5, ease: [0.4, 0, 0.8, 0.3] } : { type: "spring", stiffness: 140, damping: 20, mass: 0.9, layout: { type: "spring", stiffness: 170, damping: 26 } }}>
              <motion.div className="obRecoil" animate={inked && !calm ? { y: [0, 5, -1.5, 0] } : { y: 0 }} transition={{ duration: 0.45, delay: 0.1, times: [0, 0.25, 0.6, 1] }}>
                <div className="obPaper">
                  <div className="obBody" style={tearing ? { clipPath: BODY_TORN, WebkitClipPath: BODY_TORN } : undefined}>
                    <div className="obHead">
                      <span className="obAir"><Plane size={15} aria-hidden="true" />Homeroom Air</span>
                      <span>Boarding pass</span>
                    </div>
                    <div className="obRoute" aria-hidden="true"><b>HRM</b><i /><Plane size={18} /><i /><b>{gateCode}</b></div>

                    <label className="obLab" htmlFor="obName">Passenger</label>
                    <input id="obName" className="obName" value={uname} placeholder="your name" maxLength={20}
                      readOnly={replay || phase !== PHASE.STAMP || inked} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                      onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && stamp()} />
                    {!replay && phase === PHASE.STAMP && !inked && <p className={`obHint${uname && !nameOk ? " bad" : ""}`}>3 to 20 letters, numbers, dots or underscores.</p>}

                    <div className="obLab" style={{ marginTop: 14 }}>Gate, your class</div>
                    {replay || phase !== PHASE.STAMP || inked
                      ? <div className="obGate">{gate || "Not chosen"}</div>
                      : <div className="obClass">{classPicker(cls, setCls)}</div>}

                    <div className="obRow">
                    <div className="obGrid">
                      <div><small>Date</small><b>{today}</b></div>
                      <div><small>Departs</small><b>Now</b></div>
                      <div><small>Status</small><b>{inked ? "Checked in" : "Not yet"}</b></div>
                    </div>

                    <div className="obZone" aria-hidden="true">
                      {!inked && <span className="obZoneRing" />}
                      {inked && <>
                        <motion.span className="obRipple" initial={{ scale: 0.5, opacity: 0.45 }} animate={{ scale: 2.3, opacity: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }} />
                        {!calm && Array.from({ length: 14 }, (_, i) => (
                          <motion.i key={i} className="obDrop" initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
                            animate={{ x: Math.cos((i / 14) * 6.283) * (52 + (i * 13) % 34), y: Math.sin((i / 14) * 6.283) * (52 + (i * 13) % 34), opacity: 0, scale: 0.3 }}
                            transition={{ duration: 0.7, delay: 0.1, ease: [0.1, 0.7, 0.3, 1] }} />
                        ))}
                        <motion.div className="obInk" initial={{ scale: calm ? 1 : 1.55, opacity: 0, rotate: -22 }}
                          animate={{ scale: [calm ? 1 : 1.55, 0.93, 1], opacity: 1, rotate: -11 }} transition={{ duration: 0.34, delay: 0.1, times: [0, 0.6, 1], ease: "easeOut" }}>
                          <Ink gate={gateCode} date={today} />
                        </motion.div>
                      </>}
                    </div>

                    {phase === PHASE.STAMP && !calm && (
                      <motion.button type="button" className="obStamp" disabled={!ready || busy || inked} onClick={stamp}
                        aria-label={ready ? "Stamp the ticket" : "Stamp the ticket (fill in your name and class first)"}
                        data-ready={ready ? 1 : 0}
                        initial={{ y: -90, opacity: 0 }}
                        animate={inked ? { y: [null, 0, -26, -150], opacity: [1, 1, 1, 0], rotate: [0, 0, -4, 8] }
                          : { y: ready ? [-38, -46, -38] : -38, opacity: 1 }}
                        transition={inked ? { duration: 0.95, times: [0, 0.1, 0.26, 1], ease: "easeOut" }
                          : { duration: 2.4, repeat: ready ? Infinity : 0, ease: "easeInOut" }}
                        whileTap={ready && !busy ? { y: -12, scale: 0.97, transition: { type: "spring", stiffness: 700, damping: 28 } } : undefined}>
                        <StampTool disabled={!ready} />
                      </motion.button>
                    )}
                    {phase === PHASE.STAMP && calm && (
                      <button type="button" className="obStampFlat" disabled={!ready || busy || inked} onClick={stamp}>Stamp the ticket</button>
                    )}
                    </div>
                  </div>
                </div>

                <motion.div className="obFly" animate={torn ? { y: 520, rotate: x.get() >= 0 ? 38 : -38, opacity: 0 } : phase === PHASE.TEAR && !dragging && !calm ? { x: [0, 9, 0, 6, 0] } : { x: 0 }}
                  transition={torn ? { duration: 0.7, ease: [0.5, 0, 0.9, 0.6], delay: 0.1 } : { duration: 1.1, repeat: Infinity, repeatDelay: 1.8 }}>
                  <motion.div className="obStubWrap" ref={seamRef} style={{ x, rotate, y: lift, originX, originY: 0 }}
                    drag={phase === PHASE.TEAR && !torn ? "x" : false} dragConstraints={{ left: -w * 1.2, right: w * 1.2 }} dragElastic={0.04} dragMomentum={false}
                    onDragStart={() => { setDragging(true); play("rip"); buzz(8); }} onDragEnd={onDragEnd} whileDrag={{ cursor: "grabbing" }}>
                    <div className="obPaper">
                      <div className="obStub" data-live={phase === PHASE.TEAR ? 1 : 0} style={tearing ? { clipPath: STUB_TORN, WebkitClipPath: STUB_TORN } : undefined}
                        role={phase === PHASE.TEAR ? "button" : undefined} tabIndex={phase === PHASE.TEAR ? 0 : undefined}
                        aria-label={phase === PHASE.TEAR ? "Tear off the stub. Drag it sideways, or press Enter." : undefined} onKeyDown={onStubKey}>
                        <div className="obStubInfo"><i className="obBars" aria-hidden="true" /><small>Admit one</small></div>
                        {phase === PHASE.TEAR && !dragging && <span className="obPull" aria-hidden="true">Pull</span>}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>

            {err && <p className="obErr" role="alert">{err}</p>}
            <div className="obFoot">
              {phase === PHASE.TEAR && !torn && <button type="button" className="obLink" onClick={() => finishTear(1)}>Tap to tear instead</button>}
              {phase === PHASE.STAMP && !inked && (replay
                ? <button type="button" className="obLink" onClick={onSkip}>Close</button>
                : <button type="button" className="obLink" onClick={onSignOut}>Sign out</button>)}
              {replay && phase === PHASE.TEAR && !torn && <button type="button" className="obLink" onClick={onSkip}>Close</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
