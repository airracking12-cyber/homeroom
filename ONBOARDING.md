# v27: redesign layer and mandatory onboarding

**Flow** (`src/onboarding/machine.js`): BLANK, STAMP, TEAR, PLANE_ANIMATION, WALKTHROUGH, COMPLETE.
- BLANK, STAMP and TEAR live in `Onboarding.jsx`. The name and class are filled in on the ticket as part of STAMP (the stamp stays dimmed until both are valid).
- PLANE_ANIMATION is `PlaneFlight.jsx`. At 58% of the flight it sends PLANE_MIDPOINT, so the walkthrough starts while the plane is still in the air.
- WALKTHROUGH is the existing `Tour` in `App.jsx`, now `mandatory` on a first run: no Skip tour, no X, Escape does nothing, no Skip step.
  A "Show me how" link appears only after 20 seconds on a "do this" step, so nobody is trapped by a step they can't manage.
- Replays from the account menu are still skippable.

**Persistence:** `hasCompletedOnboarding` is stored in the Supabase user metadata (no SQL needed). It is written `false` when the
ticket is stamped and `true` when the walkthrough ends. If it is `false` at sign-in (closed the tab mid-tour, new device) the
walkthrough resumes. Accounts that predate onboarding have no value and are left alone.

**Redesign:** `src/design/redesign.css.js` is appended after the app's stylesheet (`STYLES` in `App.jsx`). Remove that import and
the `+ REDESIGN_CSS` to go back to v26.

**Preview with a fake database:** `npx vite --config vite.preview.config.js`, then open `/?scn=new` (first run),
`/?scn=pending` (resume) or `/?scn=returning`.

**New dependency:** `motion` (Framer Motion). New tests: `tests/onboarding.test.mjs`.
