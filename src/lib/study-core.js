// The pure study helpers (no screens, no database): answer matching, the spaced-repetition box schedule, and plain fallback questions.
// study.js re-exports all of these, so existing imports keep working; tests and the coach import them from here.
export const BOX_DAYS = [0, 1, 2, 4, 8, 16]; // spaced repetition: how many days until a card comes back, by box
export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
export const sameAnswer = (a, b) => { const x = norm(a), y = norm(b); return !!x && (x === y || (y.length >= 5 && lev(x, y) <= 1)); };
export const maskIdea = (d, c) => { const re = new RegExp(escRe(c), "i"); return re.test(d) ? d.replace(re, "_____") : null; };
export const mcFallback = (idea, pool) => {
  const masked = idea.c && maskIdea(idea.d, idea.c);
  const key = (p) => (masked ? p.c : p.t), right = masked ? idea.c : idea.t;
  const cand = pool.filter((p) => p.id !== idea.id && key(p) && norm(key(p)) !== norm(right));
  const others = [...shuffle(cand.filter((p) => p.subject === idea.subject)), ...shuffle(cand.filter((p) => p.subject !== idea.subject))].map(key).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3); // same-subject look-alikes first
  const c = [right, ...others];
  ["None of these", "All of these", "Not enough information"].forEach((e) => { if (c.length < 4) c.push(e); });
  const a = shuffle(c);
  return { type: "mc", ref: [idea.id], q: masked ? `Fill in the blank: "${masked}"` : `Which term matches this? "${idea.d}"`, c: a, a: a.indexOf(right), w: `${idea.t}: ${idea.d}` };
};
