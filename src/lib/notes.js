// Class notes live in real database tables (public.notes and public.note_ideas, see supabase/upgrade-v28.sql), not in one
// big shared JSON row. The app loads only a small summary of every note at start-up (title, subject, topic, who, when,
// how long, how many ideas). The full text of a note is fetched only when someone opens it, and the "ideas inventory"
// is fetched only when someone studies. Searching and finding lessons by topic happens in the database, so the AI is
// only ever handed the handful of ideas that match, not the whole class's notes.
//
// createNotes(supabase) takes the database client as a parameter so it can be tested with a fake one.

export const MAX_BODY = 120000; // characters per note (the database enforces the same cap)
const SUMMARY_OLD = "id,class_id,owner,author,subject,topic,title,kind,task_id,task_title,n,ideas_n,ideas_src,created_at";
const SUMMARY = SUMMARY_OLD + ",file_name,file_type,file_size,file_path"; // v30: the original upload, kept alongside its text
export const FILE_BUCKET = "class-notes";
const IN_CHUNK = 40; // note ids per request, so the web address stays short
const PAGE = 1000; // the database returns at most this many rows per request

export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// One row from the database becomes the "material" the screens already know how to show (without its text).
export const toMaterial = (r, me) => ({
  id: r.id,
  taskId: r.task_id || null,
  title: r.title,
  by: r.author,
  kind: r.kind,
  at: Date.parse(r.created_at) || Date.now(),
  subject: r.subject,
  topic: r.topic || "",
  taskTitle: r.task_title || "",
  n: r.n || 0, // length of the text
  ic: r.ideas_n || 0, // how many ideas are in its inventory (0 = not read yet)
  src: r.ideas_src || null, // "ai" or "local"
  mine: !!me && r.owner === me,
  orphan: r.owner == null, // from before notes had owners: any classmate may tidy it away
  file: r.file_path ? { path: r.file_path, name: r.file_name || "original", type: r.file_type || "", size: r.file_size || 0 } : null,
});

// The name a file gets in storage: safe characters only, so odd file names can never break the path.
export const safeName = (name) => String(name || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "file";
export const filePathFor = (classId, noteId, name) => `${classId}/${noteId}/${safeName(name)}`;

// "photosynthesis ", "Photosynthesis" and "photo  synthesis"-style duplicates become one topic.
export const normTopic = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60);
const topicKey = (s) => normTopic(s).toLowerCase();

// If the typed topic is the same as one the class already uses (ignoring case and spacing), use the existing spelling.
export const matchTopic = (input, existing) => {
  const t = normTopic(input);
  if (!t) return "";
  const hit = (existing || []).find((x) => topicKey(x) === topicKey(t));
  return hit || t;
};

