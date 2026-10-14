# Homeroom v30: the Data tab and a calmer app

## What to do

1. In Supabase, open **SQL Editor** and run `supabase/upgrade-v30.sql` once (after v28 and v29). Running it twice is safe and no data is lost.
2. Deploy the app as usual.

If you open the v30 app *before* running the SQL, nothing breaks. Notes still save and open. They just don't keep their original file, and a reviewer a student made is saved as an ordinary upload.

## What's new

**Data tab** (new). Everyone's notes and reviewers, by subject, then topic. Add a PDF, photo, text file or pasted notes (or "a reviewer I made"), choose the subject and topic (the assistant can suggest the topic), and it's stored for the whole class. A single uploaded file keeps its original, and classmates can download it from the note. Drag a file onto the page to add it. Search finds a note by its text. Notes with no topic are flagged, because those are the hardest for the assistant to place. Only the person who added a note can edit or remove it.

**Review tab** (rebuilt, two parts).
- *Study*: one card says what to do next (a quiz coming up, flashcards due, or nothing urgent). One bar, "Reviewing", opens a sheet for period, subjects, topics, or a word that searches every note. Nine technique tiles show what each is best for, and the Start bar stays in reach. The techniques themselves (flashcards, blanks, matching, quiz and so on) are unchanged.
- *Reviewers*: this week's reviewer, **Write a reviewer** (pick a subject and topics, optionally a focus word; the database finds those lessons and the assistant writes one page covering every key idea), and all saved reviewers. Reviewers are laid out like a study sheet: headings, bold terms with their meaning, a "Check yourself" section.
- The old *By task* section is gone: tap an upcoming task under **Coming up** to open its page. The old *Library* is now the Data tab.

**Onboarding stamp** (redone). One large **Check in** button. It's never dead: if something's missing it points at the field and says what to do. The stamp comes down by itself, so there's nothing small to aim at. The tear is a button or a more forgiving swipe.

**Tasks, Done, Ask.** Same theme, calmer: a tighter greeting, a quieter list (about three tasks fit where two did), suggestions as one list in Ask. The top bar no longer wraps its labels on desktop.

**Tour.** New step introducing Data; the Study step now points at the Reviewing bar. Shortcut: `g` then `l` goes to Data.

## Database changes (`upgrade-v30.sql`, also in `schema.sql`)

| Change | Why |
|---|---|
| `notes.kind` also allows `reviewer` | students can share a reviewer they made |
| `notes.file_path / file_name / file_type / file_size` | a note links to its original file |
| private storage bucket `class-notes` (10 MB per file), files at `<class>/<note>/<name>` | originals are visible only to that class |
| the `search` column ranks topic and title above body text | the assistant finds the right lesson first |
| trigger `notes_daily_cap`: 60 notes per student per day (the assistant's own reviewers don't count) | a mistake or a loop can't flood the library |

If someone removes a note, its original file is kept for 15 seconds so Undo works, then deleted. If the tab is closed in that window the file is left in storage (harmless; any classmate may clear it).

## How this was checked, and what wasn't

Checked: the whole `schema.sql` (v28, v29, v30) ran on a real Postgres engine (PGlite) and `upgrade-v30.sql` ran on top of it twice. 15 behaviour checks pass: kinds, the file guard, one class can't see another's notes or files, search ranking, the daily cap, and the storage rules. Run them yourself with `npm i --no-save @electric-sql/pglite && npm run verify:sql`. `npm test` passes (90 tests). The screens were driven in a headless browser against the fake-database preview (`npx vite --config vite.preview.config.js`, then `/?scn=returning`): adding notes, uploading a file, opening a note, the reviewer reader, the Study sheet, the onboarding flow, and the tour as far as the new Data step, on phone and desktop widths and in dark mode.

**Not checked** (please try these on your real project):
- Real Supabase Storage: the policies passed on the stand-in, but a real upload and download should be tried once.
- Real AI output: the reviewer text layout is built to read the assistant's format, and anything unexpected falls back to plain paragraphs, but look at a real reviewer and a real weekly reviewer.
- `npm run build`. In the environment used to write v30, `vite build` produced a bundle without the app (v29 does the same there), so only the dev server could be used. It should build normally on your machine; please confirm before deploying.
- The last two tour steps (Ask and the finish) after the new Data step.

## Files

New: `src/lib/reviewerDoc.js`, `src/lib/library.js`, `src/design/v30.css.js`, `supabase/upgrade-v30.sql`, `supabase/verify/`, `tests/v30.test.mjs`.
Changed: `src/App.jsx` (Review and Data rebuilt, tour, tabs), `src/lib/notes.js` (original files), `src/onboarding/*` (stamp), `preview/mockSupabase.js` (notes in the preview), docs.
To see v29's look again, remove `V30_CSS` from `STYLES` in `App.jsx`.
