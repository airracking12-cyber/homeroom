// Notes and reviewers: the class's shared library, adding notes (files are read into editable text), editing details.
// Same rules as v33 (10 MB files, one original kept per single file, only the owner edits or removes).
import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Upload, FileText, NotebookPen, Sparkles, Search, ChevronRight, ChevronLeft, Download, Trash2, Pencil, X, Check, FileUp } from "lucide-react";
import { notes } from "../../lib/services.js";
import { subjColor } from "../../lib/constants.js";
import { timeAgo } from "../../lib/dates.js";
import { matchTopic, topicList } from "../../lib/notes.js";
import { useData } from "../data.jsx";
import { IngestList } from "../ingest.jsx";
import { groupBySubject, libraryStats, untopiced, fmtBytes, NO_TOPIC } from "../../lib/library.js";
import { parseReviewer } from "../../lib/reviewerDoc.js";
import { Sound } from "../../lib/sound.js";
import { Button, Chip, Segmented, Field, Banner, Empty, Sheet, Dots, cx } from "../ui.jsx";
import { SubjectPicker } from "../track/parts.jsx";

export const kindMeta = (m) => (m.kind === "ai" ? { label: "Assistant", Icon: Sparkles } : m.kind === "reviewer" ? { label: "Reviewer", Icon: NotebookPen } : { label: "Notes", Icon: FileText });

// A reviewer laid out properly: headings, term and meaning rows, short points. Plain text in, nothing dropped (lib/reviewerDoc.js).
export function ReviewerDoc({ text, live }) {
  const sections = useMemo(() => parseReviewer(text), [text]);
  if (!sections.length) return null;
  const titled = sections.length > 1 && sections[0].title && sections[0].items.length === 0;
  const body = titled ? sections.slice(1) : sections;
  return (
    <article className="doc" aria-busy={!!live}>
      {titled && <h2 className="doc-title">{sections[0].title}</h2>}
      {body.map((s, i) => (
        <section className="doc-sec" key={i}>
          {s.title && <h3>{s.title}</h3>}
          {s.items.map((it, j) => (it.type === "term" ? <div className="term" key={j}><b>{it.term}</b><span>{it.meaning}</span></div> : <p className={it.type === "point" ? "point" : undefined} key={j}>{it.text}</p>))}
        </section>
      ))}
    </article>
  );
}

// The text of a note is only downloaded when someone opens it.
export function NoteBody({ id, doc }) {
  const [t, setT] = useState(null);
  useEffect(() => { let dead = false; notes.text([id]).then((r) => { if (!dead) setT(r[id] ?? ""); }); return () => { dead = true; }; }, [id]);
  if (t === null) return <p className="muted" role="status">Opening<Dots /></p>;
  if (!t) return <Banner tone="warn">We couldn&rsquo;t open this note. Check your connection and try again.</Banner>;
  return doc ? <ReviewerDoc text={t} /> : <div className="note-text">{t}</div>;
}

const FILE_MAX = 10 * 1024 * 1024; // the largest file kept as an original
const TEXT_FILE = /\.(txt|md|csv|json)$/i;

