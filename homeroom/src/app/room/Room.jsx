// "Your room": the home screen. Each real section of Homeroom is a piece of furniture; the middle of the screen stays calm
// and readable (every word sits on a solid card), and the decoration frames it at the edges.
import { Banner, Button } from "../ui.jsx";
import { Package } from "lucide-react";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { todayISO, diffDays } from "../../lib/dates.js";
import { Corkboard, Bookshelf, Calendar, Door, Dresser, Lamp, Roommate, Plant } from "./art.jsx";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Piece({ i, art, label, where, status, tour, href, onClick, pressed, glow }) {
  const body = (
    <>
      <span className="room-art">{glow && <span className="glow-layer" aria-hidden="true" />}{art}</span>
      <span className="room-text">
        <span className="room-label">{label}</span>
        <span className="room-where">{where}</span>
        <span className="room-status">{status}</span>
      </span>
    </>
  );
  const common = { className: "room-obj pop-in", style: { "--i": i }, "data-tour": tour };
  return (
    <li>
      {href
        ? <a {...common} href={href} onClick={(e) => { e.preventDefault(); onClick(); }}>{body}</a>
        : <button type="button" {...common} aria-pressed={pressed} onClick={onClick}>{body}</button>}
    </li>
  );
}

export default function Room() {
  const d = useData();
  const { go, openAsk, lamp, offer } = useShell();
  const open = d.tasks.filter((t) => (d.progress[t.id] || "todo") !== "done");
  const today = open.filter((t) => diffDays(t.deadline) <= 0).length;
  const week = open.filter((t) => { const n = diffDays(t.deadline); return n > 0 && n <= 7; }).length;
  const cork = today ? `${plural(today, "sticky note needs", "sticky notes need")} you today.` : week ? `${plural(week, "task is", "tasks are")} due this week.` : "Nothing pinned is due. Nice and calm.";
  const shelf = d.materials.length ? `${plural(d.materials.length, "set of notes", "sets of notes")} on the shelf.` : "The shelf is empty. Unpack your first notes.";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{new Date(`${todayISO()}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}{d.classLabel && <span className="only-xs"> &middot; Class {d.classLabel}</span>}</p>
          <h1>Your room</h1>
          <p className="lede">{greeting()}, {d.user}. Everything you need is within reach.</p>
        </div>
      </header>

      <div className="stack">
        {offer?.open && (
          <Banner tone="accent" icon={Package} onClose={offer.dismiss} action={<Button size="sm" variant="primary" onClick={offer.take}>Start unpacking</Button>}>
            <b>Want to unbox your room?</b>
            <span>A one-minute move-in: open the box and put each piece in its place. Skip it any time; nothing you&rsquo;ve saved changes.</span>
          </Banner>
        )}
        <ul role="list" className="room-grid">
          <Piece i={0} tour="room-track" href="#/track" onClick={() => go("track")} art={<Corkboard />} label="Corkboard" where="Track" status={cork} />
          <Piece i={1} tour="room-review" href="#/review" onClick={() => go("review")} art={<Bookshelf />} label="Bookshelf" where="Review" status={shelf} />
          <Piece i={2} tour="room-prepare" href="#/prepare" onClick={() => go("prepare")} art={<Calendar />} label="Wall calendar" where="Prepare" status="Plan for the next grade or an entrance exam." />
          <Piece i={3} tour="room-class" href="#/class" onClick={() => go("class")} art={<Door />} label="The doorway" where="Class" status="See who is around and join a study group." />
          <Piece i={4} tour="room-lamp" onClick={lamp.toggle} pressed={lamp.night} glow={lamp.night} art={<Lamp />} label="Desk lamp" where="Night mode" status={lamp.night ? "The lamp is on. Tap to switch back to day." : "Tap the lamp to turn night mode on."} />
          <Piece i={5} tour="room-ask" onClick={openAsk} art={<Roommate />} label="Your roommate" where="Ask" status="Ask about your homework or your notes." />
          <Piece i={6} tour="room-settings" href="#/settings" onClick={() => go("settings")} art={<Dresser />} label="The dresser" where="Settings" status="You, your class, sound and how Homeroom looks." />
        </ul>
      </div>

      <div className="room-floor" aria-hidden="true"><span className="wood" /><Plant /></div>
    </div>
  );
}
