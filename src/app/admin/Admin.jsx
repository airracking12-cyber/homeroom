// The admin's own small app: suggestions inbox, class quarters and join codes, the Minecraft list (when switched on).
// Data rules are the v33 ones; only the screens are new.
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Lightbulb, CircleAlert, GraduationCap, LogOut, Sun, Moon, Check, Trash2 } from "lucide-react";
import { supabase, store } from "../../lib/services.js";
import { QUARTERS } from "../../lib/constants.js";
import { timeAgo } from "../../lib/dates.js";
import { Sound } from "../../lib/sound.js";
import { MC_ON } from "../../minecraft.config.js";
import { Button, Segmented, Empty, Banner, Skeleton, cx } from "../ui.jsx";
import { Wordmark } from "../auth.jsx";

const MinecraftTab = import.meta.env.VITE_MC_ON === "true" ? lazy(() => import("./MinecraftTab.jsx")) : null;

function ClassCodeEditor({ code, onSave }) {
  const [v, setV] = useState(code);
  const [busy, setBusy] = useState(false);
  const make = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; setV(Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("")); };
  const go = async (next) => { setBusy(true); await onSave(next); setBusy(false); };
  return (
    <div className="stack" style={{ gap: 8, paddingTop: "var(--s-3)", borderTop: "1px solid var(--hairline)" }}>
      <p className="muted small">{code ? "New students must enter this code to join. People already in the class are not affected." : "Open: anyone can join. Add a code to make new students enter it first."}</p>
      <div className="row-inline" style={{ flexWrap: "wrap" }}>
        <input className="input" style={{ flex: "1 1 160px" }} value={v} maxLength={30} onChange={(e) => setV(e.target.value)} placeholder="Class code" aria-label="Class code" />
        <Button onClick={make} disabled={busy}>Make one</Button>
        <Button variant="primary" onClick={() => go(v)} disabled={busy || v.trim().length < 4 || v.trim() === code}>{code ? "Change" : "Set code"}</Button>
        {code && <Button variant="ghost" onClick={() => { setV(""); go(""); }} disabled={busy}>Open the class</Button>}
      </div>
    </div>
  );
}

