// Act I of Move-In Day, the opening shot. A title card, then a bare dorm room at night with one moving box in it. You open the
// box (the tape tears, warm light spills out), and the pieces fly out one after another and settle into the room, which warms
// up as it fills: a move-in montage. Then the light fills the screen and the real app is behind it.
// All the motion is CSS (cinema.css, transform and opacity only), switched by `data-phase`; this file is only the timeline,
// the sounds and the words. Skippable at every moment, and with reduced motion it is a short, still version of the same thing.
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../ui.jsx";
import { useMedia } from "../../lib/hooks.js";
import { Sound } from "../../lib/sound.js";
import { Stage, MOTES } from "./stage.jsx";
import { CREDIT, OPENING, PROP_COUNT, nextPhase, landsAt, placingLength, unpackedDuring } from "./machine.js";

export default function Opening({ step, headRef, onExit, onStart, onSkip }) {
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const k = reduced ? 0.2 : 1;                                  // reduced motion: the same story, in a fifth of the time
  const [phase, setPhase] = useState(reduced ? "scene" : "title");
  const [placed, setPlaced] = useState(0);
  const timers = useRef([]);
  const later = useCallback((fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // the timeline: each phase hands over to the next by itself, except where the person is in charge (scene, ready)
  useEffect(() => {
    if (phase === "title") { later(() => setPhase(nextPhase("title")), OPENING.title * k); return; }
    if (phase === "ripping") {
      [0, 140, 300].forEach((ms) => later(() => Sound.play("rip"), ms * (reduced ? 0.3 : 1)));
      later(() => setPhase(nextPhase("ripping")), OPENING.rip * k);
    } else if (phase === "open") {
      Sound.play("bell");
      later(() => setPhase(nextPhase("open")), OPENING.open * k);
    } else if (phase === "placing") {
      for (let i = 0; i < PROP_COUNT; i++) later(() => { setPlaced(i + 1); Sound.play("pop"); }, landsAt(i) * k);
      later(() => { Sound.play("add"); setPhase("ready"); }, placingLength() * k);
    } else if (phase === "exit") {
      Sound.play("done");
      onExit?.();
      later(onStart, OPENING.exit * k);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxOpen = ["open", "placing", "ready", "exit"].includes(phase);
  const count = unpackedDuring(placed, boxOpen);
  const open = () => { if (phase === "scene") setPhase("ripping"); };
  const cta = () => { if (phase === "scene") open(); else if (boxOpen && phase !== "exit") setPhase("exit"); };
  const label = phase === "scene" ? step.cta : step.ctaOpen;
  const line = boxOpen ? step.afterOpen : step.body;
  const skipTitle = () => { if (phase === "title") { timers.current.forEach(clearTimeout); timers.current = []; setPhase("scene"); } };
  const announce = phase === "ready" ? "The room is set. Press Start unpacking." : phase === "open" ? "The box is open." : "";

  return (
    <div className="cine" data-phase={phase} data-placed={placed} style={{ "--placed": placed }} role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-b">
      <div className="cine-cam" aria-hidden="true" onClick={open}>
        <div className="cine-drift">
          <Stage layout="wide" /><Stage layout="tall" />
          <div className="cine-motes">{MOTES.map((m) => <i key={m.k} style={{ left: `${m.x}%`, top: `${m.y}%`, "--d": `${m.d}s`, "--sz": `${m.s}px`, "--k": m.k }} />)}</div>
        </div>
        <div className="cine-warm" />
      </div>
      <div className="cine-vignette" aria-hidden="true" />
      <div className="cine-bar cine-bar-t" aria-hidden="true" /><div className="cine-bar cine-bar-b" aria-hidden="true" />
      <div className="cine-flash" aria-hidden="true" />

      {/* the title card: before anything else, who made it */}
      {phase === "title" && (
        <button type="button" className="cine-title" onClick={skipTitle} aria-label="Skip the title">
          <span className="eyebrow">{CREDIT.name} presents</span>
          <span className="cine-name" aria-hidden="true">Homeroom<i /></span>
          <span className="cine-tag" aria-hidden="true">Move-In Day</span>
        </button>
      )}

      <div className="cine-top"><Button variant="ghost" size="sm" className="cine-skip" onClick={onSkip}>Skip tour</Button></div>

      {/* the subtitles: what a film would say at the bottom of the frame */}
      <div className="cine-lower">
        <h2 id="tour-h" ref={headRef} tabIndex={-1}>{step.title}</h2>
        <p id="tour-b" key={boxOpen ? "after" : "before"} className="cine-sub">{line}</p>
        <p className="caption tour-credit cine-credit">{CREDIT.welcome}</p>
        <div className="cine-foot">
          <div className="cine-strip" aria-hidden="true"><ol>{Array.from({ length: PROP_COUNT }, (_, i) => <li key={i} data-done={i < count ? "" : undefined} />)}</ol><span className="caption">Unpacked {count} of {PROP_COUNT}</span></div>
          {phase !== "ripping" && phase !== "exit" && <Button variant="primary" size="lg" className="cine-cta" onClick={cta}>{label}</Button>}
        </div>
        <p className="sr" role="status">{announce}</p>
      </div>
    </div>
  );
}
