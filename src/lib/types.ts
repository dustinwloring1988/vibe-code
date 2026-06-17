export type AgentId = "claude-code" | "codex" | "opencode";

export interface AgentInfo {
  id: AgentId;
  name: string;
  vendor: string;
  description: string;
  accent: string; // tailwind text color class
}

export const AGENTS: AgentInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    description: "Agentic coding with claude-sonnet via the Claude Code SDK.",
    accent: "text-neon-magenta",
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    description: "OpenAI Codex SDK driving gpt-5 / codex-mini to write code.",
    accent: "text-neon-lime",
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "opencode.ai",
    description: "Open-source agent runtime — bring any provider.",
    accent: "text-neon-cyan",
  },
];

/** Server-sent events from the bridge */
export type BridgeEvent =
  | { type: "log"; level?: "info" | "warn" | "error"; text: string }
  | { type: "assistant"; text: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "file"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "done"; summary?: string }
  | { type: "error"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  agent?: AgentId;
  text: string;
  ts: number;
}

export interface FileMap {
  [path: string]: string;
}
