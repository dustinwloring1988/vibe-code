import { useMemo } from "react";
import { useIde } from "@/lib/ide-context";
import { File, Folder, FolderOpen } from "lucide-react";

interface Node {
  name: string;
  path: string;
  children?: Map<string, Node>;
}

function buildTree(paths: string[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      if (!cur.children) cur.children = new Map();
      let next = cur.children.get(name);
      if (!next) {
        next = { name, path, children: isFile ? undefined : new Map() };
        cur.children.set(name, next);
      }
      cur = next;
    }
  }
  return root;
}

function NodeView({ node, depth }: { node: Node; depth: number }) {
  const { state, openFile } = useIde();
  if (!node.children) {
    const active = state.openPath === node.path;
    return (
      <button
        onClick={() => openFile(node.path)}
        className={
          "w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition " +
          (active
            ? "bg-surface-2 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60")
        }
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <File className="h-3 w-3 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      {node.name && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-muted-foreground/80"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          <FolderOpen className="h-3 w-3 shrink-0 text-neon-cyan/60" />
          <span>{node.name}</span>
        </div>
      )}
      {[...node.children.values()]
        .sort((a, b) => Number(!!a.children === !!b.children) || a.name.localeCompare(b.name))
        .sort((a, b) => Number(!a.children) - Number(!b.children))
        .map((c) => (
          <NodeView key={c.path} node={c} depth={node.name ? depth + 1 : depth} />
        ))}
    </div>
  );
}

export function FileTree() {
  const { state } = useIde();
  const tree = useMemo(() => buildTree(Object.keys(state.files).sort()), [state.files]);
  return (
    <div className="h-full overflow-y-auto py-2">
      <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-1.5">
        <Folder className="h-3 w-3" /> project
      </div>
      <NodeView node={tree} depth={0} />
    </div>
  );
}
