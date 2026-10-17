// Class: your classmates and your study groups. The seat map shows who is online and how their week is going (the same
// rules as v33); tap a classmate who is online to start a temporary chat.
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, Users, MessageCircle } from "lucide-react";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { weekStatus, WEEK_LABEL } from "../../lib/hooks.js";
import { subjColor, QUARTERS } from "../../lib/constants.js";
import { Sound } from "../../lib/sound.js";
import { Button, Chip, Segmented, Field, Empty, Bar, cx } from "../ui.jsx";
import { SubjectPicker } from "../track/parts.jsx";

const ST_WORD = { complete: "Complete", almost: "Almost there", starting: "Starting", nothing: "Nothing yet" };

function SeatMap({ me, cabin, tasks, completions, groups, subjects, onChat }) {
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem("hr:cabin") === "3" ? 3 : 2; } catch { return 2; } });
  const [filter, setFilter] = useState("all");
  const [pick, setPick] = useState(null);
  const setLay = (n) => { setLayout(Number(n)); Sound.play("tap"); try { localStorage.setItem("hr:cabin", String(n)); } catch { /* storage blocked */ } };
  const names = useMemo(() => [me, ...cabin.roster.filter((n) => n !== me)], [me, cabin.roster]);
  // groupmates: people who are in at least one group with me, and the subjects of those groups
  const shared = useMemo(() => {
    const out = {};
    groups.filter((g) => (g.members || []).includes(me)).forEach((g) => (g.members || []).forEach((m) => { if (m !== me) (out[m] = out[m] || new Set()).add(g.subject); }));
    return out;
  }, [groups, me]);
  const mateCount = (s) => Object.values(shared).filter((set) => set.has(s)).length;
  const myGroups = groups.filter((g) => (g.members || []).includes(me)).length;
  const isOn = (n) => n === me || cabin.online.has(n);
  const perRow = layout * 2;
  const who = pick && names.includes(pick) ? pick : me;
  const whoSt = weekStatus(who, tasks, completions);
  const whoShared = shared[who];
  const onlineCount = names.filter(isOn).length;
  const filterSubjects = [...new Set(groups.filter((g) => (g.members || []).includes(me)).map((g) => g.subject))];
  return (
    <section className="stack" aria-label="Your class">
      <div className="between wrap">
        <p className="muted small" aria-live="polite"><span className={cx("live", cabin.live && "on")} aria-hidden="true" />{cabin.live ? `${onlineCount} of ${names.length} online now` : "Not connected right now. Online status will return when you are."}</p>
        <Segmented label="Seat layout" value={String(layout)} options={[["2", "2 + 2"], ["3", "3 + 3"]]} onChange={setLay} />
      </div>
      {filterSubjects.length > 0 && (
        <div className="chips" role="group" aria-label="Highlight groupmates by subject">
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>Everyone</Chip>
          {filterSubjects.map((s) => <Chip key={s} on={filter === s} onClick={() => setFilter(s)}><i className="dot" style={{ background: subjColor(s) }} />{s} <span className="caption" style={{ color: "inherit" }}>{mateCount(s)}</span></Chip>)}
        </div>
      )}
      <div className="seatmap" style={{ "--per": perRow, "--side": layout }} role="group" aria-label="Seat map of your class">
        {names.flatMap((n, i) => [
          ...(i % perRow === layout ? [<span key={`a${i}`} className="aisle" aria-hidden="true" />] : []),
          (() => {
          const on = isOn(n), st = weekStatus(n, tasks, completions), sh = shared[n];
          const hit = !!sh && (filter === "all" || sh.has(filter));
          const dim = n !== me && filter !== "all" && !hit;
          const label = `${n}${n === me ? " (you)" : ""}, ${on ? "online" : "offline"}, ${WEEK_LABEL[st.key]}${n !== me && on ? ". Open a chat" : ""}`;
          return (
            <button key={n} type="button" className="seat" data-on={on ? 1 : 0} data-me={n === me ? 1 : 0} data-dim={dim ? 1 : 0} data-st={st.key} data-ping={cabin.unread[n] ? 1 : 0} aria-label={label} aria-pressed={who === n}
              onMouseEnter={() => setPick(n)} onFocus={() => setPick(n)} onClick={() => { setPick(n); if (n !== me && on) { Sound.play("pop"); onChat(n); } else Sound.play("tap"); }}>
              <span className="seat-name">{n}</span>
              <span className="seat-meta"><i className="st-dot" aria-hidden="true" />{on && <i className="on-dot" aria-hidden="true" />}{sh && [...sh].slice(0, 3).map((s) => <i key={s} className="sub-dot" style={{ background: subjColor(s) }} aria-hidden="true" />)}</span>
            </button>
          );
          })(),
        ])}
      </div>
      <div className="legend" aria-hidden="true">{Object.entries(ST_WORD).map(([k, l]) => <span key={k} data-st={k}><i className="st-dot" />{l}</span>)}<span><i className="on-dot" />Online</span></div>
      <div className="card who" key={who}>
        <div className="between"><div><b className="who-name">{who}{who === me && " (you)"}</b><p className="muted small">{whoSt.total ? `${whoSt.done} of ${whoSt.total} done this week` : "No tasks due this week"}</p></div>
          {who !== me && isOn(who) && <Button variant="primary" size="sm" onClick={() => { Sound.play("pop"); onChat(who); }}><MessageCircle size={15} aria-hidden="true" />Message</Button>}</div>
        <div className="cluster" style={{ marginTop: 10 }}><span className="badge"><i className="dot" style={{ background: isOn(who) ? "var(--ok)" : "var(--faint)" }} />{isOn(who) ? "Online" : "Offline"}</span><span className="badge">{ST_WORD[whoSt.key]}</span>{whoShared && [...whoShared].map((s) => <span key={s} className="badge"><i className="dot" style={{ background: subjColor(s) }} />{s}</span>)}</div>
      </div>
      {myGroups === 0 && <p className="caption">Join a group in the Groups section and your groupmates will show their subject colour here.</p>}
    </section>
  );
}

