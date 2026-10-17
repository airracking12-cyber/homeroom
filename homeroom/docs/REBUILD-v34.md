# v34: the rebuild (Step 0)

The whole front end was thrown away and rebuilt around the three jobs: **Track**, **Review**, **Prepare**. The data layer
(Supabase, auth, RLS, the Worker), the study and planning rules, and every working feature were kept. Nothing in `supabase/`,
`functions/` or `worker.js` changed, so there is **no SQL to run**.

## 1. Why v33 felt cluttered (the audit)

Measured from the v33 zip:

- **One 6,887-line file** (`App.jsx`, 442 KB) held every screen *and* the data layer. Each release added a screen onto the same layout.
- **Six top-level tabs** (Tasks, Done, Review, Long term, Data, Ask) plus a plane panel, an account menu, a music button, a search pill and a New-task button, all visible at once.
- **About 30 controls on the Tasks screen before you read a task**: greeting card, streak, announcement, weekly banner, three quick buttons, Upcoming/All, Filters, three view buttons, a row of subject chips, a side panel with a day summary and a focus timer.
- **Four competing summaries** of the same thing (the greeting card, the ring, the weekly banner, the side panel).
- **120 KB of CSS inside JavaScript strings** in 7 files plus the onboarding file, each layered over the last (`CSS + CALM_CSS + LONGTERM_CSS + ...`), **120 `@media` blocks**, and **104 raw hex colours** in `App.jsx`. That is why spacing and states were inconsistent.
- **Labels that needed explaining**: "Data", "Long term", "Cabin", "Check in", "unbox".
- **A first-run experience that was a stunt**, not an explanation: a boarding pass, a wooden stamp, a plane, then an unboxing tour. A new student waited a long time to learn what the app was for.

## 2. Feature inventory (nothing disappears)

Every feature found in the v33 code, and where it lives now. `tests/nav.test.mjs` checks that this list matches the real destinations.

