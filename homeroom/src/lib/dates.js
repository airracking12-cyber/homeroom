// Date helpers. Dates travel as local "YYYY-MM-DD" strings, never as timestamps, so a due date never shifts with the time zone.
// Moved out of App.jsx unchanged.

export const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (iso) => Math.round((parse(iso) - parse(todayISO())) / 864e5);
export const fmtDate = (iso) => parse(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const todayLong = () => parse(todayISO()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
export const relLabel = (iso) => {
  const n = diffDays(iso);
  if (n === -1) return "Yesterday";
  if (n < -1) return `${-n} days ago`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return parse(iso).toLocaleDateString(undefined, { weekday: "long" });
  return fmtDate(iso);
};
export const fmtShort = (iso) => parse(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const weekStartOf = (iso) => { const d = parse(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }; // weeks start Monday
export const weekLabel = (ws) => `${fmtShort(ws)} to ${fmtShort(addDays(ws, 6))}`;

export function weekData(ws, tasks, materials) {
  const we = addDays(ws, 6);
  const ts = tasks.filter((t) => t.deadline >= ws && t.deadline <= we);
  const ids = new Set(ts.map((t) => t.id));
  const from = parse(ws).getTime(), to = parse(addDays(ws, 7)).getTime();
  const ms = materials.filter((m) => ids.has(m.taskId) || (m.at >= from && m.at < to));
  return { ts, ms };
}

export const timeAgo = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};
