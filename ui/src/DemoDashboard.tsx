import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DashboardShell } from "./DashboardShell";
import { useReplayEngine } from "./useReplayEngine";
import { type ViewMode } from "./ModeToggle";
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
import { parseRecordingFile } from "./recordings/importRecording";
import type { EventLogEntry } from "./agent/applyA2UIEvent";

type Mode = "idle" | "tree" | "all";

interface HistoryEntry {
  prompt: string;
  chosen: string;
  hint: string;
}

// The demo's built-in tour: the decision-tree recording ("different intents → different layouts
// from one catalog"). Lifted to component state below so an imported recording can replace it
// (arc 019). tours is a non-empty literal array; index 0 is always defined.
const defaultRecording: Recording = tours[0]!.recording;

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

export function DemoDashboard({
  view,
  onView,
  eventLog,
  setEventLog,
}: {
  view: ViewMode;
  onView: (mode: ViewMode) => void;
  eventLog: EventLogEntry[];
  setEventLog: Dispatch<SetStateAction<EventLogEntry[]>>;
}) {
  const [recording, setRecording] = useState<Recording>(defaultRecording);
  const [importError, setImportError] = useState<string | null>(null);
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

  const activeTree: DecisionTree = recording.tree ?? {};

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
    if (mode === "all") return recording;
    if (mode === "tree" && currentSegmentId) {
      return {
        meta: recording.meta,
        events: getSegmentEvents(recording, currentSegmentId, {
          append: appendRef.current,
          playedSegments,
        }),
      };
    }
    return { meta: recording.meta, events: [] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentSegmentId, playTrigger, recording]);

  const { isPlaying, play, restart } = useReplayEngine(
    filteredRecording,
    setEventLog,
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

  // Reset all tree/path state and play the whole recording linearly (shared by Play All + Import).
  function resetAndPlayAll() {
    restart();
    setMode("all");
    setCurrentSegmentId(null);
    setCurrentNode("root");
    setPath([]);
    setHistory([]);
    setPlayedSegments([]);
    triggerPlay(false);
  }

  function handlePlayAll() {
    resetAndPlayAll();
  }

  // Import a saved recording (JSON) and replay it. Validated against the SAME RecordingSchema as the
  // demo (parseRecordingFile), then fed into the unchanged useReplayEngine as a full linear sequence
  // (imported captures have no decision tree). Errors surface inline; nothing else changes on failure.
  function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    void file.text().then((raw) => {
      const result = parseRecordingFile(raw);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportError(null);
      setRecording(result.recording);
      resetAndPlayAll();
    });
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
          {/* Import a captured/shared recording (JSON) and replay it — the capture-share loop's
              receiving end (arc 019). A styled <label> wraps a hidden file input (no extra dep). */}
          <label
            title="Import a saved recording (JSON) and replay it"
            className="px-3 py-1 rounded border border-border bg-surface text-text text-sm transition-colors hover:border-primary cursor-pointer"
          >
            Import
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </>
      }
      surfaceSubtitle="components selected by user intent from standard catalog"
      eventsSubtitle="protocol stream driving the surface"
      eventLog={eventLog}
      footerLead="Interactive AG-UI replay + A2UI rendering"
    >
          {importError && (
            <p className="mt-3 text-center text-xs text-data-negative">
              Import failed: {importError}
            </p>
          )}

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
