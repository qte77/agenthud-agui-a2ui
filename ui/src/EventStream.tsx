import { useEffect, useRef } from "react";
import type { EventLogEntry } from "./agent/applyA2UIEvent";

export type { EventLogEntry };

interface EventStreamProps {
  events: EventLogEntry[];
}

// Zero-blue badges from the EyeRest data arc (TEXT_MESSAGE was blue — now neutral).
function badgeColor(type: string): string {
  if (type.startsWith("RUN_")) return "bg-data-positive/15 text-data-positive";
  if (type.startsWith("TEXT_MESSAGE")) return "bg-text-muted/15 text-text-muted";
  if (type.startsWith("TOOL_CALL")) return "bg-primary/15 text-primary";
  if (type.startsWith("STEP_")) return "bg-data-caution/15 text-data-caution";
  return "bg-text-muted/15 text-text-muted";
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2).padStart(7, " ") + "s";
}

export function EventStream({ events }: EventStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-surface font-mono text-xs p-2 space-y-1.5"
    >
      {events.length === 0 && (
        <p className="text-text-muted">
          Run a prompt to see the live event stream.
        </p>
      )}
      {events.map((entry, i) => (
        <div key={i}>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-text-muted whitespace-pre">
              {formatTime(entry.timestamp)}
            </span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeColor(entry.type)}`}
            >
              {entry.type}
            </span>
            {entry.text && (
              <span className="text-text break-words">{entry.text}</span>
            )}
          </div>
          {entry.a2uiComponentTypes && entry.a2uiComponentTypes.length > 0 && (
            <div className="ml-[7.5ch] pl-2 mt-0.5 border-l border-primary">
              <span className="text-primary text-[10px]">
                processMessages →{" "}
              </span>
              <span className="text-text-muted text-[10px]">
                {entry.a2uiComponentCount} components, {entry.a2uiComponentTypes.length} types:{" "}
              </span>
              <span className="text-primary text-[10px]">
                {entry.a2uiComponentTypes.join(", ")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
