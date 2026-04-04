import { useMemo, useState } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { CatalogViewer } from "./CatalogViewer";
import { EventStream } from "./EventStream";
import { useReplayEngine } from "./useReplayEngine";
import { fullRecording, segments, getSegmentEvents } from "./recordings";

function Dashboard() {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const filteredRecording = useMemo(
    () => ({
      meta: fullRecording.meta,
      events: getSegmentEvents(fullRecording, selectedSegment),
    }),
    [selectedSegment]
  );

  const { isPlaying, eventLog, play, restart } =
    useReplayEngine(filteredRecording);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b border-gray-700">
        <h1 className="text-lg font-semibold text-accent">agenthud</h1>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
            Replay
          </span>
          <p className="text-xs text-text-secondary">
            Pre-recorded AG-UI sequence — live agent mode planned
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedSegment ?? ""}
            onChange={(e) => {
              const val = e.target.value || null;
              setSelectedSegment(val);
              restart();
            }}
            className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
          >
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.componentHint})
              </option>
            ))}
          </select>
          <button
            onClick={play}
            disabled={isPlaying}
            className="px-3 py-1 rounded bg-accent text-gray-900 font-medium text-sm disabled:opacity-40"
          >
            Play
          </button>
          <button
            onClick={restart}
            className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-sm"
          >
            Restart
          </button>
          <CatalogViewer />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
            <span className="text-xs font-semibold text-accent uppercase tracking-wide">
              A2UI Surface
            </span>
            <span className="text-xs text-text-secondary">
              — components selected by agent intent from standard catalog
            </span>
          </div>
          <A2UISurface />
          {!isPlaying && eventLog.length === 0 && (
            <div className="mt-8 text-center text-text-secondary text-sm">
              <p>
                Select a segment and press{" "}
                <strong className="text-accent">Play</strong> to see different
                A2UI components rendered based on intent.
              </p>
              <p className="mt-2 text-xs">
                Each segment uses different components from the same catalog.
                <br />
                &quot;All&quot; plays the full sequence.
              </p>
            </div>
          )}
        </main>
        <aside className="w-96 border-l border-gray-700 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-700">
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
              AG-UI Events
            </span>
            <span className="text-xs text-text-secondary">
              — protocol stream driving the surface
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <EventStream events={eventLog} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function App() {
  return (
    <A2UISurfaceProvider>
      <Dashboard />
    </A2UISurfaceProvider>
  );
}
