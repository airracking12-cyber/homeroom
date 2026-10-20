# v34: the front end rebuilt around Track, Review and Prepare

**No SQL to run, no new settings.** Two packages were added or swapped: `@fontsource-variable/eb-garamond` in, `@fontsource-variable/fraunces` and `motion` out.
Run `npm install` once.

The full audit, feature inventory, navigation map, decisions to confirm and verification report are in `docs/REBUILD-v34.md`.
The design system is in `DESIGN.md` and `src/styles/tokens.css`.

## What changed

- **Five destinations**: Track, Review, Prepare, Class, Settings. The old Tasks, Done, Review, Long term, Data and Ask tabs, the plane panel and the account menu were folded into them. Every feature is still there.
- **A new look** from one token file: cream canvas, serif display type (EB Garamond, weight 400), hairlines instead of shadows, one coral accent. Light and dark follow the device.
- **A new introduction**: what Homeroom is, then three things to actually do (add a task, turn notes into flashcards, start a plan), then closing credits. Skippable, resumable, replayable from Settings.
- **Works on every size**: 320px phones to 2560px monitors, tab bar / rail / sidebar, notch-safe, zoomable, reduced-motion friendly.
- **Credit** for Nathaniel Visaya: the intro's last screen, Settings > About, and the sign-in screen.

## What did not change

Supabase tables, RLS, the Worker, the study rules, the plan rules and every AI prompt. They moved out of `App.jsx` into `src/lib/` without edits.

## Files

- Deleted: the old `App.jsx` body, `src/design/`, `src/longterm/LongTermTab.jsx`, the boarding pass, stamp and plane (`src/onboarding/` keeps only `flag.js`), `public/stamp/`.
- New: `src/styles/*.css`, `src/app/**`, `src/lib/{services,helpers,study,review-ai,hooks}.js`, `DESIGN.md`.
- Tests: 179 (was 158). Removed the tests that only guarded deleted visuals (stamp, boarding pass, old CSS, unboxing tour). Tests that guard behaviour
  (a failed read cannot overwrite study progress, no task photos, private plan data, every sound has a file) now point at the new files.
  Added: tokens and contrast, design-system rules, navigation, intro and credits.

## Shortcuts

`g t` Track · `g r` Review · `g p` Prepare · `g c` Class · `g s` Settings · `g d` shows what you finished · `g a` opens the assistant.
