// The two data handles every screen shares, plus the sign-in helpers. Logic moved unchanged from the v33 App.jsx.
import { supabase } from "../supabaseClient";
import { createStore } from "./store.js";
import { createNotes } from "./notes.js";
import { setAuthHeaders } from "./ai.js";

export { supabase };
export const store = createStore(supabase);
export const notes = createNotes(supabase); // class notes and their ideas live in real tables (see lib/notes.js)

export async function loadProfile(id) {
  const { data } = await supabase.from("profiles").select("username,class_id,is_admin").eq("id", id).maybeSingle();
  return data || null;
}
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: "Bearer " + (data?.session?.access_token || "") };
}
setAuthHeaders(authHeaders);
