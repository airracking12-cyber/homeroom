// A temporary chat with one classmate over a private Realtime channel. Nothing is stored anywhere.
// The channel, presence and queueing logic is the v33 one, unchanged; the screen is new.
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { supabase } from "../../lib/services.js";
import { uid } from "../../lib/helpers.js";
import { Sound } from "../../lib/sound.js";
import { Button } from "../ui.jsx";

export default function Chat({ peer, me, classId, thread, saveThread, ring, peerOnline }) {
  const [msgs, setMsgs] = useState(thread || []);
  const [text, setText] = useState("");
  const [here, setHere] = useState(false);
  const hereRef = useRef(false);
  const chan = useRef(null);
  const queue = useRef([]);
  const end = useRef(null);
  const save = useRef(saveThread); save.current = saveThread;
  const ringRef = useRef(ring); ringRef.current = ring;
  const add = useCallback((m) => setMsgs((c) => (c.some((x) => x.id === m.id) ? c : [...c, m])), []);
  useEffect(() => { save.current(peer, msgs); end.current && end.current.scrollIntoView({ block: "end" }); }, [peer, msgs]);
  useEffect(() => {
    const c = supabase.channel(`dm:${classId}:${[me, peer].sort().join(":")}`, { config: { private: true, presence: { key: me }, broadcast: { self: false } } });
    chan.current = c;
    let dead = false;
    c.on("presence", { event: "sync" }, () => {
      const present = Object.keys(c.presenceState()).includes(peer);
      hereRef.current = present; setHere(present);
      if (present && queue.current.length) {
        queue.current.forEach((m) => c.send({ type: "broadcast", event: "msg", payload: m }));
        queue.current = [];
      }
    }).on("broadcast", { event: "msg" }, ({ payload }) => {
      if (payload && payload.from === peer && typeof payload.text === "string" && payload.id) {
        add({ id: String(payload.id), from: peer, text: payload.text.slice(0, 500), at: Date.now() });
        Sound.play("pop");
      }
    });
    (async () => {
      try { await supabase.realtime.setAuth(); } catch { /* the client already has the session */ }
      if (dead) return;
      c.subscribe(async (s) => { if (s === "SUBSCRIBED") { try { await c.track({ at: Date.now() }); } catch { /* ignore */ } } });
    })();
    ringRef.current(peer);
    const again = setInterval(() => { if (!hereRef.current) ringRef.current(peer); }, 9000);
    return () => { dead = true; clearInterval(again); chan.current = null; supabase.removeChannel(c); };
  }, [peer, me, classId, add]);
  const send = () => {
    const t = text.trim().slice(0, 500);
    if (!t) return;
    const m = { id: uid(), from: me, text: t, at: Date.now() };
    add(m); setText(""); Sound.play("send");
    if (hereRef.current && chan.current) chan.current.send({ type: "broadcast", event: "msg", payload: m });
    else queue.current.push(m);
  };
  return (
    <div className="dm">
      <div className="dm-head">
        <span className="avatar" aria-hidden="true">{peer[0].toUpperCase()}</span>
        <div>
          <b>{peer}</b>
          <p className="small" data-on={peerOnline ? 1 : 0}>{peerOnline ? (here ? "Online, in this chat" : "Online, waiting for them to open it") : "Went offline. Messages won\u2019t be delivered."}</p>
        </div>
      </div>
      <div className="dm-msgs" role="log" aria-live="polite" aria-label={`Chat with ${peer}`}>
        {msgs.length === 0 && <p className="muted small" style={{ textAlign: "center", margin: "var(--s-5) 0" }}>Say hi. This chat is temporary: nothing is saved, and it clears when you close Homeroom.</p>}
        {msgs.map((m) => <div key={m.id} className={`msg ${m.from === me ? "me" : "ai"}`}>{m.text}</div>)}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="input" value={text} maxLength={500} placeholder={`Message ${peer}`} aria-label={`Message ${peer}`} onChange={(e) => setText(e.target.value)} />
        <Button variant="primary" icon type="submit" disabled={!text.trim()} aria-label="Send"><ArrowUp size={18} /></Button>
      </form>
    </div>
  );
}
