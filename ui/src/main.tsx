import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Brand fonts (self-hosted woff2 via Fontsource): Inter for UI/prose,
// JetBrains Mono for the event log / numeric data. Weights match brand/DESIGN.md.
// Latin subset only — the UI is English; avoids shipping greek/cyrillic/vietnamese.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
