# Homeroom

A shared homework list for a class, with a study assistant. React + Vite. Supabase (accounts and data) and Cloudflare Pages (hosting). All free.

## 1. Supabase (one time)
1. Create a project at supabase.com. Copy the Project URL and the publishable (anon) key from Project Settings, API.
2. Authentication, Sign In / Providers, Email: make sure **Enable email provider** is ON. **Confirm email** is optional: OFF means instant sign-up, ON means students must click a link in their inbox first.
   Then Authentication, URL Configuration: set **Site URL** to your app address (`http://localhost:5173` for testing, your Cloudflare address once deployed) and add it under Redirect URLs. Password-reset links need this.
3. SQL Editor, brand-new project: paste all of `supabase/schema.sql` and run it. (It starts fresh and wipes any old tables.)
   **Already running v7 with real accounts? Don't run schema.sql.** Run `supabase/upgrade-v8.sql` instead. It keeps every account, class and task.
   **Already running v27 or earlier? Run `supabase/upgrade-v28.sql` once** (see `UPGRADE-v28.md`). It closes a class-switching hole and moves notes into their own tables.
   **Then run `supabase/upgrade-v29.sql`** (see `UPGRADE-v29.md`) if you want optional join codes for classes.
   **Then run `supabase/upgrade-v30.sql`** (see `UPGRADE-v30.md`) for the Data tab: kept original files, student-made reviewers, better search ranking.
4. Open the app and create your own account (just email and password). On your first sign-in you fill out your boarding pass, which is where you pick your username and class. Then in the SQL Editor run:
       update public.profiles set is_admin = true where username = 'yourname';
   Sign out and back in. You now see the admin screen.

## 2. Run it on your computer
    npm install
    npm run dev

Put your Supabase project's URL and key in a `.env.local` file in this folder (required; the app won't start without it):
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-publishable-key

The study assistant needs the server part. To try it locally, make `.dev.vars` (see below), then:
    npm run build
    npx wrangler pages dev dist

