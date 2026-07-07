import { lazy, Suspense, useCallback, useState } from "react";
import { A2UISurfaceProvider } from "./A2UISurface";
import { useA2UIActions } from "@a2ui/react";
import { type ViewMode } from "./ModeToggle";
import { DemoDashboard } from "./DemoDashboard";

// Code-split the live tier: the AI SDK loads only when Live mode is opened, so the
// default Demo (offline) tier stays lean.
const LiveDashboard = lazy(() =>
  import("./LiveDashboard").then((m) => ({ default: m.LiveDashboard }))
);

function Root() {
  const [view, setView] = useState<ViewMode>("demo");
  const { clearSurfaces } = useA2UIActions();

  const onView = useCallback(
    (next: ViewMode) => {
      if (next === view) return;
      clearSurfaces(); // start the other mode on a clean surface
      setView(next);
    },
    [view, clearSurfaces]
  );

  return view === "demo" ? (
    <DemoDashboard view={view} onView={onView} />
  ) : (
    <Suspense
      fallback={
        <div className="p-8 text-center text-text-muted text-sm">
          Loading live agent…
        </div>
      }
    >
      <LiveDashboard mode={view} onMode={onView} />
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
