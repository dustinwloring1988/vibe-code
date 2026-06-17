import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import type { FileMap } from "./types";

let booting: Promise<WebContainer> | null = null;
let instance: WebContainer | null = null;

export function isIsolated(): boolean {
  return typeof window !== "undefined" && (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

export async function getContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (booting) return booting;
  if (!isIsolated()) {
    throw new Error(
      "WebContainer requires cross-origin isolation (COOP/COEP). Run the app locally with `bun dev` — the Vite config sets the required headers.",
    );
  }
  booting = WebContainer.boot().then((c) => {
    instance = c;
    return c;
  });
  return booting;
}

/** Convert a flat { "src/index.ts": "..." } map into a WebContainer tree. */
export function filesToTree(files: FileMap): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [rawPath, content] of Object.entries(files)) {
    const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
    if (!parts.length) continue;
    let cursor: FileSystemTree = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const existing = cursor[seg];
      if (!existing || !("directory" in existing)) {
        cursor[seg] = { directory: {} };
      }
      cursor = (cursor[seg] as { directory: FileSystemTree }).directory;
    }
    cursor[parts[parts.length - 1]] = { file: { contents: content } };
  }
  return root;
}

export async function mountFiles(files: FileMap) {
  const c = await getContainer();
  await c.mount(filesToTree(files));
}

export async function writeFile(path: string, content: string) {
  const c = await getContainer();
  const normalized = path.replace(/^\/+/, "");
  const dir = normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "";
  if (dir) await c.fs.mkdir(dir, { recursive: true });
  await c.fs.writeFile(normalized, content);
}

export interface RunHandle {
  exit: Promise<number>;
  kill: () => void;
}

export async function spawnStream(
  cmd: string,
  args: string[],
  onChunk: (text: string) => void,
): Promise<RunHandle> {
  const c = await getContainer();
  const proc = await c.spawn(cmd, args);
  proc.output.pipeTo(
    new WritableStream({
      write(chunk) {
        onChunk(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      },
    }),
  );
  return { exit: proc.exit, kill: () => proc.kill() };
}

export async function onServerReady(cb: (url: string, port: number) => void) {
  const c = await getContainer();
  c.on("server-ready", (port, url) => cb(url, port));
}
