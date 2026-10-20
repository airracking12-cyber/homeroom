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
| Intro | 5 screens: welcome, add real task, paste notes then 3 flashcards, pick Prepare kind, credits. Skip, resume (localStorage `hr:intro:<user>` + account flag `hasCompletedOnboarding`), replay in Settings > Help | intro/Intro.jsx, machine.js, onboarding/flag.js, App.jsx `Signed`/`introOpen` |
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

## (c) SPEC status

| Item | Status |
| --- | --- |
| A1 to A4 | standing. A1: still to read in full before stage 5: Class.jsx, Prepare.jsx, track/parts.jsx |
| Stage 1, 3.2, 3.3, 3.7 | done (tokens, fonts, motion, tests) |
| 1.1 to 1.7 tour, 3.4 room + lamp | done (stage 2) |
| 2.1 to 2.8 notes reading | DONE (stage 3): one-confirm sheet, raw save first (originals uploaded before any page is read), natural-boundary chunks, per-chunk save, resume after limit/error/cancel/closed app, "Part 3 of 8" + real %, never 100% before the coverage check, cancel keeps finished chunks, retry only the failed chunk, coverage list + one-tap reprocess, 300-idea overflow goes to a new note, >120,000 chars becomes numbered parts, PDFs read 3 pages at a time with pdf-lib, no more 650-word summary |
| 3.5 motion | keyframes done and used; `stick` (Track tasks) and `celebrate` (session end) to be used in stages 4 and 5 |
| 3.1, 3.6 | in progress: empty states with personality, roommate microcopy, replace the one `.spin` spinner with a skeleton, sticky-note tasks on Track: stage 5 |
| 4.2 to 4.7 coach | todo (stage 4) |
| 2.1, 4.1 | done (findings reported) |

## (d) Key decisions
- E1 answers: Q1 reviewer = the whole Review tab. Q2 yes, supersede tests; DESIGN.md is ignored as a constraint (replaced by a short dorm design note). Q3 my call: `@fontsource/patrick-hand` (same pattern as the two fonts already shipped). Q4 credit goes at the beginning of the tour (welcome card), plus Settings > About and sign-in. Q5 Room is the default landing, tab bar stays at 5. Q6 add `pdf-lib` and read PDFs page group by page group. Q7 superseded by the AI rule below.
- E1 AI rule, my reading: inside Notes/Review, AI runs only (1) when building the class's shared database from a note (ideas plus stored practice items: questions, key points, common mistake, memory trick) and (2) when making a reviewer. Study sessions run from stored data with no live AI and no AI grading (key-point checklist plus self-rating instead). Reviewers: one shared class reviewer per scope, first come first served: the first student to ask generates it, everyone else reads the saved one, and a claim record stops duplicate generation.
- Not covered by the AI rule, left untouched: Assistant, quick-add, Plan tonight, Prepare. (Flagged to the user.)
- User accepts any dependency or file size ("quality over size"). New dependencies so far: `@fontsource/patrick-hand` (stage 1), `pdf-lib` (stage 3).
- Reviewer scheduling: keep the existing Leitner boxes (`BOX_DAYS [0,1,2,4,8,16]`, `study.cards[ideaId] = {b, due, s, m}`); extend cards with optional fields only.
- Notes-reading persistence: raw text is `notes.body` (saved first); per-chunk ideas appended through `save_note_ideas`; private resume record in `kv` as `u:<user>:ingest:<noteId>`. Practice items and shared reviewers go in shared `kv` rows (to be checked against the kv RLS in stage 3). No SQL change planned (A3).
- Inputs over 120,000 chars: split into numbered parts with a plain notice, never cut silently.

## (e) Open questions
- None blocking. For the user to confirm: (1) the AI-rule reading; (2) Q7 superseded (key points + self-rating, no live AI grading); (3) several files added at once now become one note PER FILE, each keeping its own original (before, they were merged and only a single file kept its original).

## (f) Files changed
Stage 1 and 2: see the previous zips (tokens/motion/room/tour).
Stage 3: package.json/lock (+pdf-lib), NEW src/lib/ingest.js, NEW src/lib/ingest-ai.js, NEW src/app/ingest.jsx; src/app/data.jsx (saveNote raw save, addNote starts background reading, `ingest` in context), src/app/review/notes.jsx (AddNotesSheet rewritten, Library shows reading cards), src/app/review/Review.jsx (call sites), src/lib/notes.js (add refuses over-cap instead of cutting), src/lib/study.js (makeChunks in the legacy path, chunkText removed), src/lib/helpers.js (extractFromFile removed), src/styles/screens-review.css; preview/mockSupabase.js (preview notes survive reload); NEW tests/ingest.test.mjs, tests/reading-flow.test.mjs; tests/notes.test.mjs updated.

## Known limits (stage 3)
- Legacy path: `ensureInventory` (Study start / reviewers for an older note with no ideas) is still all-or-nothing with a local sentence fallback; it now chunks on sentences but is not resumable. Stage 4 routes it through the new reader.
- Assistant calls and real PDF page reading were tested with a mocked assistant (progress, failure, retry, cancel, resume all verified in a browser); a real-model run needs your live deployment.
- Resume works on any device for text notes (job in kv + the note text in the database); a file mid-read resumes from its stored original.

## (g) Resume point
Stage 3 DONE (231 tests pass, lint 0 errors, build ok; reading flow driven in a headless phone browser: failure, coverage, one-chunk reprocess, cancel, continue, reload-resume, pacing wait).
Next: stage 4, the reviewer as coach (Review tab, SPEC 4.x + AI rule). Plan: (1) FIRST read supabase kv RLS (can class members write `<classId>:*` shared rows?) and review/Review.jsx StudyHub + runs.jsx + lib/study.js useStudy/missCard again; (2) second pass in the reading pipeline stores PRACTICE ITEMS per idea in a shared row (questions: recall, explain, why, apply; key points; common mistake; memory trick) so Study runs with NO live AI; (3) Reviewers: one shared class reviewer per scope, first come first served with a claim record; (4) Leitner stays, extra optional card fields (confidence, last result, mistake note); interleaved weak-first sessions; 3-step confidence before reveal, mismatch flags in the moment and in the summary; wrong answer shows the likely misunderstanding and re-tests it later; coaching summary; session autosave and resume; `celebrate` at the end; route legacy ensureInventory through the new reader.
