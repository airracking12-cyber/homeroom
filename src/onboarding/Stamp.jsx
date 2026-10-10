// The boarding-pass stamp: a real-looking hand stamp, the ink it leaves, and how they move.
//
// Look: the stamp is a detailed picture (tools/stamp-tool.svg, saved at four sizes in public/stamp/v2/). The ink is drawn live (so it
// carries the passenger's gate and today's date) and then treated like real ink: a soft bleed underneath, a worn texture over it
// (ink-wear.png, a few dry specks and uneven pressure), a faint ghost of a double hit, a slight dent in the paper, a few stray
// specks, and paper fibres laid over it so it looks soaked in. It also dries: darker and shinier at first, then settling.
//
// Feel (the order of things after the press): the stamp comes down and the paper takes the hit; a moment pressed while the ink
// transfers; it peels away and rises out of the picture, which is when the mark is uncovered. While held down (before letting go)
// it presses gently lower and its shadow tightens, so the press is something you do, not only something you trigger.
//
// Used by Onboarding.jsx. With "reduce motion" on, none of this runs: the plain "Check in" button and an instantly inked ticket are used.

import { useMemo, useState } from "react";
import { motion } from "motion/react";

export const STAMP_PATH = "/stamp/v2/";

// seconds from the press to each moment (the sounds and the ticket's recoil are timed from these)
export const TIMING = { contact: 0.115, lift: 0.42, total: 1.15 };

// how high the stamp hovers above the paper (negative = up, in px), per pose
const REST = -32;

const STAMPED_TIMES = [0, 0.1, 0.21, 0.36, 1];
const STAMPED_EASE = ["easeIn", "linear", "easeOut", "easeIn"];

export const toolVariants = {
  locked: { y: REST, rotate: 5, scale: 1.02, opacity: 0.5, transition: { type: "spring", stiffness: 140, damping: 18 } },
  ready: { y: [REST, REST - 8, REST], rotate: [5, 3.2, 5], scale: 1.03, opacity: 1, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } },
  press: { y: -12, rotate: 0.5, scale: 1, opacity: 1, transition: { type: "spring", stiffness: 700, damping: 32 } },
  stamped: {
    y: [null, 0, 0, -22, -190], rotate: [null, 0, 0, -4, -11], scaleX: [null, 1, 1.035, 1, 1], scaleY: [null, 1, 0.95, 1, 1], opacity: [1, 1, 1, 1, 0],
    transition: { duration: TIMING.total, times: STAMPED_TIMES, ease: STAMPED_EASE },
  },
};

// the shadow on the paper: big and faint while the stamp is high, small and dark when it touches
export const shadowVariants = {
  locked: { scale: 1.3, opacity: 0.1, x: 12, y: 10, transition: { type: "spring", stiffness: 140, damping: 18 } },
  ready: { scale: [1.3, 1.5, 1.3], opacity: [0.13, 0.08, 0.13], x: [12, 15, 12], y: [10, 13, 10], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } },
  press: { scale: 1.06, opacity: 0.34, x: 3, y: 2, transition: { type: "spring", stiffness: 700, damping: 32 } },
  stamped: {
    scale: [null, 0.93, 0.93, 1.25, 1.8], opacity: [null, 0.46, 0.46, 0.1, 0], x: [null, 0, 0, 10, 26], y: [null, 0, 0, 9, 20],
    transition: { duration: TIMING.total, times: STAMPED_TIMES, ease: STAMPED_EASE },
  },
};

const poseOf = ({ ready, inked, pressed }) => (inked ? "stamped" : pressed && ready ? "press" : ready ? "ready" : "locked");

// One shared "pose" drives both the stamp and its shadow, so they always move together.
export function useStampPose(ready, inked) {
  const [pressed, setPressed] = useState(false);
  const bind = {
    onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false), onPointerLeave: () => setPressed(false),
  };
  return { pose: poseOf({ ready, inked, pressed }), pressed, bind };
}

// The shadow on the paper. It lives inside the ticket's stamp spot, so it stays put while the stamp moves above it.
export function StampShadow({ pose }) {
  return <motion.span className="obStampShadow" aria-hidden="true" variants={shadowVariants} initial="locked" animate={pose} />;
}

// The stamp itself. `onStamp` runs when it is pressed (click or tap). It is never dead: before the form is complete it still answers
// (Onboarding points at whatever is missing), it just looks dimmed and does not press down. It is a pointer shortcut for the big
// "Check in" button, which is the one keyboard and screen-reader users get, so it is kept out of the tab order.
export function StampButton({ pose, pressed, bind, ready, busy, inked, onStamp }) {
  const disabled = busy || inked;
  const src = (k) => `${STAMP_PATH}stamp-tool@${k}x.png`;
  return (
    <motion.button
      type="button" className="obStamp" data-ready={ready ? 1 : 0} disabled={disabled} onClick={onStamp} tabIndex={-1} aria-hidden="true"
      variants={toolVariants} initial={{ y: -110, rotate: 12, opacity: 0, scale: 1.1 }} animate={pose}
      whileHover={ready && !pressed && !inked ? { scale: 1.07 } : undefined} {...bind}
    >
      <img src={src(2)} srcSet={`${src(1)} 1x, ${src(2)} 2x, ${src(3)} 3x, ${src(4)} 4x`} width="120" height="132" alt="" draggable="false" decoding="async" />
    </motion.button>
  );
}

