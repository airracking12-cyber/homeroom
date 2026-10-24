# Homeroom v35: a cinematic Move-In Day, a living Room, and layouts that fit every screen

No database changes. Nothing to run in Supabase; deploy as usual.


## The introduction is now a short film
- **Title card, bare night room, tape rip, light, montage, dissolve** (see DESIGN.md "Move-In Day"). New files: `src/app/tour/Opening.jsx`, `src/app/tour/stage.jsx`, `src/styles/cinema.css`; `Tour.jsx` rewritten; `art.jsx` slimmed (the old inline box is gone); `machine.js` gained the opening's timeline (`PHASES`, `OPENING`, `nextPhase`, ...).
- Scenes 2 to 5 (over the real app): a title cut with two parting curtains, a clapperboard slate that claps, a spotlight, and the piece flying from the card to the thing it lights up.
- Skip tour is on screen from the first frame; Esc skips; reduced motion = no title card and a fifth of the time.
- New tokens: `--cine-*` in `tokens.css` (theme independent: the film is always a night scene).

## Home (the Room)
- The corkboard shows your real next tasks as sticky notes (overdue first); a note opens its task. The bookshelf stands your notes up as spines in their subject's colour. Equal-height tiles; two across on a phone.
- A **Room** item is now first in the navigation (it was reachable only through the wordmark).
- The greeting says "Good morning, Mika." (usernames are lowercase; names are capitalised when spoken).

## Layout, desktop and phone
- Track: a sticky "This week" rail beside the list from 1100px; groups of more than six fold to five rows with "Show N more".
- Review (Study), Class, Settings, Prepare: two columns on wide screens; every page starts at the same left edge as the header (`.page-narrow` no longer centres it away).
- The week card's buttons get their own full-width row on a phone.

## Tests
272 tests (was 263). `tests/tour.test.mjs` and `tests/design.test.mjs` describe the film; `tests/room.test.mjs` and `tests/nav.test.mjs` cover the new Room and navigation.
