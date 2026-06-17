import { lazy, Suspense, useEffect, useState } from "react";
import { useIde } from "@/lib/ide-context";

// Monaco editor needs `window`/`document` and cannot run during SSR — load it lazily on the client only.
const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

function langFor(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
}

export function EditorPane() {
  const { state, updateFile } = useIde();
  const path = state.openPath;
  const value = path ? state.files[path] ?? "" : "";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!path) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-mono">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border text-xs font-mono text-muted-foreground bg-surface/40">
        {path}
      </div>
      <div className="flex-1 min-h-0">
        {mounted ? (
          <Suspense
            fallback={
              <div className="h-full grid place-items-center text-xs font-mono text-muted-foreground">
                loading editor…
              </div>
            }
          >
            <Editor
              height="100%"
              path={path}
              language={langFor(path)}
              value={value}
              theme="vs-dark"
              onChange={(v) => updateFile(path, v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                padding: { top: 12 },
              }}
            />
          </Suspense>
        ) : (
          <pre className="h-full overflow-auto p-3 text-xs font-mono whitespace-pre-wrap">
            {value}
          </pre>
        )}
      </div>
    </div>
  );
}
