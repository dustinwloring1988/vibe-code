import { AGENTS, type AgentId } from "@/lib/types";
import { useIde } from "@/lib/ide-context";
import { Sparkles, Zap, Bot } from "lucide-react";

const ICONS: Record<AgentId, typeof Sparkles> = {
  "claude-code": Sparkles,
  codex: Zap,
  opencode: Bot,
};

export function AgentPicker() {
  const { state, setAgent } = useIde();
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 p-1">
      {AGENTS.map((a) => {
        const Icon = ICONS[a.id];
        const active = state.agent === a.id;
        return (
          <button
            key={a.id}
            onClick={() => setAgent(a.id)}
            title={a.description}
            className={
              "group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition " +
              (active
                ? "bg-surface-2 text-foreground neon-border"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60")
            }
          >
            <Icon className={"h-3.5 w-3.5 " + (active ? a.accent : "")} />
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
