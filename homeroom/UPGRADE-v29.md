# Upgrading to v29: optional class join codes

v29 includes everything from v28. If you have not done v28 yet, follow `UPGRADE-v28.md` first (run `upgrade-v28.sql`), then do this.

## What it does
Until now anyone who signed up could pick any class and read its tasks and notes. Now an admin can put a **code** on a class. New students must type it to join that class. A class with no code stays open, exactly as before, so nothing changes for anyone until you set a code. People already in a class are never kicked out or asked for the code.

## Steps
1. Supabase > SQL Editor: paste all of `supabase/upgrade-v29.sql` and Run (safe to run twice). Run it **after** `upgrade-v28.sql`.
2. Extract the v29 zip over your folder and deploy (`npm install`, `npm run build`, `npx wrangler deploy`). Deploy and run the SQL close together: the new app needs the SQL, and the old app keeps working with it.
3. Sign in as an admin: **Classes**. Each class now has a code box. Type a code (4 to 30 letters or numbers) or press **Make one**, then **Set code**. Tell your class the code. **Open the class** removes it.

## What students see
On the sign-up boarding pass (and the "Pick your class" screen), a class with a code shows a small lock, and a **Class code** box appears when they pick it. A wrong code says "That class code isn't right." Codes ignore capital letters.

## Good to know
- Codes are stored in their own table that nobody can read from the app. Only admins can see or change them.
- A code stops new people joining. It does not remove people already in the class, so if someone who shouldn't be there already joined, you would remove them yourself.
- Anyone can still add a brand-new class from the picker (that is how classes are created). New classes start open.
- I could not run the SQL or open the site where I made this, so please try it once: set a code on a test class, then sign up a test account and check that the wrong code is refused and the right one lets you in.
