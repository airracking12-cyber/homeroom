// "Your room": the home screen. Every real section of Homeroom is a piece of furniture, and the two that matter most
// show what is really in them: the corkboard pins your next tasks as sticky notes, the bookshelf stands your notes up as
// spines. The middle of the screen stays calm and readable (every word sits on a solid card or a note), and the
// decoration frames it at the edges.
import { Banner, Button } from "../ui.jsx";
import { Package, Plus, ArrowRight } from "lucide-react";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { todayISO, diffDays, relLabel } from "../../lib/dates.js";
import { subjColor } from "../../lib/constants.js";
import { nice } from "../../lib/helpers.js";
import { greeting, plural, daySummary, pinnedTasks, corkStatus, SPINES } from "./model.js";
import { Corkboard, Bookshelf, Calendar, Door, Dresser, Lamp, Roommate, Plant } from "./art.jsx";

const TILTS = ["-2deg", "1.5deg", "-1deg", "2.5deg"];

function Piece({ i, art, label, where, status, tour, href, onClick, pressed, glow, children, className = "" }) {
  const body = (
    <>
      <span className="room-art">{glow && <span className="glow-layer" aria-hidden="true" />}{art}</span>
      <span className="room-text">
        <span className="room-label">{label}</span>
        <span className="room-where">{where}</span>
        <span className="room-status">{status}</span>
        {children}
      </span>
    </>
  );
  const common = { className: `room-obj pop-in ${className}`.trim(), style: { "--i": i }, "data-tour": tour };
  return (
    <li>
      {href
        ? <a {...common} href={href} onClick={(e) => { e.preventDefault(); onClick(); }}>{body}</a>
        : <button type="button" {...common} aria-pressed={pressed} onClick={onClick}>{body}</button>}
    </li>
  );
}

// the corkboard: your next tasks, pinned. Text sits only on the notes and on the solid plate, never on the cork.
function Cork({ open, where, status, go, openForm }) {
  const notes = pinnedTasks(open);
  return (
    <section className="room-cork pop-in" style={{ "--i": 0 }} data-tour="room-track" aria-labelledby="cork-h">
      <div className="cork">
        <div className="cork-plate">
          <span className="room-art room-art-sm" aria-hidden="true"><Corkboard /></span>
          <div className="room-text"><h2 id="cork-h" className="room-label">Corkboard</h2><p className="room-where">{where}<span aria-hidden="true"> &middot; </span><span className="room-status-inline">{status}</span></p></div>
        </div>
        {notes.length ? (
          <ul role="list" className="cork-notes">
            {notes.map((t, k) => {
              const n = diffDays(t.deadline), late = n < 0;
              return (
                <li key={t.id}>
                  <button type="button" className={`note note-${(k % 3) + 1} pin room-note`} style={{ "--tilt": TILTS[k % TILTS.length] }} onClick={() => go("track", "task", t.id)}>
                    <span className="room-note-title">{t.title}</span>
                    <span className="room-note-meta"><i className="dot" style={{ background: subjColor(t.subject) }} aria-hidden="true" />{t.subject}<span aria-hidden="true">&middot;</span><span className={late ? "late" : ""}>{late ? `Overdue, ${relLabel(t.deadline)}` : relLabel(t.deadline)}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="note note-2 pin room-note room-note-empty" style={{ "--tilt": "-1deg" }}><span className="room-note-title">Nothing pinned yet</span><span className="room-note-meta">Add a task and it lands here.</span></div>
        )}
        <div className="cork-foot">
          <Button size="sm" variant="primary" onClick={() => openForm()}><Plus size={16} aria-hidden="true" />Add task</Button>
          <Button size="sm" variant="secondary" onClick={() => go("track")}>Open Track<ArrowRight size={16} aria-hidden="true" /></Button>
        </div>
      </div>
    </section>
  );
}

// the bookshelf: every set of notes stands up as a spine, in its subject's colour
function Shelf({ materials, where, status, go }) {
  const books = materials.slice(-SPINES);
  return (
    <Piece i={1} tour="room-review" href="#/review" onClick={() => go("review")} art={<Bookshelf />} label="Bookshelf" where={where} status={status} className="room-obj-shelf">
      {books.length > 0 && <span className="spines" aria-hidden="true">{books.map((m, k) => <i key={m.id || k} style={{ background: subjColor(m.subject), "--h": `${34 + ((k * 11) % 20)}px` }} />)}</span>}
    </Piece>
  );
}

export default function Room() {
  const d = useData();
  const { go, openAsk, openForm, lamp, offer } = useShell();
  const open = d.tasks.filter((t) => (d.progress[t.id] || "todo") !== "done");
  const cork = corkStatus(open);
  const shelf = d.materials.length ? `${plural(d.materials.length, "set of notes", "sets of notes")} on the shelf.` : "The shelf is empty. Unpack your first notes.";

  return (
    <div className="page room-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{new Date(`${todayISO()}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}{d.classLabel && <span className="only-xs"> &middot; Class {d.classLabel}</span>}</p>
          <h1>{greeting()}, {nice(d.user)}.</h1>
          <p className="lede">{daySummary(open)}</p>
        </div>
      </header>

      <div className="stack">
        {offer?.open && (
          <Banner tone="accent" icon={Package} onClose={offer.dismiss} action={<Button size="sm" variant="primary" onClick={offer.take}>Start unpacking</Button>}>
            <b>Want to unbox your room?</b>
            <span>A one-minute move-in: open the box and put each piece in its place. Skip it any time; nothing you&rsquo;ve saved changes.</span>
          </Banner>
        )}
        <div className="room-top">
          <Cork open={open} where="Track" status={cork} go={go} openForm={openForm} />
          <ul role="list" className="room-side">
            <Shelf materials={d.materials} where="Review" status={shelf} go={go} />
            <Piece i={2} tour="room-ask" onClick={openAsk} art={<Roommate />} label="Your roommate" where="Ask" status="Ask about your homework or your notes." />
          </ul>
        </div>
        <ul role="list" className="room-grid">
          <Piece i={3} tour="room-prepare" href="#/prepare" onClick={() => go("prepare")} art={<Calendar />} label="Wall calendar" where="Prepare" status="Plan for the next grade or an entrance exam." />
          <Piece i={4} tour="room-class" href="#/class" onClick={() => go("class")} art={<Door />} label="The doorway" where="Class" status="See who is around and join a study group." />
          <Piece i={5} tour="room-lamp" onClick={lamp.toggle} pressed={lamp.night} glow={lamp.night} art={<Lamp />} label="Desk lamp" where="Night mode" status={lamp.night ? "The lamp is on. Tap to switch back to day." : "Tap the lamp to turn night mode on."} />
          <Piece i={6} tour="room-settings" href="#/settings" onClick={() => go("settings")} art={<Dresser />} label="The dresser" where="Settings" status="You, your class, sound and how Homeroom looks." />
        </ul>
      </div>

      <div className="room-floor" aria-hidden="true"><span className="wood" /><Plant /></div>
    </div>
  );
}