function Groups({ groups, tasks, progress, subjects, defQuarter, onSave, onDelete, user, onJoin, onAddSubject }) {
  const [edit, setEdit] = useState(null); // null = the list, {} = a new group, a group = editing it
  const [confirm, setConfirm] = useState(null);
  const [f, setF] = useState({ name: "", subject: "", quarter: defQuarter });
  const open = (g) => { setConfirm(null); setF(g ? { name: g.name, subject: g.subject, quarter: g.quarter } : { name: "", subject: "", quarter: defQuarter }); setEdit(g || {}); };
  const save = (e) => { e.preventDefault(); onSave({ ...(edit.id ? edit : {}), name: f.name.trim(), subject: f.subject.trim(), quarter: f.quarter }, !!edit.id); setEdit(null); };
  if (edit) {
    return (
      <form className="stack" onSubmit={save} style={{ maxWidth: 560 }}>
        <div><Button variant="ghost" size="sm" onClick={() => setEdit(null)}><ChevronLeft size={16} aria-hidden="true" />Groups</Button></div>
        <h2>{edit.id ? "Edit group" : "New group"}</h2>
        <Field label="Group name" htmlFor="g-name"><input id="g-name" className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Chapter 4: Linear equations" /></Field>
        <Field label="Subject"><SubjectPicker subjects={subjects} value={f.subject} onChange={(v) => setF({ ...f, subject: v })} onAdd={onAddSubject} /></Field>
        <Field label="Quarter"><Segmented label="Quarter" value={String(f.quarter)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => setF({ ...f, quarter: Number(v) })} /></Field>
        <div className="form-actions"><Button variant="primary" size="lg" type="submit" disabled={!f.name.trim() || !f.subject.trim()}>{edit.id ? "Save changes" : "Create group"}</Button><Button variant="ghost" size="lg" onClick={() => setEdit(null)}>Cancel</Button></div>
      </form>
    );
  }
  const byQ = QUARTERS.map((q) => [q, groups.filter((g) => g.quarter === q).sort((a, b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))]).filter(([, l]) => l.length);
  return (
    <section className="stack-lg" aria-label="Study groups">
      <div className="between wrap">
        <p className="muted small" style={{ maxWidth: "56ch" }}>A group holds the tasks for one topic in one subject and quarter, like &ldquo;Math Q2: Chapter 4&rdquo;. Everyone in the class sees them.</p>
        <Button variant="primary" onClick={() => open(null)}><Plus size={16} aria-hidden="true" />New group</Button>
      </div>
      {byQ.length === 0 && <Empty icon={Users} title="No groups yet" action={<Button variant="primary" onClick={() => open(null)}>Make the first group</Button>}>Make one, then pick it when you add a task.</Empty>}
      {byQ.map(([q, list]) => (
        <section key={q} aria-label={`Quarter ${q}`}>
          <h2 className="group-h">Quarter {q}<span className="badge">{list.length}</span></h2>
          <div className="grid-cards">
            {list.map((g) => {
              const all = tasks.filter((t) => t.groupId === g.id);
              const done = all.filter((t) => progress[t.id] === "done").length;
              const mem = g.members || [], mine = mem.includes(user);
              return (
                <article className="card stack" style={{ gap: 12 }} key={g.id}>
                  <div className="between" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}><h3>{g.name}</h3><p className="meta"><span><i className="dot" style={{ background: subjColor(g.subject) }} />{g.subject}</span><span>{done} of {all.length} done</span></p></div>
                    <div className="cluster" style={{ flex: "none", gap: 0 }}>
                      <Button variant="ghost" icon aria-label={`Edit ${g.name}`} onClick={() => open(g)}><Pencil size={16} /></Button>
                      <Button variant="ghost" icon={confirm !== g.id} aria-label={confirm === g.id ? `Confirm delete ${g.name}` : `Delete ${g.name}`} style={confirm === g.id ? { color: "var(--bad)" } : undefined} onClick={() => { if (confirm === g.id) { onDelete(g.id); setConfirm(null); } else setConfirm(g.id); }}>{confirm === g.id ? "Tap again" : <Trash2 size={16} />}</Button>
                    </div>
                  </div>
                  <Bar value={all.length ? (done / all.length) * 100 : 0} label={`${g.name} progress`} />
                  <div className="between wrap"><span className="muted small">{mem.length ? `${mem.length} in this group: ${mem.slice(0, 4).join(", ")}${mem.length > 4 ? ` and ${mem.length - 4} more` : ""}` : "Nobody has joined yet"}</span>
                    <Button size="sm" aria-pressed={mine} onClick={() => { Sound.play(mine ? "undo" : "pop"); onJoin(g.id, !mine); }}>{mine ? "Leave" : "Join"}</Button></div>
                  {confirm === g.id && <p className="caption">Its tasks stay, they just lose the group.</p>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

export default function ClassScreen() {
  const d = useData();
  const { route, go, cabin, openChat } = useShell();
  const sec = route.parts[0] === "groups" ? "groups" : "mates";
  return (
    <div className="page">
      <header className="page-head"><div><h1>Class</h1><p className="lede">See who is around, and organise study groups.</p></div></header>
      <div className="subnav"><Segmented label="Class sections" full value={sec} options={[["mates", "Classmates"], ["groups", "Groups"]]} onChange={(v) => go("class", v === "mates" ? "" : v)} /></div>
      {sec === "mates"
        ? <SeatMap me={d.user} cabin={cabin} tasks={d.tasks} completions={d.completions} groups={d.groups} subjects={d.subjects} onChat={openChat} />
        : <Groups groups={d.groups} tasks={d.tasks} progress={d.progress} subjects={d.subjects} defQuarter={d.defQuarter} onSave={d.saveGroup} onDelete={d.deleteGroup} user={d.user} onJoin={d.joinGroup} onAddSubject={d.setSubject} />}
    </div>
  );
}
