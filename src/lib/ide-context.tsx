import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { AgentId, ChatMessage, FileMap } from "./types";
import { ensureBridgeSession, runAgent } from "./bridge-client";
import { mountFiles, writeFile, spawnStream, onServerReady, isIsolated } from "./webcontainer";

// ---------------- Starter project ----------------
const STARTER_FILES: FileMap = {
  "package.json": JSON.stringify(
    {
      name: "vibe-app",
      type: "module",
      scripts: { dev: "vite", build: "vite build" },
      dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
      devDependencies: {
        vite: "^7.0.0",
        "@vitejs/plugin-react": "^5.0.0",
      },
    },
    null,
    2,
  ),
  "vite.config.js": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], server: { host: true, port: 5173 } });
`,
  "index.html": `<!doctype html><html><head><meta charset="utf-8" /><title>Vibe App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
  "src/main.jsx": `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
`,
  "src/App.jsx": `export default function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 32, color: "#0ff" }}>
      <h1>Hello from the vibe sandbox ✨</h1>
      <p>Prompt an agent and watch this file change.</p>
    </div>
  );
}
`,
};

// ---------------- State ----------------
interface State {
  files: FileMap;
  openPath: string | null;
  messages: ChatMessage[];
  running: boolean;
  agent: AgentId;
  previewUrl: string | null;
  containerStatus: "idle" | "booting" | "installing" | "running" | "error";
  containerError: string | null;
  containerLog: string;
  started: boolean;
}

type Action =
  | { type: "set-agent"; agent: AgentId }
  | { type: "open"; path: string }
  | { type: "set-file"; path: string; content: string }
  | { type: "delete-file"; path: string }
  | { type: "set-files"; files: FileMap }
  | { type: "msg"; message: ChatMessage }
  | { type: "set-running"; running: boolean }
  | { type: "preview-url"; url: string | null }
  | { type: "container-status"; status: State["containerStatus"]; error?: string | null }
  | { type: "container-log"; chunk: string }
  | { type: "start" };

const initial: State = {
  files: STARTER_FILES,
  openPath: "src/App.jsx",
  messages: [
    {
      id: "welcome",
      role: "system",
      text: "Welcome to the vibe coding suite. OpenCode is ready — describe what you want, hit ⌘+Enter.",
      ts: Date.now(),
    },
  ],
  running: false,
  agent: "opencode",
  previewUrl: null,
  containerStatus: "idle",
  containerError: null,
  containerLog: "",
  started: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set-agent":
      return { ...state, agent: action.agent };
    case "open":
      return { ...state, openPath: action.path };
    case "set-file":
      return {
        ...state,
        files: { ...state.files, [action.path]: action.content },
        openPath: state.openPath ?? action.path,
      };
    case "delete-file": {
      const next = { ...state.files };
      delete next[action.path];
      return { ...state, files: next, openPath: state.openPath === action.path ? null : state.openPath };
    }
    case "set-files":
      return { ...state, files: action.files };
    case "msg": {
      const idx = state.messages.findIndex((m) => m.id === action.message.id);
      if (idx >= 0) {
        const messages = state.messages.slice();
        messages[idx] = action.message;
        return { ...state, messages };
      }
      return { ...state, messages: [...state.messages, action.message] };
    }
    case "set-running":
      return { ...state, running: action.running };
    case "preview-url":
      return { ...state, previewUrl: action.url };
    case "container-status":
      return { ...state, containerStatus: action.status, containerError: action.error ?? null };
    case "container-log":
      return { ...state, containerLog: (state.containerLog + action.chunk).slice(-20_000) };
    case "start":
      return { ...state, started: true };
    default:
      return state;
  }
}

// ---------------- Context ----------------
interface Ctx {
  state: State;
  setAgent: (a: AgentId) => void;
  openFile: (p: string) => void;
  updateFile: (p: string, c: string) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  cancelRun: () => void;
  bootAndRun: () => Promise<void>;
}

