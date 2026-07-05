// Conversation turn shaping for the live agent (PR2 / #156 Stage 1).
// A button click becomes one follow-up user turn; history is an immutable list of user turns
// (assistant/tool turns stay out until full multi-turn — Stage 2).

export interface UserTurn {
  role: "user";
  content: string;
}

/** Turns a clicked A2UI action name into the follow-up user turn sent to the agent. */
export function actionToTurn(name: string): UserTurn {
  return {
    role: "user",
    content: `The user clicked "${name}" — update the interface accordingly.`,
  };
}

/** Immutable append of a user turn to the conversation history. */
export function appendUserTurn(messages: UserTurn[], text: string): UserTurn[] {
  return [...messages, { role: "user", content: text }];
}
