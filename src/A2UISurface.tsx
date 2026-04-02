import { A2UIProvider, A2UIRenderer, initializeDefaultCatalog } from "@a2ui/react";
import type { ReactNode } from "react";

let initialized = false;
if (!initialized) {
  initializeDefaultCatalog();
  initialized = true;
}

export function A2UISurfaceProvider({ children }: { children: ReactNode }) {
  return <A2UIProvider>{children}</A2UIProvider>;
}

export function A2UISurface() {
  return <A2UIRenderer surfaceId="main" />;
}
