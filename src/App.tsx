import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { useReplayEngine } from "./useReplayEngine";
import recording from "./recordings/overview.json";

function Dashboard() {
  const { isPlaying, eventLog, play, restart } = useReplayEngine(recording);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b border-gray-700">
        <h1 className="text-lg font-semibold text-accent">agenthud</h1>
        <div className="flex gap-2">
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
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <A2UISurface />
        </main>
        <aside className="w-80 border-l border-gray-700">
          <EventStream events={eventLog} />
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
