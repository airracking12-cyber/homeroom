# Upgrading to v28

You already have Homeroom running. Do these in order. Nothing is deleted, and you can stop after step 2 and use the old version.

## 1. Back up (2 minutes)
Supabase > Table Editor > `kv` > the "..." menu > Export to CSV (and `profiles` if you like). Keep the file.

## 2. Run the database upgrade
Supabase > SQL Editor > New query. Paste all of `supabase/upgrade-v28.sql` and press Run.
It is safe to run twice. It does three things:

- **Closes a security hole.** Before, any signed-in student could change their own class to any text through the API. For example, setting it to `u` gave them everyone's private progress, and setting it to another class's id gave them that class's tasks and notes. Now a class must exist, and the only way to change class is `choose_class()` (the app uses it).
- **Gives notes real tables.** `public.notes` (one row per note) and `public.note_ideas` (one row per idea), searchable, and only the person who added a note (or an admin) can edit or remove it.
- **Copies your existing notes and idea inventories into those tables.** The old rows (`<class>:materials` and `<class>:kb` in `kv`) are left alone.

Afterwards run this to check the numbers look right:

    select (select count(*) from public.notes) as notes,
           (select count(*) from public.note_ideas) as ideas;

## 3. Replace the files and deploy
Copy this folder over your old one (replace everything), then deploy as usual:

    npm install
    npm run build
    npx wrangler deploy

(or push to GitHub if Cloudflare builds from there). The database upgrade must be done before students open the new version.

## 4. Check it
- Review > Library: your old notes are there, with their subjects. Open one: the text loads when you open it.
- Add notes: pick a subject, type or accept a topic, upload a PDF or photo. It says "Reading your notes" for a few seconds, then it is ready.
- Library: pick a subject, then a topic, then **Study these** or **Make a reviewer**.
- Study: tap a topic, or type a word in "Or find a lesson by a word".
- Ask: a question about a lesson now brings in only the matching ideas.

Old notes have no topic yet. Their owners can open a note and tap **Edit subject and topic** (notes from before v28 whose owner couldn't be matched can be tidied by anyone in the class).

## 5. Later, once you are sure
The very bottom of `upgrade-v28.sql` has a commented-out `delete` that removes the old `materials` and `kb` rows. Run it only after a few days of everything working, and only if you took the backup.

## Also changed in v28 (no action needed)
- The assistant gives up on a request after 60 seconds (2 minutes for PDFs and photos) and uses the backup provider; before, a stuck request could spin forever.
- Ticking tasks now saves only that task's status, merged into what is stored, so a phone and a laptop no longer overwrite each other. Progress made on another device shows up on refresh.
- Start-up makes 3 requests at once instead of 11 one after another. If one fails, that part keeps showing what it had instead of going blank.
- Uploads are limited to 10 MB (the server accepts 16 MB requests; it was 30).
- `public/_headers` adds HSTS, Permissions-Policy and a **Content-Security-Policy in report-only mode**: it blocks nothing yet. Open the site, press F12, and check the Console for "Content Security Policy" messages while you use every screen. If there are none, rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `public/_headers` to turn it on.
- PNG install icons, an iOS icon, and matching theme colours.

## Not done, and why
- **Fonts are still loaded from Google Fonts**, and **`App.jsx` is still one big file** (code-splitting). I couldn't download fonts or run a build in the place I made this, and a split I can't test could break the app. Both are safe to do later on your own computer.
- **Classes are still open to join** unless you also run `upgrade-v29.sql` (optional join codes; see `UPGRADE-v29.md`).
- **Flashcard progress (`u:<you>:study`) is still saved as one block**, so using two devices at the same moment can overwrite recent flashcard answers.
- **I could not run the SQL or open the site where I made this.** Everything was checked by reading it, by 82 automated tests, and by rendering the new screens against a fake database. Please read step 4 as a real test.
