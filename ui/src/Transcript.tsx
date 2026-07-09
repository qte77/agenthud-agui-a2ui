// A2UIViewer is from @a2ui/react (already eager via A2UISurface); Transcript itself lives in the
// Live lazy chunk, so it pulls nothing new into the eager graph.
import { A2UIViewer } from "@a2ui/react";
import { qteA2uiTheme } from "./theme/a2uiTheme";
import type { TranscriptTurn } from "./agent/transcript";

// Paged Live conversation transcript (#209): one turn shown at a time, ◀/▶ to step through history.
// A selected PAST turn renders as a frozen, inert A2UIViewer snapshot; the LATEST turn renders no viewer
// here — the live interactive A2USurface (in DashboardShell) shows it, and the shell hides that surface
// while a past turn is viewed. NOTE: accumulate() drops dataModelUpdate, so a frozen turn's data-bound
// values fall back to defaults — acceptable while UIs are literalString-driven (#195 / #206).
export function Transcript({
  turns,
  selected,
  onPrev,
  onNext,
}: {
  turns: TranscriptTurn[];
  selected: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (turns.length === 0) return null;

  const turn = turns[selected];
  const isLatest = selected === turns.length - 1;
  const arrowClass =
    "shrink-0 rounded border border-border px-2 py-0.5 transition-opacity disabled:opacity-40 hover:border-primary";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <button type="button" aria-label="Previous turn" disabled={selected === 0} onClick={onPrev} className={arrowClass}>
          ◀
        </button>
        <span className="min-w-0 flex-1 truncate text-right">
          <span className="rounded-full border border-border bg-surface px-3 py-1">{turn?.userText}</span>
        </span>
        <span className="shrink-0">
          Turn {selected + 1} of {turns.length}
        </span>
        <button type="button" aria-label="Next turn" disabled={isLatest} onClick={onNext} className={arrowClass}>
          ▶
        </button>
      </div>
      {!isLatest && turn?.snapshot ? (
        <div className="pointer-events-none opacity-80" aria-label="previous turn (read-only)">
          <A2UIViewer root={turn.snapshot.root} components={turn.snapshot.components} theme={qteA2uiTheme} />
        </div>
      ) : null}
    </div>
  );
}
