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
   **Then run `supabase/upgrade-v30.sql`** (see `UPGRADE-v30.md`) for the notes library (Review > Notes): kept original files, student-made reviewers, better search ranking.
4. Open the app and create your own account (just email and password). On your first sign-in you set up your profile (your name and your class), then a short introduction walks you through Track, Review and Prepare. Then in the SQL Editor run:
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
   Optional: add a plain variable `AI_SEARCH` with the value `off` to stop the assistant from searching the web (see `UPGRADE-v33.md`, section 5). Leave it out to keep search on.
5. In Supabase, Authentication, URL Configuration: set Site URL to your live address.

To try the study assistant locally, make `.dev.vars` with `GEMINI_API_KEY=...` and `GROQ_API_KEY=...`, then:
    npm run build
    npx wrangler dev

Get the AI keys at aistudio.google.com and console.groq.com/keys. Never put them in `src/`.

**Rate limit.** `wrangler.jsonc` gives each signed-in student 20 study-assistant calls per minute (the `AI_LIMITER` binding). It is per student, not per IP, and approximate, so it protects the class's free quota from a runaway loop rather than from a determined attacker. To change it, edit `limit` (period can only be 10 or 60). If the binding is missing, the proxy simply doesn't limit. Run the tests with `npm test`.

## What's in it

