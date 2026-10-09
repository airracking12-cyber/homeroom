// Local preferences (this device) and the shared class database, behind one small interface.
// createStore(supabase) takes the database client as a parameter so it can be tested with a fake one.
// store.update() is the "nobody's change is lost" guard: it reads the row and its version, applies the change,
// and writes only if the version is still the same; if someone else saved in between, it reads again and retries.
// Moved out of App.jsx; the logic is unchanged.

export const LS = "hr:";

export function createStore(supabase, storage = globalThis.localStorage) {
  return {
    async get(key, shared = false) {
      if (!shared) {
        try { const v = storage.getItem(LS + key); return v ? JSON.parse(v) : null; } catch { return null; }
      }
      // null means "nothing saved here yet"; undefined means "couldn't reach the database", so callers keep what they have
      // instead of treating a hiccup as an empty list.
      try {
        const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
        if (error) { console.error("kv get failed", error); return undefined; }
        return data ? data.value : null;
      } catch { return undefined; }
    },
    // Several shared rows in one request (start-up used to make one request per row). Returns { key: value } with
    // missing keys left out, or null if the database couldn't be reached.
    async getMany(keys) {
      if (!keys.length) return {};
      try {
        const { data, error } = await supabase.from("kv").select("key,value").in("key", keys);
        if (error) { console.error("kv getMany failed", error); return null; }
        const out = {};
        for (const r of data || []) out[r.key] = r.value;
        return out;
      } catch (e) { console.error("kv getMany failed", e); return null; }
    },
    async set(key, val, shared = false) {
      if (!shared) {
        try { storage.setItem(LS + key, JSON.stringify(val)); return true; } catch { return false; }
      }
      try {
        const { error } = await supabase
          .from("kv")
          .upsert({ key, value: val, updated_at: new Date().toISOString() });
        if (error) { console.error("kv set failed", error); return false; }
        return true;
      } catch (e) { console.error("kv set failed", e); return false; }
    },
    async del(key, shared = false) {
      if (!shared) { try { storage.removeItem(LS + key); } catch (err) { console.warn("[Homeroom] non-fatal:", err); } return; }
      try { await supabase.from("kv").delete().eq("key", key); } catch (err) { console.warn("[Homeroom] non-fatal:", err); }
    },
    // Read, change, write back; if someone else saved in between, try again (so nobody's change is lost).
    async update(key, fn, empty = []) {
      for (let i = 0; i < 6; i++) {
        const { data, error } = await supabase.from("kv").select("value,version").eq("key", key).maybeSingle();
        if (error) { console.error("kv read failed", error); return false; }
        const next = fn(data ? data.value : empty);
        if (!data) {
          const r = await supabase.from("kv").insert({ key, value: next, version: 1 });
          if (!r.error) return true;
          continue;
        }
        const r = await supabase.from("kv").update({ value: next, version: data.version + 1, updated_at: new Date().toISOString() }).eq("key", key).eq("version", data.version).select("key");
        if (r.error) { console.error("kv write failed", r.error); return false; }
        if (r.data && r.data.length) return true;
      }
      return false;
    },
    classes: {
      async list() {
        let r = await supabase.from("classes").select("id,year,name,label,quarter,locked").order("label"); // locked: the class asks for a code (v29)
        if (r.error) r = await supabase.from("classes").select("id,year,name,label,quarter").order("label"); // not upgraded to v29 yet
        if (r.error) r = await supabase.from("classes").select("id,year,name,label").order("label"); // not upgraded to v8 yet: still show the classes
        return r.data || [];
      },
      async add(c) {
        await supabase.from("classes").upsert(c, { onConflict: "id", ignoreDuplicates: true });
      },
    },
    async listShared(prefix) {
      try {
        const { data, error } = await supabase.from("kv").select("key,value").like("key", `${prefix}%`);
        if (error) return [];
        return data || [];
      } catch { return []; }
    },
  };
}
