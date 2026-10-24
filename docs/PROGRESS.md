# PROGRESS

Project: Homeroom v34 (React 19 + Vite, Supabase, Cloudflare Workers). Read SPEC.md first, then this file, then pick up at the Resume point.
Keep this file short (B8): collapse finished items to one line.

## (a) Files read

**Read in full:** README.md, DESIGN.md, UPGRADE-v34.md, docs/REBUILD-v34.md, package.json, vite.config.js, index.html, public/_headers, wrangler.jsonc, functions/api/[provider].js,
src/main.jsx, src/App.jsx, src/app/intro/{machine.js,Intro.jsx}, src/onboarding/flag.js, src/lib/{ai,notes,review-ai,study,services,store,writes,constants,reviewerDoc,library,helpers,assistant-actions}.js,
src/app/{data.jsx,ui.jsx,nav.js,prefs.js,shell-context.js,router.js,shell.jsx,Assistant.jsx}, src/app/review/{Review,runs,notes}.jsx, src/styles/tokens.css, tests/{design,intro}.test.mjs.

**Partly read (targeted lines or grep):** supabase/schema.sql (notes, note_ideas, save_note_ideas), src/app/settings/Settings.jsx (Look and Help groups), tests/contrast.test.mjs (first 60 lines).

**Skimmed (function names and greps only, NOT yet read in full):** src/app/track/{Track,parts}.jsx, src/app/prepare/Prepare.jsx, src/app/class/{Class,Chat}.jsx, src/app/auth.jsx, src/app/admin/*, src/app/settings/MinecraftPanel.jsx, src/lib/{longterm,hooks,dates,sound,debounce}.js, src/ErrorBoundary.jsx, src/styles/{base,components,layout,screens-*}.css (keyframes and rule counts only).

**Not read:** other tests, other supabase/*.sql, minecraft/, tools/, preview/, UPGRADE-v28..v33, docs/history/*, public sounds.

**Must finish before stage 1 touches them:** the skimmed CSS files (stage 1), Track/parts/Class/Prepare/Settings (stages 2 and 5).

## (b) Feature inventory (nothing may disappear; "(skimmed)" = taken from REBUILD-v34.md, code not yet read in full)

| Area | Feature | Where |
| --- | --- | --- |
| Shell | 5 destinations Track/Review/Prepare/Class/Settings, hash router, `g`+letter shortcuts, `?` help, search (Ctrl/Cmd+K, `/`), Ask assistant, offline and unsaved-changes banners, skip link | nav.js, router.js, shell.jsx |
| Auth | sign-up/in, email confirm, reset, class gate, profile setup, join codes, admin split | App.jsx Root, auth.jsx (skimmed) |
| Move-In Day (replaced the old intro) | unboxing: bare wall, moving box, 5 pieces unpacked, real elements lit, real notes added last; skip/Esc, resume (`hr:tour:<user>` + account flags), one-time offer, replay in Settings | tour/{machine.js,art.jsx,Tour.jsx}, room/Room.jsx offer, onboarding/flag.js |
| Track | task list/calendar/board, add/edit/delete + Undo, quick-add (AI), draft, comments, status, "N finished", streak, week ring, plan tonight (AI), focus timer, Done view | track/Track.jsx, parts.jsx (skimmed), data.jsx |
| Review > Study | next-up hero, scope sheet (period, subjects, topics, word search), goal chips, 9 techniques | review/Review.jsx `StudyHub`, lib/study.js `TECHS` |
| Review techniques | Flashcards (Leitner), Fill blanks, Match, Memory tricks (AI), Teach it back (AI marks), Blurting (AI marks), Practice quiz (AI MC), Mixed exam (timed), Weekly plan | review/runs.jsx, lib/review-ai.js |
| Review > Notes | class library by subject/topic, search (DB full text), add notes (paste, PDF, photo, text; topic suggestion), edit details, remove + Undo, download original | review/notes.jsx `Library`/`AddNotesSheet`, data.jsx `addNote`, lib/notes.js |
| Review > Reviewers | AI one-page reviewers: this week's, subject builder, per-task, saved list, reader | review/Review.jsx, lib/review-ai.js `makeWeekly`/`makeSubjectReviewer`/`makeTaskReviewer`, lib/study.js `writeReviewer` |
| Prepare | 4-step setup, weekly plan, weeks ahead, "Teach me this" lessons, web-searched curriculum | prepare/Prepare.jsx, lib/longterm.js (skimmed) |
| Class | seat map + presence, temporary chat, groups | class/Class.jsx, Chat.jsx, hooks.js `useCabin` (skimmed) |
| Settings | Look (Auto/Light/Dark), Sound (sfx, music, volume), subjects and colours, class, Help (replay intro, shortcuts, feedback), export my data, sign out, delete account, About + credit | settings/Settings.jsx, prefs.js `useAppearance` |
| Assistant | chat, task proposals (confirm first), reads note catalogue + `findIdeas` | Assistant.jsx, lib/assistant-actions.js |
| Admin | suggestions inbox, class quarter, join codes, Minecraft (switched off) | admin/* (skimmed) |
| Data layer | `kv` rows (shared + private `u:<user>:*`), `store.update` version-checked writes, write queue with retry banner, `notes`/`note_ideas` tables, on-device cache | lib/store.js, writes.js, notes.js, data.jsx |
| Sound | file-based sfx + music with synth fallback | lib/sound.js (skimmed) |
| Credit | Nathaniel Visaya: intro last screen, Settings > About, sign-in, console | intro/machine.js `CREDIT`, tests/intro.test.mjs |

### Where the AI reads the user's notes or data (SPEC 2.1)
1. File to text: `helpers.extractFromFile` (PDF/photo to Gemini, told to condense to under 650 words), called from `notes.jsx readFiles`. Text files cut at 20,000 chars. Several files merge into one note; only a single file keeps its original, and only at Save time.
2. `review-ai.suggestTopic`: first 1,500 chars.
3. `study.aiIdeas`: the note's inventory. `chunkText(text, 3000)` splits on lines, one `callClaude` per chunk, one bad chunk throws and the whole note falls back to `localIdeas` (sentence split, max 120). Saved once at the end by RPC `save_note_ideas` (replaces all). Driven by `ensureInventory` from `data.addNote`, Study start, weekly/task/subject reviewers.
4. Consumers of ideas: `writeReviewer`, `makeWeekly`, `buildQuiz`, `askTricks`, `markTeach`, `markBlurt`, and the assistant (`findIdeas`, 150-title catalogue, 20,000-char hits).

### Silent truncation found today (all violate 2.5)
`notes.add` and `data.addNote` slice to 120,000 chars (the DB also checks it); text files 20,000; PDF/photo condensed to ~650 words and capped by the proxy's 4,096-token output; DB `save_note_ideas` keeps at most 300 ideas per note; `localIdeas` 120; suggestTopic 1,500.

### Limits that shape the build
AI proxy: 20 calls/min per student (`AI_LIMITER`, 429 + `X-Homeroom-Limit`), 4,096 output tokens, 60s/120s timeouts, 16 MB request. CSP: `font-src 'self' data:`, `script-src 'self'`. No model or Supabase available in my sandbox, so AI paths can only be tested through failure/fallback paths here.

## (c) SPEC status: ALL DONE (see the last reply for what was verified)

| Item | Status |
| --- | --- |
| A1 to A4 | held. Not read in full (only edited for copy/spinner): Class.jsx, Prepare.jsx, track/parts.jsx |
| 1.1 to 1.7 Move-In Day | DONE, rebuilt as an unboxing (E2): bare wall, box with credit label, pieces rise out, spotlight on real elements, real notes last, lights flare, Skip/Esc/replay, offer, a11y, reduced motion. Nothing of the old intro remains (test enforces) |
| 2.1 to 2.8 notes reading | DONE (stage 3): chunked, per-chunk save, resume, real % progress, coverage + reprocess, cancel/retry, 300-idea overflow, numbered parts, PDFs by page group |
| 3.1 to 3.7 dorm UI | DONE: tokens, Patrick Hand + Inter, motion system (unpack/pop-in/stick/glow + celebrate), room home, lamp, lights, skeletons not spinners, empty states with personality, AA both modes, 44px targets, transform/opacity only |
| 4.1 to 4.7 coach | DONE: Coach me (active recall, Leitner kept with all history, interleaved weak-first, mixed question types, confidence before reveal, mismatch flags in the moment and summary, misunderstanding + re-test, coaching summary, autosave + resume, celebration) |
| E1 AI rule | DONE: the assistant only builds the shared database (ideas, topic, practice questions) and writes reviewers; studying calls it 0 times (test + browser check). Reviewers: one per week/task/subject for the class, first come first served (claim records), existing one opened |

## (d) Key decisions
- Q7 superseded: open answers are checked against stored key points + the student's own rating (no live grading).
- Several files at once = one note per file, each keeping its original.
- Leitner kept: new optional card fields x (last confidence), l (last score), w (confident-wrong count), u (unsure-right count).
- No SQL changes anywhere: shared kv rows hold practice items (`<class>:practice:<note>`), claims (`<class>:claim:...`), private rows hold reading jobs (`u:<user>:ingest`) and the coach session (`u:<user>:session`).
- Dependencies added: `@fontsource/patrick-hand`, `pdf-lib` (lazy chunk). Removed: `@fontsource-variable/eb-garamond`.

## (e) Open questions
- None blocking. Worth confirming: (1) the AI-rule reading; (2) the one-note-per-file change.

## Known limits
- Older notes with no ideas are still read the old all-or-nothing way when first studied (sentence chunking, not resumable); the new reader handles every note added from now on.
- Assistant-dependent paths (idea reading, PDF copying, practice questions, reviewers) were verified against a mocked assistant in a browser; run one real PDF and one real note on your deployment.
- Not tested with a real screen reader.

## (f) Files changed (all stages, grouped)
Tokens/motion/room: styles/{tokens,components,layout,motion,room,screens-*}.css, tests/{design,contrast}.test.mjs, DESIGN.md. Room + lamp: app/{nav.js,shell.jsx,prefs.js,room/*}, App.jsx. Move-In Day: app/tour/*, onboarding/flag.js, settings/Settings.jsx, README.md, tests/{tour,nav}.test.mjs. Reading: lib/{ingest,ingest-ai,notes,helpers,study}.js, app/{ingest.jsx,data.jsx,review/notes.jsx}, tests/{ingest,reading-flow,notes}.test.mjs, preview/mockSupabase.js. Coach: lib/{study-core,practice,practice-store,coach,claims}.js, app/review/{coach.jsx,runs.jsx,Review.jsx}, tests/{practice,coach,claims,coach-wiring}.test.mjs. Deps: package.json/lock.

## (g) Resume point
All requirements built (263 tests pass, lint 0 errors, build ok). Nothing is mid-file. If you say "continue": run the real-assistant checks above on your deployment, then optional polish ideas: sticky-note styling for Track tasks (the `stick` animation is currently used by the coach tip and the corkboard piece), a lighter legacy path for old notes.
