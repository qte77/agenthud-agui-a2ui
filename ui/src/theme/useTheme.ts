import { useCallback, useEffect, useState } from "react";
import {
  type ThemeMode,
  STORAGE_KEY,
  effectiveTheme,
  nextTheme,
  resolveTheme,
} from "./theme";

// React port of qte77 ui-kit/theme.js. The inline anti-FOUC guard in index.html
// has already set html[data-theme] before paint; this hook reads the same sources
// so its initial state matches, then keeps the DOM + storage in sync on change.

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const url = new URLSearchParams(window.location.search).get("theme");
  let ls: string | null = null;
  try {
    ls = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage disabled — non-fatal */
  }
  return resolveTheme(url, ls);
}

function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
  else root.removeAttribute("data-theme"); // system → prefers-color-scheme governs
  // Emit so any non-React consumer (charts/canvas) can recolour on flip.
  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { mode, effective: effectiveTheme(mode) },
    })
  );
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);

  useEffect(() => {
    applyMode(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // In System mode, re-apply when the OS preference flips (keeps it in sync).
  useEffect(() => {
    if (mode !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const cycle = useCallback(() => setMode((m) => nextTheme(m)), []);

  return { mode, cycle, effective: effectiveTheme(mode) };
}