**Sign-up and your profile.** Creating an account asks only for an email and a password. The first time someone signs in they pick a username and their class (or add the class if it isn't listed), and then a short introduction starts. Anyone whose profile has no username yet (for example someone who closed the tab halfway) gets the profile screen again next time, and anyone who left the introduction half-way is sent back into it. It can be replayed from Settings > Help.

**Your class (Class > Classmates).** Everyone in the class is a seat on a 2+2 or 3+3 map. A green dot means online. The dot on each seat shows this week's progress: Complete, Almost there (60%+), Starting, or Nothing. Tap someone who is online for a temporary chat that is never stored. The chips above the map pick a subject and grey out everyone who isn't in a group with you for it. Join a group under Class > Groups; your groupmates then show their subject colour.

**Done.** In Track, switch To do / Done. Everything you've finished, by subject, for the class's current quarter or all quarters.

**Quarters.** Admin > Classes sets which quarter each class is in. New tasks start in that quarter, and the Done tab and the Minecraft rule use it.

**Subjects with colours.** Add a subject anywhere you pick one (task form, groups) and choose its colour. It's saved for the whole class, so nothing in the code needs editing. Settings > Your class > Subjects and colours lists them all and lets anyone recolour one.

**Prepare (was Long term, v33)** plans a whole next grade, or a new school's entrance exam, week by week. It asks four things (what for, your grade now, the school you type in, and how long you have), then gives a session for each week that adjusts to what you finish. Each item can teach itself: "Teach me this" writes a short lesson with practice questions. See `UPGRADE-v33.md`.

**Review (v30)** has three parts: *Study*, *Notes* and *Reviewers*. *Study*: one card says what to do next, one bar sets what you're reviewing (period, subjects, topics, or a word that searches every note), and nine technique tiles each say what they're best for: Flashcards (spaced repetition), Fill the blanks, Match pairs, Memory tricks, Teach it back, Blurting, Practice quiz, Mixed exam, and a Weekly plan. *Notes* is the class library (it was the Data tab). *Reviewers*: this week's reviewer, a builder that writes a reviewer from the class's notes for a subject and topics, and every saved reviewer, laid out like a study sheet. **Data (v30)** is a tab of its own: everyone's notes and reviewers by subject and topic. Add a PDF, photo, text file or pasted notes (or a reviewer you made), tag the subject and topic, and the assistant reads from there when anyone reviews. A single uploaded file keeps its original for classmates to download.

How notes are stored (v28): each note is one row in `public.notes` (subject, topic, title, text, who added it, which task it came from), and each idea in a note is one row in `public.note_ideas`. At start-up the app loads only a short summary of every note (no text); a note's text is fetched when someone opens it, and ideas are fetched when someone studies. Only the person who added a note (or an admin) can edit or remove it. Anyone can add notes from Review > Notes (Add notes) or from a task's page, choosing a subject and a topic (the assistant suggests one).

How the reviewers avoid missing things: each note is first turned into an inventory of every idea in it (a term plus a one-line fact), saved once for the whole class, right when the note is added. Flashcards, blanks and matching come straight from that inventory, so every idea gets used. The quiz writes a question for every idea in a batch and asks again for any the assistant skipped. If the assistant is busy, a plain sentence-by-sentence inventory and plain questions keep every technique working. Your flashcard boxes, session log and weekly plan are private to you (`u:<you>:study`).

How the right lesson is found: Postgres full-text search runs over notes and ideas (`find_ideas` and `search_notes` in `upgrade-v28.sql`). In Review > Notes you can open a subject or topic, or search a word, then press Study or Write a reviewer. In Study you can pick topics or type a word, and only the matching ideas are used. The assistant (the Ask button in the top bar) gets a short catalogue of note titles plus only the ideas that match the question. The search matches words (and the start of words), not meanings; a question like "plants making food" will not find a note that says "photosynthesis".

**Minecraft.** Built but switched off. See `minecraft/README.md`.

## Keyboard shortcuts

Press `?` anywhere in the app to see this list.

| Keys | What it does |
| --- | --- |
| `Ctrl` / `Cmd` + `K`, or `/` | Search |
| `n` | Add a task |
| `g` then `t`, `r`, `p`, `c` or `s` | Go to Track, Review, Prepare, Class or Settings |
| `g` then `d` or `a` | Show what you have finished, or open the assistant |
| `j` / `k` | Move to the next or previous task in the list |
| `Enter` or `Space` | Open the focused task |
| `x` | Mark the focused task done |
| `Esc` | Close the open sheet |

Plain-key shortcuts pause while a sheet is open. Sheets are native dialogs, so they keep keyboard focus inside themselves and give it back to the button that opened them. A "Skip to content" link appears for keyboard users on first Tab.

## Behaviour worth knowing

- **Draft task:** a half-written new task is kept in this browser and restored next time the form opens (with a "Start fresh" option). It is cleared on save and on sign-out, and it is never sent to Supabase.
- **Errors:** a crash inside one screen shows a small "Try again" card for that screen only. A crash anywhere else shows a full-screen fallback with "Try again" and "Reload" buttons (`src/ErrorBoundary.jsx`).
- **Saving:** study progress is saved a moment after the last answer, and immediately if the page is hidden or closed. If a save fails, a banner says the last change may not have saved.
- **Photos:** the app no longer asks for, stores or shows photos of homework (v33). Old photos stay untouched in the private `task-proofs` bucket in Supabase; delete the bucket there if you want the space. Notes you upload in Review > Notes are separate.
- **Your data:** Settings has "Download a copy of my data" (a JSON file of your tasks, statuses and notes).
- **Connection:** going offline or coming back online shows a short toast.
- **Page title:** follows the active destination, with the focus-timer countdown in front while it runs.
- **Accessibility:** respects reduced-motion and increased-contrast settings, and has a Windows high-contrast focus ring.
- **Sounds** are files in `public/sounds/v2/`, made by the scripts in `tools/` (you only need those to change a sound; see `tools/README.md`). `src/lib/sound.js` plays them and falls back to synthesized sounds if one fails to load.
- **Code layout:** the look is in `src/styles/` (all values in `tokens.css`, described in `DESIGN.md`); screens are in `src/app/` (one folder per destination); the rules and logic are in `src/lib/` and are covered by `npm test`. Adding a colour or a size? `tests/contrast.test.mjs` and `tests/design.test.mjs` will tell you if it fails WCAG AA or drifts off the system. `docs/REBUILD-v34.md` has the audit, the feature inventory and the navigation map.

## The introduction
Five screens: what Homeroom is, then three small things to actually do (add a real task, turn pasted notes into flashcards, start a plan), then closing credits. Calm pacing, nothing bounces, every screen has a **Skip intro** button, and it remembers where you were if you close the tab. Replay it from Settings > Help. Its steps and the credit text are plain data in `src/app/intro/machine.js`, tested in `tests/intro.test.mjs`.

**When you add a feature,** give it one clear home in the navigation (`src/app/nav.js`) and add a line to `FEATURE_HOME` there; `tests/nav.test.mjs` checks the list.

## Credits
Homeroom was designed, built and maintained, start to finish, by Nathaniel Visaya ("Nathan") for his class. His name is on the last screen of the introduction, in Settings > About, on the sign-in screen, in the page's metadata and in the browser console.
