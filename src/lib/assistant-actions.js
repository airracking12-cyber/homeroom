// What the assistant is allowed to propose. The model's reply may end with <<ACTIONS>> and a JSON array; this turns that into
// a short list of well-formed tasks to SHOW the student. Nothing here writes anything: the student confirms first.
// The model reads classmates' notes, so its output is treated as untrusted: every field is checked and bounded.
import { TYPES, PRIORITIES } from "./constants.js";
import { isRealDate } from "./dates.js";

export const MAX_PROPOSED = 5;
const str = (v) => (typeof v === "string" ? v.trim() : "");

export function parseActions(full) {
  const mi = full.indexOf("<<ACTIONS>>");
  if (mi < 0) return [];
  const tail = full.slice(mi + 11);
  let arr = [];
  try { const p = JSON.parse(tail.slice(tail.indexOf("["), tail.lastIndexOf("]") + 1)); if (Array.isArray(p)) arr = p; } catch { return []; }
  const out = [];
  for (const a of arr) {
    if (out.length >= MAX_PROPOSED) break;
    if (!a || a.type !== "add_task") continue;
    const title = str(a.title).slice(0, 120), subject = str(a.subject).slice(0, 40);
    if (!title || !subject || !isRealDate(a.deadline)) continue;
    out.push({
      title, subject, deadline: a.deadline,
      type: TYPES.includes(a.taskType) ? a.taskType : "Homework",
      priority: PRIORITIES.includes(a.priority) ? a.priority : "Medium",
      notes: str(a.notes).slice(0, 600),
    });
  }
  return out;
}
