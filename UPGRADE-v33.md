# v33: Long term review, no homework photos, and two safety fixes

Two changes. No SQL to run, no new settings, no new packages.

## 1. Long term tab (new)

A plan for the whole next grade, or for a new school's entrance exam, spread over the weeks you have.

**Setup asks four things, one at a time:**
1. Next grade level, or a school's entrance exam?
2. Which grade are you in now? (Pre-filled from your class, like "8-16" or "Grade 10 Atlas".)
3. Which school? Typed, never picked from a list. For the grade plan it is the school you're from (its curriculum); for the exam it is the school you're applying to. The grade plan also has "I don't know, use the national curriculum".
4. How long until you need all of it? A chip (1 to 9 months) or an exact date.

**What you get:** a dark "This week's session" block you can tick off, a "Weeks ahead" list, and a strip with one tick per week.

**How the plan is made (`src/lib/longterm.js`, all plain functions, 26 tests with the style and wiring checks):**
- The assistant is asked only for a *map*: subjects and topics for that grade or exam, in teaching order, each with a weight (1 to 3) and a flag for "skill from your current grade that the next one builds on". It also says how sure it is. The weeks are worked out by the app, so a plan keeps working and re-planning without the assistant.
- Shakiest subjects go first and subjects take turns, so a week mixes subjects. A second look at each topic comes a few topics after the first. Mixed practice (timed for an exam, a check-up for a grade) is last.
- Each week gets an even share of what is left. Skip a week and the rest spreads over the weeks that remain. This week's session is pinned the first time you open it, so ticking one thing never moves the others.
- "Make it fit you": how ready you feel in each subject (Shaky, Okay, Strong), a weekly time limit (it says exactly how much you'd cover, like "50% by Jan 12"), and the date. "What this covers" lets you remove or add subjects and topics. Up to 5 plans.
- Where the class already has notes on a topic (same subject, similar topic name), a "Study with your class's notes" link opens the existing Review > Study.
- The assistant can be wrong about a specific school. The plan says how sure it was, shows "Check this list" when it wasn't sure, and the topic list is always editable.

**Where it is stored:** `u:<username>:longterm` in the existing `kv` table. The database already keeps every `u:<username>:*` key private to that student and deletes them with the account. A failed read is treated as an error, never as "no plans", so a bad connection can't overwrite saved plans.

**Files:** `src/lib/longterm.js` (planner), `src/longterm/LongTermTab.jsx` (screens), `src/design/longterm.css.js` (styles), `tests/longterm.test.mjs`. Wired in `src/App.jsx`: nav tab, page, shortcut `g` then `p`, a tour step, and `t-longterm` / `p-longterm` in `UNBOX_TOKENS`.

**Screens:** checked from a 320px phone to a 1440px desktop (phones, large phones, small tablet, iPad portrait and landscape). On phones under 360px the grade picker uses five columns and the tab labels step down to 11px so "Long term" stays on one line.

### Teach me this (added to the Long term tab)

Each Refresh, Learn and Recall item has a "Teach me this" link. It opens a short lesson inside the item: a few sentences with an example, key points, and three practice questions whose answers stay hidden until you tap them. It exists because the plan's "Learn" items are next year's topics, which the student hasn't been taught and the class has no notes on.

- One lesson per topic, saved in the plan (`plan.lessons`), so reopening is instant and costs no assistant call. Only the newest 24 are kept, so the saved plan stays small. Removing a topic or subject removes its lesson.
- Subjects named Filipino or Araling Panlipunan get the lesson in Filipino; everything else in English. The panel says it was written by the assistant and to check it against notes or a textbook.
- "How did it go?" (Not yet, Mostly, Got it) changes how long that topic's later second look gets (about 30% longer, or 20% shorter). It never moves this week's pinned session.
- A failed lesson shows what happened and a Try again link, and the rest of the session is untouched.
- Code: `lessonPrompt`, `parseLesson`, `saveLesson`, `setTopicRate` in `src/lib/longterm.js` (5 more tests); the panel is `LessonBody` in `LongTermTab.jsx`.

## 2. Homework photos are gone

Marking a task done used to open "Show your work" and ask for a photo of the homework (on by default). That whole feature is now removed.
- Marking done goes straight through. The "Ask for a photo" switch, the "Photo sent / Verified" badges, the photo section in the task sheet and the upload sheet are all gone.
- Removed from the code: the upload and image-shrinking helpers, `src/sniffImage.js` (and its test), the `proofs` data in the app and in the on-device cache, and the unused photo styles. (`reviewProof` was already unused: no screen could ever set "Verified".)
- **Nothing in Supabase changed.** The private `task-proofs` bucket, its policies in `schema.sql`, and the `<class>:proofs` rows are left as they were, so no data was deleted. The app just doesn't read or show them any more.
- Optional tidy-up, only if you want the space: in the Supabase dashboard open Storage, then `task-proofs`, and delete the bucket. That permanently deletes the old photos. The `<class>:proofs` rows are tiny and can stay.
- To bring the feature back, restore the version before this change; it was one self-contained feature.

## 3. Study progress can't be overwritten by a bad connection

If the database couldn't be reached when the Review tab opened, the study hub quietly started with an empty set, and the next flashcard you answered saved that empty set over your real progress. Now:
- A failed read shows "We couldn't load your study progress. Check your connection, then try again. Your saved progress is safe." with a Try again button, and retries by itself when the connection returns.
- Nothing is saved until the real data has loaded (`readOutcome` in `src/lib/store.js`, tested).
- I checked every other read-then-save in the app. Task progress was already safe (it merges into the saved row). The rest are saved only on the device. The Long term tab already behaved this way.

## 4. The build refuses to make a blank site

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `npm run build` used to report success and produce a blank page. It now stops and says which setting is missing and where to put it (`.env.local` locally, Build variables on Cloudflare). The preview config (`vite.preview.config.js`) is unaffected. Code: `tools/build-env.js`, `vite.config.js`, tested.

## 5. The assistant looks schools up on the web

Before, the assistant only remembered what it could about a school, so for a specific entrance exam it was often guessing. Now, when a school is named (for either kind of plan), it searches the web first and the plan keeps the pages it read.

- **The server turns search on, never the browser.** `functions/api/[provider].js` adds Gemini's Google Search tool only for a request that asks with `?search=1`, only for Gemini, and the tool is always the one the server sets. The existing rule that removes any `tools` a browser sends is unchanged, and Groq never gets tools.
- **Kill switch:** set a variable `AI_SEARCH` to `off` in Cloudflare and search is ignored everywhere. Plans then fall back to the ordinary answer.
- **Falls back, never breaks:** if search is off, over its quota or failing, `callSearch` (`src/lib/ai.js`) makes the ordinary call instead, so a plan is still made. Your own per-student rate limit is passed on, not hidden.
- **Real sources only.** The links shown under "Sources" come from Google's record of the pages it read (`groundingMetadata`), not from text the model wrote, so a link can't be made up. Only `https` links, one per site, five at most, opened with `noopener noreferrer`. They are cleaned again whenever a plan is loaded.
- **Honest about gaps.** If a school was looked up and nothing was found, the plan says "No online sources were found for this school, so check the topics with the school." A "high confidence" claim about a named school is lowered to "medium" unless something was found to back it. The prompt tells the model to ignore any instructions inside web pages and to say plainly if it can't look a school up.
- **Cost and quota:** Google Search grounding has its own daily limit on the free Gemini tier and may be billed on a paid plan. Check Google's current pricing for your key. One lookup happens per new plan (not per lesson), and it still counts against each student's existing rate limit. If you see it fall back often, that is usually the quota.
- Not checked against the live Gemini service (no keys in my environment). The proxy, the client, the fallback and the screens are all tested with a stand-in.
