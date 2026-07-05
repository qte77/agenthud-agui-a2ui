import { A2UIProvider, A2UIRenderer, initializeDefaultCatalog } from "@a2ui/react";
import type { ReactNode } from "react";
import { qteA2uiTheme } from "./theme/a2uiTheme";

// Register the A2UI standard component catalog once at module load.
initializeDefaultCatalog();

export function A2UISurfaceProvider({ children }: { children: ReactNode }) {
  // Theme the rendered surface with our EyeRest-branded class hooks (see theme/a2uiTheme.ts
  // + the .a2ui-surface rules in index.css) — the catalog is unstyled without this.
  return <A2UIProvider theme={qteA2uiTheme}>{children}</A2UIProvider>;
}

export function A2UISurface() {
  return <A2UIRenderer surfaceId="main" />;
}
