import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2, Check, AlertCircle } from "lucide-react";
import { getBridgeUrl, setBridgeUrl, pingBridge } from "@/lib/bridge-client";

export function BridgeStatus() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"unknown" | "ok" | "down">("unknown");
  const [agents, setAgents] = useState<string[]>([]);

  useEffect(() => setUrl(getBridgeUrl()), []);

  const check = async (u?: string) => {
    const result = await pingBridge(u ?? getBridgeUrl());
    setStatus(result.ok ? "ok" : "down");
    setAgents(result.agents ?? []);
  };

  useEffect(() => {
    check();
    const i = setInterval(check, 10000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    setBridgeUrl(url);
    check(url);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-neon-cyan/40 transition"
      >
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (status === "ok" ? "bg-neon-lime" : status === "down" ? "bg-destructive" : "bg-muted-foreground")
          }
        />
        bridge {status === "ok" ? "online" : status === "down" ? "offline" : "?"}
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="glass w-full max-w-lg rounded-xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-lg font-semibold">Local agent bridge</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  The bridge is a tiny Node server that hosts the Claude Code, Codex, and OpenCode SDKs.
                  Run it locally — see <code className="font-mono text-neon-cyan">/bridge/README.md</code>.
                </p>
              </div>
              <label className="block text-sm">
                <span className="text-muted-foreground">Bridge URL</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:8787"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="rounded-md border border-border bg-surface-2/40 p-3 text-xs">
                {status === "ok" ? (
                  <div className="flex items-center gap-2 text-neon-lime">
                    <Check className="h-4 w-4" />
                    Connected. Agents available: {agents.join(", ") || "(none reported)"}
                  </div>
                ) : status === "down" ? (
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Bridge unreachable. Open a terminal in <code className="font-mono">/bridge</code> and run{" "}
                      <code className="font-mono">npm install && node server.mjs</code>.
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Checking…</span>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