// Add notes: paste or choose files, one confirm, done. The raw input is saved the moment you confirm; the assistant then reads it
// in parts in the background (progress cards below), and anything it can't read is listed with a one-tap way to try again.
export function AddNotesSheet({ open, onClose, materials, subjects, onAddSubject, fixedSubject, defaultSubject, defaultTopic, heading, seed, allowReviewer = true, taskId, taskTitle }) {
  const d = useData();
  const [text, setText] = useState("");
  const [subject, setSubject] = useState(fixedSubject || defaultSubject || "");
  const [topic, setTopic] = useState(defaultTopic || "");
  const [title, setTitle] = useState("");
  const [mine, setMine] = useState(false);          // "a reviewer I made"
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);         // null while editing; the ids of what was saved afterwards
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { if (open) { setSubject(fixedSubject || defaultSubject || ""); setTopic(defaultTopic || ""); } }, [open, fixedSubject, defaultSubject, defaultTopic]);
  const names = useMemo(() => topicList(materials, subject ? [subject] : []).map((x) => x.topic), [materials, subject]);
  const addFiles = (list) => {
    const picked = [...(list || [])]; if (!picked.length) return;
    const big = picked.filter((f) => f.size > FILE_MAX), okay = picked.filter((f) => f.size <= FILE_MAX);
    const odd = okay.filter((f) => !(/\.pdf$/i.test(f.name) || f.type === "application/pdf" || f.type.startsWith("image/") || TEXT_FILE.test(f.name) || f.type.startsWith("text/")));
    const good = okay.filter((f) => !odd.includes(f));
    setErr(big.length || odd.length ? `${[...big.map((f) => `${f.name} is over 10 MB`), ...odd.map((f) => `${f.name} isn't a PDF, photo or text file`)].join(". ")}. ${good.length ? "The others were added." : "Pick a smaller file, or paste the notes instead."}` : "");
    if (big.length || odd.length) Sound.play("err");
    setFiles((c) => [...c, ...good.filter((f) => !c.some((x) => x.name === f.name && x.size === f.size))]);
  };
  useEffect(() => { if (open && seed && seed.files && seed.files.length) addFiles(seed.files); }, [seed && seed.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const need = !text.trim() && !files.length ? "Add some notes first" : !subject ? "Pick a subject first" : "";
  const reset = () => { setText(""); setTitle(""); setTopic(""); setFiles([]); setMine(false); setSaved(null); setErr(""); setSaving(false); };
  const close = () => { if (!saving) { onClose(); setTimeout(reset, 250); } };
  const confirm = async (e) => {
    e?.preventDefault(); if (need || saving) return;
    setErr(""); setSaving(true);
    const r = await d.ingest.start({ text, files, title: title.trim(), subject, topic: matchTopic(topic, names), kind: mine ? "reviewer" : "upload", taskId, taskTitle });
    setSaving(false);
    if (r.ids.length) { setSaved(r.ids); Sound.play("pop"); }
    if (!r.ok) { setErr(r.ids.length ? "Some of that couldn't be saved. What was saved is below; add the rest again." : "We couldn't save those notes just now. Check your connection and try again."); Sound.play("err"); }
  };
  return (
    <Sheet open={open} onClose={close} title={heading || "Add notes"}>
      {saved ? (
        <div className="stack">
          <p className="muted small">Saved and shared with your class. You can close this: the assistant keeps reading in the background, and picks up again if you close Homeroom.</p>
          <IngestList ingest={d.ingest} ids={saved} />
          {err && <Banner tone="bad">{err}</Banner>}
          <div className="form-actions"><Button variant="primary" onClick={close}>Close</Button><Button onClick={reset}>Add more</Button></div>
        </div>
      ) : (
        <form className="stack" onSubmit={confirm}>
          <p className="muted small">Everyone in your class can read and study from what you add.</p>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.md,.csv,.json,text/plain" hidden onChange={(e) => { const l = [...(e.target.files || [])]; e.target.value = ""; addFiles(l); }} />
          <button type="button" className="dropzone" data-over={over ? 1 : undefined} disabled={saving} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer && e.dataTransfer.files); }}>
            <span className="glyph"><Upload size={20} aria-hidden="true" /></span>
            <span><b>Choose a PDF, photo or text file</b><span className="small muted" style={{ display: "block" }}>Up to 10 MB each. Your original is kept as it is. Or paste below.</span></span>
          </button>
          {files.length > 0 && <div className="cluster">{files.map((f, i) => <span key={`${f.name}${i}`} className="badge badge-ok"><Check size={12} aria-hidden="true" />{f.name} <span style={{ fontWeight: 400 }}>{fmtBytes(f.size)}</span><button type="button" className="chip-x" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X size={12} aria-hidden="true" /></button></span>)}</div>}
          <Field label="Notes" htmlFor="an-text"><textarea id="an-text" className="textarea" style={{ minHeight: 140 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your notes here" /></Field>
          {!fixedSubject && <Field label="Subject"><SubjectPicker subjects={subjects} value={subject} onChange={setSubject} onAdd={onAddSubject} /></Field>}
          <details className="more">
            <summary>Add a topic or title (optional)</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <Field label="Topic or lesson" htmlFor="an-topic" help="Left empty, Homeroom names the topic for you.">
                <input id="an-topic" className="input" value={topic} maxLength={60} onChange={(e) => setTopic(e.target.value)} placeholder="Photosynthesis" />
                {names.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{names.slice(0, 8).map((t) => <Chip key={t} on={topic.trim().toLowerCase() === t.toLowerCase()} onClick={() => setTopic(t)}>{t}</Chip>)}</div>}
              </Field>
              <Field label="Title" htmlFor="an-title"><input id="an-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson 2.1 key points" /></Field>
            </div>
          </details>
          {allowReviewer && <label className="check-row"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> <span>This is a reviewer I made myself</span></label>}
          {err && <Banner tone="bad">{err}</Banner>}
          <Button variant="primary" size="lg" block type="submit" disabled={!!need || saving}>{saving ? <>Saving<Dots /></> : need || "Share with class"}</Button>
        </form>
      )}
    </Sheet>
  );
}

export function EditNoteSheet({ note, materials, subjects, onAddSubject, onClose, onSave }) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (note) { setSubject(note.subject); setTopic(note.topic || ""); setTitle(note.title); setErr(""); } }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = useMemo(() => topicList(materials, subject ? [subject] : []), [materials, subject]);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const ok = await onSave({ subject, topic: matchTopic(topic, known.map((x) => x.topic)), title: title.trim() || note.title });
    setBusy(false);
    if (ok) onClose(); else { setErr("We couldn't change that just now. Only the person who added a note can edit it."); Sound.play("err"); }
  };
  return (
    <Sheet open={!!note} onClose={onClose} title="Edit details">
      <form className="stack" onSubmit={save}>
        <Field label="Subject"><SubjectPicker subjects={[...new Set([...subjects, ...(note ? [note.subject] : [])])]} value={subject} onChange={setSubject} onAdd={onAddSubject} /></Field>
        <Field label="Topic or lesson" htmlFor="en-topic">
          <input id="en-topic" className="input" value={topic} maxLength={60} onChange={(e) => setTopic(e.target.value)} placeholder="Photosynthesis" />
          {known.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{known.slice(0, 8).map((x) => <Chip key={x.topic} on={topic.trim().toLowerCase() === x.topic.toLowerCase()} onClick={() => setTopic(x.topic)}>{x.topic}</Chip>)}</div>}
        </Field>
        <Field label="Title" htmlFor="en-title"><input id="en-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
        {err && <Banner tone="bad">{err}</Banner>}
        <Button variant="primary" size="lg" block type="submit" disabled={busy || !subject}>{busy ? <>Saving<Dots /></> : "Save"}</Button>
      </form>
    </Sheet>
  );
}

