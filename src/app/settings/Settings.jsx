// Settings: everything about you and the class that you rarely need, in one calm place. Nothing here is a daily action.
import { useState, lazy, Suspense } from "react";
import { ChevronRight, ChevronDown, Download, LogOut, Trash2, MessageSquare, Play, Users, Palette, Volume2, Gamepad2, Keyboard, Info } from "lucide-react";
import { supabase, notes } from "../../lib/services.js";
import { subjColor, SWATCHES } from "../../lib/constants.js";
import { toISO } from "../../lib/dates.js";
import { Sound } from "../../lib/sound.js";
import { MC_ON } from "../../minecraft.config.js";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { Button, Segmented, Field, Sheet, Dots, useToast } from "../ui.jsx";
import { Wordmark } from "../auth.jsx";

// the Minecraft panel is its own download, and only exists in the build while the feature is switched on
const MinecraftPanel = import.meta.env.VITE_MC_ON === "true" ? lazy(() => import("./MinecraftPanel.jsx")) : null;

function SubjectsPanel({ subjects, onSet }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[1]);
  const n = name.trim().slice(0, 40);
  const taken = subjects.some((x) => x.toLowerCase() === n.toLowerCase());
  return (
    <div className="stack">
      <p className="muted small">Subjects and their colours are shared with your class. Anything you add to a task shows up here by itself.</p>
      <div className="card card-flat divided">
        {subjects.map((x) => (
          <div key={x}>
            <button type="button" className="row-btn" aria-expanded={open === x} onClick={() => setOpen(open === x ? null : x)}><i className="dot big" style={{ background: subjColor(x) }} /><span className="grow"><span className="title">{x}</span></span><ChevronDown size={16} className="muted" aria-hidden="true" style={{ transform: open === x ? "rotate(180deg)" : "none" }} /></button>
            {open === x && <div className="swatches" role="radiogroup" aria-label={`Colour for ${x}`} style={{ padding: "0 var(--s-4) var(--s-3)" }}>{SWATCHES.map((c, i) => <button key={c} type="button" className="sw" role="radio" aria-checked={subjColor(x) === c} aria-label={`Colour ${i + 1}`} style={{ "--sw": c }} onClick={() => { Sound.play("pop"); onSet({ name: x, color: c }); }} />)}</div>}
          </div>
        ))}
      </div>
      <Field label="Add a subject" htmlFor="sp-name" error={taken ? "That subject is already on the list." : undefined}>
        <input id="sp-name" className="input" value={name} maxLength={40} placeholder="Science" onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="swatches" role="radiogroup" aria-label="Colour for the new subject">{SWATCHES.map((c, i) => <button key={c} type="button" className="sw" role="radio" aria-checked={color === c} aria-label={`Colour ${i + 1}`} style={{ "--sw": c }} onClick={() => setColor(c)} />)}</div>
      <div><Button variant="primary" disabled={!n || taken} onClick={() => { onSet({ name: n, color }); setName(""); Sound.play("add"); }}>Add subject</Button></div>
    </div>
  );
}

function FeedbackForm({ onSend, onClose }) {
  const [kind, setKind] = useState("request");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) return <div className="center-col" style={{ padding: "var(--s-6) 0" }}><span className="glyph-ok"><Check size={26} strokeWidth={3} aria-hidden="true" /></span><h3 className="display" style={{ fontSize: "var(--fs-h2)", fontWeight: 400 }}>Sent</h3><p className="muted">Thank you. The admin will read it.</p><Button onClick={onClose}>Done</Button></div>;
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSend(kind, text.trim()); Sound.play("add"); setSent(true); }}>
      <Segmented label="What kind" full value={kind} onChange={setKind} options={[["request", "A suggestion"], ["problem", "Something\u2019s wrong"]]} />
      <Field label={kind === "problem" ? "What happened?" : "What would make this better?"} htmlFor="fb-text"><textarea id="fb-text" className="textarea" style={{ minHeight: 140 }} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <Button variant="primary" size="lg" type="submit" disabled={!text.trim() || busy}>{busy ? <>Sending<Dots /></> : "Send it"}</Button>
    </form>
  );
}

function DeleteAccount({ user, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { setBusy(false); setErr("We couldn't delete the account: " + error.message + " Try again in a moment."); return; }
    onDeleted();
  };
  return (
    <div className="stack">
      <p className="muted">This permanently deletes your account and your saved progress. Tasks you added stay for the class. This can&rsquo;t be undone.</p>
      <Field label={`Type your username (${user}) to confirm`} htmlFor="del-name" error={err || undefined}><input id="del-name" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" /></Field>
      <div className="form-actions"><Button variant="danger" size="lg" disabled={typed.trim() !== user || busy} onClick={go}>{busy ? <>Deleting<Dots /></> : "Delete my account"}</Button><Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button></div>
    </div>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <section className="stack" style={{ gap: 8 }} aria-label={title}>
      <h2 className="group-h" style={{ margin: 0 }}><Icon size={16} aria-hidden="true" />{title}</h2>
      <div className="card card-flat divided">{children}</div>
    </section>
  );
}
const Row = ({ title, hint, children }) => <div className="set-row"><div className="grow"><p className="title">{title}</p>{hint && <p className="caption">{hint}</p>}</div><div className="set-ctl">{children}</div></div>;
const Action = ({ icon: Icon, title, hint, onClick, danger }) => (
  <button type="button" className="row-btn" onClick={onClick}><Icon size={18} aria-hidden="true" className={danger ? undefined : "muted"} style={danger ? { color: "var(--bad)" } : undefined} /><span className="grow"><span className="title" style={danger ? { color: "var(--bad)" } : undefined}>{title}</span>{hint && <span className="caption" style={{ display: "block" }}>{hint}</span>}</span><ChevronRight size={16} className="muted" aria-hidden="true" /></button>
);

