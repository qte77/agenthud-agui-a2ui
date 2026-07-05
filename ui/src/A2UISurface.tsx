import { A2UIProvider, A2UIRenderer, initializeDefaultCatalog } from "@a2ui/react";
import type { ReactNode } from "react";
import { qteA2uiTheme } from "./theme/a2uiTheme";
import { dispatchAction } from "./agent/actionBridge";

// Register the A2UI standard component catalog once at module load.
initializeDefaultCatalog();

export function A2UISurfaceProvider({ children }: { children: ReactNode }) {
  // Theme the rendered surface with our EyeRest-branded class hooks (see theme/a2uiTheme.ts
  // + the .a2ui-surface rules in index.css) — the catalog is unstyled without this.
  // onAction routes Button clicks to the live agent via the actionBridge (no-op when no
  // handler is registered, e.g. in Demo mode).
  return (
    <A2UIProvider theme={qteA2uiTheme} onAction={(m) => dispatchAction(m.userAction?.name ?? "")}>
      {children}
    </A2UIProvider>
  );
}

export function A2UISurface({ fallback }: { fallback?: ReactNode }) {
  // `fallback` renders while the surface doesn't exist (e.g. Live's pending-render skeleton
  // between Run-click and the first render_ui batch). Spread keeps exactOptionalPropertyTypes happy.
  return <A2UIRenderer surfaceId="main" {...(fallback !== undefined ? { fallback } : {})} />;
}
