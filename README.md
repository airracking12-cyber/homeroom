# Homeroom

A shared homework list for a class, with a study assistant. React + Vite. Supabase (accounts and data) and Cloudflare Pages (hosting). All free.

## 1. Supabase (one time)
1. Create a project at supabase.com. Copy the Project URL and the publishable (anon) key from Project Settings, API.
2. Authentication, Sign In / Providers, Email: make sure **Enable email provider** is ON. **Confirm email** is optional: OFF means instant sign-up, ON means students must click a link in their inbox first.
   Then Authentication, URL Configuration: set **Site URL** to your app address (`http://localhost:5173` for testing, your Cloudflare address once deployed) and add it under Redirect URLs. Password-reset links need this.
3. SQL Editor, brand-new project: paste all of `supabase/schema.sql` and run it. (It starts fresh and wipes any old tables.)
   **Already running v7 with real accounts? Don't run schema.sql.** Run `supabase/upgrade-v8.sql` instead. It keeps every account, class and task.
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

## What's in v8 and v9

**Sign-up and the boarding pass.** Creating an account asks only for an email and a password. The first time someone signs in they fill out a boarding pass (username and class), it gets stamped, they tear off the stub, a plane crosses the screen, and they're in. Anyone whose profile has no username yet (for example someone who closed the tab halfway) gets the pass again next time. The pass can be replayed from the account menu.

**Your class as a plane.** The left side (or the plane button in the header on smaller screens) shows everyone in the class as a seat on a 2+2 or 3+3 plane. A green dot means online. The bar under a seat shows this week's progress: Complete, Almost there (60%+), Starting, or Nothing. Tap someone who is online for a temporary chat that is never stored. The filter at the top picks a subject and grays out everyone who isn't in a group with you for it. Join a group under Tasks > Groups; your groupmates then light up in the subject's colour. This uses Supabase Realtime private channels, and the policies for them are in the SQL files. Nothing to switch on.

**Done tab.** Everything you've finished, by subject, for the class's current quarter or all quarters.

**Quarters.** Admin > Classes sets which quarter each class is in. New tasks start in that quarter, and the Done tab and the Minecraft rule use it.

**Subjects with colours.** Add a subject anywhere you pick one (task form, groups) and choose its colour. It's saved for the whole class, so nothing in the code needs editing. Account menu > Subjects and colours lists them all and lets anyone recolour one.

**Review is now a study hub.** Step 1: choose Today, This week or Final, and which subjects (or every subject). Step 2: choose a technique, each with a note on what it's best for: Flashcards (spaced repetition), Fill the blanks, Match pairs, Memory tricks, Teach it back, Blurting, Practice quiz, Mixed exam, and a Weekly plan that spreads review over the week. The By task, Weekly and Library views are still there. Their old separate quiz and flashcard screens are gone: "Study this" on a task (or "Study this week" on the weekly page) opens the same hub, limited to those notes, so there is one place to study and one set of rules. The weekly page, the per-task reviewer and the Ask assistant now all read the full ideas list instead of trimmed notes, and a reviewer that leaves an idea out gets an "Also remember" section added automatically. Shortcuts: in flashcards Space flips and 1 / 2 / 3 rate; in quizzes 1 to 4 pick an answer. The hub remembers the period and subjects you last picked, and marks the techniques that fit that period best. The Library shows how many key ideas each note holds and has a "Study all of <subject>" button.

How the reviewers avoid missing things: each note is first turned into an inventory of every idea in it (a term plus a one-line fact), saved once for the whole class under `<class>:kb` and re-made only if the note changes. Flashcards, blanks and matching come straight from that inventory, so every idea gets used. The quiz writes a question for every idea in a batch and asks again for any the assistant skipped; "Everything" quizzes cover every idea. If the assistant is busy, a plain sentence-by-sentence inventory and plain questions keep every technique working. Your flashcard boxes, session log and weekly plan are private to you (`u:<you>:study`).

**Minecraft.** Built but switched off. See `minecraft/README.md`.

## Welcome tour
New accounts get a hands-on tour right after the plane lands (it is offered, not forced). It lights up the real buttons and waits for the student to use them: tick a practice task, open it, set its progress, add a task, switch views, open Done, Review and Study, look at the class plane, and search. The practice task is never saved. Replay it any time from the account menu, and Esc ends it. **When you add a feature, add a step to `tourSteps` in `src/App.jsx` so new students see it.**
