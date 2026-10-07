# v13 + v24 merge (v25)

Base: **v24** (lib/ split, 51 tests, save flush, rate limiter, photo sniffing, data export, "may not have saved" banner,
study focus mode, Claude-Parchment colours, measured AA contrast, type scale).

Brought over from **v13**:
- Keyboard shortcuts (`?`, `g` then t/d/r/a, `j`/`k`, `x`, Enter/Space on a row) and the shortcuts sheet
- Sheet focus trap + focus returned to the opener
- Skip-to-content link, `main` landmark
- Draft task saving ("Picked up where you left off" / Start fresh), form hint explaining why Save is disabled
- Per-tab error card with "Try again" (ErrorBoundary `inline` + `resetKey`), recoloured to v24's palette
- Offline / back-online toasts, toasts that pause on hover/focus, longer window for Undo
- Page title follows the tab (+ timer), browser theme-colour follows light/dark
- Empty-state "Add a task" button
- Plane in plan view (wings, fuselage, seat numbers) and boarding-pass header band + route row
- CSS: prefers-contrast, forced-colors, native control accent, hover/press micro-interactions, long-word wrapping

Deliberately NOT taken from v13 (v24's version is tested and newer): colour tokens, density/spacing layer,
type layer, dark-mode parity layer, tour timing, skeleton/empty-state art, small-phone padding tweaks.

Adjusted while merging: boarding-pass route text 30/26px -> 32/28px to sit on v24's type scale.
Not verified in a browser (no dependencies could be installed here): run `npm install && npm run build && npm run dev` and look at
the plane/cabin and the boarding pass first, since those are the two places v13's CSS meets v24's tokens.

# v26: the unboxing tour
Only the "showing around" part changed; the box, sign-in, boarding pass and plane are untouched.
- The app now lands wrapped (`data-unbox` on the root, set when the plane takes off) and the tour unpacks it: tokens in `UNBOX_TOKENS`, `data-rv` attributes in the markup, `show` lists in `tourSteps`.
- The tour starts by itself when the plane lands (the old "Want a one-minute tour?" bar is gone), and the first card is the offer: Skip tour or Start unpacking. "Play introduction" now ends in the tour too.
- Slower pacing: each new piece pops out with the lights up, then the spotlight and card come in, with the text arriving line by line. A finished step holds for about 2.4 seconds (or press Next). The dots became a progress bar.
- New helpers step (Plan my evening, Groups, focus timer) and an account step; the old tab-only steps now each unwrap their tab.
- Credits to Nathaniel Visaya ("Nathan"): first and last tour card, the account menu footer, page metadata, console, README, package author.
- New: tests/unbox.test.mjs. Not run in a browser (no dependencies could be installed here): after `npm install && npm run dev`, create a fresh account and watch the tour on a phone width and a desktop width, and check that the spotlight lines up with each piece once it has popped.
