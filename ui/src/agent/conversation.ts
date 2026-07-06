// Conversation turn shaping for the live agent (#156 Stages 1+2).
// A button click becomes one follow-up user turn; after each run a compact ASSISTANT summary of
// what was rendered is appended, so turn N actually sees turn N-1's output (real continuity, not
// "multiple single-turns") while staying cheap on the visitor's BYOK tokens.

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** Turns a clicked A2UI action name into the follow-up user turn sent to the agent. */
export function actionToTurn(name: string): ConversationTurn {
  return {
    role: "user",
    content: `The user clicked "${name}" — update the interface accordingly.`,
  };
}

/** Immutable append of a user turn to the conversation history. */
export function appendUserTurn(messages: ConversationTurn[], text: string): ConversationTurn[] {
  return [...messages, { role: "user", content: text }];
}

/** Immutable append of an assistant turn (the render summary) to the conversation history. */
export function appendAssistantTurn(
  messages: ConversationTurn[],
  text: string
): ConversationTurn[] {
  return [...messages, { role: "assistant", content: text }];
}

const SUMMARY_MAX_CHARS = 1200;

/**
 * Compact, model-facing summary of a rendered A2UI batch: the Text literals carry the content
 * (story state), Button action names carry the interaction semantics. Capped so multi-turn
 * histories stay cheap on the visitor's key.
 */
/** Collect a component's model-relevant content (Text literal / Button action name). */
function collectComponentContent(
  component: Record<string, unknown> | undefined,
  texts: string[],
  actions: string[]
): void {
  const text = (component?.Text as { text?: { literalString?: string } } | undefined)?.text
    ?.literalString;
  if (text) texts.push(text);
  const action = (component?.Button as { action?: { name?: string } } | undefined)?.action?.name;
  if (action) actions.push(action);
}

export function summarizeRender(messages: unknown[]): string {
  const texts: string[] = [];
  const actions: string[] = [];
  for (const msg of messages as Record<string, unknown>[]) {
    const update = msg.surfaceUpdate as
      | { components?: { component?: Record<string, unknown> }[] }
      | undefined;
    for (const comp of update?.components ?? []) {
      collectComponentContent(comp.component, texts, actions);
    }
  }
  const parts = [
    texts.length > 0 ? `You rendered: ${texts.join(" | ")}` : "You rendered a UI.",
    actions.length > 0 ? `Buttons offered: ${actions.join(", ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ").slice(0, SUMMARY_MAX_CHARS);
}
