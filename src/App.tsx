import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { CatalogViewer } from "./CatalogViewer";
import { EventStream } from "./EventStream";
import { useReplayEngine } from "./useReplayEngine";
import { ThemeToggle } from "./theme/ThemeToggle";
import {
  tours,
  getSegmentEvents,
  type TreeChoice,
  type Recording,
  type DecisionTree,
} from "./recordings";

type Mode = "idle" | "tree" | "all";

interface HistoryEntry {
  prompt: string;
  chosen: string;
  hint: string;
}

// Single streamlined tour: the decision-tree recording that shows "different
// intents → different layouts from one catalog".
const activeRecording: Recording = tours[0].recording;

function Dashboard() {
  const [mode, setMode] = useState<Mode>("idle");
  const [currentNode, setCurrentNode] = useState("root");
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(true);
  const [path, setPath] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [playTrigger, setPlayTrigger] = useState(0);
  const appendRef = useRef(false);
  const lastHandledTrigger = useRef(0);

  const activeTree: DecisionTree = activeRecording.tree ?? {};

  const filteredRecording = useMemo(() => {
    if (mode === "all") return activeRecording;
    if (mode === "tree" && currentSegmentId) {
      return {
        meta: activeRecording.meta,
        events: getSegmentEvents(activeRecording, currentSegmentId, {
          // eslint-disable-next-line react-hooks/refs -- deliberate latest-value side channel; recompute is driven by playTrigger
          append: appendRef.current,
        }),
      };
    }
    return { meta: activeRecording.meta, events: [] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentSegmentId, playTrigger]);

  const { isPlaying, eventLog, play, restart } = useReplayEngine(
    filteredRecording,
    useCallback(() => setShowChoices(true), [])
  );

  // Auto-play after state settles (new recording available)
  useEffect(() => {
    if (playTrigger > 0 && playTrigger !== lastHandledTrigger.current && !isPlaying) {
      lastHandledTrigger.current = playTrigger;
      if (filteredRecording.events.length > 0) {
        play({ append: appendRef.current });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTrigger, play]);

  const treeNode = activeTree[currentNode];
  const isLeaf = mode === "tree" && !isPlaying && showChoices && !treeNode;

  function triggerPlay(append: boolean) {
    appendRef.current = append;
    setShowChoices(false);
    setPlayTrigger((n) => n + 1);
  }

  function handleChoice(choice: TreeChoice, fromNode?: string) {
    const node = fromNode ? activeTree[fromNode] : activeTree[currentNode];
    if (node) {
      setHistory((prev) => [
        ...prev,
        { prompt: node.prompt, chosen: choice.label, hint: choice.hint },
      ]);
    }
    const isAppend = path.length > 0;
    setCurrentSegmentId(choice.segment);
    setPath((prev) => [...prev, choice.label]);
    setCurrentNode(choice.next ?? "__leaf__");
    triggerPlay(isAppend);
  }

  function handlePlayAll() {
    restart();
    setMode("all");
    setCurrentSegmentId(null);
    setCurrentNode("root");
    setPath([]);
    setHistory([]);
    triggerPlay(false);
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
      <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <h1 className="text-lg font-semibold text-primary">agenthud</h1>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            Replay
          </span>
          {path.length > 0 && (
            <span className="text-xs text-text-muted">
              {path.join(" → ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {(path.length > 0 || mode === "all") && (
            <button
              onClick={handleStartOver}
              className="px-3 py-1 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary"
            >
              Start over
            </button>
          )}
          <button
            onClick={handlePlayAll}
            disabled={isPlaying}
            className="px-3 py-1 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary disabled:opacity-40"
          >
            Play All
          </button>
          <CatalogViewer />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              A2UI Surface
            </span>
            <span className="text-xs text-text-muted">
              — components selected by user intent from standard catalog
            </span>
          </div>
          <A2UISurface />

          {mode === "idle" && (
            <div className="mt-8">
              <p className="text-text-muted text-sm text-center mb-4">
                {activeTree.root?.prompt ?? "Choose a path"}
              </p>
              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                {activeTree.root?.choices.map((c) => (
                  <button
                    key={c.segment}
                    onClick={() => {
                      setMode("tree");
                      handleChoice(c, "root");
                    }}
                    className="p-3 rounded-lg border border-border hover:border-primary text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-primary">
                      {c.label}
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      {c.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-center mt-4 text-xs text-text-muted">
                Or press <strong className="text-text">Play All</strong> for
                the full sequence.
              </p>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-4 space-y-1">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-text-muted">{h.prompt}</span>
                  <span className="text-primary font-medium">{h.chosen}</span>
                  <span className="text-text-muted">({h.hint})</span>
                </div>
              ))}
            </div>
          )}

          {mode === "tree" && !isPlaying && showChoices && treeNode && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-text-muted text-sm mb-3">
                {treeNode.prompt}
              </p>
              <div className="flex flex-wrap gap-2">
                {treeNode.choices.map((c) => (
                  <button
                    key={c.segment}
                    onClick={() => handleChoice(c)}
                    className="px-3 py-2 rounded-lg border border-border hover:border-primary text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-primary">
                      {c.label}
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      {c.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLeaf && (
            <div className="mt-6 border-t border-border pt-4 text-center text-text-muted text-sm">
              <p>Path complete. Try a different route or play the full sequence.</p>
            </div>
          )}
        </main>
        <aside className="w-96 border-l border-border flex flex-col">
          <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
            <span className="text-xs font-semibold text-data-positive uppercase tracking-wide">
              AG-UI Events
            </span>
            <span className="text-xs text-text-muted">
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