// The mark. 132 x 132, centred on (66, 66). `gate` is up to three letters, `date` a short date such as "Oct 9".
function InkArt({ gate, date }) {
  return (
    <svg viewBox="0 0 132 132" width="128" height="128" aria-hidden="true" focusable="false" overflow="visible">
      <defs>
        <path id="obArcTop" d="M 25 66 A 41 41 0 0 1 107 66" />
        <path id="obArcBot" d="M 17 66 A 49 49 0 0 0 115 66" />
        <path id="obPlane" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        <path id="obStar" d="M0 -3.6 L1.05 -1.15 L3.7 -1.1 L1.65 .55 L2.3 3.1 L0 1.7 L-2.3 3.1 L-1.65 .55 L-3.7 -1.1 L-1.05 -1.15 Z" />
        {/* a gentle wobble on the edges, as if the rubber were a little uneven, then a hair of softening so nothing is jagged */}
        <filter id="obEdge" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="12" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.22" />
        </filter>
        <filter id="obBleed" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.15" /></filter>
        {/* where the ink took and where it did not (a picture, ink-wear.png: white, with the ink amount in its alpha) */}
        <mask id="obWear" maskUnits="userSpaceOnUse" x="-8" y="-8" width="148" height="148"><image href={`${STAMP_PATH}ink-wear.png`} x="-8" y="-8" width="148" height="148" preserveAspectRatio="none" /></mask>
        <g id="obArt" fill="none" stroke="var(--ob-stamp)" style={{ color: "var(--ob-stamp)" }}>
          <circle cx="66" cy="66" r="60.5" strokeWidth="3.6" />
          <circle cx="66" cy="66" r="55" strokeWidth="1" />
          <circle cx="66" cy="66" r="33" strokeWidth="1.3" />
          <text fill="currentColor" stroke="none" fontSize="9.6" fontWeight="700" letterSpacing="2.3" textAnchor="middle" fontFamily="Inter,sans-serif"><textPath href="#obArcTop" startOffset="50%">HOMEROOM AIR</textPath></text>
          <text fill="currentColor" stroke="none" fontSize="9.6" fontWeight="700" letterSpacing="2.3" textAnchor="middle" fontFamily="Inter,sans-serif"><textPath href="#obArcBot" startOffset="50%" side="right">CHECKED IN</textPath></text>
          <use href="#obStar" x="21.5" y="66" fill="currentColor" stroke="none" />
          <use href="#obStar" x="110.5" y="66" fill="currentColor" stroke="none" />
          <use href="#obPlane" transform="translate(56.4 38.2) scale(.8)" fill="currentColor" stroke="none" />
          <text x="66" y="72" fill="currentColor" stroke="none" fontSize="25" fontWeight="500" textAnchor="middle" fontFamily="Fraunces,Georgia,serif">{gate}</text>
          <path d="M45 80.5 H55 M77 80.5 H87" strokeWidth=".9" />
          <text x="66" y="83" fill="currentColor" stroke="none" fontSize="7.4" fontWeight="600" letterSpacing="1" textAnchor="middle" fontFamily="Inter,sans-serif">{date}</text>
        </g>
      </defs>
      {/* ink soaked into the paper around the edges */}
      <use href="#obArt" filter="url(#obBleed)" opacity=".42" />
      {/* a faint ghost, as when a stamp lands with the slightest slip */}
      <use href="#obArt" transform="translate(.7 .5)" opacity=".16" filter="url(#obEdge)" />
      {/* the mark itself, worn by the texture */}
      <g mask="url(#obWear)"><use href="#obArt" filter="url(#obEdge)" /></g>
    </svg>
  );
}

// A few stray specks around the mark, the same every time (no randomness while rendering).
const SPECKS = Array.from({ length: 11 }, (_, i) => {
  const a = (i * 2.399963) % 6.283185; // golden-angle spread
  const rad = 54 + ((i * 37) % 19);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad, s: 1.2 + ((i * 53) % 17) / 8, d: ((i * 29) % 11) / 220 };
});

// Everything on the ticket once it has been stamped: the dent, the specks, the ink, and the paper fibres over the top.
export function Impression({ gate, date, calm, tilt = -11 }) {
  const t0 = calm ? 0 : TIMING.contact;
  const dry = useMemo(() => ({ filter: ["blur(2.4px) brightness(.86) saturate(1.35)", "blur(0px) brightness(.9) saturate(1.25)", "blur(0px) brightness(1) saturate(1)"] }), []);
  return (
    <>
      <motion.span className="obDent" aria-hidden="true" initial={calm ? false : { opacity: 0, scale: 1.12 }} animate={{ opacity: [0, 0.6, 0.32], scale: [1.12, 1, 1] }}
        transition={{ delay: t0, duration: calm ? 0.01 : 0.75, times: [0, 0.22, 1], ease: "easeOut" }} />
      {!calm && SPECKS.map((p, i) => (
        <motion.i key={i} className="obSpeck" aria-hidden="true" style={{ width: p.s, height: p.s, marginLeft: p.x, marginTop: p.y }}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.8 }} transition={{ delay: t0 + 0.02 + p.d, duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }} />
      ))}
      <motion.div className="obInk" aria-hidden="true" style={{ rotate: tilt }}
        initial={calm ? false : { opacity: 0, scale: 1.05, ...{ filter: dry.filter[0] } }}
        animate={{ opacity: 1, scale: 1, filter: dry.filter }}
        transition={calm ? { duration: 0.01 } : { opacity: { delay: t0, duration: 0.12 }, scale: { delay: t0, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }, filter: { delay: t0, duration: 2.4, times: [0, 0.2, 1], ease: "easeOut" } }}>
        <InkArt gate={gate} date={date} />
      </motion.div>
      <span className="obFiber" aria-hidden="true" />
    </>
  );
}