export function NoteRow({ m, onOpen, subjectLabel }) {
  const { label, Icon } = kindMeta(m);
  return (
    <button type="button" className="row-btn" onClick={() => onOpen(m.id)}>
      <span className="note-ic" data-kind={m.kind}><Icon size={18} aria-hidden="true" /></span>
      <span className="grow">
        <span className="title">{m.title}</span>
        <span className="meta">{subjectLabel && <span><i className="dot" style={{ background: subjColor(m.subject) }} />{m.subject}</span>}{subjectLabel && m.topic && <span>{m.topic}</span>}<span>{label}</span><span>{m.mine ? "You" : m.by}</span><span>{timeAgo(m.at)}</span></span>
      </span>
      <span className={cx("badge", m.ic > 0 || m.kind === "ai" ? "badge-ok" : "")}>{m.kind === "ai" ? "Reviewer" : m.ic > 0 ? `${m.ic} ideas` : "Not read yet"}</span>
    </button>
  );
}

export function NoteSheet({ note, onClose, onStudy, onEdit, onRemove }) {
  const [dl, setDl] = useState(false);
  const download = async () => { if (!note.file || dl) return; setDl(true); const url = await notes.fileUrl(note.file.path); setDl(false); if (url) window.open(url, "_blank", "noopener"); else Sound.play("err"); };
  const owner = note && (note.mine || note.orphan);
  return (
    <Sheet open={!!note} onClose={onClose} title={note ? note.title : "Note"}>
      {note && (
        <div className="stack">
          <div className="cluster"><span className="badge"><i className="dot" style={{ background: subjColor(note.subject) }} />{note.subject}</span>{note.topic ? <span className="badge">{note.topic}</span> : <span className="badge badge-warn">No topic yet</span>}<span className="badge">{kindMeta(note).label}</span></div>
          <p className="muted small">Added by {note.mine ? "you" : note.by}, {timeAgo(note.at)}{note.ic > 0 ? `. ${note.ic} key ideas ready to study.` : note.kind === "ai" ? "." : ". Not read by the assistant yet."}</p>
          <div className="form-actions"><Button variant="primary" onClick={() => onStudy(note)}>Study this</Button>{owner && <Button onClick={() => onEdit(note)}><Pencil size={14} aria-hidden="true" />Edit details</Button>}{note.file && <Button onClick={download} disabled={dl}><Download size={14} aria-hidden="true" />{dl ? "Opening" : "Original"}</Button>}</div>
          <NoteBody id={note.id} doc={note.kind === "ai" || note.kind === "reviewer"} />
          {owner && <div><Button variant="ghost" size="sm" style={{ color: "var(--bad)" }} onClick={() => onRemove(note)}><Trash2 size={14} aria-hidden="true" />Remove these notes</Button></div>}
        </div>
      )}
    </Sheet>
  );
}

