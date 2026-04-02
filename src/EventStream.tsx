import { useEffect, useRef } from "react";

export interface EventLogEntry {
  type: string;
  timestamp: number;
  text?: string;
  a2uiComponentCount?: number;
  a2uiComponentTypes?: string[];
}

interface EventStreamProps {
  events: EventLogEntry[];
}

function badgeColor(type: string): string {
  if (type.startsWith("RUN_")) return "bg-green-700 text-green-100";
  if (type.startsWith("TEXT_MESSAGE")) return "bg-blue-700 text-blue-100";
  if (type.startsWith("TOOL_CALL")) return "bg-amber-700 text-amber-100";
  if (type.startsWith("STEP_")) return "bg-gray-600 text-gray-200";
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
      className="h-full overflow-y-auto bg-gray-900 font-mono text-xs p-2 space-y-1.5"
    >
      {events.map((entry, i) => (
        <div key={i}>
          <div className="flex items-start gap-2">
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
          {entry.a2uiComponentTypes && entry.a2uiComponentTypes.length > 0 && (
            <div className="ml-[7.5ch] pl-2 mt-0.5 border-l border-amber-800">
              <span className="text-amber-400 text-[10px]">
                processMessages →{" "}
              </span>
              <span className="text-gray-400 text-[10px]">
                {entry.a2uiComponentCount} components:{" "}
              </span>
              <span className="text-amber-300 text-[10px]">
                {entry.a2uiComponentTypes.join(", ")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
