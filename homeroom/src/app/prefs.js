// How Homeroom looks and sounds: light, dark or follow the device; sound effects; music. Saved on this device's account row
// like v33 ("theme" and "audio"). The theme is a data-theme attribute on <html>; "auto" removes it and the system decides.
import { useState, useEffect, useCallback } from "react";
import { store } from "../lib/services.js";
import { Sound } from "../lib/sound.js";

export function useAppearance(ready) {
  const [theme, setTheme] = useState("auto");
  const [audio, setAudio] = useState({ sfx: true, music: false, vol: 0.5 });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let dead = false;
    Promise.all([store.get("theme"), store.get("audio")]).then(([th, au]) => {
      if (dead) return;
      if (th === "light" || th === "dark" || th === "auto") setTheme(th);
      if (au && typeof au === "object") setAudio((a) => ({ ...a, ...au }));
      setLoaded(true);
    });
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "auto") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", theme);
    // keep the browser chrome (status bar, address bar) in step with the app
    const id = requestAnimationFrame(() => {
      if (theme === "auto") return; // the two tags in index.html already follow the device
      const c = getComputedStyle(el).getPropertyValue("--canvas").trim();
      // a forced theme must beat the device setting, so both tags get the forced colour
      if (c) document.querySelectorAll('meta[name="theme-color"]').forEach((x) => x.setAttribute("content", c));
    });
    return () => cancelAnimationFrame(id);
  }, [theme]);
  useEffect(() => { if (loaded) store.set("theme", theme); }, [theme, loaded]);
  useEffect(() => { Sound.setSfx(audio.sfx); Sound.setVolume(audio.vol); if (loaded) store.set("audio", audio); }, [audio, loaded]);
  useEffect(() => {
    // Browsers only allow sound after a tap, so a saved "music on" starts on your first touch.
    if (!audio.music || !ready) return undefined;
    const go = () => { if (!Sound.isMusic()) Sound.startMusic(); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, [audio.music, ready]);
  useEffect(() => () => Sound.stopMusic(), []);
  const toggleMusic = useCallback(() => {
    setAudio((a) => { const on = !a.music; if (on) Sound.startMusic(); else Sound.stopMusic(); return { ...a, music: on }; });
  }, []);
  return { theme, setTheme, audio, setAudio, toggleMusic };
}
