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

## 3. Put it online (Cloudflare Pages)
1. Push this folder to a GitHub repository.
2. Cloudflare dashboard, Workers & Pages, Create, Pages, connect the repository. Build command `npm run build`, output folder `dist`.
3. Settings, Variables and Secrets:
   - Secrets: `GEMINI_API_KEY`, `GROQ_API_KEY`
   - Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same values as above), and `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` if you made a new project
4. Redeploy.

`.dev.vars` for local testing:
    GEMINI_API_KEY=...
    GROQ_API_KEY=...
    SUPABASE_URL=...
    SUPABASE_ANON_KEY=...

Get the AI keys at aistudio.google.com and console.groq.com/keys. Never put them in `src/`.

## Keyboard
N = new task, / or Ctrl+K = search, Esc = close.

## Accounts
Students sign in with email and password. The username is only the name shown to the class. "Forgot your password?" on the sign-in screen emails a reset link. Supabase's built-in email sender is limited to a few emails per hour; for a whole class, add your own SMTP provider under Authentication, SMTP Settings.