// The topics a class has used, most-used first. Optionally only for some subjects.
export const topicList = (materials, subjects) => {
  const want = subjects && subjects.length ? new Set(subjects) : null;
  const count = new Map();
  for (const m of materials) {
    if (!m.topic || (want && !want.has(m.subject))) continue;
    count.set(m.topic, (count.get(m.topic) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => ({ topic: t, n }));
};

export const ideaId = (noteId, idx) => `${noteId}:${idx}`;

// A page-at-a-time reader, because the database never returns more than 1000 rows in one request.
export async function readAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}

export function createNotes(supabase) {
  const text = new Map(); // note id -> full text, filled when a note is opened or just written
  const ideas = new Map(); // note id -> { n, at, src, ideas }, filled when someone studies or a note is read

  const me = async () => {
    try { return (await supabase.auth.getSession())?.data?.session?.user?.id || null; } catch { return null; }
  };

  const api = {
    clear() { text.clear(); ideas.clear(); },

    // The summary of every note in the class (no text). Returns null if the database couldn't be reached, so the
    // screen can keep what it had instead of showing an empty library.
    async list(classId) {
      if (!classId) return [];
      const uid = await me();
      const ask = (cols) => readAll(() =>
        supabase.from("notes").select(cols).eq("class_id", classId).order("created_at", { ascending: false }).order("id")
      );
      let { data, error } = await ask(SUMMARY);
      if (error) ({ data, error } = await ask(SUMMARY_OLD)); // v30 not run yet: no file columns, everything else works
      if (error) { console.error("notes list failed", error); return null; }
      return data.map((r) => toMaterial(r, uid));
    },

    // Full text for the notes asked about; only the ones not already held are fetched.
    async text(ids) {
      const out = {};
      const need = [];
      for (const id of ids) { if (text.has(id)) out[id] = text.get(id); else need.push(id); }
      for (const part of chunk(need, IN_CHUNK)) {
        const { data, error } = await supabase.from("notes").select("id,body").in("id", part);
        if (error) { console.error("notes text failed", error); continue; }
        for (const r of data || []) { text.set(r.id, r.body); out[r.id] = r.body; }
      }
      return out;
    },

    // Saves a new note. Returns true when the database accepted it. A note may carry its original file (n.file, already in
    // storage). If the database hasn't had the v30 upgrade yet, the note is still saved, just without the file link and
    // (for a student-made reviewer) as an ordinary upload.
    async add(n) {
      const body = String(n.text || "").slice(0, MAX_BODY);
      const row = {
        id: n.id, class_id: n.classId, author: n.author, subject: n.subject, topic: normTopic(n.topic) || null,
        title: String(n.title || "Untitled notes").slice(0, 120), body, kind: n.kind || "upload",
        task_id: n.taskId || null, task_title: n.taskTitle ? String(n.taskTitle).slice(0, 200) : null,
      };
      const withFile = n.file ? { ...row, file_path: n.file.path, file_name: String(n.file.name).slice(0, 200), file_type: String(n.file.type || "").slice(0, 100), file_size: n.file.size || 0 } : row;
      let { error } = await supabase.from("notes").insert(withFile);
      if (error && n.file) ({ error } = await supabase.from("notes").insert(row)); // no file columns yet
      if (error && row.kind === "reviewer") ({ error } = await supabase.from("notes").insert({ ...row, kind: "upload" })); // old kind list
      if (error) { console.error("note save failed", error); return false; }
      text.set(n.id, body);
      return true;
    },

    // Keeps the original file of an upload (a PDF or photo) in the class's private storage. Returns { path, name, type, size },
    // or null if it couldn't be stored (the note is still saved from its text).
    async uploadFile(classId, noteId, file) {
      try {
        const path = filePathFor(classId, noteId, file.name);
        const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) { console.warn("original file not stored", error); return null; }
        return { path, name: file.name, type: file.type || "", size: file.size || 0 };
      } catch (e) { console.warn("original file not stored", e); return null; }
    },

    // A link to the original that works for five minutes (the storage is private).
    async fileUrl(path) {
      try {
        const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 300);
        if (error || !data) return null;
        return data.signedUrl || null;
      } catch { return null; }
    },

    async removeFile(path) {
      if (!path) return;
      try { await supabase.storage.from(FILE_BUCKET).remove([path]); } catch (e) { console.warn("[Homeroom] non-fatal:", e); }
    },

    async remove(id) {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) { console.error("note remove failed", error); return false; }
      text.delete(id); ideas.delete(id);
      return true;
    },

    // Change a note's subject, topic or title (its owner only; the database enforces that).
    async relabel(id, { subject, topic, title }) {
      const patch = {};
      if (subject !== undefined) patch.subject = String(subject).slice(0, 40);
      if (topic !== undefined) patch.topic = normTopic(topic) || null;
      if (title !== undefined) patch.title = String(title).slice(0, 120);
      const { data, error } = await supabase.from("notes").update(patch).eq("id", id).select("id");
      if (error) { console.error("note relabel failed", error); return false; }
      return !!(data && data.length); // zero rows means it isn't yours to change
    },

    // The ideas inventory of a note is replaced in one go, by a database function that also updates the idea count.
    async saveIdeas(id, src, list) {
      const payload = list.map((i) => ({ t: i.t, d: i.d, c: i.c || "", k: i.k || "fact" }));
      const { data, error } = await supabase.rpc("save_note_ideas", { p_note: id, p_src: src, p_ideas: payload });
      if (error) { console.error("ideas save failed", error); return null; }
      ideas.set(id, { n: 0, at: Date.now(), src, ideas: payload });
      return typeof data === "number" ? data : payload.length;
    },

    // The stored ideas of some notes, as { noteId: { n, at, src, ideas: [{ t, d, c, k }] } }. Order is kept, so an
    // idea's place in its list (and so its flashcard id) never changes.
    async ideasFor(ids) {
      const out = {};
      const need = [];
      for (const id of ids) { if (ideas.has(id)) out[id] = ideas.get(id); else need.push(id); }
      for (const part of chunk(need, IN_CHUNK)) {
        const { data, error } = await readAll(() =>
          supabase.from("note_ideas").select("note_id,idx,title,detail,keyword,kind").in("note_id", part).order("note_id").order("idx")
        );
        if (error) { console.error("ideas read failed", error); continue; }
        const got = {};
        for (const r of data) {
          const e = (got[r.note_id] = got[r.note_id] || { n: 0, at: Date.now(), src: "ai", ideas: [] });
          e.ideas.push({ t: r.title, d: r.detail, c: r.keyword || "", k: r.kind || "fact" });
        }
        for (const [id, e] of Object.entries(got)) { ideas.set(id, e); out[id] = e; }
      }
      return out;
    },

    // The best-matching ideas across the class's notes, found by the database (subject, topic and search words).
    // Each idea carries where it came from, and the same id (note id + place in the list) the study screens use.
    // By default every word has to match; if that finds nothing for a few words, it tries again with any word (or pass
    // any: true for a whole question).
    async findIdeas({ subjects = [], topics = [], q = "", limit = 80, any = false } = {}) {
      const ask = async (anyWord) => {
        const { data, error } = await supabase.rpc("find_ideas", {
          p_subjects: subjects.length ? subjects : null, p_topics: topics.length ? topics : null,
          p_q: q || "", p_limit: limit, p_any: anyWord,
        });
        if (error) { console.error("find ideas failed", error); return null; }
        return data || [];
      };
      let rows = await ask(any);
      if (rows && rows.length === 0 && !any && String(q).trim().split(/\s+/).length > 1) rows = await ask(true);
      if (rows === null) return null;
      return rows.map((r) => ({
        t: r.title, d: r.detail, c: r.keyword || "", k: r.kind || "fact",
        id: ideaId(r.note_id, r.idx), mid: r.note_id, mt: r.note_title, subject: r.subject, topic: r.topic || "",
      }));
    },

    // Which notes mention these words anywhere in their text? Returns [{ id, snippet }] best first.
    async search(q, limit = 30) {
      const { data, error } = await supabase.rpc("search_notes", { p_q: q, p_limit: limit });
      if (error) { console.error("notes search failed", error); return null; }
      return (data || []).map((r) => ({ id: r.id, snippet: String(r.snippet || "").replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim() }));
    },
  };
  return api;
}