| Feature | v33 home | v34 home |
| --- | --- | --- |
| Task list grouped by date, by subject, by group | Tasks | **Track** (Filters > Group the list) |
| Calendar view, board view (drag to change status) | Tasks | **Track** (List / Calendar / Board) |
| Done tasks by subject, this quarter or all | Done tab | **Track** (To do / Done toggle) |
| Add, edit, delete a task (with Undo) | New task / sheets | **Track**, one Add task sheet reachable from everywhere (`n`) |
| Quick-add from one sentence | New task | Inside the Add task sheet |
| Draft task kept in the browser | New task | Same, with "Start fresh" |
| Task comments | Task sheet | Task sheet |
| Mark done / in progress / not started | Row and sheet | Same |
| "N classmates finished" | Row | Row and sheet |
| Streak, this week's ring | Hero | **Track** week card |
| Admin announcement (shown) | Banner | **Track** banner (see note A) |
| Weekly reviewer banner (Sun/Mon) | Banner | **Track** banner |
| Plan my evening | Quick row | **Track** week card > Plan tonight |
| Focus timer (25/5/15, countdown in tab title) | Side panel | **Track** week card > Focus timer |
| Search tasks and notes | Header | Top bar, every screen (`/`, Ctrl/Cmd+K) |
| Ask the assistant (answers, adds tasks) | Ask tab | Top bar **Ask** button, every screen |
| Keyboard shortcuts and help | `?` | `?`, same shortcuts (see note C) |
| Study hub: next-up card, scope, 9 techniques | Review | **Review > Study** |
| Flashcards (spaced repetition), blanks, match, memory tricks, teach-back, blurting, quiz, mixed exam, weekly plan | Review | **Review > Study** (focus mode) |
| Study progress saved privately | Review | Same (`u:<you>:study`) |
| Notes library by subject and topic, search by word | Data tab | **Review > Notes** |
| Add notes (PDF, photo, text, paste), topic suggestion | Data tab | **Review > Notes** (and a task's own page) |
| Edit note details, remove notes (owner only), download original | Data tab | **Review > Notes** |
| Reviewers: this week's, builder, saved list, reader | Review | **Review > Reviewers** |
| Per-task review page | Task sheet | Task sheet > "Review for this" |
| Long term: 4-step setup, weekly plan, weeks ahead, make it fit, what it covers | Long term tab | **Prepare** |
| "Teach me this" lessons, practice, "How did it go?" | Long term tab | **Prepare** |
| Web-searched school curriculum with sources | Long term tab | **Prepare** |
| Seat map, who is online, week status, subject filter | Plane panel | **Class > Classmates** (see note B) |
| Temporary one-to-one chat | Plane panel | **Class > Classmates** |
| Study groups (create, join, progress) | Tasks > Groups | **Class > Groups** |
| Subjects and colours (shared) | Account menu | **Settings > Your class** |
| Light / dark / auto | Account menu | **Settings > Look** |
| Sound effects, music, volume | Header / menu | **Settings > Sound** |
| Change class | Account menu | **Settings > Your class** |
| Replay the introduction | Account menu | **Settings > Help** |
| Send a suggestion or report a problem | Account menu | **Settings > Help** |
| Download a copy of my data | Account menu | **Settings > Your account** |
| Sign out, delete account | Account menu | **Settings > Your account** |
| Sign up, sign in, email confirmation, password reset, join codes | Auth | Same logic, new screens |
| First-run profile (username, class, create a class) | Boarding pass | **Set up your profile** screen |
| Admin: suggestions inbox, class quarter, join codes | Admin app | Same, new screens |
| Minecraft link (built, switched off) | Done tab / admin | **Settings** and **Admin**, still behind `minecraft.config.js` |

### Things that changed on purpose (please confirm)

- **A. Announcements.** v33 *shows* an admin announcement, but nothing in the app can *post* one: `postAnn` exists in the code and
  is never called. I kept the display and did **not** invent a posting screen. Say the word and I will add an Announcements tab to Admin.
- **B. The seat map is no longer an airplane.** It is the same feature (2+2 or 3+3 seats, online dot, week status, subject filter,
  tap to chat) drawn as a plain classroom grid, because the plane belonged to the intro that was removed.
- **C. Shortcuts.** `g t` Track, `g r` Review, `g p` Prepare (the old Long term), plus new `g c` Class and `g s` Settings.
  `g d` (Done) and `g a` (Ask) still work. Done is now a toggle in Track and Ask a button in the top bar.
- **D. One accent colour.** The five-colour accent picker is gone (the brief asks for one accent, and each extra accent would need
  its own contrast check). Nothing else in Settings was removed.
- **E. Swipe gestures on task rows are gone.** Every swipe had a tap equivalent (the tick button, and Edit/Delete in the task sheet).
- **F. Board view starts at tablet width** (from 768px). Phones get List and Calendar.
- **G. Content security policy** no longer allows Google Fonts (fonts are self-hosted) and the stamp image folder rule is removed.
- **H. Display type.** The reference file is a marketing site, so display sizes top out at 40px (28px on phones) and section gaps are 24 to 32px.
  A small tracked uppercase label (dates, "Step 1 of 4") is the one exception to v33's no-all-caps rule.

## 3. Navigation: before and after

```
BEFORE (v33)                                       AFTER (v34)
─────────────                                      ─────────────
Left rail / bottom bar: 6 tabs                     Phone: bottom tab bar · Tablet: rail · Desktop: sidebar
  Tasks   Done   Review   Long term   Data   Ask      Track     Review      Prepare     Class       Settings
Header:  class chip · plane · music · search · New    (top bar, every screen)  class · Search · Ask
Account menu: theme, accents, subjects, sound,
  music, class, intro, feedback, export, sign out,    Track      what is due, shared with the class
  delete, credit                                        To do | Done · List | Calendar | Board · Filters
Plane panel: seat map, chat, filter                     Plan tonight · Focus timer · Add task (the one primary action)
Tasks > Groups                                       Review     get ready for what is coming
Tasks > quick row: Plan, Groups, Focus                  Study | Notes | Reviewers
Data: notes library                                  Prepare    the next grade or an entrance exam
Review: Study | Reviewers                               setup, this week, weeks ahead, lessons
Long term: plans                                     Class      Classmates (seat map, chat) | Groups
Ask: assistant chat                                  Settings   Look · Sound · Your class · Help · Your account · About
```

Five destinations. One primary action per screen (Add task on Track, Start on Review, Next on Prepare setup).
Rarely used things (account, class, replay intro, About) live under Settings.

## 4. What the build is

- `src/styles/`: `tokens.css` (every value), `base.css`, `components.css`, `layout.css`, and one stylesheet per area. Real CSS files, no CSS-in-JS.
- `src/app/`: 21 files, none over 612 lines. `App.jsx` is 157 lines and only decides which screen you are on.
- `src/lib/`: the logic, moved out of the old file *unchanged* (`study.js`, `review-ai.js`, `helpers.js`, `hooks.js`, `services.js`).
  Every AI prompt is the v33 prompt, copied verbatim.
- The intro is a five-screen machine (`src/app/intro/machine.js`): welcome, add a real task, turn real notes into flashcards,
  hand off to the real plan setup, closing credits. Skippable on every screen, resumable, replayable from Settings.
  The credit (Nathaniel Visaya, "Nathan" where space is tight) is on the last intro screen, in Settings > About, and on the sign-in screen.

## 5. Verification

Run in this environment against the preview build (`vite.preview.config.js`, fake database):

| Check | Result |
| --- | --- |
| `npm test` | 179 pass, 0 fail |
| `oxlint` | 0 errors, 60 warnings (v33 had 93) |
| Real production build | fails loudly without Supabase settings, bundles with them (JS 213 KB gzipped) |
| Contrast, light, dark, system dark | every text and control pair passes AA (tests/contrast.test.mjs) |
| axe-core (WCAG 2.2 AA + best practice), real Chromium | **0 violations on 29 screen states**: every destination, the sheets, calendar, board, intro, sign-in, profile; light and dark; phone and desktop |
| Layout sweep, real Chromium | 6 destinations at 320, 375, 414, 640, 768, 1024, 1280, 1440, 1920, 2560 and landscape 568, 667, 844: **84 of 84 with no sideways scroll** |
| Scripted flows, real Chromium | 49 of 49: add, open, comment, status, tick and Undo, delete and Undo, filters, calendar, board, Done, search, shortcuts, notes, study run focus mode, Prepare wizard and its failure path, theme, intro replay and skip, feedback, sign out, profile validation |
| Real WebKit engine (WebKitGTK 2.52) | every destination at phone and desktop, a sheet open: no errors, no overflow, `<dialog>`, `:has()`, `color-mix`, `dvh` all supported |
| Reduced motion | all animation and the intro's staggered delay switched off |

Bugs the checks caught and I fixed before shipping: a toast sitting on the Add button; the wordmark and "Ask" wrapping at 390px;
words breaking mid-letter in the goal switcher; seven accessibility findings from axe; the intro's staggered reveal ignoring
reduced motion; search losing focus when a sheet opened; Escape clearing the search box instead of closing it; flashcards in the
intro coming from the whole subject instead of the note just pasted; a segmented control with no pressed state.

### What I could not verify (please check on real devices)

- **Real iPhones and Androids.** WebKitGTK is the same engine family as Safari but is not Safari. Not checked: the iOS on-screen keyboard
  covering inputs, notches and the home indicator (`env(safe-area-inset-*)` is used but untested on hardware), `<dialog>` and `dvh`
  behaviour in iOS Safari, Android Chrome's address-bar resize, foldables, haptics, pinch-zoom feel.
- **Firefox.** It cannot be installed in this environment. Chromium and WebKit only. Nothing I use is Chromium-only, but it is unproven.
- **The AI features.** There is no Worker or model here, so flashcards, quizzes, reviewers, lessons, curriculum mapping, the assistant
  and quick-add were only exercised through their failure and offline-fallback paths. Their prompts are unchanged from v33, but a
  live run is needed. The intro's flashcard step and Prepare setup have the same dependence.
- **Real Supabase.** The fake database stands in for it. Sign-up emails, class codes, Realtime presence and chat, file upload and
  download, and RLS were not exercised. No SQL changed.
- **Screen readers** (VoiceOver, TalkBack, NVDA). axe finds structural problems but cannot judge the experience.
- **200% and 400% browser zoom** were checked by narrowing the viewport (640px and 320px), not with a real zoom.
- **Sound and music** were not heard.

## 6. Item 1 (Offline PWA): scope, waiting for your yes

Nothing is built. This is what I would do.

**In scope**
- A service worker and web manifest so the app *opens* with no connection on desktop, iOS and Android (iOS needs no install for the worker, but "Add to Home Screen" makes storage far less likely to be cleared).
- The app shell (page, scripts, styles, fonts, sounds) cached by version.
- A device copy of your **tasks, your progress and your Prepare plan**, shown read-only when offline, with a small "You're offline" note.
- **Ticks queued and synced**: ticking a task or a plan item offline goes into a queue on the device and is sent when you are back online, one change at a time, using the same merge-into-what's-saved write v33 already uses (so a phone cannot erase a laptop's tick).
- A visible **"A new version is ready. Update"** prompt, never an automatic reload while you are typing.

**Out of scope, by design**
- Anything AI (assistant, quiz, reviewers, lessons, plan building). Those say plainly they need a connection.
- Classmate data: comments, notes text, presence, chat, groups' membership changes.
- Adding or editing tasks, notes and plans offline.

**Things to decide**
1. Hand-written worker (about 150 lines, no new dependency, I write the tests) or `vite-plugin-pwa` (a dependency and Workbox, less code of ours)? I recommend hand-written: the queue and cache rules are specific to your data.
2. On a shared device: signing out clears the device copy and the queue. OK?
3. A signed-in session may expire while offline. I would keep the local copy readable and ask you to sign in when you are back online. OK?

**Risks I will test or flag**: a cached old app talking to a newer database (the cache is versioned and the update prompt handles it); iOS gives no background sync, so a queue is sent next time you open the app online; Supabase keeps the session in browser storage, which iOS can clear after a week of non-use for sites that aren't installed.
