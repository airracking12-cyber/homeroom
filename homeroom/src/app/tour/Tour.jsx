// Move-In Day, the film. Scene 1 is the opening shot (Opening.jsx): a title card, a bare room at night, a moving box. Every scene
// after it puts one piece in its place in the REAL app: a clapperboard slate, a title that cuts in, a spotlight on the part of
// the app the piece stands for (found by its data-tour attribute), and the piece itself flying from the card to that spot.
// Focus moves to each card, Esc skips, and it ends with your first real notes on the shelf, never a "done" screen.
// It never points at nothing: if an element isn't on screen it tries the next candidate, then shows a centered card.
import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "../ui.jsx";
import { Sound } from "../../lib/sound.js";
import { STEPS, start, reduce, stepOf, unpackedCount, slotStates, sceneLabel, loadSaved, save, pickTarget, cardSide, holeFor } from "./machine.js";
import { ITEM_ART } from "./art.jsx";
import Opening from "./Opening.jsx";

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
const find = (id) => [...document.querySelectorAll(`[data-tour="${id}"]`)].find(visible) || null;
const plain = (r) => (r ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null);
const near = (a, b) => ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) < 0.5);

// The moment you finish moving in: the string lights flare for a few seconds (an opacity-only glow, set by a flag on the page).
function settleIn() {
  const el = document.documentElement;
  el.dataset.movedIn = "1";
  setTimeout(() => { delete el.dataset.movedIn; }, 3600);
}

