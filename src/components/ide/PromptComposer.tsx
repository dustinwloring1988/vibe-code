import { useEffect, useRef, useState } from "react";
import { useIde } from "@/lib/ide-context";
import { ArrowUp, Square } from "lucide-react";
import { AGENTS } from "@/lib/types";

export function PromptComposer() {
  const { state, sendPrompt, cancelRun } = useIde();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = () => {
    if (!value.trim() || state.running) return;
    void sendPrompt(value);
    setValue("");
  };

  const agentName = AGENTS.find((a) => a.id === state.agent)?.name ?? state.agent;

  return (
    <div className="glass rounded-xl p-3">
      <textarea
        ref={ref}
        value={value}
        disabled={state.running}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder={`Describe what ${agentName} should build…  (⌘+Enter to send)`}
        className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          {state.running ? "agent running" : "ready"}
        </span>
        {state.running ? (
          <button
            onClick={cancelRun}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
          >
            <Square className="h-3 w-3 fill-current" /> Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed pulse-glow"
          >
            Send <ArrowUp className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
