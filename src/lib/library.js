// Helpers for the Data tab: how a class's notes are grouped by subject and topic, and the numbers shown at the top.
// Pure functions over the note summaries the app already holds (see lib/notes.js toMaterial), so they are easy to test.

export const NO_TOPIC = "No topic yet";

// [{ subject, notes, ideas, people, latest, topics: [{ topic, notes: [material], ideas }] }], biggest subject first.
export function groupBySubject(materials) {
  const by = new Map();
  for (const m of materials) {
    const s = m.subject || "General";
    const g = by.get(s) || { subject: s, notes: 0, ideas: 0, people: new Set(), latest: 0, topicMap: new Map() };
    g.notes += 1;
    g.ideas += m.ic || 0;
    g.people.add(m.by);
    g.latest = Math.max(g.latest, m.at || 0);
    const t = m.topic || NO_TOPIC;
    const tg = g.topicMap.get(t) || { topic: t, notes: [], ideas: 0 };
    tg.notes.push(m); tg.ideas += m.ic || 0;
    g.topicMap.set(t, tg);
    by.set(s, g);
  }
  return [...by.values()]
    .map(({ topicMap, people, ...g }) => ({
      ...g,
      people: people.size,
      topics: [...topicMap.values()]
        .map((t) => ({ ...t, notes: [...t.notes].sort((a, b) => b.at - a.at) }))
        // real topics first (most notes first), the "no topic yet" bucket last
        .sort((a, b) => (a.topic === NO_TOPIC) - (b.topic === NO_TOPIC) || b.notes.length - a.notes.length || a.topic.localeCompare(b.topic)),
    }))
    .sort((a, b) => b.notes - a.notes || a.subject.localeCompare(b.subject));
}

export function libraryStats(materials) {
  const topics = new Set();
  const people = new Set();
  let ideas = 0;
  for (const m of materials) {
    if (m.topic) topics.add(`${m.subject}|${m.topic}`);
    people.add(m.by);
    ideas += m.ic || 0;
  }
  return { notes: materials.length, topics: topics.size, ideas, people: people.size, subjects: new Set(materials.map((m) => m.subject)).size };
}

// notes with no topic are the ones the assistant finds hardest to place
export const untopiced = (materials) => materials.filter((m) => !m.topic && m.kind !== "ai");

export const fmtBytes = (n) => {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

// "This week, every subject" for the scope button on the Study screen
export function scopeLine({ period, subjects = [], topics = [], q = "" }) {
  const when = { today: "Today", week: "This week", final: "Whole quarter" }[period] || "This week";
  const what = q.trim() ? `\u201c${q.trim()}\u201d` : topics.length === 1 ? topics[0] : topics.length > 1 ? `${topics.length} topics` : subjects.length === 1 ? subjects[0] : subjects.length > 1 ? `${subjects.length} subjects` : "Every subject";
  return { when, what, text: q.trim() ? what : `${when} \u00b7 ${what}` };
}