export default function Tour({ user, route, go, ownNotes, toast, onClose }) {
  const [st, dispatch] = useReducer(reduce, user, (u) => start(loadSaved(u)));
  const step = stepOf(st);
  const welcome = step.id === "welcome";
  const [bare, setBare] = useState(true);                      // the real room waits behind the film until the light fills the screen
  const [aim, setAim] = useState({ id: null, rect: null });
  const [covered, setCovered] = useState(false);              // a sheet is open (Add notes): the tour steps aside
  const [fly, setFly] = useState(null);                       // the piece in flight from the card to its place
  const [landed, setLanded] = useState(false);
  const headRef = useRef(null);
  const artRef = useRef(null);
  const baseline = useRef(ownNotes);
  const closed = useRef(false);
  const focusedFor = useRef("");

  // remember the place, and tell the app when the tour ends
  useEffect(() => {
    save(user, st);
    if (!st.open && !closed.current) { closed.current = true; onClose(st.finished ? "finished" : "skipped"); }
  }, [st, user, onClose]);

  // while the room is still bare (the opening shot), the real room waits behind the film; it furnishes itself as the light fills the screen
  useEffect(() => {
    const el = document.documentElement;
    if (st.open && welcome && bare) el.dataset.tourBare = "1"; else delete el.dataset.tourBare;
    return () => { delete el.dataset.tourBare; };
  }, [st.open, welcome, bare]);

  // take the student to the right page for this step
  useEffect(() => {
    if (!st.open) return;
    baseline.current = ownNotes;
    const r = step.route;
    if (r && (route.dest !== r[0] || (r[1] && route.parts[0] !== r[1]))) go(...r);
  }, [st.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // the hands-on step is done when this student's own note lands on the shelf (a classmate's note doesn't count)
  useEffect(() => {
    if (st.open && step.handsOn && ownNotes > baseline.current) {
      settleIn();
      toast?.(`Welcome home, ${user}. Your first notes are on the shelf.`);
      dispatch({ type: "DONE" });
    }
  }, [ownNotes, st.open, step.handsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the spotlight on the target: it is looked for again every moment, so a page that is still loading, a rotated phone
  // or a scroll can't leave it pointing at nothing
  useEffect(() => {
    if (!st.open) return undefined;
    let dead = false, scrolledFor = "";
    const tick = () => {
      if (dead) return;
      setCovered(!!document.querySelector("dialog[open]"));
      const id = pickTarget(step.targets, (t) => !!find(t));
      const el = id ? find(id) : null;
      if (el && scrolledFor !== step.id) { scrolledFor = step.id; el.scrollIntoView({ block: "center", inline: "nearest" }); }
      const rect = plain(el && el.getBoundingClientRect());
      setAim((a) => ((a.id === id && ((!a.rect && !rect) || (a.rect && rect && near(a.rect, rect)))) ? a : { id, rect }));
    };
    tick();
    const t = setInterval(tick, 160);
    window.addEventListener("resize", tick); window.addEventListener("scroll", tick, true);
    return () => { dead = true; clearInterval(t); window.removeEventListener("resize", tick); window.removeEventListener("scroll", tick, true); };
  }, [st.open, st.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // while the card is up, the page behind can't be reached by keyboard or screen reader (the hands-on step needs the real button)
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return undefined;
    root.inert = st.open && !covered && !step.handsOn;
    return () => { root.inert = false; };
  }, [st.open, covered, step.handsOn]);

  // Esc skips (unless a sheet is open: then Esc closes the sheet first)
  useEffect(() => {
    if (!st.open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.preventDefault(); dispatch({ type: "SKIP" }); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [st.open]);

  // focus moves to the card's heading at every step (and again once the page behind has settled)
  useEffect(() => {
    if (!st.open || covered) return;
    const tag = `${step.id}:${aim.id || "none"}`;
    if (focusedFor.current === tag) return;
    focusedFor.current = tag;
    headRef.current?.focus({ preventScroll: true });
  }, [st.open, covered, step.id, aim.id]);

  // each scene after the first: the slate claps as the title cuts away, then the piece flies from the card to its place in the app
  useEffect(() => {
    setFly(null); setLanded(false);
    if (!st.open || welcome) return undefined;
    const timers = [setTimeout(() => Sound.play("tap"), 620)];
    return () => timers.forEach(clearTimeout);
  }, [st.step, st.open, welcome]);
  const flownFor = useRef("");
  useEffect(() => {
    if (!st.open || welcome || covered || !aim.rect || flownFor.current === step.id) return undefined;
    const t = setTimeout(() => {
      const a = artRef.current && artRef.current.getBoundingClientRect();
      if (!a || !a.width) return;
      flownFor.current = step.id;
      const hole = holeFor(aim.rect, window.innerWidth, window.innerHeight);
      const size = 56, fx = a.left + a.width / 2 - size / 2, fy = a.top + a.height / 2 - size / 2;
      const tx = hole.left + hole.width / 2 - size / 2, ty = hole.top + hole.height / 2 - size / 2;
      setFly({ n: step.id, fx, fy, tx, ty, mx: (fx + tx) / 2, my: Math.min(fy, ty) - 70 });
      setTimeout(() => { Sound.play("pop"); setLanded(true); }, 760);
    }, 1250);
    return () => clearTimeout(t);
  }, [st.open, welcome, covered, aim.rect, step.id]);

  if (!st.open) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const hole = !welcome && aim.rect ? holeFor(aim.rect, vw, vh) : null;
  const Art = ITEM_ART[step.item];
  const act = () => {
    if (step.handsOn) { const el = find(aim.id || step.targets[0]); if (el) el.click(); else go(...step.route); return; }
    dispatch({ type: "NEXT" });
  };

  return createPortal(
    <div className="tour" hidden={covered} data-act={welcome ? "opening" : "steps"}>
      {welcome ? (
        <Opening step={step} headRef={headRef} onExit={() => setBare(false)} onStart={() => dispatch({ type: "NEXT" })} onSkip={() => dispatch({ type: "SKIP" })} />
      ) : (
        <>
          {hole ? (
            <>
              <div className="tour-scrim" aria-hidden="true" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
              <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
              <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
              <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
              <div className="tour-ring" aria-hidden="true" data-landed={landed ? "" : undefined} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
            </>
          ) : <div className="tour-scrim" aria-hidden="true" style={{ inset: 0 }} />}
          <div className="tour-layer" data-side={cardSide(aim.rect, vh)}>
            <section key={step.id} className={cx("tour-card pop-in")} data-kind="step" role="dialog" aria-modal={!step.handsOn} aria-labelledby="tour-h" aria-describedby="tour-b">
              <div className="slate" aria-hidden="true">
                <span className="slate-arm" />
                <span className="slate-board"><b>{sceneLabel(st.step)}</b><span>{step.slot}</span><span>Take 1</span></span>
              </div>
              <div className="tag-head">
                <div className="tag-art" ref={artRef} aria-hidden="true"><Art />{step.item === "corkboard" && <span className="tag-note stick" style={{ "--tilt": "7deg", "--i": 2 }} />}</div>
                <div className="tag-text">
                  <p className="eyebrow">Move-In Day &middot; piece {st.step + 1} of {STEPS.length}</p>
                  <h2 id="tour-h" ref={headRef} tabIndex={-1}>{step.title}</h2>
                </div>
              </div>
              <p id="tour-b">{step.body}</p>
              <div className="tour-slots">
                <ol aria-hidden="true">{slotStates(st.step, true).map((s) => <li key={s.id} data-done={s.done ? "" : undefined} />)}</ol>
                <span className="caption">Unpacked {unpackedCount(st.step, true)} of {STEPS.length}</span>
              </div>
              <div className="tour-actions">
                <Button variant="primary" onClick={act}>{step.cta}</Button>
                {st.step > 0 && <Button onClick={() => dispatch({ type: "BACK" })}>Back</Button>}
                <Button variant="ghost" onClick={() => dispatch({ type: "SKIP" })}>{step.skipLabel || "Skip tour"}</Button>
              </div>
            </section>
          </div>
          <div key={`cut-${step.id}`} className="tour-cut" aria-hidden="true"><span className="eyebrow">{sceneLabel(st.step)}</span><span className="tour-cut-title">{step.slot}</span></div>
          {fly && fly.n === step.id && (
            <div key={fly.n} className="tour-fly" aria-hidden="true" style={{ "--fx": `${fly.fx}px`, "--fy": `${fly.fy}px`, "--mx": `${fly.mx}px`, "--my": `${fly.my}px`, "--tx": `${fly.tx}px`, "--ty": `${fly.ty}px` }}><Art /></div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
