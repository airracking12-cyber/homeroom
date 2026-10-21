# Homeroom design: the cozy dorm room

Principle: **cozy at the edges, calm in the middle.** Decoration (string lights, lamp glow, corkboard, sticky notes, plants, wood) frames the screen. Study areas stay clean and readable. Decoration never sits behind or over text or controls.

This replaces the v34 "calm" rules. The rules below are enforced by `tests/design.test.mjs` and `tests/contrast.test.mjs`.

## Tokens (src/styles/tokens.css is the only place a colour, size, radius, shadow or duration is defined)
- **Palette:** warm creams (canvas, paper), wood browns (ink, borders, frames), muted sage (success, plants, calm washes), ONE accent: clay terracotta (`--accent-fill` for buttons and selected states, `--accent` for big shapes only). Night mode is the room with the lamp on: warm brown, never black.
- **Type:** headings use Patrick Hand (rounded, handwritten feel, weight 400, `font-synthesis: none`), body uses Inter. Both are bundled by Vite, so they work offline once cached; the stacks fall back to system rounded faces.
- **Radius** 12 control / 16 card / 24 large / pill. **Space** 4px base. **Shadows** three tokens: `--shadow-paper` (cards), `--shadow-note` (sticky notes), `--shadow-float` (fab, toast); sheets use `--overlay-shadow`.
- **Accessibility:** text pairs are at least 4.5:1, large text and control boundaries at least 3:1, in light and night. `--faint`, `--wood-2`, `--cork`, `--sage` are decoration and never carry text. Touch targets are at least 44px. Focus is always a visible 2px ring; the lamp glow adds to it, never replaces it.

## Motion (src/styles/motion.css)
Four reusable animations, each defined once: `unpack` (boxes and sheets open), `pop-in` (items settle in, `--i` staggers), `stick` (sticky notes peel and attach, `--tilt` sets the resting angle), `glow` (lamp and focus). Plus one `celebrate` burst, drawn in a decorative band above the finish card's text.
- Only `transform` and `opacity` animate. Glow is an opacity-animated layer, never an animated shadow or filter.
- Every tap shows a pressed state within 100ms (`--dur-press: 60ms`), before any async work.
- Reduced motion: every entrance becomes a 160ms fade; infinite effects stop.

## Furniture (src/styles/room.css)
String lights live in the strip reserved at the top of the sticky bar (`--lights-h`). `.cork` is a frame; text sits only on the `.note` sticky notes pinned to it. `.wood` is a shelf edge. `.lamp` hosts the night-mode glow.

## Room map (home screen, "your room")
Track = corkboard and desk. Review = bookshelf (Notes are the shelf, Reviewers the binders, Study the lamp-lit desk). Prepare = wall calendar. Class = the doorway to the hallway. Settings = the dresser. Night mode = the lamp. Ask = your roommate.

## Move-In Day (the first-run introduction)
An unboxing. A bare wall (the real room waits behind it), a kraft moving box that opens with transform transitions, and five pieces unpacked one per step with the shared `unpack` motion: corkboard (Track), bookshelf (Review), desk lamp (night mode and Ask), your first real notes. Each step lights a real element (a dimmed screen with a glowing ring) and a kraft-paper card that never covers it. The kraft tokens (`--kraft`, `--kraft-2`, `--kraft-3`, `--tape`) are decoration only. It ends with the string lights flaring and your notes on the shelf, never a "done" screen.