export default function Settings({ appearance, onSignOut, onChangeClass, onReplayTour, onDeleted }) {
  const d = useData();
  const toast = useToast();
  const { openHelp } = useShell();
  const { theme, setTheme, audio, setAudio, toggleMusic } = appearance;
  const [sub, setSub] = useState(null); // subjects | feedback | delete | minecraft

  const exportMyData = async () => {
    try {
      const mine = d.materials.filter((m) => m.mine);
      const bodies = await notes.text(mine.map((m) => m.id));
      const data = {
        app: "homeroom", schema: 1, exportedAt: new Date().toISOString(), user: d.user, class: d.classLabel,
        tasks: d.tasks.map((t) => ({ title: t.title, subject: t.subject, type: t.type, priority: t.priority, quarter: t.quarter || null, deadline: t.deadline, notes: t.notes || "", myStatus: d.progress[t.id] || "todo" })),
        myNotes: mine.map((m) => ({ title: m.title, subject: m.subject, topic: m.topic, taskId: m.taskId, text: bodies[m.id] || "" })),
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `homeroom-${toISO(new Date())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Saved a copy of your tasks and notes");
    } catch (err) {
      console.warn("[Homeroom] export failed:", err);
      toast("We couldn't save a copy just now. Try again in a moment.");
    }
  };

  return (
    <div className="page">
      <header className="page-head"><div><h1>Settings</h1><p className="lede">Signed in as <b>{d.user}</b>{d.classLabel ? `, class ${d.classLabel}` : ""}.</p></div></header>
      <div className="set-cols">
      <div className="stack-lg">
        <Group icon={Palette} title="Look">
          <Row title="Appearance" hint="Auto follows your device."><Segmented label="Appearance" value={theme} onChange={setTheme} options={[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]} /></Row>
        </Group>
        <Group icon={Volume2} title="Sound">
          <Row title="Sound effects"><Segmented label="Sound effects" value={audio.sfx ? "on" : "off"} onChange={(v) => { setAudio((a) => ({ ...a, sfx: v === "on" })); if (v === "on") { Sound.setSfx(true); Sound.play("pop"); } }} options={[["on", "On"], ["off", "Off"]]} /></Row>
          <Row title="Background music" hint="Quiet, and off by default."><Segmented label="Background music" value={audio.music ? "on" : "off"} onChange={(v) => { if ((v === "on") !== audio.music) toggleMusic(); }} options={[["on", "On"], ["off", "Off"]]} /></Row>
          <div className="set-row"><label className="grow title" htmlFor="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.05" value={audio.vol} className="range" onChange={(e) => { const v = Number(e.target.value); setAudio((a) => ({ ...a, vol: v })); Sound.setVolume(v); }} /></div>
        </Group>
        <Group icon={Users} title="Your class">
          <Action icon={Users} title={`Class ${d.classLabel || ""}`} hint="Switch to a different class" onClick={onChangeClass} />
          <Action icon={ChevronDown} title="Subjects and colours" hint="Shared with your class" onClick={() => setSub("subjects")} />
          {MC_ON && <Action icon={Gamepad2} title="Minecraft server" onClick={() => setSub("minecraft")} />}
        </Group>
      </div>
      <div className="stack-lg">
        <Group icon={Info} title="Help">
          <Action icon={Play} title="Replay Move-In Day" hint="Unbox your room again, one piece at a time" onClick={onReplayTour} />
          <Action icon={Keyboard} title="Keyboard shortcuts" hint="For laptops and desktops" onClick={openHelp} />
          <Action icon={MessageSquare} title="Send a suggestion or report a problem" onClick={() => setSub("feedback")} />
        </Group>
        <Group icon={Download} title="Your account">
          <Action icon={Download} title="Download a copy of my data" hint="Your tasks and your notes, as a file" onClick={exportMyData} />
          <Action icon={LogOut} title="Sign out" onClick={onSignOut} />
          <Action icon={Trash2} title="Delete my account" hint="This can't be undone" danger onClick={() => setSub("delete")} />
        </Group>
        <section className="card about stack" style={{ gap: 8 }} aria-label="About Homeroom">
          <Wordmark />
          <p><b>About Homeroom.</b> Designed, built and maintained by one person, Nathaniel Visaya, for students and their classmates.</p>
          <p className="muted small">Shared class tracker. Review tools. Long-term exam prep. Thank you for using it.</p>
        </section>
      </div>
      </div>
      <Sheet open={sub === "subjects"} onClose={() => setSub(null)} title="Subjects and colours">{sub === "subjects" && <SubjectsPanel subjects={d.subjects} onSet={d.setSubject} />}</Sheet>
      <Sheet open={sub === "feedback"} onClose={() => setSub(null)} title="Send a suggestion">{sub === "feedback" && <FeedbackForm onSend={d.sendFeedback} onClose={() => setSub(null)} />}</Sheet>
      <Sheet open={sub === "delete"} onClose={() => setSub(null)} title="Delete account" modal>{sub === "delete" && <DeleteAccount user={d.user} onClose={() => setSub(null)} onDeleted={onDeleted} />}</Sheet>
      {MC_ON && <Sheet open={sub === "minecraft"} onClose={() => setSub(null)} title="Minecraft server">{sub === "minecraft" && <Suspense fallback={<p className="muted" role="status">Loading<Dots /></p>}><MinecraftPanel /></Suspense>}</Sheet>}
    </div>
  );
}
