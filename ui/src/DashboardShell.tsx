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
  footerLead,
  children,
}: DashboardShellProps) {
  const build = formatBuildInfo(__APP_VERSION__, __BUILD_SHA__);
  return (
    <div className="h-screen flex flex-col max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <BrandHeader />
        {headerMiddle}
        <div className="flex items-center gap-2">
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
          <A2UISurface />
          {children}
        </main>
        <aside className="w-96 border-l border-border flex flex-col">
          <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
            <span className="text-xs font-semibold text-data-positive uppercase tracking-wide">
              AG-UI Events
            </span>
            <span className="text-xs text-text-muted">— {eventsSubtitle}</span>
          </div>
          <div className="flex-1 min-h-0">
            <EventStream events={eventLog} />
          </div>
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
