import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { CatalogViewer } from "./CatalogViewer";
import { EventStream } from "./EventStream";
import { useReplayEngine } from "./useReplayEngine";
import {
  fullRecording,
  decisionTree,
  getSegmentEvents,
  type TreeChoice,
} from "./recordings";

type Mode = "idle" | "tree" | "all";

interface HistoryEntry {
  prompt: string;
  chosen: string;
  hint: string;
}

function Dashboard() {
  const [mode, setMode] = useState<Mode>("idle");
  const [currentNode, setCurrentNode] = useState("root");
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(true);
  const [path, setPath] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const needsPlayRef = useRef(false);
  const appendRef = useRef(false);

  const filteredRecording = useMemo(() => {
    if (mode === "all") return fullRecording;
    if (mode === "tree" && currentSegmentId) {
      return {
        meta: fullRecording.meta,
        events: getSegmentEvents(fullRecording, currentSegmentId, {
          append: path.length > 0,
        }),
      };
    }
    return { meta: fullRecording.meta, events: [] };
  }, [mode, currentSegmentId, path.length]);

  const { isPlaying, eventLog, play, restart } = useReplayEngine(
    filteredRecording,
    useCallback(() => setShowChoices(true), [])
  );

  // Auto-play when segment changes in tree mode
  useEffect(() => {
    if (needsPlayRef.current && !isPlaying && mode === "tree" && currentSegmentId) {
      needsPlayRef.current = false;
      play({ append: appendRef.current });
    }
  }, [currentSegmentId, isPlaying, mode, play]);

  const treeNode = decisionTree[currentNode];
  const isLeaf = mode === "tree" && !isPlaying && showChoices && !treeNode;

  function handleChoice(choice: TreeChoice, fromNode?: string) {
    const node = fromNode ? decisionTree[fromNode] : decisionTree[currentNode];
    if (node) {
      setHistory((prev) => [
        ...prev,
        { prompt: node.prompt, chosen: choice.label, hint: choice.hint },
      ]);
    }
    setShowChoices(false);
    appendRef.current = path.length > 0;
    setCurrentSegmentId(choice.segment);
    setPath((prev) => [...prev, choice.label]);
    setCurrentNode(choice.next ?? "__leaf__");
    needsPlayRef.current = true;
  }

  function handlePlayAll() {
    setMode("all");
    setCurrentSegmentId(null);
    setCurrentNode("root");
    setPath([]);
    setShowChoices(false);
    needsPlayRef.current = false;
    setTimeout(() => play(), 0);
  }

  function handleStartOver() {
    restart();
    setMode("idle");
    setCurrentNode("root");
    setCurrentSegmentId(null);
    setPath([]);
    setHistory([]);
    setShowChoices(true);
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b border-gray-700">
        <h1 className="text-lg font-semibold text-accent">agenthud</h1>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
            Replay
          </span>
          {path.length > 0 && (
            <span className="text-xs text-text-secondary">
              {path.join(" → ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode !== "idle" && (
            <button
              onClick={handleStartOver}
              className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-sm"
            >
              Start over
            </button>
          )}
          <button
            onClick={handlePlayAll}
            disabled={isPlaying}
            className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-sm disabled:opacity-40"
          >
            Play All
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
              — components selected by user intent from standard catalog
            </span>
          </div>
          <A2UISurface />

          {/* Idle: show initial tree choices */}
          {mode === "idle" && (
            <div className="mt-8">
              <p className="text-text-secondary text-sm text-center mb-4">
                {decisionTree.root?.prompt ?? "Choose a path"}
              </p>
              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                {decisionTree.root?.choices.map((c) => (
                  <button
                    key={c.segment}
                    onClick={() => {
                      setMode("tree");
                      handleChoice(c, "root");
                    }}
                    className="p-3 rounded-lg border border-gray-700 hover:border-accent text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-accent">
                      {c.label}
                    </span>
                    <span className="text-xs text-text-secondary ml-2">
                      {c.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-center mt-4 text-xs text-text-secondary">
                Or press <strong className="text-gray-300">Play All</strong> for
                the full sequence.
              </p>
            </div>
          )}

          {/* Decision history */}
          {history.length > 0 && (
            <div className="mt-4 space-y-1">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="text-gray-600">{h.prompt}</span>
                  <span className="text-accent font-medium">{h.chosen}</span>
                  <span className="text-gray-600">({h.hint})</span>
                </div>
              ))}
            </div>
          )}

          {/* Tree mode: show next choices after segment completes */}
          {mode === "tree" && !isPlaying && showChoices && treeNode && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <p className="text-text-secondary text-sm mb-3">
                {treeNode.prompt}
              </p>
              <div className="flex flex-wrap gap-2">
                {treeNode.choices.map((c) => (
                  <button
                    key={c.segment}
                    onClick={() => handleChoice(c)}
                    className="px-3 py-2 rounded-lg border border-gray-700 hover:border-accent text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-accent">
                      {c.label}
                    </span>
                    <span className="text-xs text-text-secondary ml-2">
                      {c.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leaf: no more choices */}
          {isLeaf && (
            <div className="mt-6 border-t border-gray-700 pt-4 text-center text-text-secondary text-sm">
              <p>Path complete. Try a different route or play the full sequence.</p>
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