## 3. Put it online (Cloudflare Workers)
1. Push this folder to a GitHub repository.
2. Cloudflare dashboard, Workers & Pages, Create, import the repository. Project name `homeroom` (must match `wrangler.jsonc`). Build command `npm run build`, deploy command `npx wrangler deploy`.
3. Build variables (needed while building): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. After the first deploy, open the Worker, Settings, Variables and Secrets, and add Secrets: `GEMINI_API_KEY`, `GROQ_API_KEY`. (`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already set in `wrangler.jsonc`; they are public values.)
5. In Supabase, Authentication, URL Configuration: set Site URL to your live address.

To try the study assistant locally, make `.dev.vars` with `GEMINI_API_KEY=...` and `GROQ_API_KEY=...`, then:
    npm run build
    npx wrangler dev

Get the AI keys at aistudio.google.com and console.groq.com/keys. Never put them in `src/`.

**Rate limit.** `wrangler.jsonc` gives each signed-in student 20 study-assistant calls per minute (the `AI_LIMITER` binding). It is per student, not per IP, and approximate, so it protects the class's free quota from a runaway loop rather than from a determined attacker. To change it, edit `limit` (period can only be 10 or 60). If the binding is missing, the proxy simply doesn't limit. Run the tests with `npm test`.

## What's in v8 and v9

**Sign-up and the boarding pass.** Creating an account asks only for an email and a password. The first time someone signs in they fill out a boarding pass (username and class), it gets stamped, they tear off the stub, a plane crosses the screen, and they're in. Anyone whose profile has no username yet (for example someone who closed the tab halfway) gets the pass again next time. The stamp is a detailed wooden hand stamp with real-looking ink (see `UPGRADE-v31.md`). The pass can be replayed from the account menu.

**Your class as a plane.** The left side (or the plane button in the header on smaller screens) shows everyone in the class as a seat on a 2+2 or 3+3 plane. A green dot means online. The bar under a seat shows this week's progress: Complete, Almost there (60%+), Starting, or Nothing. Tap someone who is online for a temporary chat that is never stored. The filter at the top picks a subject and grays out everyone who isn't in a group with you for it. Join a group under Tasks > Groups; your groupmates then light up in the subject's colour. This uses Supabase Realtime private channels, and the policies for them are in the SQL files. Nothing to switch on.

**Done tab.** Everything you've finished, by subject, for the class's current quarter or all quarters.

**Quarters.** Admin > Classes sets which quarter each class is in. New tasks start in that quarter, and the Done tab and the Minecraft rule use it.

**Subjects with colours.** Add a subject anywhere you pick one (task form, groups) and choose its colour. It's saved for the whole class, so nothing in the code needs editing. Account menu > Subjects and colours lists them all and lets anyone recolour one.

**Review (v30)** has two parts. *Study*: one card says what to do next, one bar sets what you're reviewing (period, subjects, topics, or a word that searches every note), and nine technique tiles each say what they're best for: Flashcards (spaced repetition), Fill the blanks, Match pairs, Memory tricks, Teach it back, Blurting, Practice quiz, Mixed exam, and a Weekly plan. *Reviewers*: this week's reviewer, a builder that writes a reviewer from the class's notes for a subject and topics, and every saved reviewer, laid out like a study sheet. **Data (v30)** is a tab of its own: everyone's notes and reviewers by subject and topic. Add a PDF, photo, text file or pasted notes (or a reviewer you made), tag the subject and topic, and the assistant reads from there when anyone reviews. A single uploaded file keeps its original for classmates to download.

How notes are stored (v28): each note is one row in `public.notes` (subject, topic, title, text, who added it, which task it came from), and each idea in a note is one row in `public.note_ideas`. At start-up the app loads only a short summary of every note (no text); a note's text is fetched when someone opens it, and ideas are fetched when someone studies. Only the person who added a note (or an admin) can edit or remove it. Anyone can add notes from Review > Library (Add notes) or from a task's page, choosing a subject and a topic (the assistant suggests one).

How the reviewers avoid missing things: each note is first turned into an inventory of every idea in it (a term plus a one-line fact), saved once for the whole class, right when the note is added. Flashcards, blanks and matching come straight from that inventory, so every idea gets used. The quiz writes a question for every idea in a batch and asks again for any the assistant skipped. If the assistant is busy, a plain sentence-by-sentence inventory and plain questions keep every technique working. Your flashcard boxes, session log and weekly plan are private to you (`u:<you>:study`).

How the right lesson is found: Postgres full-text search runs over notes and ideas (`find_ideas` and `search_notes` in `upgrade-v28.sql`). In the Data tab you can open a subject or topic, or search a word, then press Study or Write a reviewer. In Study you can pick topics or type a word, and only the matching ideas are used. The Ask assistant gets a short catalogue of note titles plus only the ideas that match the question. The search matches words (and the start of words), not meanings; a question like "plants making food" will not find a note that says "photosynthesis".

**Minecraft.** Built but switched off. See `minecraft/README.md`.

## Keyboard shortcuts

Press `?` anywhere in the app to see this list.

| Keys | What it does |
| --- | --- |
| `Ctrl` / `Cmd` + `K`, or `/` | Search |
| `n` | Add a task |
| `g` then `t`, `d`, `r` or `a` | Go to Tasks, Done, Review or Ask |
| `j` / `k` | Move to the next or previous task in the list |
| `Enter` or `Space` | Open the focused task |
| `x` | Mark the focused task done |
| `Esc` | Close the open sheet, or end the tour |

Plain-key shortcuts pause while a sheet is open and while the tour is running. Sheets keep keyboard focus inside themselves and give it back to the button that opened them. A "Skip to content" link appears for keyboard users on first Tab.

## Behaviour worth knowing

- **Draft task:** a half-written new task is kept in this browser and restored next time the form opens (with a "Start fresh" option). It is cleared on save and on sign-out, and it is never sent to Supabase.
- **Errors:** a crash inside one tab shows a small "Try again" card for that tab only. A crash anywhere else shows a full-screen fallback with "Try again" and "Reload" buttons (`src/ErrorBoundary.jsx`).
- **Saving:** study progress is saved a moment after the last answer, and immediately if the page is hidden or closed. If a save fails, a banner says the last change may not have saved.
- **Photos:** an upload is checked by its first bytes, not by its file name, so a renamed non-image is refused.
- **Your data:** the account menu has "Download a copy of my data" (a JSON file of your tasks, statuses and notes).
- **Connection:** going offline or coming back online shows a short toast.
- **Page title:** follows the active tab, with the focus-timer countdown in front while it runs.
- **Accessibility:** respects reduced-motion and increased-contrast settings, and has a Windows high-contrast focus ring.
- **Sounds and stamp pictures** are files in `public/sounds/v2/` and `public/stamp/v2/`, made by the scripts in `tools/` (you only need those to change a sound or the stamp; see `tools/README.md`). `src/lib/sound.js` plays them and falls back to synthesized sounds if one fails to load.
- **Code layout:** shared logic lives in `src/lib/` (dates, constants, store, AI client, debounced saver) and is covered by `npm test`. Adding a colour or font size? `tests/contrast.test.mjs` and `tests/typography.test.mjs` will tell you if it drifts off the scale or fails WCAG AA.

## Welcome tour (the unboxing)
After the boarding pass and the plane, the app lands as an empty box and the tour unpacks it one piece at a time. Each step brings out one new piece of the real interface with a pop and a puff of paper scraps (with the lights up, so you see it arrive), and only then does the spotlight and the card come in. The pieces go top to bottom, so nothing already unpacked ever moves: your day and the week's ring, the three helpers, the views, the first task, the side panel, New task, then the Done, Review and Ask tabs, the class plane, search, and your account. Steps that ask you to do something (tick the practice task, open it, switch to the calendar, open a tab) wait for you, show a "Nice", pause a couple of seconds, and move on, or you can press Next. The practice task is never saved. The last step opens everything at once and carries a credit to Nathaniel Visaya ("Nathan"), who made the app on his own. Esc or the X ends the tour and unpacks everything instantly. "Play introduction" in the account menu replays the boarding pass, the plane and the tour. With reduced motion switched on, pieces simply appear.

**When you add a feature, add it to the tour.** Give the piece a `data-rv="name"` attribute, add `"name"` to `UNBOX_TOKENS` in `src/App.jsx`, and list it in the `show` of the step that introduces it (`tourSteps`). `tests/unbox.test.mjs` fails if a piece is listed but never wired up. Pieces below one another must be listed top to bottom, or a blank gap will show where the later one is still wrapped.

## Credits
Homeroom was designed, written and built, start to finish, by Nathaniel Visaya ("Nathan") for his class. You'll find his name in the tour (the first card and the last), at the bottom of the account menu, in the page's metadata, and in the browser console.
