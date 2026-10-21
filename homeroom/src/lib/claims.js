// First come, first served. Some work is done ONCE for the whole class (writing a note's practice questions, making a class
// reviewer). The first student to ask claims it; everyone else sees who is on it and uses the result when it appears. A claim
// that nobody finishes (a closed phone) goes stale after a few minutes so another student can take over.
export const STALE_MS = 3 * 60 * 1000;
// store.update is a version-checked read-modify-write, so two students claiming in the same moment cannot both win.
export async function claim(store, key, user, { now = Date.now(), staleMs = STALE_MS } = {}) {
  let won = false, holder = null;
  const ok = await store.update(key, (cur) => {
    if (cur && cur.by && cur.by !== user && now - cur.at < staleMs) { won = false; holder = cur.by; return cur; }
    won = true; holder = user; return { by: user, at: now };
  }, null);
  return ok ? { won, by: holder } : { won: false, by: null, error: true };
}
export async function release(store, key, user) {
  return store.update(key, (cur) => (cur && cur.by === user ? { by: null, at: 0 } : cur), null);
}
export async function whoHas(store, key, { now = Date.now(), staleMs = STALE_MS } = {}) {
  const cur = await store.get(key, true);
  return cur && cur.by && now - cur.at < staleMs ? cur.by : null;
}