// The class library: every note and reviewer by subject and topic.
export function Library({ tasks, materials, subjects, onAddSubject, removeMaterial, relabelMaterial, onStudy, onReviewer, openId, setOpenId }) {
  const d = useData();
  const [subj, setSubj] = useState(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [scopeMine, setScopeMine] = useState("all");
  const [noTopic, setNoTopic] = useState(false);
  const [adding, setAdding] = useState(false);
  const [seed, setSeed] = useState(null);
  const [editing, setEditing] = useState(null);
  const [over, setOver] = useState(false);
  const s = q.trim();
  useEffect(() => {
    if (s.length < 2) { setHits(null); return undefined; }
    let dead = false;
    const id = setTimeout(async () => { const r = await notes.search(s, 50); if (!dead) setHits(r || []); }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [s]);
  const all = useMemo(() => materials.map((m) => { const t = tasks.find((x) => x.id === m.taskId); return { ...m, subject: m.subject || t?.subject || "Other", taskTitle: m.taskTitle || t?.title || "" }; }), [materials, tasks]);
  const base = scopeMine === "mine" ? all.filter((m) => m.mine) : all;
  const stats = useMemo(() => libraryStats(all), [all]);
  const groups = useMemo(() => groupBySubject(base), [base]);
  const lonely = useMemo(() => untopiced(all), [all]);
  const rank = new Map((hits || []).map((h, i) => [h.id, { snippet: h.snippet, i }]));
  const low = s.toLowerCase();
  const searching = !!s || noTopic;
  const flat = searching ? base.filter((m) => (noTopic ? !m.topic && m.kind !== "ai" : true)).filter((m) => !s || rank.has(m.id) || `${m.title} ${m.topic} ${m.subject}`.toLowerCase().includes(low))
    .sort((a, b) => (s && rank.has(a.id) && rank.has(b.id) ? rank.get(a.id).i - rank.get(b.id).i : b.at - a.at)) : [];
  const group = groups.find((g) => g.subject === subj) || null;
  const note = all.find((m) => m.id === openId) || null;
  const startAdd = () => { setSeed(null); setAdding(true); };
  const study = (o) => onStudy({ period: "final", ...o });
  const dropProps = {
    onDragOver: (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); const fl = [...(e.dataTransfer?.files || [])]; if (fl.length) { setSeed({ files: fl, id: uid() }); setAdding(true); } },
  };
  return (
    <div className="stack" data-over={over ? 1 : undefined} {...dropProps}>
      <div className="between wrap">
        <p className="muted small" style={{ maxWidth: "52ch" }}>{stats.notes ? `${stats.notes} notes, ${stats.subjects} subjects, ${stats.ideas} key ideas. Everything you review is built from these.` : "Everyone\u2019s notes and reviewers collect here."}</p>
        <Button variant="primary" data-tour="add-notes" onClick={startAdd}><Plus size={16} aria-hidden="true" />Add notes</Button>
      </div>
      <IngestList ingest={d.ingest} />
      <div className="toolbar">
        <label className="searchbox"><Search size={16} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a lesson: a word or topic" aria-label="Search the notes" type="search" />{q && <button type="button" aria-label="Clear search" onClick={() => setQ("")}><X size={16} /></button>}</label>
        <Segmented label="Whose notes" value={scopeMine} onChange={setScopeMine} options={[["all", "Everyone"], ["mine", "Mine"]]} />
      </div>
      {lonely.length > 0 && !searching && <Banner tone="warn" action={<Button size="sm" onClick={() => setNoTopic(true)}>Show them</Button>}>{lonely.length} {lonely.length === 1 ? "note has" : "notes have"} no topic yet, so Homeroom can&rsquo;t tell which lesson {lonely.length === 1 ? "it belongs" : "they belong"} to.</Banner>}
      {noTopic && <div className="cluster"><Button variant="ghost" size="sm" onClick={() => setNoTopic(false)}><ChevronLeft size={16} aria-hidden="true" />Back</Button><span className="muted small">Notes with no topic. Open one and choose Edit details to add it.</span></div>}
      {searching ? (
        <section aria-label="Search results">
          {s && <p className="muted small" style={{ marginBottom: 8 }} role="status">{flat.length} {flat.length === 1 ? "note matches" : "notes match"} &ldquo;{s}&rdquo;</p>}
          {flat.length === 0 ? <Empty icon={Search} title="Nothing matches">Try other words, or check the spelling.</Empty> : (
            <div className="card card-flat divided">{flat.map((m) => <div key={m.id}><NoteRow m={m} onOpen={setOpenId} subjectLabel />{rank.get(m.id)?.snippet && <p className="snip">{rank.get(m.id).snippet}</p>}</div>)}</div>
          )}
        </section>
      ) : group ? (
        <section className="stack" aria-label={group.subject}>
          <div><Button variant="ghost" size="sm" onClick={() => setSubj(null)}><ChevronLeft size={16} aria-hidden="true" />All subjects</Button></div>
          <div><h2 className="subj-h"><i className="dot big" style={{ background: subjColor(group.subject) }} />{group.subject}</h2><p className="muted small">{group.notes} {group.notes === 1 ? "note" : "notes"}, {group.ideas} key ideas, {group.people} {group.people === 1 ? "contributor" : "contributors"}</p></div>
          <div className="form-actions"><Button variant="primary" onClick={() => study({ subjects: [group.subject] })}>Study this subject</Button><Button onClick={() => onReviewer({ subject: group.subject, topics: [] })}><Sparkles size={14} aria-hidden="true" />Write a reviewer</Button><Button onClick={startAdd}><Plus size={14} aria-hidden="true" />Add notes here</Button></div>
          {group.topics.map((t) => (
            <div key={t.topic} className="stack" style={{ gap: 4 }}>
              <div className="between"><h3>{t.topic} <span className="caption">· {t.notes.length}</span></h3>{t.topic !== NO_TOPIC && <span className="cluster"><Button variant="ghost" size="sm" onClick={() => study({ subjects: [group.subject], topics: [t.topic] })}>Study</Button><Button variant="ghost" size="sm" onClick={() => onReviewer({ subject: group.subject, topics: [t.topic] })}>Reviewer</Button></span>}</div>
              {t.topic === NO_TOPIC && <p className="caption">Open a note and choose Edit details to give it a topic.</p>}
              <div className="card card-flat divided">{t.notes.map((m) => <NoteRow key={m.id} m={m} onOpen={setOpenId} />)}</div>
            </div>
          ))}
        </section>
      ) : groups.length === 0 ? (
        <Empty icon={FileUp} title={scopeMine === "mine" ? "You haven\u2019t added anything yet" : "The shelf is empty"} action={<Button variant="primary" data-tour="add-notes" onClick={startAdd}>Unpack the first notes</Button>}>{scopeMine === "mine" ? "Add your notes and your classmates can study from them too." : "Add notes and your class can review from them. Drop a PDF or photo here, or paste text."}</Empty>
      ) : (
        <section aria-label="Subjects">
          <h2 className="eyebrow" style={{ marginBottom: 8 }}>Subjects</h2>
          <div className="card card-flat divided">
            {groups.map((g) => { const real = g.topics.filter((t) => t.topic !== NO_TOPIC); return (
              <button key={g.subject} type="button" className="row-btn" onClick={() => setSubj(g.subject)}>
                <i className="dot big" style={{ background: subjColor(g.subject) }} />
                <span className="grow"><span className="title">{g.subject}</span><span className="meta"><span>{g.notes} {g.notes === 1 ? "note" : "notes"}</span><span>{real.length} {real.length === 1 ? "topic" : "topics"}</span>{real.length > 0 && <span>{real.slice(0, 3).map((t) => t.topic).join(", ")}</span>}</span></span>
                <ChevronRight size={18} aria-hidden="true" className="muted" />
              </button>
            ); })}
          </div>
        </section>
      )}
      <AddNotesSheet open={adding} onClose={() => setAdding(false)} materials={all} subjects={subjects} onAddSubject={onAddSubject} defaultSubject={group ? group.subject : ""} seed={seed} heading="Add notes" />
      <EditNoteSheet note={editing} materials={all} subjects={subjects} onAddSubject={onAddSubject} onClose={() => setEditing(null)} onSave={(patch) => relabelMaterial(editing.id, patch)} />
      <NoteSheet note={note} onClose={() => setOpenId(null)} onStudy={(m) => { setOpenId(null); study({ subjects: [m.subject], topics: m.topic ? [m.topic] : [] }); }} onEdit={(m) => { setOpenId(null); setEditing(m); }} onRemove={(m) => { setOpenId(null); removeMaterial(m.id); }} />
    </div>
  );
}

