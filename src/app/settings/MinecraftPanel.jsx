// The Minecraft server panel in Settings. It is a separate download, and only part of the build while MC_ON is true (see
// minecraft.config.js), so students never fetch it while the feature is off. Behaviour is unchanged.
import { useState, useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { supabase } from "../../lib/services.js";
import { copyText } from "../../lib/helpers.js";
import { Sound } from "../../lib/sound.js";
import { MINECRAFT } from "../../minecraft.config.js";
import { useData } from "../data.jsx";
import { Button, Field, Dots } from "../ui.jsx";

function CopyLine({ label, value }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="stack" style={{ gap: 4 }}>
      <p className="caption">{label}</p>
      <div className="row-inline"><code className="code">{value}</code><Button size="sm" onClick={async () => { if (await copyText(value)) { setOk(true); Sound.play("pop"); setTimeout(() => setOk(false), 1600); } }}>{ok ? <><Check size={14} aria-hidden="true" />Copied</> : <><Copy size={14} aria-hidden="true" />Copy</>}</Button></div>
    </div>
  );
}

function MinecraftView({ done, total, linked, onLink, onUnlink }) {
  const allDone = total > 0 && done === total;
  const [name, setName] = useState(linked || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  const save = async () => { if (!valid || busy) return; setBusy(true); setErr(""); const e = await onLink(name.trim()); setBusy(false); if (e) { setErr(e); Sound.play("err"); } else Sound.play("add"); };
  if (!allDone) return <div className="stack"><h3 className="display" style={{ fontSize: "var(--fs-h2)", fontWeight: 400 }}>{linked ? "Access is paused" : "Almost there"}</h3><p className="muted">{total === 0 ? "There are no tasks yet." : `${total - done} of ${total} tasks are still open.`} Finish every task in your class&rsquo;s quarter and you can join the Minecraft server{linked ? ` as ${linked}` : ""}.</p></div>;
  return (
    <div className="stack">
      <h3 className="display" style={{ fontSize: "var(--fs-h2)", fontWeight: 400 }}>Congratulations on completing every task!</h3>
      <Field label={linked ? "Your Minecraft username" : "Enter your username to be able to join the Minecraft server"} htmlFor="mc-name" error={err || (name && !valid ? "3 to 16 letters, numbers or underscores." : undefined)}>
        <input id="mc-name" className="input" value={name} maxLength={16} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      </Field>
      <div><Button variant="primary" disabled={!valid || busy || (linked && name.trim() === linked)} onClick={save}>{busy ? <>Saving<Dots /></> : linked ? "Change username" : "Unlock server access"}</Button></div>
      {linked && <p className="muted small">You&rsquo;re in, <b>{linked}</b>. Join with the address below.</p>}
      <div className="card card-ink stack" style={{ gap: 12 }}>
        <p className="caption">{MINECRAFT.version}</p>
        <CopyLine label="Java address, for IPv6" value={MINECRAFT.ipv6} />
        <CopyLine label="If that doesn't work" value={MINECRAFT.host} />
        <p className="caption">If none work, change your IPv4 DNS settings: main <b>{MINECRAFT.dns.main}</b>, alt <b>{MINECRAFT.dns.alt}</b>.</p>
      </div>
      {linked && <div><Button variant="ghost" size="sm" onClick={onUnlink}>Unlink this username</Button></div>}
    </div>
  );
}

export default function MinecraftPanel() {
  const d = useData();
  const [mcName, setMcName] = useState(undefined);   // undefined = still asking, null = not linked yet
  const tasks = d.tasks.filter((t) => (t.quarter || 1) === d.classQuarter);
  const done = tasks.filter((t) => d.progress[t.id] === "done").length;
  useEffect(() => {
    if (d.user && d.classId && !d.isAdmin) supabase.rpc("my_minecraft").then(({ data }) => setMcName(data || null));
    else setMcName(null);
  }, [d.user, d.classId, d.isAdmin]);
  const link = async (n) => {
    const { error } = await supabase.rpc("link_minecraft", { p_name: n });
    if (error) return /duplicate|unique/i.test(error.message) ? "That Minecraft name is already linked to another student." : /bad minecraft/i.test(error.message) ? "Minecraft names are 3 to 16 letters, numbers or underscores." : "We couldn't save it: " + error.message;
    setMcName(n); return null;
  };
  const unlink = async () => { await supabase.rpc("unlink_minecraft"); setMcName(null); };
  if (mcName === undefined) return <p className="muted" role="status">Loading<Dots /></p>;
  return <MinecraftView done={done} total={tasks.length} linked={mcName} onLink={link} onUnlink={unlink} />;
}
