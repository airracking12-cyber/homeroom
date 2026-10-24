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

## Move-In Day (the first-run introduction): a short film about an unboxing
Scene 1 is the opening shot, on its own black stage (`src/app/tour/Opening.jsx`, `stage.jsx`, `src/styles/cinema.css`, the `--cine-*` tokens). **Title card** ("Nathaniel Visaya presents / Homeroom / Move-In Day"; any tap skips it; reduced motion has none) → **a bare dorm room at night**, lit only by a cold moonbeam, with one taped box on the floor and subtitles in the lower third, letterbox bars (2.39:1 on wide screens, slim on a phone held upright) → **Open the box**: the tape tears, the flaps swing out, warm light spills, the camera pushes in → **the montage**: string lights unroll, then corkboard, bookshelf, lamp and plant fly out of the box into the room, which warms with each one, a pop sound on every landing → **Start unpacking**: the light fills the frame and the film dissolves into the real app, which furnishes itself behind it.
Scenes 2 to 5 happen over the real app: a title cuts in ("Scene 2, Corkboard") while two black curtains part, a clapperboard slate claps shut on the card, the spotlight lands on the real element (found by `data-tour`), and the piece flies from the card to that element. The last scene has the student add real notes, then the string lights flare. Five scenes at most; skippable from the first frame (Skip tour, Esc); it remembers where you were; it never ends on a "done" screen.
Rules (tests/tour.test.mjs, tests/design.test.mjs): the film's colours are tokens and every pair is readable on black; only `transform` and `opacity` ever move (no filter, no blur, no continuous scale of a big layer: the camera only scales in one-off transitions); the film's own keyframes live in `cinema.css` and are listed in the design test; two compositions of the stage (`wide`, `tall`) switch on aspect ratio so the box and every piece are in frame on any screen; the stage never sits under the subtitles (a two-row grid); reduced motion runs the same story in a fifth of the time with no title card; the whole opening, from pressing "Open the box" to the real room, is under nine seconds.

## Layout (every screen, every width)
Phone (under 640): one column, the bottom bar, a floating add button. Tablet (640 to 1023): the icon rail, two columns where it helps. Laptop and up (1024+): the full sidebar and **two columns, never a stretched strip**: Room (corkboard 1.75fr + shelf and roommate, then four tiles), Track (list + a sticky "This week" rail from 1100), Review's Study (what is next + the study tool, from 1100), Class (seat map + whoever you are looking at), Settings (look, sound, class | help, account, about), Prepare (wizard + a short note). Every page's content starts at the same left edge as the header; nothing is centred away from it. The Room is the first item in the navigation, so home is always one tap away.

