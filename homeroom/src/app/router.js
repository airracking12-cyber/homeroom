import { useEffect, useState, useCallback } from "react";
import { parseRoute, hashFor } from "./nav.js";

// A tiny hash router: the route is whatever "#/..." says, and go() changes it (so Back and Forward just work).
export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((dest, ...parts) => { const h = hashFor(dest, ...parts); if (window.location.hash !== h) window.location.hash = h; else setRoute(parseRoute(h)); }, []);
  const back = useCallback((dest, ...parts) => { if (window.history.length > 1) window.history.back(); else go(dest, ...parts); }, [go]);
  return { route, go, back };
}
