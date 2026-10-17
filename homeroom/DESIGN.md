# DESIGN.md

Homeroom's design system. Warm, calm, editorial, and built for daily use: a cream canvas, one coral accent, a serif for display
type, hairlines instead of shadows. Simple and uncluttered. Every colour, size and radius lives in `src/styles/tokens.css`;
nothing else in the app contains a hex value (`tests/contrast.test.mjs` fails if one appears).

> **Where this came from.** The brief for v34 named a reference file, `design-claude.md`, as the look to follow. That file (and
> an earlier `DESIGN.md`) was not in the upload, so these tokens were built from the colours, type rules and shapes described in
> the brief itself. All values are in one file on purpose: if you compare against the original and something differs, change
> `tokens.css` and run `npm test`. The contrast test will tell you whether a new value still passes.

## Adapted, not copied

The reference describes a marketing site; Homeroom is a daily-use app. So:

| Marketing site | Homeroom |
| --- | --- |
| 96px between sections | 24px on phones, 32px from 768px |
| 24 to 32px card padding | 16px, 20px from 768px. Lists stay compact and scannable |
| Display type up to 48px | 28px on phones, 40px on desktop |
| Hero band, pricing, cookie banner, connector tile, footer | Not built. App components instead: task row, plan week card, lesson card, quiz card, tab bar, sidebar, empty state |
| Brand mark | A plain Homeroom wordmark of our own (serif, with a coral dot) |

## Colour

All pairs below are verified in light, dark and system-dark by `tests/contrast.test.mjs`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#faf9f5` | `#1b1a17` | the page |
| `--surface` | `#f3efe5` | `#252320` | cards |
| `--surface-2` | `#ebe5d8` | `#302d28` | wells, hover wash, segmented tracks |
| `--raised` | `#fffefb` | `#2a2824` | sheets and menus |
| `--hairline` | `#e1d9ca` | `#3a3630` | decorative borders and dividers |
| `--border` | `#8c877b` | `#8b857a` | borders you must see: inputs, checkboxes (3:1) |
| `--ink` / `--body` / `--muted` | `#141413` / `#3d3d3a` / `#5c5a54` | `#f5f1e8` / `#d9d4c8` / `#b0aa9d` | text |
| `--faint` | `#8e8b82` | `#6f6a60` | **decoration and disabled only, never small text** |
| `--coral` | `#cc785c` | `#d9856a` | big shapes, the wordmark dot. Not text, and not on cards |
| `--accent-fill` | `#a9583e` | `#d9856a` | every button with a label, selected states, progress |
| `--accent-text` | `#9a4a31` | `#eaa690` | coral-coloured text |
| `--ok`, `--warn`, `--bad`, `--info` | with `-wash` tints | | status, always with a word or icon |

Accessibility overrides that beat the reference file:
- White on `#cc785c` is 3.3:1, so buttons use `--accent-fill` (white on it is 5.1:1).
- `#8e8b82` on cream is 3.2:1, so it is never used for text. Secondary text is `--muted` (5.1:1 on canvas, 4.5+ on cards).
- Hover, focus and pressed states are all visible (the reference says to skip hover; we do not).
- Coral on a cream card is only 2.85:1, so rings, bars and selected icons on cards use `--accent-fill`.

## Type

- **Display:** EB Garamond (variable), weight 400, letter-spacing `-0.02em`, line-height 1.15. Never bold the serif: go bigger, not heavier. Never use the sans for display headings.
- **Body and UI:** Inter (variable). Body 16px / 1.55, small 14px, caption 13px. 16px inputs stop iOS zooming in.
- Both are self-hosted with `@fontsource-variable/*`, so they work offline. No Google Fonts link anywhere.
- Scale: display 28 / 40, h2 22 / 26, h3 18, body 16, small 14, caption 13.
- One small uppercase label (`.eyebrow`, 13px, tracked) is allowed for dates and step counters. No other all-caps.

## Space and shape

- 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 56. Content is capped at 1200px.
- Radius: 8 controls (buttons, inputs, tabs), 12 cards, 16 large containers and sheets, pill for badges and chips.
- Depth comes from colour blocks and hairlines. A shadow is only for something that floats: the Add button, a toast, a sheet.

## Components (all in `src/app/ui.jsx` and `src/styles/components.css`)

Button (primary, secondary, ghost, danger; 40px, 44px on touch) · Chip · Segmented control (real radios) · Field · Card · Badge · Bar ·
Ring · Banner · Empty state · Skeleton · Sheet (native `<dialog>`: bottom sheet on phones, side panel from 768px) · Toast with Undo ·
Task row · Tab bar / rail / sidebar. Screens add: plan week card, lesson card, quiz card, flashcard, seat map.

## Layout by device

Mobile first, from 320px up.
- **Phone:** top bar, bottom tab bar (5 destinations), one round Add button above it.
- **Tablet (768px):** a slim left rail with labels, side-panel sheets.
- **Desktop (1024px):** a sidebar with the wordmark, search field in the top bar.
- **Ultrawide:** content stays at 1200px, centred; the top bar lines up with it.
- Uses `dvh`/`svh` (never bare `100vh`), `env(safe-area-inset-*)`, `viewport-fit=cover`, and never blocks zoom. A phone held sideways gets a shorter bar.

## Motion

120 / 200 / 320ms, one easing curve. Used to confirm (a tick, a sheet arriving, lines of the intro appearing one after another),
never to decorate. `prefers-reduced-motion` removes all of it, including the staggered delays.

## Rules

Do
- Keep the cream canvas on every screen. One primary action per screen.
- Use coral only for primary actions and selected states.
- Give every control hover (on devices that hover), a visible focus ring and a pressed state, and a 44px target on touch.
- Write short, human copy with a next step in every error.

Don't
- Use pure white, cool greys, blue accents or a fourth surface colour.
- Put coral everywhere, use emoji as icons (icons are `lucide-react` only), or stack cards inside cards inside cards.
- Add purple gradients, glow, blur glass (only the sticky bar blurs) or `transition: all`.
