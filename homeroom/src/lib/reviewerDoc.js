// A reviewer is stored as plain text (short headed sections, one idea per line, "Term: meaning"). This turns that text into
// sections the screen can lay out properly: headings, term/meaning rows and short paragraphs. Nothing about how reviewers
// are saved changes, and anything it can't classify is shown as a plain paragraph, so no text is ever dropped.

const MD = /^\s{0,3}(#{1,6}\s+|[*_]{1,3}(?=\S)|>\s?)|[*_]{2,3}|`+/g; // markdown the assistant sometimes adds anyway
const BULLET = /^\s*(?:[-\u2022\u2013*]|\d{1,2}[.)])\s+/;
const clean = (s) => String(s || "").replace(/\r/g, "").replace(MD, "").replace(/[ \t]+$/g, "");

const isHeading = (line, prev, next) => {
  const t = line.trim();
  if (!t || t.length > 64 || BULLET.test(t)) return false;
  if (/[.!?;,]$/.test(t)) return false;
  if (/:\s+\S/.test(t)) return false; // "Term: meaning" is an item, not a heading
  const words = t.split(/\s+/).length;
  if (words > 9) return false;
  return prev === "" || next === "" || t.endsWith(":") || words <= 4;
};

const asTerm = (t) => {
  const m = t.match(/^([^:]{2,48}?):\s+(\S.{5,})$/);
  if (m && m[1].split(/\s+/).length <= 7) return { term: m[1].trim(), meaning: m[2].trim() };
  return null;
};

export function parseReviewer(text) {
  const lines = clean(text).split("\n").map((l) => l.trimEnd());
  const sections = [];
  let cur = { title: "", items: [] };
  const push = () => { if (cur.items.length || cur.title) sections.push(cur); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const prev = i === 0 ? "" : lines[i - 1].trim();
    const next = i === lines.length - 1 ? "" : lines[i + 1].trim();
    if (isHeading(line, prev, next)) {
      push();
      cur = { title: line.replace(/:$/, ""), items: [] };
      continue;
    }
    const body = line.replace(BULLET, "");
    const term = asTerm(body);
    if (term) cur.items.push({ type: "term", ...term });
    else if (BULLET.test(line)) cur.items.push({ type: "point", text: body });
    else cur.items.push({ type: "p", text: body });
  }
  push();
  // a lone heading at the very top with a short first line is the reviewer's title
  return sections;
}

export const reviewerCount = (sections) => sections.reduce((n, s) => n + s.items.filter((x) => x.type !== "p").length, 0);
