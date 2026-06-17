import { useEffect, useRef } from "react";
import { useIde } from "@/lib/ide-context";
import { AGENTS } from "@/lib/types";
import { User, Sparkles, Terminal } from "lucide-react";

export function ChatPanel() {
  const { state } = useIde();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [state.messages]);

  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
      {state.messages.map((m) => {
        const agent = m.agent ? AGENTS.find((a) => a.id === m.agent) : undefined;
        if (m.role === "user") {
          return (
            <div key={m.id} className="flex gap-2.5 items-start">
              <div className="h-6 w-6 rounded-md bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 text-sm whitespace-pre-wrap leading-relaxed">{m.text}</div>
            </div>
          );
        }
        if (m.role === "agent") {
          return (
            <div key={m.id} className="flex gap-2.5 items-start">
              <div className="h-6 w-6 rounded-md bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <Sparkles className={"h-3.5 w-3.5 " + (agent?.accent ?? "text-neon-cyan")} />
              </div>
              <div className="flex-1 text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                {m.text}
                {state.running && <span className="caret-blink ml-0.5">▍</span>}
              </div>
            </div>
          );
        }
        return (
          <div key={m.id} className="flex gap-2.5 items-start text-xs text-muted-foreground font-mono">
            <Terminal className="h-3 w-3 mt-0.5 shrink-0 text-neon-lime/60" />
            <div className="flex-1 whitespace-pre-wrap">{m.text}</div>
          </div>
        );
      })}
    </div>
  );
}
