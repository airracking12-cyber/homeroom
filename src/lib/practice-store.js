// Reading the class's stored practice items (the questions behind the coach). Reading only: they are written when the shared
// database is built (app/ingest.jsx), never while someone is studying.
import { store } from "./services.js";
import { practiceKey, ideaRef } from "./practice.js";

// { noteId: row | null } for the notes the ideas come from. A note with no row yet simply has no practice items (the coach
// falls back to plain recall and explaining for it) and the reader is asked to prepare them.
export async function loadPractice(classId, noteIds) {
  const ids = [...new Set(noteIds)];
  const rows = await Promise.all(ids.map(async (id) => { try { const v = await store.get(practiceKey(classId, id), true); return v && v.items ? v : null; } catch { return null; } }));
  return Object.fromEntries(ids.map((id, i) => [id, rows[i]]));
}
export const noteIdsOf = (ideas) => [...new Set(ideas.map((i) => ideaRef(i.id).noteId))];
