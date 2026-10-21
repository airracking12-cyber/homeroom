# PROGRESS

Project: Homeroom v34 at workspace root (React 19 + Vite, Supabase, Cloudflare Workers). Read SPEC.md first, then this file, then pick up at the Resume point.
Keep this file short (B8). First reply: docs only, no app-code changes.

Note: the tree is large. A1: not all files were read in full this pass. Nested `homeroom/` is a previous upgrade copy (Patrick Hand, pdf-lib, tour/room/ingest). It is not treated as source of truth. See open question Q0.

## (a) Files read

**Read in full:** package.json, index.html, public/_headers, src/main.jsx, src/App.jsx, src/app/intro/{machine.js,Intro.jsx}, src/onboarding/flag.js, src/app/{nav.js,prefs.js}, src/styles/tokens.css, src/lib/{study.js,notes.js,review-ai.js,helpers.js,assistant-actions.js,constants.js}, src/app/review/notes.jsx.

**Partly read:** README.md (to line 80), src/lib/ai.js (to ~80), src/app/data.jsx (header + addNote), src/app/review/{Review.jsx to ~140, runs.jsx to ~130}, src/app/{shell.jsx to ~80, ui.jsx to ~80, settings/Settings.jsx Help/Look, track/Track.jsx to ~80, prepare/Prepare.jsx to ~50, class/Class.jsx to ~40, admin/Admin.jsx to ~40}, src/styles/{base.css to 47, components.css btn/active}, supabase/schema.sql (notes body cap + save_note_ideas 300).

**Grep / names only:** AI call sites under src/, intro Esc, keyframes, FEATURE_HOME in nav.js.

**Not read this pass:** rest of CSS, auth.jsx, track/parts.jsx, longterm.js, store/writes/hooks/sound, tests, remaining supabase SQL, minecraft/, tools/, UPGRADE-v28..v34, DESIGN.md body, nested `homeroom/`.

## (b) Feature inventory (nothing may disappear)

| Area | Feature | Where |
| --- | --- | --- |
| Shell | 5 dests Track/Review/Prepare/Class/Settings (default Track), hash router, g+letter, `?` help, search, Ask, skip link, offline/unsaved banners | nav.js, router.js, shell.jsx |
| Auth | sign-up/in, email confirm, reset, class gate, profile, join codes | App.jsx Root, auth.jsx |
| Intro | Full-screen 5 steps: welcome, add real task, paste notes→3 flashcards, pick Prepare kind, credits. Skip, resume `hr:intro:<user>` + flag `hasCompletedOnboarding`. Replay Settings > Help. Older accounts with no flag are left alone. No Esc. Does not spotlight live chrome. | intro/Intro.jsx, machine.js, onboarding/flag.js, App.jsx Signed |
| Track | list/calendar/board, add/edit/delete+Undo, quick-add (AI in parts.jsx), comments, status, streak, week ring, plan tonight, focus timer, Done | track/Track.jsx, parts.jsx |
| Review > Study | next-up hero, scope (period/subjects/topics/word), goal chips, 9 techniques | review/Review.jsx StudyHub, lib/study.js TECHS |
| Review techniques | Flashcards Leitner BOX_DAYS [0,1,2,4,8,16] cards `{b,due,s,m}`; Cloze; Match; Memory tricks (live AI); Teach it back (live AI mark); Blurt (live AI mark); Quiz/Exam (live AI MC + fallback); Weekly plan | review/runs.jsx, lib/review-ai.js, study.js useStudy `u:<user>:study` |
| Review > Notes | class library, search, add (paste/PDF/photo/text, topic suggest), edit, remove+Undo, original download | notes.jsx, data.jsx addNote, lib/notes.js |
| Review > Reviewers | this week / subject builder / per-task / saved reader | Review.jsx, review-ai makeWeekly/makeSubjectReviewer/makeTaskReviewer, study.writeReviewer |
| Prepare | 4-step setup, weekly plan, Teach me this, web search | prepare/Prepare.jsx, lib/longterm.js |
| Class | seat map, presence, temp chat, groups | class/Class.jsx, Chat.jsx |
| Settings | Look Auto/Light/Dark, sound, subjects, Help replay intro, export, sign out, delete, About credit | Settings.jsx, prefs.js |
| Assistant | chat, task proposals (confirm first), catalogue + findIdeas | Assistant.jsx, assistant-actions.js, helpers.buildContext |
| Admin | suggestions, quarters, join codes, Minecraft off | admin/Admin.jsx |
| Data | kv shared+private, versioned writes, notes/note_ideas, cache | store.js, writes.js, notes.js, data.jsx |
| Credit | Nathaniel Visaya: intro last screen, Settings About, sign-in, console | intro/machine.js CREDIT |
| Name in code | "Homeroom" (title, Wordmark, splash, console). No APP_NAME constant. | index.html, main.jsx, auth Wordmark |

