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
  T("t1", "Lab report: osmosis in potato cells", "Science", "Project", 0, "High", "Include the graph and a short conclusion."),
  T("t2", "Read chapter 7 and annotate", "English", "Study", 1, "Medium", ""),
  T("t3", "Quadratics worksheet, questions 1 to 14", "Mathematics", "Homework", 2, "Medium", ""),
  T("t4", "Periodic exam: Kasaysayan ng Asya", "Araling Panlipunan", "Exam", 4, "High", "Chapters 9 to 12."),
  T("t5", "Poster: renewable energy", "Science", "Project", 6, "Low", ""),
  T("t6", "Pagsusulit: Pang-uri at Pang-abay", "Filipino", "Quiz", 3, "Low", ""),
]);
kv.set("c1:announcements", []);

// ---- notes + ideas (v28 tables) so the Review and Data screens have something to show ----
const nowMs = Date.now();
const N = (id, subject, topic, title, author, ageDays, body, ideas, kind = "upload", owner = null) => ({ id, class_id: "c1", owner: owner || (author === "mika" ? "u1" : "x_" + author), author, subject, topic, title, body, kind, task_id: null, task_title: null, n: body.length, ideas_n: ideas.length, ideas_src: "ai", created_at: new Date(nowMs - ageDays * 864e5).toISOString(), _ideas: ideas });
const I = (t, d, c, k = "fact") => ({ t, d, c, k });
const notesDb = [
  N("n1", "Mathematics", "Quadratic equations", "Lesson 4.1: Solving by factoring", "mika", 0.3, "A quadratic equation has the form ax^2 + bx + c = 0. To solve by factoring, rewrite it as a product of two binomials, set each factor to zero, then solve. The zero product property says that if a times b equals zero, then a or b is zero.", [I("Standard form", "A quadratic equation is written ax^2 + bx + c = 0 where a is not zero.", "ax^2 + bx + c = 0", "formula"), I("Zero product property", "If a product of factors equals zero, at least one factor must equal zero.", "at least one factor", "term"), I("Factoring steps", "Move every term to one side, factor, set each factor to zero, then solve for x.", "set each factor to zero", "process")]),
  N("n2", "Mathematics", "Quadratic equations", "Quadratic formula cheat sheet", "ines", 2, "The quadratic formula x = (-b ± sqrt(b^2 - 4ac)) / 2a solves any quadratic equation. The discriminant b^2 - 4ac tells how many real roots there are.", [I("Quadratic formula", "x equals negative b plus or minus the square root of b squared minus 4ac, all over 2a.", "2a", "formula"), I("Discriminant", "b^2 - 4ac tells how many real roots: positive gives two, zero gives one, negative gives none.", "b^2 - 4ac", "term")]),
  N("n3", "Mathematics", "Linear functions", "Slope and intercepts", "owen", 6, "Slope is rise over run. The slope-intercept form is y = mx + b where m is the slope and b is the y-intercept.", [I("Slope", "Slope measures steepness as rise over run.", "rise over run", "term"), I("Slope-intercept form", "y = mx + b, where m is the slope and b is the y-intercept.", "y = mx + b", "formula")]),
  N("n4", "Science", "Photosynthesis", "Photosynthesis notes", "mika", 1, "Photosynthesis happens in the chloroplasts. Plants turn carbon dioxide and water into glucose and oxygen using light energy. Chlorophyll absorbs mostly red and blue light.", [I("Where it happens", "Photosynthesis takes place in the chloroplasts of plant cells.", "chloroplasts", "fact"), I("Equation", "Carbon dioxide and water become glucose and oxygen in the presence of light.", "glucose", "formula"), I("Chlorophyll", "The green pigment that absorbs mostly red and blue light.", "red and blue", "term"), I("Reactants", "Photosynthesis uses carbon dioxide, water and light energy.", "light energy", "fact")]),
  N("n5", "Science", "Photosynthesis", "Light vs dark reactions", "ines", 4, "The light-dependent reactions happen in the thylakoids and make ATP. The Calvin cycle happens in the stroma and builds glucose.", [I("Light reactions", "Occur in the thylakoid membranes and produce ATP and NADPH.", "thylakoid", "process"), I("Calvin cycle", "Occurs in the stroma and uses ATP to build glucose from carbon dioxide.", "stroma", "process")]),
  N("n6", "Science", "Cell structure", "Parts of the cell", "owen", 9, "The nucleus holds DNA. Mitochondria release energy. The cell membrane controls what enters and leaves.", [I("Nucleus", "Holds the cell's DNA and controls its activities.", "DNA", "term"), I("Mitochondria", "Release energy from food through respiration.", "Mitochondria", "term"), I("Cell membrane", "Controls what enters and leaves the cell.", "controls", "term")]),
  N("n7", "Araling Panlipunan", "Kasaysayan ng Asya", "Mga sinaunang kabihasnan", "ines", 3, "Ang apat na sinaunang kabihasnan sa Asya ay ang Mesopotamia, Indus, Tsina, at Ehipto sa Africa. Umusbong ang mga ito sa tabi ng mga ilog.", [I("Kabihasnan sa tabi ng ilog", "Umusbong ang mga sinaunang kabihasnan sa tabi ng malalaking ilog.", "ilog", "fact"), I("Mesopotamia", "Kabihasnang nasa pagitan ng Tigris at Euphrates.", "Tigris at Euphrates", "term")]),
  N("n8", "Araling Panlipunan", "Kasaysayan ng Asya", "Dinastiyang Tsino", "mika", 5, "Ang Dinastiyang Shang ang unang may tala sa kasaysayan. Sumunod ang Zhou na nagpakilala ng Mandate of Heaven.", [I("Dinastiyang Shang", "Ang unang dinastiya na may nakasulat na tala.", "Shang", "term"), I("Mandate of Heaven", "Paniniwalang binibigyan ng langit ang karapatang mamuno.", "Mandate of Heaven", "term")]),
  N("n9", "Filipino", "Pang-uri at Pang-abay", "Aralin 3: Pang-uri", "owen", 2, "Ang pang-uri ay naglalarawan sa pangngalan o panghalip. Ang pang-abay ay naglalarawan sa pandiwa, pang-uri, o kapwa pang-abay.", [I("Pang-uri", "Salitang naglalarawan sa pangngalan o panghalip.", "pangngalan", "term"), I("Pang-abay", "Naglalarawan sa pandiwa, pang-uri, o kapwa pang-abay.", "pandiwa", "term")]),
  N("n10", "English", "Chapter 7", "Chapter 7 summary", "ines", 1, "In chapter 7 the narrator discovers the letter. The central theme is trust and betrayal.", [I("Central theme", "Chapter 7 explores trust and betrayal.", "trust and betrayal", "fact"), I("Key event", "The narrator discovers the hidden letter.", "letter", "fact")]),
  N("n11", "Mathematics", "Quadratic equations", "Reviewer: Quadratic equations", "mika", 0.1, "Solving by factoring\nStandard form: ax^2 + bx + c = 0.\nZero product property: if a product is zero, at least one factor is zero.\n\nQuadratic formula\nx = (-b ± sqrt(b^2 - 4ac)) / 2a.\nThe discriminant tells how many real roots there are.", [], "ai"),
];
const ideasDb = () => notesDb.flatMap((n) => n._ideas.map((x, idx) => ({ note_id: n.id, idx, title: x.t, detail: x.d, keyword: x.c, kind: x.k, subject: n.subject, topic: n.topic, note_title: n.title })));
const strip = (n) => { const { _ideas, body, ...r } = n; return r; };

