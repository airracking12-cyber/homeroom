// The admin's Minecraft list. Its own download, and only part of the build while MC_ON is true (see minecraft.config.js).
import { useState, useEffect, useCallback } from "react";
import { Gamepad2 } from "lucide-react";
import { supabase } from "../../lib/services.js";
import { Sound } from "../../lib/sound.js";
import { Button, Empty, Skeleton } from "../ui.jsx";

export default function MinecraftTab() {
  const [mcLinks, setMcLinks] = useState(null);
  const loadMc = useCallback(async () => { const { data, error } = await supabase.rpc("mc_links_admin"); setMcLinks(error ? [] : data || []); }, []);
  useEffect(() => { loadMc(); }, [loadMc]);
  const unlinkAdmin = async (n) => { Sound.play("undo"); setMcLinks((c) => (c || []).filter((x) => x.mc_display !== n)); await supabase.rpc("mc_admin_unlink", { p_name: n }); };
  return (
    <section className="stack" aria-label="Minecraft">
      {mcLinks === null && <Skeleton rows={3} />}
      {mcLinks && mcLinks.length === 0 && <Empty icon={Gamepad2} title="Nobody has linked a name yet">Names appear here once students finish their tasks and enter their username.</Empty>}
      {(mcLinks || []).map((l) => <div className="card between" key={l.mc_display}><div><b>{l.mc_display}</b><p className="muted small">{l.username}, class {l.class_id}</p></div><Button size="sm" onClick={() => unlinkAdmin(l.mc_display)}>Unlink</Button></div>)}
    </section>
  );
}
