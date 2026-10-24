// Reading notes, as the student sees it: one confirm, then a calm progress card per note ("Part 3 of 8", a real percentage,
// plain stages), Cancel that keeps what is finished, Try again that retries only what failed, and a coverage check at the end.
// The logic is in lib/ingest.js (tested); this file connects it to the database, the assistant and the screen.
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { notes, store } from "../lib/services.js";
import { uid } from "../lib/helpers.js";
import { suggestTopic } from "../lib/review-ai.js";
import { callClaude, parseJSON } from "../lib/ai.js";
import { claim } from "../lib/claims.js";
import { PRACTICE_SYSTEM, practicePrompt, parsePractice, practiceKey, mergePractice, missingIdeas, BATCH } from "../lib/practice.js";
import { matchTopic } from "../lib/notes.js";
import { makeChunks, planParts, deriveTitle, newJob, runIngest, progressOf, coverage, stageText, makePacer } from "../lib/ingest.js";
import { ideasForChunk, transcribe, imageBlock, pdfParts, pdfPartBlock, partLabel, isPdf, isImage, readText } from "../lib/ingest-ai.js";
import { Bar, Button } from "./ui.jsx";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const RESUME = new Set(["running", "paused"]);

export function useIngest({ user, classRef, saveNote, markInventory, relabel, topicNames, noteInfo, toast }) {
  const jobs = useRef(new Map());
  const [view, setView] = useState([]);
  const waiting = useRef(false);
  const fns = useRef({});
  const pacer = useMemo(() => makePacer({ onWait: (ms) => { waiting.current = ms > 0; fns.current.publish?.(); } }), []);

  const publish = useCallback(() => {
    setView([...jobs.current.values()].map((e) => ({
      id: e.id, kind: e.kind, title: e.title, noteId: e.noteId, noOriginal: !!e.noOriginal, running: !!e.ctl, waiting: !!e.ctl && waiting.current,
      job: { ...e.job, chunks: e.job.chunks.map((c) => ({ ...c })) },
    })));
  }, []);
  // autosave: this device at once, and the database in the background (never slows the reading down)
  const queue = useRef(Promise.resolve());
  const save = useCallback(() => {
    const payload = { v: 1, jobs: Object.fromEntries([...jobs.current].filter(([, e]) => e.kind !== "practice").map(([id, e]) => [id, { kind: e.kind, title: e.title, subject: e.subject, topic: e.topic, noteId: e.noteId, noteKind: e.noteKind, taskId: e.taskId, taskTitle: e.taskTitle, file: e.file, parts: e.parts, texts: e.texts, isImage: e.isImage, job: e.job }])) };
    try { localStorage.setItem(`hr:ingest:${user}`, JSON.stringify(payload)); } catch { /* storage full or blocked */ }
    queue.current = queue.current.then(() => store.set(`u:${user}:ingest`, payload, true)).catch(() => {});
  }, [user]);
  fns.current.publish = publish;

  const getFile = async (e) => {
    if (e.fileObj) return e.fileObj;
    const url = await notes.fileUrl(e.file.path);
    if (!url) throw new Error("original not available");
    const blob = await (await fetch(url)).blob();
    e.fileObj = new File([blob], e.file.name, { type: e.file.type });
    return e.fileObj;
  };

  const depsFor = (e, ctl) => {
    const base = { signal: ctl.signal, pacer, persist: async () => save(), onUpdate: publish };
    if (e.kind === "ideas") {
      return { ...base,
        callChunk: (c) => ideasForChunk(c, { title: e.title, subject: e.subject }),
        loadIdeas: async () => (await notes.ideasFor([e.noteId]))[e.noteId]?.ideas || [],
        saveIdeas: async (list) => { const n = await notes.saveIdeas(e.noteId, "ai", list); if (n == null || n < list.length) return null; markInventory(e.noteId, { ideas: list, src: "ai" }); return n; },
      };
    }
    if (e.kind === "practice") {
      const key = practiceKey(classRef.current, e.noteId);
      return { ...base, short: () => false, max: Infinity, // a batch of ideas is one chunk; what is stored is the progress
        callChunk: async (c) => {
          const parsed = parsePractice(parseJSON(await callClaude(PRACTICE_SYSTEM, [{ role: "user", content: practicePrompt(c.batch, { subject: e.subject, title: e.title }) }])), c.batch);
          return Object.entries(parsed).map(([bi, p]) => ({ t: `idea ${c.batch[bi].idx}`, d: "", p }));
        },
        loadIdeas: async () => { const row = await store.get(key, true); return Object.entries((row && row.items) || {}).map(([i, p]) => ({ t: `idea ${i}`, d: "", p })); },
        saveIdeas: async (list) => { const add = {}; list.forEach((x) => { add[Number(x.t.slice(5))] = x.p; }); const ok = await store.update(key, (cur) => mergePractice(cur, add), null); return ok ? list.length : null; },
      };
    }
    return { ...base, short: () => false, max: Infinity,   // a file is copied page group by page group; each copy is kept in the job
      callChunk: async (c) => {
        const part = e.parts[c.i], f = await getFile(e);
        const block = e.isImage ? await imageBlock(f) : await pdfPartBlock(f, part.from, part.to);
        const out = String(await transcribe(block, `all the text on ${partLabel(part)}`)).trim();
        if (!out) return [];
        e.texts[c.i] = out;
        return [{ t: `part ${c.i}`, d: out }];
      },
      loadIdeas: async () => Object.keys(e.texts).map((i) => ({ t: `part ${i}`, d: e.texts[i] })),
      saveIdeas: async (l) => l.length,
    };
  };

  // Makes the note row(s) from text (the raw save), then starts reading each. A text over the database cap becomes numbered parts.
  const createNotes = async ({ id, title, text, subject, topic, kind, taskId, taskTitle, file, fileObj }) => {
    const parts = planParts(text); const ids = [];
    for (let k = 0; k < parts.length; k++) {
      const noteId = k === 0 && id ? id : uid();
      const t = parts.length > 1 ? `${title} (part ${k + 1} of ${parts.length})`.slice(0, 120) : title;
      const ok = await saveNote({ id: noteId, title: t, text: parts[k], subject, topic, kind, taskId, taskTitle, file: k === 0 ? file : null, fileObj: k === 0 ? fileObj : null });
      if (!ok) return { ok: false, ids };
      ids.push(noteId);
      if (kind !== "ai") fns.current.startIdeas({ noteId, title: t, subject, topic, text: parts[k], noteKind: kind, taskId, taskTitle });
    }
    return { ok: true, ids };
  };

  const finish = async (e) => {
    // all pages are copied: now the note is made, and it takes over the same card (same id) for the study-ideas stage
    const have = e.parts.map((p, i) => (e.texts[i] ? e.texts[i] : `[${cap(partLabel(p))} could not be read from the original file.]`));
    jobs.current.delete(e.id); save();
    await createNotes({ id: e.id, title: e.title, text: have.join("\n\n"), subject: e.subject, topic: e.topic, kind: e.noteKind, taskId: e.taskId, taskTitle: e.taskTitle, file: e.file });
    publish();
  };

  const run = useCallback(async (id, only) => {
    const e = jobs.current.get(id);
    if (!e || e.ctl) return;
    const ctl = new AbortController(); e.ctl = ctl; publish();
    try {
      if (e.kind === "ideas" && e.text && !e.topic && !e.topicTried) { // name the topic once, as part of building the shared database
        e.topicTried = true;
        try { await pacer.wait(ctl.signal); const t = await suggestTopic(e.text, e.subject); if (t) { const m = matchTopic(t, topicNames(e.subject)); if (m && await relabel(e.noteId, { topic: m })) e.topic = m; } } catch { /* optional */ }
      }
      await runIngest({ job: e.job, chunks: e.chunks, only, deps: depsFor(e, ctl) });
    } catch (err) { console.warn("[Homeroom] reading stopped:", err); e.job.state = "paused"; e.job.error = "read"; }
    e.ctl = null; waiting.current = false; save(); publish();
    if (e.job.covered) {
      if (e.kind === "file") await finish(e);
      else if (e.kind === "practice") { jobs.current.delete(e.id); publish(); toast?.(`Practice questions for \u201c${e.title}\u201d are ready`); }
      else { if (!document.documentElement.dataset.movedIn) toast?.(`\u201c${e.title}\u201d is ready to study`); /* the move-in welcome has the stage for a few seconds */ fns.current.startPractice?.({ noteId: e.noteId, title: e.title, subject: e.subject }); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startIdeas = useCallback((n) => {
    const chunks = makeChunks(n.text);
    if (!chunks.length) return;
    const job = newJob({ id: n.noteId, noteId: n.noteId, title: n.title, chunks });
    jobs.current.set(n.noteId, { ...n, id: n.noteId, kind: "ideas", textLen: n.text.length, chunks, job });
    save(); publish(); run(n.noteId);
  }, [run, save, publish]);
  fns.current.startIdeas = startIdeas;

  // Practice questions are written ONCE per note for the whole class, by whoever claims it first. What is already stored is never
  // written again, so a stop (or a classmate finishing first) just means fewer left to do.
  const startPractice = useCallback(async ({ noteId, title, subject }) => {
    const id = `${noteId}:p`;
    if (jobs.current.has(id)) return;
    const ideas = (await notes.ideasFor([noteId]))[noteId]?.ideas || [];
    if (!ideas.length) return;
    const key = practiceKey(classRef.current, noteId);
    const missing = missingIdeas(await store.get(key, true), ideas.length);
    if (!missing.length) return;
    const c = await claim(store, `${classRef.current}:claim:practice:${noteId}`, user);
    if (!c.won) return; // a classmate is already on it
    const batches = []; for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH).map((idx) => ({ idx, t: ideas[idx].t, d: ideas[idx].d })));
    const chunks = batches.map((b, i) => ({ i, section: "", text: `Questions for ideas ${b[0].idx + 1} to ${b[b.length - 1].idx + 1}`, batch: b }));
    const job = newJob({ id, noteId, title, chunks });
    jobs.current.set(id, { id, kind: "practice", title, subject, noteId, chunks, job });
    publish(); run(id);
  }, [user, publish]); // eslint-disable-line react-hooks/exhaustive-deps
  fns.current.startPractice = startPractice;
  const ensurePractice = useCallback((noteIds) => { noteIds.forEach((nid) => { const m = noteInfo(nid); if (m) startPractice({ noteId: nid, title: m.title, subject: m.subject }); }); }, [startPractice, noteInfo]);

  // One confirm: the raw input is saved first (pasted text as a note, a file as its untouched original), then reading begins.
  const start = useCallback(async ({ text, files, title, subject, topic, kind, taskId, taskTitle }) => {
    const ids = []; let ok = true; const T = (title || "").trim();
    const raw = String(text || "").trim();
    if (raw) { const r = await createNotes({ title: T || deriveTitle(raw), text: raw, subject, topic, kind, taskId, taskTitle }); ids.push(...r.ids); ok = ok && r.ok; if (!r.ok) return { ok, ids }; }
    for (const f of files || []) {
      const name = f.name.replace(/\.[^.]+$/, "");
      const ttl = (files.length === 1 && T ? T : name) || "Untitled notes";
      if (isPdf(f) || isImage(f)) {
        const id = uid();
        const file = await notes.uploadFile(classRef.current, id, f); // the original is saved FIRST and never changed
        const parts = isPdf(f) ? await pdfParts(f) : [{ from: 1, to: 1 }];
        const chunks = parts.map((p, i) => ({ i, section: "", text: isImage(f) ? "The photo" : cap(partLabel(p)) }));
        const job = newJob({ id, noteId: id, title: ttl, chunks });
        jobs.current.set(id, { id, kind: "file", title: ttl, subject, topic, noteId: id, noteKind: kind, taskId, taskTitle, file, noOriginal: !file, fileObj: f, isImage: isImage(f), parts, texts: {}, chunks, job });
        ids.push(id); save(); publish(); run(id);
      } else {
        try { const t = (await readText(f)).trim(); if (!t) throw new Error("empty"); const r = await createNotes({ title: ttl, text: t, subject, topic, kind, taskId, taskTitle, fileObj: f }); ids.push(...r.ids); ok = ok && r.ok; }
        catch { ok = false; }
      }
    }
    return { ok, ids };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback((id) => jobs.current.get(id)?.ctl?.abort(), []);
  const retry = useCallback((id) => run(id), [run]);
  const reprocess = useCallback((id) => { const e = jobs.current.get(id); if (e) run(id, coverage(e.job).missed.map((m) => m.i)); }, [run]);
  const dismiss = useCallback((id) => { jobs.current.delete(id); save(); publish(); }, [save, publish]);
  // a part that doesn't fit in one note moves, as it is, into a new note that is read on its own
  const moveRest = useCallback(async (id) => {
    const e = jobs.current.get(id); if (!e || e.kind !== "ideas") return;
    const full = e.job.chunks.filter((c) => c.status === "full");
    const text = full.map((c) => e.chunks[c.i].text).join("");
    const r = await createNotes({ title: `${e.title} (continued)`.slice(0, 120), text, subject: e.subject, topic: e.topic, kind: e.noteKind, taskId: e.taskId, taskTitle: e.taskTitle });
    if (!r.ok) return;
    full.forEach((c) => { c.status = "done"; c.moved = true; });
    e.job.covered = true; e.job.state = "done"; save(); publish();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const keepWhatWasRead = useCallback((id) => { const e = jobs.current.get(id); if (e?.kind === "file") finish(e); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the app was closed or the page reloaded: pick every unfinished job up where it stopped
  useEffect(() => {
    let dead = false;
    (async () => {
      let payload = await store.get(`u:${user}:ingest`, true);
      if (!payload) { try { payload = JSON.parse(localStorage.getItem(`hr:ingest:${user}`) || "null"); } catch { payload = null; } }
      for (const [id, s] of Object.entries(payload?.jobs || {})) {
        if (dead || !s.job || s.job.covered || jobs.current.has(id)) continue;
        if (s.kind === "ideas") {
          const text = (await notes.text([s.noteId]))[s.noteId];
          if (!text) continue; // the note was removed
          const chunks = makeChunks(text);
          jobs.current.set(id, { ...s, id, textLen: text.length, chunks, job: chunks.length === s.job.chunks.length ? s.job : newJob({ id, noteId: s.noteId, title: s.title, chunks }) });
        } else {
          const chunks = s.parts.map((p, i) => ({ i, section: "", text: s.isImage ? "The photo" : cap(partLabel(p)) }));
          jobs.current.set(id, { ...s, id, texts: s.texts || {}, chunks });
        }
      }
      if (dead) return;
      publish();
      for (const [id, e] of jobs.current) if (RESUME.has(e.job.state) && !e.ctl) run(id);
    })();
    return () => { dead = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => ({ jobs: view, start, startIdeas, ensurePractice, cancel, retry, reprocess, dismiss, moveRest, keepWhatWasRead }), [view, start, startIdeas, ensurePractice, cancel, retry, reprocess, dismiss, moveRest, keepWhatWasRead]);
}

// One note being read.
export function IngestCard({ item, ingest }) {
  const { job } = item;
  const p = progressOf(job), cov = coverage(job);
  const file = item.kind === "file", prac = item.kind === "practice";
  const stage = job.covered ? stageText(job) : item.running ? (item.waiting ? stageText(job, true) : file ? "Reading your file" : prac ? "Writing practice questions" : stageText(job)) : stageText(job);
  const needs = !job.covered && !item.running && (job.state === "attention" || job.state === "full");
  return (
    <section className="card ingest" aria-label={`Reading ${item.title}`}>
      <div className="ingest-head"><b className="ingest-title">{item.title}</b><span className="badge">{file ? "Your file" : prac ? "Practice" : "Study ideas"}</span></div>
      <Bar value={p.pct} label={`${item.title}: ${p.pct} percent`} />
      <p className="small"><b>{p.label}</b> &middot; {p.pct}%</p>
      <p className="small muted" role="status">{stage}</p>
      {item.noOriginal && <p className="small muted">We couldn&rsquo;t keep the original file, so this can&rsquo;t pick up again if you close Homeroom.</p>}
      {needs && (
        <div className="ingest-missed">
          <p className="small"><b>{cov.represented} of {cov.total} parts are in. These weren&rsquo;t:</b></p>
          <ul className="plain">{cov.missed.map((m) => <li key={m.i} className="small"><b>{m.label}</b>. {m.why}</li>)}</ul>
        </div>
      )}
      <div className="cluster">
        {item.running && <Button size="sm" onClick={() => ingest.cancel(item.id)}>Cancel</Button>}
        {!item.running && job.state === "cancelled" && <Button size="sm" variant="primary" onClick={() => ingest.retry(item.id)}>Continue</Button>}
        {!item.running && job.state === "paused" && <Button size="sm" variant="primary" onClick={() => ingest.retry(item.id)}>Try again</Button>}
        {needs && job.state === "attention" && <Button size="sm" variant="primary" onClick={() => ingest.reprocess(item.id)}>Read the missed {cov.missed.length === 1 ? "part" : "parts"} again</Button>}
        {needs && job.state === "attention" && file && <Button size="sm" onClick={() => ingest.keepWhatWasRead(item.id)}>Use what was read</Button>}
        {needs && job.state === "full" && <Button size="sm" variant="primary" onClick={() => ingest.moveRest(item.id)}>Put the rest in a new note</Button>}
        {!item.running && (job.covered || job.state === "cancelled") && <Button size="sm" variant="ghost" onClick={() => ingest.dismiss(item.id)}>{job.covered ? "Done" : "Not now"}</Button>}
      </div>
    </section>
  );
}

export function IngestList({ ingest, ids }) {
  const list = ingest.jobs.filter((j) => !ids || ids.includes(j.id));
  if (!list.length) return null;
  return <div className="stack ingest-list">{list.map((j) => <IngestCard key={j.id} item={j} ingest={ingest} />)}</div>;
}