const classes = [{ id: "c1", year: 2026, name: "Grade 10 Atlas", label: "Grade 10 Atlas", quarter: 1 }, { id: "c2", year: 2026, name: "Grade 10 Birch", label: "Grade 10 Birch", quarter: 1 }];

function run(b) {
  const eq = Object.fromEntries(b.f.filter((x) => x[0] === "eq").map((x) => [x[1], x[2]]));
  let data = null;
  if (b.t === "profiles") data = b.op === "select" ? profile : null;
  else if (b.t === "classes") data = b.op === "select" ? classes : null;
  else if (b.t === "kv") {
    if (b.op === "select") {
      const like = b.f.find((x) => x[0] === "like");
      const inK = b.f.find((x) => x[0] === "in");
      if (inK) data = inK[2].filter((k) => kv.has(k)).map((key) => ({ key, value: kv.get(key) }));
      else if (like) { const pre = like[2].replace(/%$/, ""); data = [...kv].filter(([k]) => k.startsWith(pre)).map(([key, value]) => ({ key, value })); }
      else { const k = eq.key; data = kv.has(k) ? { value: kv.get(k), version: 1 } : null; }
    } else if (b.payload && eq.key !== undefined) { kv.set(eq.key, b.payload.value); } else if (b.payload && b.payload.key) kv.set(b.payload.key, b.payload.value);
  } else if (b.t === "notes") {
    const inF = b.f.find((x) => x[0] === "in");
    if (b.op === "select") {
      const rows = notesDb.filter((n) => !inF || inF[2].includes(n.id));
      data = rows.map((n) => (b.cols && /body/.test(b.cols) ? { id: n.id, body: n.body } : strip(n)));
    } else if (b.op === "insert") {
      const r = b.payload; notesDb.unshift({ ...r, owner: "u1", created_at: new Date().toISOString(), n: String(r.body || "").length, ideas_n: 0, ideas_src: null, _ideas: [] });
    } else if (b.op === "delete") { const i = notesDb.findIndex((n) => n.id === eq.id); if (i >= 0) notesDb.splice(i, 1); }
    else if (b.op === "update") { const n = notesDb.find((x) => x.id === eq.id); if (n) Object.assign(n, b.payload); data = n ? [{ id: n.id }] : []; }
  } else if (b.t === "note_ideas") {
    const inF = b.f.find((x) => x[0] === "in");
    data = ideasDb().filter((r) => !inF || inF[2].includes(r.note_id));
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
      if (k === "select") return (c) => { b.cols = c; return p; };
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
    if (name === "find_ideas") {
      const w = String(args.p_q || "").toLowerCase().split(/\s+/).filter(Boolean);
      const rows = ideasDb().filter((r) => (!args.p_subjects || args.p_subjects.includes(r.subject)) && (!args.p_topics || args.p_topics.includes(r.topic)) && (!w.length || (args.p_any ? w.some : w.every).call(w, (x) => `${r.title} ${r.detail} ${r.topic} ${r.note_title}`.toLowerCase().includes(x))));
      return { data: rows.slice(0, args.p_limit || 80), error: null };
    }
    if (name === "save_note_ideas") { const n = notesDb.find((x) => x.id === args.p_note); if (n) { n._ideas = args.p_ideas; n.ideas_n = args.p_ideas.length; n.ideas_src = args.p_src; } return { data: args.p_ideas.length, error: null }; }
    if (name === "search_notes") { const w = String(args.p_q || "").toLowerCase(); return { data: notesDb.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(w)).map((n) => ({ id: n.id, snippet: n.body.slice(0, 90) })), error: null }; }
    if (name === "class_roster") return { data: [{ username: "mika", seat: 1 }, { username: "ines", seat: 2 }, { username: "owen", seat: 3 }], error: null };
    return { data: null, error: null };
  },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1", user_metadata: meta } } } }),
    updateUser: async ({ data }) => { Object.assign(meta, data); sessionStorage.setItem("mock:meta", JSON.stringify(meta)); window.__mockMeta = { ...meta }; return { data: {}, error: null }; },
    onAuthStateChange: (cb) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    signOut: async () => ({ error: null }), signUp: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }), resetPasswordForEmail: async () => ({ error: null }),
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({}), createSignedUrls: async () => ({ data: [], error: null }), createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }) }) },
  channel: () => { const c = { on: () => c, subscribe: () => c, send: () => c, track: async () => {}, presenceState: () => ({}), unsubscribe: () => {} }; return c; },
  removeChannel: () => {},
  realtime: { setAuth: () => {} },
};
window.__mockMeta = { ...meta };