const IdeCtx = createContext<Ctx | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  const sessionIdRef = useRef(crypto.randomUUID());
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await ensureBridgeSession({
        sessionId: sessionIdRef.current,
        agent: "opencode",
        files: STARTER_FILES,
      });
      if (cancelled) return;
      dispatch({
        type: "msg",
        message: {
          id: "workspace-ready",
          role: "system",
          text: result.ok
            ? `OpenCode workspace ready at ${result.workdir}`
            : `⚠ Could not prepare workspace: ${result.error}. Start the bridge with \`cd bridge && node server.mjs\`.`,
          ts: Date.now(),
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAgent = useCallback((agent: AgentId) => dispatch({ type: "set-agent", agent }), []);
  const openFile = useCallback((path: string) => dispatch({ type: "open", path }), []);
  const updateFile = useCallback((path: string, content: string) => {
    dispatch({ type: "set-file", path, content });
    // mirror to WC if booted
    writeFile(path, content).catch(() => {});
  }, []);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "set-running", running: false });
  }, []);

  const sendPrompt = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text || stateRef.current.running) return;
    const agent = stateRef.current.agent;
    dispatch({ type: "start" });
    dispatch({
      type: "msg",
      message: { id: crypto.randomUUID(), role: "user", text, ts: Date.now() },
    });
    dispatch({ type: "set-running", running: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const agentMsgId = crypto.randomUUID();
    let agentBuf = "";

    try {
      for await (const ev of runAgent({
        agent,
        prompt: text,
        files: stateRef.current.files,
        sessionId: sessionIdRef.current,
        signal: ctrl.signal,
      })) {
        if (ev.type === "log") {
          dispatch({
            type: "msg",
            message: { id: crypto.randomUUID(), role: "system", text: ev.text, ts: Date.now() },
          });
        } else if (ev.type === "tool") {
          dispatch({
            type: "msg",
            message: {
              id: crypto.randomUUID(),
              role: "system",
              text: `↳ tool: ${ev.name}`,
              ts: Date.now(),
            },
          });
        } else if (ev.type === "assistant") {
          agentBuf += ev.text;
          dispatch({
            type: "msg",
            message: { id: agentMsgId, role: "agent", agent, text: agentBuf, ts: Date.now() },
          });
        } else if (ev.type === "file") {
          dispatch({ type: "set-file", path: ev.path, content: ev.content });
          writeFile(ev.path, ev.content).catch(() => {});
        } else if (ev.type === "delete") {
          dispatch({ type: "delete-file", path: ev.path });
        } else if (ev.type === "error") {
          dispatch({
            type: "msg",
            message: { id: crypto.randomUUID(), role: "system", text: `⚠ ${ev.message}`, ts: Date.now() },
          });
        } else if (ev.type === "done") {
          if (ev.summary && !agentBuf) {
            dispatch({
              type: "msg",
              message: { id: agentMsgId, role: "agent", agent, text: ev.summary, ts: Date.now() },
            });
          } else if (!agentBuf) {
            dispatch({
              type: "msg",
              message: {
                id: agentMsgId,
                role: "agent",
                agent,
                text: "(Agent finished without a text reply — check system logs above for details.)",
                ts: Date.now(),
              },
            });
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!ctrl.signal.aborted) {
        dispatch({
          type: "msg",
          message: {
            id: crypto.randomUUID(),
            role: "system",
            text: `⚠ Bridge error: ${message}. Is the bridge running? See /bridge/README.md.`,
            ts: Date.now(),
          },
        });
      }
    } finally {
      dispatch({ type: "set-running", running: false });
      abortRef.current = null;
    }
  }, []);

  const bootAndRun = useCallback(async () => {
    if (!isIsolated()) {
      dispatch({
        type: "container-status",
        status: "error",
        error:
          "Browser is not cross-origin isolated. WebContainer needs COOP/COEP headers — run `bun dev` locally.",
      });
      return;
    }
    try {
      dispatch({ type: "container-status", status: "booting" });
      await mountFiles(stateRef.current.files);
      dispatch({ type: "container-status", status: "installing" });
      const install = await spawnStream("npm", ["install"], (c) =>
        dispatch({ type: "container-log", chunk: c }),
      );
      const code = await install.exit;
      if (code !== 0) {
        dispatch({ type: "container-status", status: "error", error: `npm install exited ${code}` });
        return;
      }
      await onServerReady((url) => dispatch({ type: "preview-url", url }));
      dispatch({ type: "container-status", status: "running" });
      await spawnStream("npm", ["run", "dev"], (c) =>
        dispatch({ type: "container-log", chunk: c }),
      );
    } catch (e) {
      dispatch({
        type: "container-status",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const value = useMemo(
    () => ({ state, setAgent, openFile, updateFile, sendPrompt, cancelRun, bootAndRun }),
    [state, setAgent, openFile, updateFile, sendPrompt, cancelRun, bootAndRun],
  );

  return <IdeCtx.Provider value={value}>{children}</IdeCtx.Provider>;
}

export function useIde() {
  const v = useContext(IdeCtx);
  if (!v) throw new Error("useIde must be used within IdeProvider");
  return v;
}
