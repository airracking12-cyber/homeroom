// What the Room says about your day, as plain functions (tests/room.test.mjs). The screen only draws it.
import { diffDays } from "../../lib/dates.js";

export const PINNED = 4;                       // sticky notes on the corkboard
export const SPINES = 7;                       // books standing on the shelf

export const greeting = (hour = new Date().getHours()) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// one line about the day, from what is really due (open tasks only)
export function daySummary(open) {
  const n = open.map((t) => diffDays(t.deadline));
  const late = n.filter((x) => x < 0).length, now = n.filter((x) => x === 0).length, soon = n.filter((x) => x > 0 && x <= 7).length;
  const parts = [now && `${now} due today`, late && `${late} overdue`, soon && `${soon} more in the next 7 days`].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : "Nothing is due. Nice and calm.";
}

// what goes on the corkboard: whatever is due first (overdue included), no more than fit
export const pinnedTasks = (open, n = PINNED) => [...open].sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, n);

// the sentence on the corkboard's plate
export function corkStatus(open) {
  const today = open.filter((t) => diffDays(t.deadline) <= 0).length;
  const week = open.filter((t) => { const n = diffDays(t.deadline); return n > 0 && n <= 7; }).length;
  return today ? `${plural(today, "sticky note needs", "sticky notes need")} you today` : week ? `${plural(week, "task is", "tasks are")} due this week` : "Nothing pinned is due";
}
