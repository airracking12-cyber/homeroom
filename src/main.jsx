import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

try {
  console.info("%cHomeroom%c  made by Nathaniel \u201CNathan\u201D Visaya, for his class", "font:600 15px Georgia,serif;color:#C4694A", "color:#8a867a");
} catch { /* the console is only a nicety */ }

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
