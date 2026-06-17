import type { AgentId, BridgeEvent, FileMap } from "./types";

const DEFAULT_BRIDGE = "http://localhost:8787";
const STORAGE_KEY = "vibe.bridgeUrl";

export function getBridgeUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BRIDGE;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_BRIDGE;
}

export function setBridgeUrl(url: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

export async function pingBridge(url = getBridgeUrl()): Promise<{ ok: boolean; agents?: AgentId[]; error?: string }> {
  try {
    const res = await fetch(`${url}/health`, { method: "GET" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { agents?: AgentId[] };
    return { ok: true, agents: data.agents };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ensureBridgeSession(opts: {
  sessionId: string;
  agent: AgentId;
  files?: FileMap;
}): Promise<{ ok: boolean; workdir?: string; error?: string }> {
  try {
    const res = await fetch(`${getBridgeUrl()}/session/ensure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { workdir?: string };
    return { ok: true, workdir: data.workdir };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RunOptions {
  agent: AgentId;
  prompt: string;
  files?: FileMap;
  sessionId?: string;
  signal?: AbortSignal;
}

/**
 * POST to the bridge and stream back newline-delimited JSON events.
 * Yields BridgeEvent objects as they arrive.
 */
export async function* runAgent(opts: RunOptions): AsyncGenerator<BridgeEvent> {
  const url = `${getBridgeUrl()}/run`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: opts.agent,
      prompt: opts.prompt,
      files: opts.files ?? {},
      sessionId: opts.sessionId,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge returned ${res.status}: ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as BridgeEvent;
      } catch {
        yield { type: "log", text: line };
      }
    }
  }
  if (buf.trim()) {
    try {
      yield JSON.parse(buf) as BridgeEvent;
    } catch {
      yield { type: "log", text: buf };
    }
  }
}
