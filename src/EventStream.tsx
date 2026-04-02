import { useEffect, useRef } from "react";

export interface EventLogEntry {
  type: string;
  timestamp: number;
  text?: string;
  meta?: Record<string, string>;
}

interface EventStreamProps {
  events: EventLogEntry[];
}

function badgeColor(type: string): string {
  if (type.startsWith("RUN_")) return "bg-green-700 text-green-100";
  if (type === "TEXT_MESSAGE_START" || type === "TEXT_MESSAGE_CONTENT" || type === "TEXT_MESSAGE_END")
    return "bg-blue-700 text-blue-100";
  if (type.startsWith("TOOL_CALL")) return "bg-amber-700 text-amber-100";
  return "bg-gray-600 text-gray-200";
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
      className="h-full overflow-y-auto bg-gray-900 font-mono text-xs p-2 space-y-1"
    >
      {events.map((entry, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="shrink-0 text-gray-500 whitespace-pre">
            {formatTime(entry.timestamp)}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeColor(entry.type)}`}
          >
            {entry.type}
          </span>
          {entry.text && (
            <span className="text-gray-300 break-words">{entry.text}</span>
          )}
        </div>
      ))}
    </div>
  );
}
