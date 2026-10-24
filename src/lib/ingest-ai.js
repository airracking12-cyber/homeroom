// The assistant's part of reading notes: finding the study ideas in ONE chunk, and copying a PDF page group or a photo into
// plain text (a faithful copy, never a summary). PDFs are split into page groups with pdf-lib so each group is its own chunk.
import { callClaude, parseJSON } from "./ai.js";
import { imageToJpegBase64, readAsDataURL } from "./helpers.js";
import { DIGEST_SYSTEM } from "./study.js";

export async function ideasForChunk(chunk, { title, subject }) {
  const section = chunk.section ? `Section: ${chunk.section}\n` : "";
  const raw = await callClaude(DIGEST_SYSTEM, [{ role: "user", content: `Subject: ${subject}\nNote title: ${title}\n${section}\nNOTES:\n${chunk.text}` }]);
  const j = parseJSON(raw);
  if (!j || !Array.isArray(j.ideas)) throw new Error("bad inventory");
  return j.ideas.filter((x) => x && x.t && x.d).map((x) => ({ t: String(x.t).slice(0, 80), d: String(x.d).slice(0, 320), c: String(x.c || "").slice(0, 60), k: String(x.k || "fact").slice(0, 12) }));
}

export const TRANSCRIBE_SYSTEM = "You copy study material into plain text exactly as written. Do NOT summarize, shorten or reword anything. Plain text only: no markdown symbols, no emojis. Keep headings and lists as plain lines, one per line, in the original order. Describe each diagram, picture or table briefly in words inside square brackets, then copy any text it contains. If there is no readable text, write [no readable text].";
export const transcribe = (block, what) => callClaude(TRANSCRIBE_SYSTEM, [{ role: "user", content: [block, { type: "text", text: `Copy out ${what}.` }] }]);

export const PAGES_PER_PART = 3; // a faithful copy of 3 dense pages fits inside one answer
const pdfBlock = (data) => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
export const imageBlock = async (file) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await imageToJpegBase64(file) } });
export const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const isImage = (f) => String(f.type).startsWith("image/");
export const readText = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });

const docs = new WeakMap();
async function load(file) {
  if (docs.has(file)) return docs.get(file);
  const { PDFDocument } = await import("pdf-lib"); // loaded only when a PDF is added
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  docs.set(file, doc);
  return doc;
}
// Page groups of a PDF: [{ from, to }] (1-based, inclusive). If the file can't be split, it is one part (to: 0 means "all of it").
export async function pdfParts(file, per = PAGES_PER_PART) {
  try {
    const n = (await load(file)).getPageCount();
    if (!n) throw new Error("no pages");
    const out = []; for (let p = 1; p <= n; p += per) out.push({ from: p, to: Math.min(n, p + per - 1) });
    return out;
  } catch { return [{ from: 1, to: 0 }]; }
}
export async function pdfPartBlock(file, from, to) {
  if (!to) return pdfBlock((await readAsDataURL(file)).split(",")[1]);
  const { PDFDocument } = await import("pdf-lib");
  const src = await load(file), out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return pdfBlock(await out.saveAsBase64());
}
export const partLabel = (p) => (!p.to ? "the whole file" : p.from === p.to ? `page ${p.from}` : `pages ${p.from} to ${p.to}`);
