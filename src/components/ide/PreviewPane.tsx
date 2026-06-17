import { useEffect, useState } from "react";
import { useIde } from "@/lib/ide-context";
import { Play, RotateCw, AlertTriangle, Globe } from "lucide-react";
import { isIsolated } from "@/lib/webcontainer";

export function PreviewPane() {
  const { state, bootAndRun } = useIde();
  const [isolated, setIsolated] = useState(true);
  useEffect(() => setIsolated(isIsolated()), []);

  const status = state.containerStatus;
  const statusLabel: Record<typeof status, string> = {
    idle: "idle",
    booting: "booting webcontainer…",
    installing: "npm install…",
    running: "dev server running",
    error: "error",
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface/40">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Globe className="h-3 w-3 text-neon-cyan" />
          {state.previewUrl ? (
            <a
              href={state.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground hover:text-neon-cyan truncate max-w-[280px]"
            >
              {state.previewUrl}
            </a>
          ) : (
            <span>{statusLabel[status]}</span>
          )}
        </div>
        <button
          onClick={bootAndRun}
          disabled={status === "booting" || status === "installing"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:border-neon-cyan/50 disabled:opacity-50"
        >
          {status === "running" ? <RotateCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {status === "running" ? "Restart" : status === "idle" ? "Run" : "…"}
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-white">
        {!isolated ? (
          <IsolationWarning />
        ) : state.containerError ? (
          <ErrorPanel msg={state.containerError} />
        ) : state.previewUrl ? (
          <iframe
            title="preview"
            src={state.previewUrl}
            className="w-full h-full border-0"
            allow="cross-origin-isolated"
          />
        ) : status === "idle" ? (
          <IdleHero onRun={bootAndRun} />
        ) : (
          <BootingScreen log={state.containerLog} status={statusLabel[status]} />
        )}
      </div>
    </div>
  );
}

function IsolationWarning() {
  return (
    <div className="h-full grid-bg flex items-center justify-center text-foreground p-8 bg-background">
      <div className="max-w-md text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-neon-magenta" />
        <h3 className="text-lg font-semibold">WebContainer needs cross-origin isolation</h3>
        <p className="text-sm text-muted-foreground">
          This page must be served with{" "}
          <code className="font-mono text-neon-cyan">Cross-Origin-Opener-Policy</code> and{" "}
          <code className="font-mono text-neon-cyan">Cross-Origin-Embedder-Policy</code> headers.
          Run the app locally with <code className="font-mono text-neon-lime">bun dev</code> — the
          Vite config already sets them.
        </p>
      </div>
    </div>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="h-full bg-background text-foreground p-6 overflow-auto">
      <div className="flex items-center gap-2 text-destructive mb-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="font-semibold">Preview error</span>
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{msg}</pre>
    </div>
  );
}

function IdleHero({ onRun }: { onRun: () => void }) {
  return (
    <div className="h-full bg-background grid-bg flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 border border-border neon-border">
          <Play className="h-6 w-6 text-neon-cyan" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Boot the sandbox</h3>
        <p className="text-sm text-muted-foreground">
          Spin up a real Node + Vite environment inside your browser to preview the app the agent is building.
        </p>
        <button
          onClick={onRun}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground pulse-glow"
        >
          Run sandbox
        </button>
      </div>
    </div>
  );
}

function BootingScreen({ log, status }: { log: string; status: string }) {
  return (
    <div className="h-full bg-background text-foreground p-4 font-mono text-xs overflow-auto">
      <div className="text-neon-cyan mb-2">▸ {status}</div>
      <pre className="text-muted-foreground whitespace-pre-wrap">{log || "…"}</pre>
    </div>
  );
}
