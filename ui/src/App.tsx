import { lazy, Suspense, useCallback, useState } from "react";
import { A2UISurfaceProvider } from "./A2UISurface";
import { type ViewMode } from "./ModeToggle";
import { DemoDashboard } from "./DemoDashboard";
import type { EventLogEntry } from "./agent/applyA2UIEvent";

// Code-split the live tier: the AI SDK loads only when Live mode is opened, so the
// default Demo (offline) tier stays lean.
const LiveDashboard = lazy(() =>
  import("./LiveDashboard").then((m) => ({ default: m.LiveDashboard }))
);

function Root() {
  const [view, setView] = useState<ViewMode>("demo");
  // The AG-UI event log lives here so the stream + A2UI surface persist across a source switch
  // (continuity — #128). Each source's engine appends via the injected setter; a fresh run of
  // either source still clears it. Switching is now just a view change — no clearSurfaces().
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const onView = useCallback((next: ViewMode) => setView(next), []);

  return view === "demo" ? (
    <DemoDashboard view={view} onView={onView} eventLog={eventLog} setEventLog={setEventLog} />
  ) : (
    <Suspense
      fallback={
        <div className="p-8 text-center text-text-muted text-sm">
          Loading live agent…
        </div>
      }
    >
      <LiveDashboard
        mode={view}
        onMode={onView}
        eventLog={eventLog}
        setEventLog={setEventLog}
      />
    </Suspense>
  );
}

export function App() {
  return (
    <A2UISurfaceProvider>
      <Root />
    </A2UISurfaceProvider>
  );
}