export default function Admin({ theme, setTheme, onSignOut }) {
  const [tab, setTab] = useState("suggestions");
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const seen = useRef(null);
  const [adminClasses, setAdminClasses] = useState([]);
  const [qErr, setQErr] = useState("");
  useEffect(() => { store.classes.list().then(setAdminClasses); }, []);
  const [codes, setCodes] = useState({});
  const loadCodes = useCallback(async () => {
    const { data, error } = await supabase.rpc("class_codes_admin");
    if (!error) setCodes(Object.fromEntries((data || []).map((r) => [r.class_id, r.code])));
  }, []);
  useEffect(() => { if (tab === "classes") loadCodes(); }, [tab, loadCodes]);
  const saveCode = async (id, code) => {
    setQErr("");
    const { error } = await supabase.rpc("set_class_code", { cls: id, new_code: code });
    if (error) { setQErr("We couldn't save the code: " + error.message + " Try again."); return false; }
    Sound.play("add"); loadCodes(); store.classes.list().then(setAdminClasses); return true;
  };
  const setQuarter = async (id, q) => {
    setQErr(""); Sound.play("pop");
    setAdminClasses((c) => c.map((x) => (x.id === id ? { ...x, quarter: q } : x)));
    const { error } = await supabase.from("classes").update({ quarter: q }).eq("id", id);
    if (error) { setQErr("We couldn't change the quarter: " + error.message + " Try again."); store.classes.list().then(setAdminClasses); }
  };
  const load = useCallback(async () => {
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
    const inb = (data || []).map((r) => ({ id: r.id, at: Date.parse(r.created_at), read: r.read, type: r.type, from: r.from_user, text: r.text }));
    const unread = inb.filter((i) => !i.read).length;
    if (seen.current !== null && unread > seen.current) Sound.play("bell");
    seen.current = unread;
    setInbox(inb); setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const on = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    const id = setInterval(on, 30000);
    return () => { document.removeEventListener("visibilitychange", on); window.removeEventListener("focus", on); clearInterval(id); };
  }, [load]);
  const markRead = (id) => {
    setInbox((c) => c.map((i) => (id === "all" || i.id === id ? { ...i, read: true } : i)));
    (id === "all" ? supabase.from("feedback").update({ read: true }).eq("read", false) : supabase.from("feedback").update({ read: true }).eq("id", id)).then(() => {});
  };
  const dismiss = (id) => { Sound.play("undo"); setInbox((c) => c.filter((i) => i.id !== id)); supabase.from("feedback").delete().eq("id", id).then(() => {}); };
  const unread = inbox.filter((i) => !i.read).length;
  const list = [...inbox].sort((a, b) => b.at - a.at).filter((i) => filter === "all" || (filter === "unread" ? !i.read : i.type === filter));
  const count = (f) => inbox.filter((i) => (f === "unread" ? !i.read : i.type === f)).length;
  const dark = theme === "dark" || (theme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const tabs = [["suggestions", `Suggestions${unread ? ` (${unread})` : ""}`], ["classes", "Classes"], ...(MC_ON ? [["minecraft", "Minecraft"]] : [])];
  return (
    <div className="page">
      <a className="skip" href="#admin-main">Skip to content</a>
      <header className="page-head">
        <div><Wordmark /><h1 style={{ marginTop: 8 }}>Admin</h1><p className="lede">Read what students send, and look after the classes.</p></div>
        <div className="cluster"><Button size="sm" onClick={() => { Sound.play("pop"); setTheme(dark ? "light" : "dark"); }}>{dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}{dark ? "Light mode" : "Dark mode"}</Button><Button size="sm" onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Sign out</Button></div>
      </header>
      <div className="subnav"><Segmented label="Admin sections" full value={tab} options={tabs} onChange={(v) => { Sound.play("tap"); setTab(v); }} /></div>
      <main id="admin-main" tabIndex={-1} className="stack-lg" style={{ outline: "none" }}>
        {tab === "suggestions" && (
          <section className="stack" aria-label="Suggestions">
            <div className="between wrap"><Segmented label="Show" value={filter} onChange={setFilter} options={[["all", `All${inbox.length ? ` (${inbox.length})` : ""}`], ["unread", `Unread${count("unread") ? ` (${count("unread")})` : ""}`], ["request", "Ideas"], ["problem", "Problems"]]} />
              {unread > 0 && <Button size="sm" onClick={() => markRead("all")}><Check size={15} aria-hidden="true" />Mark all read</Button>}</div>
            {loading && <Skeleton rows={3} h={84} />}
            {!loading && list.length === 0 && <Empty icon={Lightbulb} title={inbox.length ? "Nothing in this view" : "No suggestions yet"}>{inbox.length ? "Try another filter." : "When someone sends an idea or reports a problem, it shows up here."}</Empty>}
            {list.map((i) => (
              <article className={cx("card sug stack", !i.read && "unread")} style={{ gap: 8 }} key={i.id}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div className="cluster">{i.type === "problem" ? <span className="badge badge-bad"><CircleAlert size={13} aria-hidden="true" />Problem</span> : <span className="badge badge-accent"><Lightbulb size={13} aria-hidden="true" />Idea</span>}<span className="small"><b>{i.from}</b></span><span className="caption">{timeAgo(i.at)}</span>{!i.read && <span className="badge badge-info">New</span>}</div>
                </div>
                <p style={{ whiteSpace: "pre-wrap" }}>{i.text}</p>
                <div className="cluster">{!i.read && <Button size="sm" onClick={() => markRead(i.id)}>Mark read</Button>}<Button size="sm" variant="ghost" onClick={() => dismiss(i.id)} style={{ color: "var(--bad)" }}><Trash2 size={14} aria-hidden="true" />Delete</Button></div>
              </article>
            ))}
          </section>
        )}
        {tab === "classes" && (
          <section className="stack" aria-label="Classes">
            <p className="muted small" style={{ maxWidth: "60ch" }}>Choose which quarter each class is in. New tasks start in that quarter, and the Done view and Minecraft access look at it.</p>
            {qErr && <Banner tone="bad">{qErr}</Banner>}
            {adminClasses.length === 0 && <Empty icon={GraduationCap} title="No classes yet">Classes appear here when students create them.</Empty>}
            <div className="grid-cards">
              {adminClasses.map((c) => (
                <article className="card stack" style={{ gap: 12 }} key={c.id}>
                  <div className="between wrap"><div><h2 style={{ fontSize: "var(--fs-h2)" }}>{c.label}</h2><p className="muted small">Currently in quarter {c.quarter || 1}</p></div>
                    <Segmented label={`Quarter for ${c.label}`} value={String(c.quarter || 1)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => setQuarter(c.id, Number(v))} /></div>
                  <ClassCodeEditor key={c.id + ":" + (codes[c.id] || "")} code={codes[c.id] || ""} onSave={(v) => saveCode(c.id, v)} />
                </article>
              ))}
            </div>
          </section>
        )}
        {MC_ON && tab === "minecraft" && <Suspense fallback={<Skeleton rows={3} />}><MinecraftTab /></Suspense>}
      </main>
    </div>
  );
}
