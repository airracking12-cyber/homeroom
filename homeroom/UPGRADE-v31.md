# Homeroom v31: a real unboxing, a heavier visual upgrade, new sounds and a new stamp

No database changes. Deploy as usual (v30's SQL must already be run).

v31 also carries the **sounds and stamp** work that was built on a separate v30 (it is merged in here; see the last two sections). `npm install` is not needed again, but run `npm run build` so the new files in `public/sounds/v2/` and `public/stamp/v2/` are deployed.

## The unboxing

The welcome tour now feels like opening a parcel, slowly.

1. A kraft-paper lid with a clay ribbon and a label ("Homeroom, for you, handle with care") covers the screen. The tape is cut (a rip), the label lifts away, and the lid slides open (box-open sound).
2. Underneath, the whole app is wrapped in tissue paper: every piece sits where it will be, covered. The big ones (your day, the task list, the side panel, whole pages) are tied with the ribbon.
3. As the tour introduces each piece, a sheet of paper lifts off it with a sheen across it, and the real piece settles into place while the lights stay up. Then the spotlight and the card come in.
4. It is slower on purpose: about 2.4 seconds per new piece, 3 seconds for the lid, 3.3 for the finale. Reduce-motion skips the lid and the paper and just shows the pieces.

The steps, gates and "Show me how" fallback are unchanged. The new Data tab step from v30 is part of it.

## The visual upgrade (`src/design/v31.css.js`)

- **Ambient canvas**: three soft colour glows (clay, sky, sage) behind everything instead of flat cream; dark mode has its own, quieter set.
- **One depth language**: cards, rows, tiles and lists share a lit top edge plus a close and a far shadow, and lift on hover.
- **Tasks hero card**: the greeting is now a real card with a glow and arcs, a bigger headline and a softly shadowed ring. Day headings have count pills.
- **Controls with body**: the primary button is raised with a lit edge, segmented controls are sunken tracks with a raised thumb, chips and checks lift and glow on hover, inputs have a soft focus halo.
- **Calmer chrome**: frosted rail with an accent edge on the active item, a tab bar with a lit rim, rounder sheets with a gentle blur behind them.
- **Motion**: pages, lists and subject grids arrive in a short stagger.
- Phone: a more compact hero, so the list starts sooner.

To go back to v30's look, remove `V31_CSS` from `STYLES` in `App.jsx`. To go back to the old unboxing, remove `UNBOX_LOOK_CSS` and restore the old `UNBOX_CSS` (see ONBOARDING.md).

## Sounds (`src/lib/sound.js`, `public/sounds/v2/`)

The old sounds were made live in the browser from plain sine waves, which is why they sounded thin and beepy. They are now audio files built to behave like real objects.

- **Tones.** Taps, pops, add and done use soft marimba, celesta and glass notes in one key, so they sound good one after another.
- **Room.** Every sound has a small room around it, in stereo.
- **Effects.** Errors are a soft felt thud, not a buzz. The paper tear, the whoosh and the box opening are new recordings. The unboxing's tape rip, box-open and pop use them.
- **Variants.** Tap, pop and tear each have three variants, never the same one twice in a row, with a tiny random pitch drift.
- **Stamp.** The stamp sound is a rubber-and-wood thump, and there is a new peel sound as the stamp lifts.
- **Music.** The background loop is now 80 seconds of soft electric piano, quiet bass and brushed hats, with a whisper of vinyl crackle.
- **Safety net.** If a file fails to load, the old synthesized sound plays instead, so the app is never silent by accident.
- **Size.** The files total about 1.8 MB and download quietly after the page opens, then stay cached for a year (`public/_headers`).

Everything plays through a light compressor, so several sounds at once never get harsh. The old in-file sound code is gone from `App.jsx`; it now imports `Sound` from `src/lib/sound.js`, which has the same functions (`play`, `setSfx`, `setVolume`, `startMusic`, `stopMusic`, `isMusic`, `pause`, `resume`). If one sound is too loud or quiet, change its number in `TRIM` at the top of `sound.js`; `tools/README.md` has the rest.

## Stamp (`src/onboarding/Stamp.jsx`, `public/stamp/v2/`)

- **Look.** A detailed wooden stamp with a grained maple knob, brass ring, walnut block and a rubber die with ink on its edge. It is drawn at four sizes, so it is crisp on any screen.
- **Hover.** It hovers above the ticket, and its shadow on the paper grows and fades as it floats.
- **Press.** Holding it down presses it lower and tightens the shadow, and letting go stamps. It comes down, the ticket dips, it stays pressed while the ink transfers, then peels away and rises, uncovering the mark.
- **Ink.** The mark looks like real ink: a soft bleed, a worn texture with a few dry specks, a faint double-hit ghost, a dent in the paper, stray specks, and paper fibres over the top. It dries from dark and glossy to its final colour. Each stamping lands at a slightly different angle. The ticket's paper also has a faint fibre texture.
- **Timing.** The stamp sound lands the instant the rubber touches the paper, and the peel sound as it lifts.
- **Reduce motion.** The plain button and the instantly inked ticket still apply.

**How it fits with v31's Check in button.** The big **Check in** button stays, and it is still never dead: with a name or class missing it points at the field and says what to do. The stamp is now a second way to do the same thing, and it never goes dead either. Pressing it with the form incomplete points at the missing field, exactly as the button does. Holding the Check in button also presses the stamp lower, and releasing it stamps, so both routes feel the same. The stamp is left out of the tab order (it is a pointer shortcut; the button is the keyboard and screen-reader route). With reduce motion on there is no stamp tool at all: the Check in button is the plain button, and the ticket is inked at once. The old falling stamp icon, ripple and droplets are gone.

## How this was checked, and what wasn't

Checked in a headless browser against the preview mock (phone and desktop, light and dark): the lid closed, opening and gone; the wrapped app; the paper lifting off the hero with the ribbon; the real piece settling in; the Tasks, Review and Data screens in the new look. `npm test` passes (90 tests), lint has no errors, and the first eight tour steps run with no errors.

**Merge check (sounds and stamp).** `npm test` passes (109 tests; the new ones check that every sound the app plays has a file, that the app uses the shared player, and that the stamp, button and cache rules are wired). The real `Onboarding.jsx`, `Stamp.jsx` and styles were bundled and run in a headless browser, phone and desktop widths, with a stand-in for the animation library: the hover pose, pressing the stamp with an empty form (it points at the name field and plays the error sound), holding the Check in button (the stamp presses), stamping (stamp sound at contact, peel sound after, inked ticket with dent and specks, then the tear step), reduce motion, a replay, and a class list long enough to wrap. No errors.

**Not checked**: the sounds themselves (I can't hear; whether they sound nice to you needs your ears, and `TRIM` is the one-line fix); the real easing of the stamp's movement (the stand-in applies each pose but does not animate it, so tell me if it feels too slow, fast or bouncy); the real `npm run build`; the last tour steps and the finale (many sheets at once) after the new Data step, because the gated steps make an automated run slow; the paper on the Done, Review, Data and Ask pages; how the lid and paper animations perform on a low-end phone (they use gradients and transforms only, no filters, but please try it on the slowest phone you can); and `npm run build` on your machine, as in v30.
