// A stand-in for the Supabase client, for local previews and screenshots only (see vite.preview.config.js). Nothing here ships.
// Scenario comes from ?scn= : new (signed in, no ticket yet), pending (stamped, never finished the tour), returning (all done).
const q = new URLSearchParams(location.search);
const scn = q.get("scn") || "returning";
const today = new Date();
const iso = (d) => { const x = new Date(today); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const meta = JSON.parse(sessionStorage.getItem("mock:meta") || "null") || (scn === "pending" ? { hasCompletedOnboarding: false } : scn === "returning" ? { hasCompletedOnboarding: true } : {});
let profile = scn === "new" ? { username: null, class_id: null, is_admin: false } : { username: "mika", class_id: "c1", is_admin: false };
const kv = new Map();
const T = (id, title, subject, type, d, pr, notes) => ({ id, title, subject, type, priority: pr, deadline: iso(d), notes, addedBy: "mika", quarter: 1, createdAt: Date.now() - id.length * 1000 });
kv.set("c1:tasks", [
  T("t1", "Lab report: osmosis in potato cells", "Science", "Assignment", 0, "High", "Include the graph and a short conclusion."),
  T("t2", "Read chapter 7 and annotate", "English", "Reading", 1, "Medium", ""),
  T("t3", "Quadratics worksheet, questions 1 to 14", "Mathematics", "Homework", 2, "Medium", ""),
  T("t4", "Unit test: the Cold War", "History", "Test", 4, "High", "Chapters 9 to 12."),
  T("t5", "Poster: renewable energy", "Science", "Project", 6, "Low", ""),
  T("t6", "Vocabulary list 12", "Spanish", "Quiz", 3, "Low", ""),
]);
kv.set("c1:announcements", []);
const classes = [{ id: "c1", year: 2026, name: "Grade 10 Atlas", label: "Grade 10 Atlas", quarter: 1 }, { id: "c2", year: 2026, name: "Grade 10 Birch", label: "Grade 10 Birch", quarter: 1 }];

function run(b) {
  const eq = Object.fromEntries(b.f.filter((x) => x[0] === "eq").map((x) => [x[1], x[2]]));
  let data = null;
  if (b.t === "profiles") data = b.op === "select" ? profile : null;
  else if (b.t === "classes") data = b.op === "select" ? classes : null;
  else if (b.t === "kv") {
    if (b.op === "select") {
      const like = b.f.find((x) => x[0] === "like");
      if (like) { const pre = like[2].replace(/%$/, ""); data = [...kv].filter(([k]) => k.startsWith(pre)).map(([key, value]) => ({ key, value })); }
      else { const k = eq.key; data = kv.has(k) ? { value: kv.get(k), version: 1 } : null; }
    } else if (b.payload && eq.key !== undefined) { kv.set(eq.key, b.payload.value); } else if (b.payload && b.payload.key) kv.set(b.payload.key, b.payload.value);
  } else data = b.many ? [] : null;
  return { data, error: null };
}
function from(t) {
  const b = { t, op: "select", f: [], payload: null, many: true };
  const p = new Proxy(b, {
    get(_, k) {
      if (k === "then") return (res, rej) => Promise.resolve(run(b)).then(res, rej);
      if (k === "maybeSingle" || k === "single") return () => { b.many = false; return Promise.resolve(run(b)); };
      if (k === "eq" || k === "like" || k === "in" || k === "neq") return (c, v) => { b.f.push([k, c, v]); return p; };
      if (k === "update" || k === "insert" || k === "upsert") return (pl) => { b.op = k; b.payload = pl; return p; };
      if (k === "delete") return () => { b.op = "delete"; return p; };
      return () => p;
    },
  });
  return p;
}
const listeners = new Set();
export const supabase = {
  from,
  rpc: async (name, args) => {
    if (name === "complete_profile") { profile = { username: args.uname, class_id: args.cls, is_admin: false }; return { data: null, error: null }; }
    if (name === "class_roster") return { data: [{ username: "mika", seat: 1 }, { username: "ines", seat: 2 }, { username: "owen", seat: 3 }], error: null };
    return { data: null, error: null };
  },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1", user_metadata: meta } } } }),
    updateUser: async ({ data }) => { Object.assign(meta, data); sessionStorage.setItem("mock:meta", JSON.stringify(meta)); window.__mockMeta = { ...meta }; return { data: {}, error: null }; },
    onAuthStateChange: (cb) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    signOut: async () => ({ error: null }), signUp: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }), resetPasswordForEmail: async () => ({ error: null }),
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({}), createSignedUrls: async () => ({ data: [], error: null }) }) },
  channel: () => { const c = { on: () => c, subscribe: () => c, send: () => c, track: async () => {}, presenceState: () => ({}), unsubscribe: () => {} }; return c; },
  removeChannel: () => {},
  realtime: { setAuth: () => {} },
};
window.__mockMeta = { ...meta };
