# SPEC

Sections A and C of the project brief, copied verbatim with their numbers. Never summarize, merge, or shorten them.
New instructions from the user are appended at the bottom, verbatim, with the next number (B2).

## A. Ground rules (apply to every message)

A1. The code is the only source of truth about what the app is, what it does, and how it's built. Read all of it before doing anything else. If it's too large to read in one pass, say so, read it in a sensible order, and list the files you've read in PROGRESS.md. Don't assume anything that isn't in the code. If something I ask for doesn't match the code (for example, there's no reviewer, no night mode, or no AI-reading feature), ask me instead of guessing or inventing one.

A2. Keep every existing feature and all saved user data working. Keep the current tech stack and structure unless I say otherwise. Don't add dependencies without asking first; tell me what it's for and what it costs in size.

A3. Don't change how data is stored unless you must. If you must, use a backward-compatible, versioned migration, back up the old data first, and tell me how to test it against existing data.

A4. If requirements conflict, this is the priority order: (1) never lose user data, (2) existing features keep working, (3) accessibility and performance, (4) the new features, (5) visual flourish. Tell me about the conflict instead of silently choosing.

## C. Requirements

### 1. Move-In Day introduction
1.1 Replace the current intro with a guided tour that teaches the app by using it.
1.2 At most 5 steps, framed as moving into a dorm, opening with a welcome that uses the app's own name from the code.
1.3 Each step spotlights a real UI element that exists in the app, so the user learns where things are. If an element isn't visible (small screen, empty state), fall back to a nearby element or a centered card. Never point at nothing.
1.4 One step has the user add their first real notes or data. The tour ends with that real content in the app, not a "tutorial complete" screen.
1.5 Skippable anytime, replayable from the menu, and under 90 seconds for a user who doesn't linger.
1.6 Users who already have saved data get a one-time, dismissible offer to take the tour. Never force it. Skipping must never alter or lose anything.
1.7 Keyboard and screen-reader friendly: focus moves to each step, Esc skips, reduced motion respected.

### 2. Note/data reading: simple, visible, lossless
2.1 Find everywhere the AI reads the user's notes or data. Tell me what you found before changing it.
2.2 Flow: upload or paste, one confirm, done. Remove extra options and jargon.
2.3 Save the raw input immediately and unchanged, before any AI touches it. Never overwrite it.
2.4 Split large inputs into chunks on natural boundaries (headings, paragraphs, never mid-sentence). Process each chunk independently and save results per chunk.
2.5 If processing hits a limit, fails, is cancelled, or the app is closed, it resumes from the last finished chunk. Never truncate silently; if something can't be processed, say so.
2.6 Progress bar with a live percentage based on real chunks completed ("Part 3 of 8"), plus plain-language stages beside it. Never show a fake 100%: reach 100% only after the last chunk is saved and the coverage check has run.
2.7 Finish with a coverage check: every section of the source is represented in the output, and anything missed is listed, with a one-tap way to reprocess only those parts.
2.8 Include cancel (keeps finished chunks), a friendly error with retry (retries only the failed chunk), and autosave throughout.

### 3. Cozy dorm UI, designed with restraint
3.1 Reimagine the UI, UX, and animations as a cozy dorm room that feels like unpacking and settling in. Principle: cozy at the edges, calm in the middle. Decoration (lamp glow, string lights, corkboard, plants, textures) frames the screen. Study areas stay clean and readable, and decoration never sits behind or over text or controls.
3.2 Palette: warm creams, wood browns, muted sage, one accent color. Pair a rounded, handwritten-feel heading font with a clean body font. Check what fonts the app already loads. Any new font must be self-hosted or already permitted, and must fall back gracefully offline.
3.3 Define colors, spacing, radii, and shadows once as design tokens. Components use tokens, never hardcoded values.
3.4 Layout metaphor: the home screen is "your room." Map the app's real sections to parts of a room (for example desk, bookshelf, corkboard) and night mode to a lamp, based only on what actually exists in the code. Show me the proposed mapping in your plan before building it.
3.5 Motion system with four reusable animations used everywhere, each defined once: unpack (boxes open), pop-in (items settle into place), stick (sticky notes peel and attach), glow (lamp and focus states). Plus one celebration when a session is finished.
3.6 Every tap shows a visible response within 100ms (a pressed state before any async work). Use skeletons instead of spinners, empty states with personality, and microcopy like a friendly roommate. Errors and destructive actions stay plain and unambiguous.
3.7 Technical: animate transform and opacity only (build glow as an opacity-animated layer, not an animated box-shadow or filter). Smooth on low-end phones. Respect "reduce motion" (swap to instant or simple fades). WCAG AA contrast (4.5:1 body text, 3:1 large text and UI components) in both light and night modes. Mobile-first, touch targets at least 44px.

### 4. Reviewer as coach
4.1 Improve the existing reviewer so it builds better students, not just memorization. First tell me how it works today.
4.2 Use active recall, spaced repetition, and interleaved topics instead of repeated flashcards. Choose the simplest scheduling that fits the app's existing data (for example Leitner-style boxes), tell me which in the plan, and keep all existing review history.
4.3 Mix question types: recall, "explain it in your own words," "why does this work," and "apply it to a new situation." If the app has no way to generate or grade open-ended answers, ask me how they should be checked before building.
4.4 Ask for a confidence rating (simple 3-step scale) before revealing each answer. Flag mismatches between confidence and accuracy, both confident-but-wrong and unsure-but-right, in the moment and in the summary.
4.5 On a wrong answer, explain the likely misunderstanding and re-test it later. Focus on weak topics and adapt difficulty.
4.6 End each session with a short coaching summary: what went well, what to work on, one concrete tip.
4.7 Sessions autosave, so quitting mid-session never loses answers.

<!-- New instructions from the user are appended below this line, verbatim, numbered E1, E2, ... (B2). -->

### E1 (user, after the first reply; answers to Q1 to Q7 plus new rules)

ignore design.md
ok just make nathaniels credit in the begining then
make it so that the ai is only used for the database and when making reviers the whole class is one big shared reviewer and its a first come first serve basis 

1. the whole review tab
w. yes you may
3.shatever you decide is better
4. sure add that
5.the first
6.sure add that
7. sure

now go i do not care how big the file size is so it is quality over size here
