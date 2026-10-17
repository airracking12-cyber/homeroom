# v32: the calm redesign

A visual redo of everything inside the app, with the Review tab rebuilt. The introduction (splash, sign-in, class gate, boarding pass) is untouched.

## The idea
Light surfaces are for planning, dark surfaces are for focusing. The focus timer and every study session sit on the dark surface, so starting to study feels like lowering the lights. Coral is scarce; subject colours do the rest.

## What changed
- `src/design/calm.css.js`: one consolidated design layer (tokens from DESIGN.md, shell, Tasks, Review, study stage, reader, Data, sheets). It replaces the old redesign, v30 and v31 layers for the app.
- `src/design/intro/`: the previous stylesheet stack, kept only for the introduction screens (`hr solo`) so they look exactly as before. Delete nothing here unless you want the intro restyled.
- `src/design/fonts.css.js`: Fraunces and Inter are self-hosted (no Google Fonts request). Aliased to the same names the intro already uses.
- Review tab: next-up card, a one-sentence "Reviewing" line, techniques chosen by goal (Memorize, Understand, Test myself, Plan ahead), Start inside the chosen card, reviewers grouped by subject, reader set as a numbered study sheet, study sessions on a dark stage.
- Tasks: a ruled list instead of cards; docked bottom tab bar on phones; 44px touch targets on touch screens.
- Accessibility: flashcard name, inert hidden filter panel, account button name, 44px targets.
- Copy: "Start" with a full accessible name per technique, clearer empty and unread-notes text.

## Palette notes
DESIGN.md values, with two nudges so small text passes AA: muted text `#67655F`, and filled buttons use `#B4573A` (white on `#CC785C` is only 3.5:1). The default accent is now `#CC785C`.

## Tests
`contrast` and `typography` now read the calm layer too; `calm.test.mjs` guards against uppercase labels, `transition: all`, blur glass and missing reduced-motion rules.

## Known leftovers
- Task rows still nest the "Mark as done" button inside a button-role row (axe: nested-interactive). Fixing it means restructuring the row that handles swipe.
- The app's original base styles in `App.jsx` still sit underneath the calm layer.
- During the unboxing moment the paper parcels take the shape of the new layout.