### 2.1 Where the AI reads notes/data (findings only; no code change)

1. `helpers.extractFromFile` — PDF/photo to Gemini, told to condense under 650 words. Called from notes.jsx `readFiles` **before** save. Text files sliced to 20,000 chars. Several files merge into one note; only a single file keeps its original, and only at Save.
2. `review-ai.suggestTopic` — first 1,500 chars of the (already extracted) text.
3. `study.aiIdeas` via `ensureInventory` — `chunkText` splits on **lines** at 3000 chars (can cut mid-sentence). One `callClaude` per chunk; one bad chunk throws and the **whole note** falls back to `localIdeas` (sentences, max 120). Saved once at the end by RPC `save_note_ideas` (replaces all, DB keeps ≤300). Driven by `data.addNote`, Study start, weekly/task/subject reviewers.
4. After inventory: `writeReviewer`, `makeWeekly`, `buildQuiz`, `askTricks`, `markTeach`, `markBlurt`; assistant `findIdeas` + 150-title catalogue + 20,000-char hits.
5. Track `parts.jsx` quick-add / plan-tonight; Prepare curriculum + lessons — not note-ingest, but they do call AI.

Silent truncation vs 2.5: `notes.add`/`data.addNote` slice 120,000 (DB check same); text files 20k; PDF/photo ~650 words + 4096 output tokens; ideas 300; localIdeas 120; suggestTopic 1,500.

Limits: proxy 20 calls/min/student, 4096 out tokens, 60s/120s, CSP `font-src 'self' data:`.

## (c) SPEC status

| Item | Status |
| --- | --- |
| A1–A4 | standing. A1 incomplete: skimmed CSS/Track parts/auth/store |
| 1.1–1.7 | todo. Intro exists but is a separate overlay, not an in-app spotlight tour |
| 2.1 | done this reply (findings above). 2.2–2.8 todo |
| 3.1–3.7 | todo. Tokens already exist (cream/coral/Garamond+Inter, --touch 44px, reduced-motion in base.css). Not dorm-framed; no unpack/pop-in/stick/glow/celebrate system |
| 4.1 | done this reply (how it works today, in the reply). 4.2–4.7 todo |
| D2 stages | todo: tokens → intro → note-reading → reviewer → polish |

## (d) Key decisions (none locked until "go")

- Source of truth this session: **workspace root**, not nested `homeroom/`.
- Scheduling proposal if 4.x is the Review tab: **keep Leitner** `study.cards[ideaId]={b,due,s,m}` and `log`; extend optional fields only (A3).
- No storage format change planned unless chunk resume cannot live in existing kv + notes.body.
- No new dependencies until you answer Q3/Q6.

## (e) Open questions (blocking)

See chat: Q0–Q7.

## (f) Files changed

- docs/SPEC.md (created)
- docs/PROGRESS.md (created)
- App code: none (D1)

## (g) Resume point

First reply done. Waiting for answers to Q0–Q7 and the word **go**. Then D2 stage 1 (design tokens), after appending any new instructions to SPEC as E1.
