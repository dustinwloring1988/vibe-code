import { createFileRoute } from "@tanstack/react-router";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { IdeProvider, useIde } from "@/lib/ide-context";
import { AgentPicker } from "@/components/ide/AgentPicker";
import { PromptComposer } from "@/components/ide/PromptComposer";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { FileTree } from "@/components/ide/FileTree";
import { EditorPane } from "@/components/ide/EditorPane";
import { PreviewPane } from "@/components/ide/PreviewPane";
import { BridgeStatus } from "@/components/ide/BridgeStatus";
import { WelcomeScreen } from "@/components/ide/WelcomeScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vibe Coding Suite" },
      {
        name: "description",
        content:
          "Multi-agent vibe coding IDE. Pick Claude Code, Codex, or OpenCode, prompt them, and preview the result in a WebContainer sandbox.",
      },
      { property: "og:title", content: "Vibe Coding Suite" },
      {
        property: "og:description",
        content: "Multi-agent vibe coding IDE with live WebContainer preview.",
      },
    ],
  }),
  component: VibeIDE,
});

function VibeIDE() {
  return (
    <IdeProvider>
      <IdeShell />
    </IdeProvider>
  );
}

function IdeShell() {
  const { state } = useIde();
  if (!state.started) return <WelcomeScreen />;
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 min-h-0 p-2">
        <PanelGroup orientation="horizontal" className="h-full w-full flex">
          <Panel defaultSize={26} minSize={18}>
            <div className="h-full glass rounded-xl flex flex-col">
              <SectionHeader title="Conversation" subtitle="agent ↔ you" />
              <ChatPanel />
              <div className="p-2 border-t border-border">
                <PromptComposer />
              </div>
            </div>
          </Panel>
          <Handle />

          <Panel defaultSize={42} minSize={24}>
            <div className="h-full glass rounded-xl flex overflow-hidden">
              <div className="w-52 shrink-0 border-r border-border">
                <FileTree />
              </div>
              <div className="flex-1 min-w-0">
                <EditorPane />
              </div>
            </div>
          </Panel>
          <Handle />

          <Panel defaultSize={32} minSize={20}>
            <div className="h-full glass rounded-xl overflow-hidden flex flex-col">
              <SectionHeader title="Preview" subtitle="webcontainer · localhost" />
              <div className="flex-1 min-h-0">
                <PreviewPane />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="h-12 shrink-0 border-b border-border flex items-center justify-between px-3 bg-surface/40 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-neon-cyan to-neon-magenta grid place-items-center text-background font-black text-sm">
            V
          </div>
          <h1 className="text-sm font-semibold tracking-tight">
            vibe<span className="text-neon-cyan">.</span>code
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono ml-1">
            suite
          </span>
        </div>
        <div className="h-5 w-px bg-border mx-2" />
        <AgentPicker />
      </div>
      <BridgeStatus />
    </header>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
      <h2 className="text-xs font-semibold tracking-wide">{title}</h2>
      {subtitle && (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function Handle() {
  return (
    <PanelResizeHandle className="w-2 group">
      <div className="h-full w-full flex items-center justify-center">
        <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-neon-cyan/60 transition" />
      </div>
    </PanelResizeHandle>
  );
}
