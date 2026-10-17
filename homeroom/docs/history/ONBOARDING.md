# v27: redesign layer and mandatory onboarding

**Flow** (`src/onboarding/machine.js`): BLANK, STAMP, TEAR, PLANE_ANIMATION, WALKTHROUGH, COMPLETE.
- BLANK, STAMP and TEAR live in `Onboarding.jsx`. The name and class are filled in on the ticket as part of STAMP (the stamp is dimmed until both are valid, but never dead: see below).
- PLANE_ANIMATION is `PlaneFlight.jsx`. At 58% of the flight it sends PLANE_MIDPOINT, so the walkthrough starts while the plane is still in the air.
- WALKTHROUGH is the existing `Tour` in `App.jsx`, now `mandatory` on a first run: no Skip tour, no X, Escape does nothing, no Skip step.
  A "Show me how" link appears only after 20 seconds on a "do this" step, so nobody is trapped by a step they can't manage.
- Replays from the account menu are still skippable.

**Persistence:** `hasCompletedOnboarding` is stored in the Supabase user metadata (no SQL needed). It is written `false` when the
ticket is stamped and `true` when the walkthrough ends. If it is `false` at sign-in (closed the tab mid-tour, new device) the
walkthrough resumes. Accounts that predate onboarding have no value and are left alone.

**Redesign:** `src/design/redesign.css.js` is appended after the app's stylesheet (`STYLES` in `App.jsx`). Remove that import and
the `+ REDESIGN_CSS` to go back to v26.

**Preview with a fake database:** `npx vite --config vite.preview.config.js`, then open `/?scn=new` (first run),
`/?scn=pending` (resume) or `/?scn=returning`.

**New dependency:** `motion` (Framer Motion). New tests: `tests/onboarding.test.mjs`.

# v30: the stamp is a button now

The old stamp was a small, bobbing target you had to hit, dimmed until the form was valid, with nothing saying what was missing.
- STAMP: one large **Check in** button. It is never dead. If the name or class is missing it focuses that field, shakes it and says what to do
  (`point()` in `Onboarding.jsx`). When both are valid it saves the ticket, and the stamp comes down by itself. Nothing to aim at.
- TEAR: a **Tear off the stub** button, or swipe the stub. The swipe is easier: a 40% pull (was 55%) or a quicker flick (`TEAR_DISTANCE`, `TEAR_FLICK` in `machine.js`).
- The machine and its phases are unchanged, so `tests/onboarding.test.mjs` still describes the flow.

# v31: the unboxing is a real unboxing

The tour still has the same steps, gates and tokens (`data-rv` on pieces, `show: [...]` on steps). What changed is how a piece comes out of the box.
- **The lid** (first step only): a kraft-paper lid with a ribbon cross and a label covers the screen. The label lifts off (tape cut), the two halves slide apart, and only then does the welcome card appear. Its state is `lidS` in `Tour` (`closed`, `tape`, `open`, gone) and it is what decides whether the intro still has to run, because effects run twice under React StrictMode and a "ran already" flag would skip it.
- **Wrapped pieces**: a piece that is not unwrapped yet is no longer invisible. It keeps its place and size and shows as tissue paper, with everything on it hidden; big pieces (hero, list, side, whole pages) are tied with the clay ribbon. This is generated per token in `UNBOX_CSS` (App.jsx); the paper itself is `--wrap`, `--wrap-ribbon` in `design/unbox.css.js` (light and dark).
- **Unwrapping**: when a step introduces a piece, `Tour` lays a sheet of the same paper over it (`.tourSheet`, measured from the live element and kept glued to it while the page scrolls), *then* lets the piece out (`pending`), then the sheet lifts away with a sheen while the real piece settles in (`unboxPop`). Pieces on another tab are picked up as soon as that tab has mounted.
- **Pace**: a new piece gets 2.4 s with the lights up (3.3 s for the finale, 3 s for the lid) and a tape-rip, box-open and pop sound each. With "reduce motion" on, the lid and sheets are skipped and pieces simply appear.

# v31: sounds and the new stamp

- **Stamp** (`Stamp.jsx`): `useStampPose` gives one pose (`locked`, `ready`, `press`, `stamped`) shared by `StampButton` (the wooden stamp) and `StampShadow`, so they always move together. `Impression` is the mark: bleed, wear (`ink-wear.png`), ghost, dent, specks, fibres, and the drying from dark to final colour. The pictures are in `public/stamp/v2/`; the sources are in `tools/`.
- **Two ways to stamp, one function.** The stamp and the **Check in** button both call `stamp()` in `Onboarding.jsx`. If the form is incomplete both go to `point()`. Holding either one sets the `press` pose (the Check in button spreads `stampPose.bind`); letting go is the click that stamps. The stamp is `tabIndex={-1}` and `aria-hidden`, because the button is the accessible route.
- **Timing.** `TIMING` in `Stamp.jsx` (`contact`, `lift`, `total`) drives the stamp sound, the peel sound, the ink, the ticket's dip (`.obRecoil`) and when `EVENT.STAMPED` is sent. `tests/assets.test.mjs` checks the moments are in order and match the keyframes.
- **Reduce motion**: no stamp, no shadow, no specks. The Check in button inks the ticket at once, with the stamp sound only.
- **Sounds**: `src/lib/sound.js` (files in `public/sounds/v2/`, synthesized fallback). The onboarding and the tour only call `Sound.play(name)`; `tests/soundstamp.test.mjs` checks every name used has a file.
