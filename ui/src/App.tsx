import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A2UISurfaceProvider } from "./A2UISurface";
import { DashboardShell } from "./DashboardShell";
import { useA2UIActions } from "@a2ui/react";
import { useReplayEngine } from "./useReplayEngine";
import { type ViewMode } from "./ModeToggle";

// Code-split the live tier: the AI SDK loads only when Live mode is opened, so the
// default Demo (offline) tier stays lean.
const LiveDashboard = lazy(() =>
  import("./LiveDashboard").then((m) => ({ default: m.LiveDashboard }))
);
import {
  tours,
  getSegmentEvents,
  findChoiceByAction,
  type TreeChoice,
  type TreeNode,
  type Recording,
  type DecisionTree,
} from "./recordings";
import { setActionHandler } from "./agent/actionBridge";

type Mode = "idle" | "tree" | "all";

interface HistoryEntry {
  prompt: string;
  chosen: string;
  hint: string;
}

// Single streamlined tour: the decision-tree recording that shows "different
// intents → different layouts from one catalog".
// tours is a non-empty literal array; index 0 is always defined
const activeRecording: Recording = tours[0]!.recording;

/** Renders the tree-choice buttons when in tree mode and choices are available. */
function DemoTreeChoiceView({
  mode,
  isPlaying,
  showChoices,
  node,
  onChoice,
}: {
  mode: Mode;
  isPlaying: boolean;
  showChoices: boolean;
  node: TreeNode | undefined;
  onChoice: (c: TreeChoice) => void;
}) {
  if (mode !== "tree" || isPlaying || !showChoices || !node) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-text-muted text-sm mb-3">{node.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {node.choices.map((c) => (
          <button
            key={c.segment}
            onClick={() => onChoice(c)}
            className="px-3 py-2 rounded-lg border border-border hover:border-primary text-left transition-colors"
          >
            <span className="text-sm font-medium text-primary">{c.label}</span>
            <span className="text-xs text-text-muted ml-2">{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Renders the leaf-end message when the path is complete and no further node exists. */
function DemoLeafView({
  mode,
  isPlaying,
  showChoices,
  treeNode,
}: {
  mode: Mode;
  isPlaying: boolean;
  showChoices: boolean;
  treeNode: TreeNode | undefined;
}) {
  if (mode !== "tree" || isPlaying || !showChoices || treeNode) return null;
  return (
    <div className="mt-6 border-t border-border pt-4 text-center text-text-muted text-sm">
      <p>Path complete. Try a different route or play the full sequence.</p>
    </div>
  );
}

function DemoDashboard({
  view,
  onView,
}: {
  view: ViewMode;
  onView: (mode: ViewMode) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [currentNode, setCurrentNode] = useState("root");
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(true);
  const [path, setPath] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [playTrigger, setPlayTrigger] = useState(0);
  // Segment ids the visitor has already played — seeds append-mode root patching so refs to
  // visited sections keep stacking while never-played refs are stripped.
  const [playedSegments, setPlayedSegments] = useState<string[]>([]);
  const appendRef = useRef(false);
  const lastHandledTrigger = useRef(0);

  const activeTree: DecisionTree = activeRecording.tree ?? {};

  // Rendered A2UI Buttons drive the tree: the recording's choices declare which action name
  // triggers them (TreeChoice.action), and clicks arrive via the same actionBridge Live uses.
  // Unregistered on unmount, so Live re-registers its own handler cleanly on view switch.
  useEffect(() => {
    setActionHandler((name) => {
      const choice = findChoiceByAction(activeTree[currentNode], name);
      if (choice) handleChoice(choice);
    });
    return () => setActionHandler(null);
  });

  const filteredRecording = useMemo((): Pick<Recording, "meta" | "events"> => {
    if (mode === "all") return activeRecording;
    if (mode === "tree" && currentSegmentId) {
      return {
        meta: activeRecording.meta,
        events: getSegmentEvents(activeRecording, currentSegmentId, {
          append: appendRef.current,
          playedSegments,
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
    // The outgoing segment has fully played by the time the next choice is made.
    if (currentSegmentId) {
      setPlayedSegments((prev) => [...prev, currentSegmentId]);
    }
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
    setPlayedSegments([]);
    triggerPlay(false);
  }

  function handleStartOver() {
    restart();
    setMode("idle");
    setCurrentNode("root");
    setCurrentSegmentId(null);
    setPath([]);
    setHistory([]);
    setPlayedSegments([]);
    setShowChoices(true);
  }

  return (
    <DashboardShell
      view={view}
      onView={onView}
      headerMiddle={
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            Replay
          </span>
          {path.length > 0 && (
            // Truncate long paths (loops make them unbounded); full path stays legible via title.
            <span className="min-w-0 truncate text-xs text-text-muted" title={path.join(" → ")}>
              {path.join(" → ")}
            </span>
          )}
        </div>
      }
      extraControls={
        <>
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
        </>
      }
      surfaceSubtitle="components selected by user intent from standard catalog"
      eventsSubtitle="protocol stream driving the surface"
      eventLog={eventLog}
      footerLead="AG-UI event replay + A2UI rendering"
    >

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

          <DemoTreeChoiceView
            mode={mode}
            isPlaying={isPlaying}
            showChoices={showChoices}
            node={treeNode}
            onChoice={handleChoice}
          />

          <DemoLeafView
            mode={mode}
            isPlaying={isPlaying}
            showChoices={showChoices}
            treeNode={treeNode}
          />
    </DashboardShell>
  );
}

function Root() {
  const [view, setView] = useState<ViewMode>("demo");
  const { clearSurfaces } = useA2UIActions();

  const onView = useCallback(
    (next: ViewMode) => {
      if (next === view) return;
      clearSurfaces(); // start the other mode on a clean surface
      setView(next);
    },
    [view, clearSurfaces]
  );

  return view === "demo" ? (
    <DemoDashboard view={view} onView={onView} />
  ) : (
    <Suspense
      fallback={
        <div className="p-8 text-center text-text-muted text-sm">
          Loading live agent…
        </div>
      }
    >
      <LiveDashboard mode={view} onMode={onView} />
    </Suspense>
  );
}

export function App() {
  return (
    <A2UISurfaceProvider>
      <Root />
    </A2UISurfaceProvider>
  );
}
