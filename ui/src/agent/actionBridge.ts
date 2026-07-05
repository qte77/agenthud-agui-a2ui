// Bridge from the A2UI surface's onAction (provider at App root) to the live agent's
// sendAction (state owned by LiveDashboard). A module-level registry is deliberate KISS:
// there is exactly one A2UIProvider, and even a multi-surface transcript keeps a single
// onAction callback (the payload carries userAction.surfaceId). Unset in Demo → clicks no-op.

let handler: ((name: string) => void) | null = null;

export function setActionHandler(fn: ((name: string) => void) | null): void {
  handler = fn;
}

export function dispatchAction(name: string): void {
  handler?.(name);
}
