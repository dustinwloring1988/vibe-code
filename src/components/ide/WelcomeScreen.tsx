import { useRef, useState, useEffect } from "react";
import { useIde } from "@/lib/ide-context";
import { AGENTS, type AgentId } from "@/lib/types";
import { ArrowUp, Paperclip, Plus, GitBranch, Image, Figma, Upload, LayoutGrid as Layout, SquareUser as UserSquare } from "lucide-react";

const QUICK_PROMPTS = [
  { icon: Image, label: "Clone a Screenshot" },
  { icon: Figma, label: "Import from Figma" },
  { icon: Upload, label: "Upload a Project" },
  { icon: Layout, label: "Landing Page" },
  { icon: UserSquare, label: "Sign Up Form" },
];

export function WelcomeScreen() {
  const { state, setAgent, sendPrompt } = useIde();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = (text?: string) => {
    const prompt = (text ?? value).trim();
    if (!prompt) return;
    void sendPrompt(prompt);
    setValue("");
  };

  const agentInfo = AGENTS.find((a) => a.id === state.agent)!;

  const isCtrlEnter = typeof navigator !== "undefined" && /mac/i.test(navigator.platform)
    ? "⌘ + Enter"
    : "Ctrl + Enter";

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background grid-bg px-4">
      {/* Title */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <GitBranch className="h-6 w-6 text-neon-cyan" />
          <h1 className="text-3xl font-bold font-mono tracking-tight">
            What can I help you{" "}
            <span className="text-neon-cyan text-glow">ship</span>?
          </h1>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          Describe your component, feature, or fix and{" "}
          <span className="text-foreground/80">{agentInfo.name}</span> will build it.
        </p>
      </div>

      {/* Composer card */}
      <div className="w-full max-w-2xl glass rounded-xl overflow-hidden neon-border">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="text-neon-cyan font-bold">{">"}_</span>
            <AgentSelector agent={state.agent} onSelect={setAgent} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]">
              {isCtrlEnter.split(" + ")[0]}
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]">
              Enter
            </kbd>
            <span className="ml-1">to send</span>
          </span>
        </div>

        {/* Textarea */}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          rows={5}
          placeholder="Describe what you want to build..."
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm placeholder:text-muted-foreground/50 font-mono focus:outline-none"
        />

        {/* Card footer */}
        <div className="flex items-center justify-between px-4 pb-4">
          <button
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-neon-cyan/40 transition">
              <Plus className="h-3.5 w-3.5" /> Project
            </button>
            <button
              onClick={() => submit()}
              disabled={!value.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition pulse-glow"
            >
              <ArrowUp className="h-3.5 w-3.5" /> Send
            </button>
          </div>
        </div>
      </div>

      {/* Quick prompt chips */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {QUICK_PROMPTS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => submit(label)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-neon-cyan/30 hover:bg-surface transition"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentSelector({ agent, onSelect }: { agent: AgentId; onSelect: (a: AgentId) => void }) {
  const [open, setOpen] = useState(false);
  const current = AGENTS.find((a) => a.id === agent)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="hover:text-foreground transition"
      >
        {current.name.toLowerCase()}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 glass rounded-md border border-border py-1 min-w-[140px]">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => { onSelect(a.id); setOpen(false); }}
              className={
                "w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 transition " +
                (a.id === agent ? "text-foreground" : "text-muted-foreground")
              }
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
