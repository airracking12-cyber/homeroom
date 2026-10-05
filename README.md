# Homeroom

A shared homework list for a class, with a study assistant. React + Vite. Supabase (accounts and data) and Cloudflare Pages (hosting). All free.

## 1. Supabase (one time)
1. Create a project at supabase.com. Copy the Project URL and the publishable (anon) key from Project Settings, API.
2. Authentication, Sign In / Providers, Email: make sure **Enable email provider** is ON. **Confirm email** is optional: OFF means instant sign-up, ON means students must click a link in their inbox first.
   Then Authentication, URL Configuration: set **Site URL** to your app address (`http://localhost:5173` for testing, your Cloudflare address once deployed) and add it under Redirect URLs. Password-reset links need this.
3. SQL Editor: paste all of `supabase/schema.sql` and run it. (It starts fresh and wipes any old tables.)
4. Open the app, create your own account (email, username, password), then in the SQL Editor run:
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

## Welcome tour
New accounts get a hands-on tour the first time they sign in. It lights up the real buttons and waits for the student to use them: tick a practice task, open it, set its progress, add a task, switch views, open Review and Ask, and search. The practice task is never saved and nobody else sees it. Students can replay the tour any time from the account menu ("Take the tour again"), and Esc ends it.

The tour lives in the `Tour` component in `src/App.jsx`. To change a step, edit the `tourSteps` list just above it. To point a step at another control, add `data-tour="some-name"` to that control and use the same name as the step's `target`.

## How the interface moves
One set of rules, so nothing feels random:
- **Press:** anything you push squeezes in slightly, then springs back.
- **Hover:** only things that open something rise, and only a little.
- **Finishing a task is the big moment:** the check draws itself, the circle springs, the title strikes through, the card slides away, the weekly ring counts up and glows, and the undo toast shows a bar running down. On phones there is a short buzz.
- **A task you just added** drops into the list and glows once, so you can see where it landed.
- **Everything else stays quiet.** The greeting animates in once on load, tab changes are a plain fade, and the header gets a soft edge once you scroll.

The styles are in the `v3` block near the end of the `CSS` string in `src/App.jsx`.

## Keyboard
N = new task, / or Ctrl+K = search, Esc = close.

## Accounts
Students sign in with email and password. The username is only the name shown to the class. "Forgot your password?" on the sign-in screen emails a reset link. Supabase's built-in email sender is limited to a few emails per hour; for a whole class, add your own SMTP provider under Authentication, SMTP Settings.
