import type { ReactNode } from "react";
import { A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { CatalogViewer } from "./CatalogViewer";
import { GitHubLinks } from "./GitHubLinks";
import { REPO_URL } from "./config";
import { formatBuildInfo } from "./buildInfo";
import { BrandHeader } from "./BrandHeader";
import { ThemeToggle } from "./theme/ThemeToggle";
import { ModeToggle, type ViewMode } from "./ModeToggle";
import type { EventLogEntry } from "./agent/applyA2UIEvent";

// The chrome shared by the Demo (replay) and Live (BYOK) dashboards: layout, header,
// A2UI surface, the AG-UI event sidebar, and footer. Each mode owns its engine + body
// and slots them in. Presentational only — no engine imports — so it stays in the eager
// bundle and the Live tier's AI SDK keeps code-splitting behind its own lazy chunk.
interface DashboardShellProps {
  view: ViewMode;
  onView: (mode: ViewMode) => void;
  /** Header middle: the mode badge (+ Demo's path breadcrumb). */
  headerMiddle: ReactNode;
  /** Mode-specific controls between ThemeToggle and CatalogViewer (Demo: Start over / Play All). */
  extraControls?: ReactNode;
  surfaceSubtitle: string;
  eventsSubtitle: string;
  eventLog: EventLogEntry[];
  /** Optional collapsible panel pinned to the top of the right sidebar (Live: connection settings). */
  asidePanel?: ReactNode;
  /** Optional content shown while the A2UI surface doesn't exist (Live: pending-render skeleton). */
  surfaceFallback?: ReactNode;
  /** Dim the existing surface + show a Generating chip while a follow-up turn streams (Live). */
  surfaceBusy?: boolean;
  /** Lead text before the shared repo link in the footer. */
  footerLead: string;
  /** Mode-specific main body, rendered below the A2UI surface. */
  children: ReactNode;
}

export function DashboardShell({
  view,
  onView,
  headerMiddle,
  extraControls,
  surfaceSubtitle,
  eventsSubtitle,
  eventLog,
  asidePanel,
  surfaceFallback,
  surfaceBusy,
  footerLead,
  children,
}: DashboardShellProps) {
  const build = formatBuildInfo(__APP_VERSION__, __BUILD_SHA__);
  return (
    <div className="h-screen flex flex-col max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-border">
        <BrandHeader />
        {/* Shrinkable middle slot: long content (e.g. the replay breadcrumb) truncates instead of
            pushing the brand/controls — header layout stays constant. */}
        <div className="flex-1 min-w-0 overflow-hidden">{headerMiddle}</div>
        <div className="flex items-center gap-2 shrink-0">
          <ModeToggle mode={view} onChange={onView} />
          {extraControls}
          <CatalogViewer />
          <ThemeToggle />
          <GitHubLinks />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              A2UI Surface
            </span>
            <span className="text-xs text-text-muted">— {surfaceSubtitle}</span>
          </div>
          <div className="relative">
            {surfaceBusy && (
              <span className="qte-generating-chip" role="status">
                Generating…
              </span>
            )}
            <div className={surfaceBusy ? "qte-surface-busy" : undefined}>
              <A2UISurface {...(surfaceFallback != null ? { fallback: surfaceFallback } : {})} />
            </div>
          </div>
          {children}
        </main>
        <aside className="w-96 border-l border-border flex flex-col min-h-0 overflow-hidden">
          {asidePanel}
          {/* Events log: part of the sidebar accordion in Live (opening Connection/Prompt closes it);
              open by default in Demo, which has no asidePanel and so no accordion peer.
              overflow-hidden on the <details> + wrapper is required: a native <details> flex parent
              doesn't otherwise bound its children, so the stream would grow past the footer instead
              of scrolling internally. */}
          {/* A native <details> lays its content out at intrinsic height regardless of its own
              (flex-bounded) box, so neither flex nor grid bounds the scroll region. Position the
              stream absolutely instead — it then sizes to the details box (h-10 summary offset) and
              scrolls internally rather than spilling past the footer. */}
          <details
            name="sidebar-accordion"
            open={!asidePanel}
            className="relative flex-1 min-h-0 overflow-hidden [&:not([open])]:flex-none"
          >
            <summary className="flex h-10 items-center gap-1 px-2 border-b border-border cursor-pointer select-none marker:text-text-muted">
              <span className="text-xs font-semibold text-data-positive uppercase tracking-wide">
                AG-UI Events
              </span>{" "}
              <span className="text-xs text-text-muted truncate">— {eventsSubtitle}</span>
            </summary>
            <div className="absolute inset-x-0 bottom-0 top-10 overflow-hidden">
              <EventStream events={eventLog} />
            </div>
          </details>
        </aside>
      </div>
      <footer className="px-4 py-2 border-t border-border text-center text-xs text-text-muted">
        {footerLead} ·{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          qte77/agenthud-agui-a2ui
        </a>{" "}
        ·{" "}
        <a
          href={build.href}
          target="_blank"
          rel="noreferrer"
          title={build.title}
          className="text-primary hover:underline"
        >
          {build.label}
        </a>
      </footer>
    </div>
  );
}
