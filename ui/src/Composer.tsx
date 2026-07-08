import { useState } from "react";

// Free-text follow-up input for Live mode (#195): continue the conversation without clicking a
// rendered Button. Sits at the bottom of the main column (DashboardShell `children`); disabled while
// a turn streams or before the first run. Draft text is local — the parent only learns of a send.
export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <form
      className="sticky bottom-0 mt-3 flex gap-2 border-t border-border bg-bg pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = draft.trim();
        if (disabled || !text) return;
        onSend(text);
        setDraft("");
      }}
    >
      <input
        type="text"
        className="w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
        placeholder="Message the agent — continue this conversation"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        disabled={disabled}
        className="shrink-0 rounded bg-primary px-3 py-1.5 text-sm text-primary-on transition-opacity disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
