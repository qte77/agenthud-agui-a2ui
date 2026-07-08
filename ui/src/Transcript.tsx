import { useEffect, useRef } from "react";
// A2UIViewer is from @a2ui/react (already eager via A2UISurface); Transcript itself lives in the
// Live lazy chunk, so it pulls nothing new into the eager graph.
import { A2UIViewer } from "@a2ui/react";
import { qteA2uiTheme } from "./theme/a2uiTheme";
import type { TranscriptTurn } from "./agent/transcript";

// The Live conversation transcript (#195): one row per turn (the user's text + that turn's rendered
// surface). Every turn EXCEPT the latest is frozen as a read-only A2UIViewer snapshot — the latest
// stays the live interactive surface rendered above (DashboardShell). Inert frozen turns:
// pointer-events-none, no onAction. NOTE: accumulate() drops dataModelUpdate, so a frozen turn's
// data-bound values fall back to defaults — acceptable while UIs are literalString-driven (#195).
export function Transcript({ turns }: { turns: TranscriptTurn[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Follow-scroll: keep the newest turn in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length]);

  if (turns.length === 0) return null;

  const lastIndex = turns.length - 1;
  return (
    <div className="space-y-4">
      {turns.map((turn, i) => (
        <div key={i} className="space-y-2">
          <p className="text-xs text-text-muted text-right">
            <span className="rounded-full border border-border bg-surface px-3 py-1">
              {turn.userText}
            </span>
          </p>
          {i < lastIndex && turn.snapshot && (
            <div className="pointer-events-none opacity-80" aria-label="previous turn (read-only)">
              <A2UIViewer
                root={turn.snapshot.root}
                components={turn.snapshot.components}
                theme={qteA2uiTheme}
              />
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
