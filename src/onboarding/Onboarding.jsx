// The first-run ticket: blank white, stamp it, tear off the stub, then take off.
// The visible flow is BLANK > STAMP > TEAR; the plane and the walkthrough are in PlaneFlight.jsx and the Tour (App.jsx).
// The stamp (a wooden hand stamp, its shadow and the ink it leaves) is in Stamp.jsx. It hovers over the ticket and can be pressed
// directly, or the big "Check in" button can be used (holding either one presses the stamp lower, letting go stamps).
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
import { Impression, StampButton, StampShadow, TIMING, useStampPose } from "./Stamp.jsx";

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

export default function Onboarding({
  classes, classPicker, replay, name, classLabel, onSubmit, onTakeoff, onSignOut, onSkip, sound,
}) {
  const calm = useReducedMotion();
  const [phase, send] = useReducer(reduce, PHASE.BLANK);
  const [uname, setUname] = useState(replay ? name || "" : "");
  const [cls, setCls] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(""); // which field is being pointed at: "name" or "class"
  const nameRef = useRef(null);
  const classRef = useRef(null);
  const [inked, setInked] = useState(false); // the stamp has landed
  const [torn, setTorn] = useState(false); // the stub has come away
  const [gone, setGone] = useState(false); // the ticket is leaving
  const [dragging, setDragging] = useState(false);
  const [tilt] = useState(() => -(7 + Math.floor(Math.random() * 8))); // each stamping lands a little differently
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const play = (n) => { try { if (sound) sound.play(n); } catch { /* sound is optional */ } };

  const u = uname.trim().toLowerCase();
  const nameOk = /^[a-z0-9_.]{3,20}$/.test(u);
  const gate = replay ? classLabel : (classes.find((c) => c.id === cls) || {}).label;
  const ready = replay || (nameOk && !!cls);
  const stampPose = useStampPose(ready && !busy, inked);
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

  // 2. STAMP: tap "Check in" (or press the stamp itself). Neither is ever dead: if something is missing, they point at the
  // field and say what to do. Otherwise the stamp comes down by itself, so there is nothing small or moving to aim at.
  const missing = !replay && (!nameOk ? "name" : !cls ? "class" : "");
  const point = (what) => {
    setNudge(what); play("err"); buzz(12);
    if (what === "name" && nameRef.current) nameRef.current.focus({ preventScroll: false });
    if (what === "class" && classRef.current && classRef.current.scrollIntoView) classRef.current.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    later(() => setNudge(""), 900);
  };
  const stamp = async () => {
    if (busy || inked || phase !== PHASE.STAMP) return;
    setErr("");
    if (missing) { point(missing); return; }
    if (!replay) {
      setBusy(true);
      const e = await onSubmit(u, cls);
      setBusy(false);
      if (e) { setErr(e); play("err"); return; }
    }
    setInked(true);
    const thump = () => { play("stamp"); buzz([14, 30, 10]); };
    if (calm) thump();
    else {
      later(thump, TIMING.contact * 1000); // the sound lands when the rubber does
      later(() => play("lift"), TIMING.lift * 1000); // and the peel as the stamp lifts
    }
    later(() => send(EVENT.STAMPED), calm ? 400 : TIMING.total * 1000 + 100);
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
  const heading = torn ? "Boarding now" : phase === PHASE.TEAR ? "Tear off the stub" : inked ? "Checked in" : "Check in";
  const sub = torn ? "Safe travels."
    : phase === PHASE.TEAR ? "Swipe the stub along the dotted line, or just tap the button."
      : inked ? "Stamping your ticket."
        : replay ? "Press the stamp, or tap the button." : "Pick a name and your class, then press the stamp or tap the button.";
  const checklist = phase === PHASE.STAMP && !replay && !inked
    ? (missing === "name" ? (uname ? "Your name needs 3 to 20 letters, numbers, dots or underscores." : "Type a name your classmates will see.") : missing === "class" ? "Now pick your class above." : "")
    : "";

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
              <motion.div className="obRecoil" animate={inked && !calm ? { y: [0, 6, -1.5, 0.5, 0] } : { y: 0 }} transition={{ duration: 0.5, delay: TIMING.contact, times: [0, 0.22, 0.5, 0.75, 1] }}>
                <div className="obPaper">
                  <div className="obBody" style={tearing ? { clipPath: BODY_TORN, WebkitClipPath: BODY_TORN } : undefined}>
                    <div className="obHead">
                      <span className="obAir"><Plane size={15} aria-hidden="true" />Homeroom Air</span>
                      <span>Boarding pass</span>
                    </div>
                    <div className="obRoute" aria-hidden="true"><b>HRM</b><i /><Plane size={18} /><i /><b>{gateCode}</b></div>

                    <label className="obLab" htmlFor="obName">Passenger</label>
                    <input id="obName" ref={nameRef} className={`obName${nudge === "name" ? " nudge" : ""}`} value={uname} placeholder="your name" maxLength={20}
                      readOnly={replay || phase !== PHASE.STAMP || inked} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                      onChange={(e) => { setUname(e.target.value.toLowerCase().replace(/\s+/g, "")); setNudge(""); }} onKeyDown={(e) => e.key === "Enter" && stamp()} aria-describedby="obHint" />
                    {!replay && phase === PHASE.STAMP && !inked && <p id="obHint" className={`obHint${uname && !nameOk ? " bad" : ""}`} data-show={uname && !nameOk ? 1 : 0}>3 to 20 letters, numbers, dots or underscores.</p>}

                    <div className="obLab" style={{ marginTop: 14 }}>Gate, your class</div>
                    {replay || phase !== PHASE.STAMP || inked
                      ? <div className="obGate">{gate || "Not chosen"}</div>
                      : <div ref={classRef} className={`obClass${nudge === "class" ? " nudge" : ""}`}>{classPicker(cls, (c) => { setCls(c); setNudge(""); })}</div>}

                    <div className="obRow">
                    <div className="obGrid">
                      <div><small>Date</small><b>{today}</b></div>
                      <div><small>Departs</small><b>Now</b></div>
                      <div><small>Status</small><b>{inked ? "Checked in" : "Not yet"}</b></div>
                    </div>

                    <div className="obZone" aria-hidden="true">
                      {!inked && <span className="obZoneRing"><em>Stamp here</em></span>}
                      {phase === PHASE.STAMP && !calm && <StampShadow pose={stampPose.pose} />}
                      {inked && <Impression gate={gateCode} date={today} calm={!!calm} tilt={tilt} />}
                    </div>

                    {phase === PHASE.STAMP && !calm && (
                      <StampButton pose={stampPose.pose} pressed={stampPose.pressed} bind={stampPose.bind} ready={ready} busy={busy} inked={inked} onStamp={stamp} />
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
            <div className="obAct">
              {phase === PHASE.STAMP && (
                <>
                  <button type="button" className="obGo" data-soft={missing ? 1 : 0} disabled={busy || inked} onClick={stamp} {...(calm ? {} : stampPose.bind)}>
                    {busy ? "Checking you in…" : inked ? "Checked in" : "Check in"}
                  </button>
                  <p className="obNeed" aria-live="polite">{checklist}</p>
                </>
              )}
              {phase === PHASE.TEAR && !torn && <button type="button" className="obGo" onClick={() => finishTear(1)}>Tear off the stub</button>}
            </div>
            <div className="obFoot">
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
