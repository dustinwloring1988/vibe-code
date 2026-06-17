// Vibe Coding Suite — local agent bridge
//
// Tiny HTTP server that exposes Claude Code, Codex, and OpenCode SDKs to the
// browser app. Run on your own machine; the browser app talks to it on
// http://localhost:8787.
//
//   cd bridge
//   npm install
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... node server.mjs
//
// Endpoints
//   GET  /health  -> { ok, agents }
//   POST /run     -> NDJSON stream of BridgeEvent objects
//
// Each /run request runs the chosen agent inside a temp workspace seeded with
// the files the browser sent. When the browser sends a sessionId, the same
// workspace (and agent thread/session where supported) is reused for the
// whole conversation. As the agent writes/edits files, we diff the workspace
// and stream `{type:"file"}` events back so the browser keeps an in-memory
// mirror it can mount in WebContainer.

import express from "express";
import cors from "cors";
import { mkdtemp, writeFile, mkdir, readFile, readdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { workdir: string, agent?: string, claudeSessionId?: string, codexThread?: unknown, opencodeServer?: { close?: () => Promise<void> }, opencodeClient?: unknown, opencodeSessionId?: string, lastUsed: number }>} */
const sessions = new Map();

const HAS_ANTHROPIC = Boolean(process.env.ANTHROPIC_API_KEY);
const HAS_OPENAI = Boolean(process.env.OPENAI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    agents: ["claude-code", "codex", "opencode"],
    keys: { anthropic: HAS_ANTHROPIC, openai: HAS_OPENAI },
  });
});

/** Pre-create a temp workspace (and OpenCode session when applicable). */
app.post("/session/ensure", async (req, res) => {
  const { sessionId, agent = "opencode", files = {} } = req.body ?? {};
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const { session, workdir } = await getOrCreateWorkspace(sessionId, agent, files);
    const agentState = session ?? { workdir, agent, lastUsed: Date.now() };

    if (agent === "opencode") {
      await ensureOpencodeSession(agentState, workdir, () => {});
    }

    res.json({ ok: true, workdir, agent, sessionId });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post("/run", async (req, res) => {
  const { agent, prompt, files = {}, sessionId } = req.body ?? {};
  if (!agent || !prompt) {
    res.status(400).json({ error: "agent and prompt are required" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (ev) => {
    res.write(JSON.stringify(ev) + "\n");
    if (typeof res.flush === "function") res.flush();
  };

  // Acknowledge immediately so the client knows the bridge accepted the run
  send({ type: "log", text: "run accepted" });

  let session = null;
  let workdir;
  let ephemeral = true;

  try {
    ({ session, workdir, ephemeral } = await getOrCreateWorkspace(sessionId, agent, files));
    send({
      type: "log",
      text: sessionId && session
        ? `workspace: ${workdir} (session ${sessionId.slice(0, 8)}…)`
        : `workspace: ${workdir}`,
    });

    const before = await snapshot(workdir);

    // Agent handles live on the session object (persisted or per-run ephemeral).
    const agentState = session ?? { workdir, agent, lastUsed: Date.now() };

    if (agent === "claude-code") await runClaudeCode({ prompt, cwd: workdir, send, session: agentState });
    else if (agent === "codex") await runCodex({ prompt, cwd: workdir, send, session: agentState });
    else if (agent === "opencode") await runOpencode({ prompt, cwd: workdir, send, session: agentState, ephemeral });
    else send({ type: "error", message: `Unknown agent: ${agent}` });

    const after = await snapshot(workdir);
    for (const [rel, content] of after) {
      if (before.get(rel) !== content) send({ type: "file", path: rel, content });
    }
    for (const rel of before.keys()) {
      if (!after.has(rel)) send({ type: "delete", path: rel });
    }

    send({ type: "done" });
  } catch (e) {
    send({ type: "error", message: e?.message || String(e) });
    send({ type: "done" });
  } finally {
    res.end();
    if (ephemeral && workdir) {
      rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

async function getOrCreateWorkspace(sessionId, agent, files) {
  const now = Date.now();
  pruneSessions(now);

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastUsed = now;
    if (session.agent !== agent) {
      if (session.agent) await resetAgentHandles(session);
      session.agent = agent;
    }
    await syncFiles(session.workdir, files);
    return { session, workdir: session.workdir, ephemeral: false };
  }

  const workdir = await mkdtemp(path.join(tmpdir(), "vibe-"));
  await syncFiles(workdir, files);

  if (!sessionId) {
    return { session: null, workdir, ephemeral: true };
  }

  const session = { workdir, agent, lastUsed: now };
  sessions.set(sessionId, session);
  return { session, workdir, ephemeral: false };
}

async function syncFiles(workdir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(workdir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
}

async function resetAgentHandles(session) {
  session.claudeSessionId = undefined;
  session.codexThread = undefined;
  if (session.opencodeServer) {
    await session.opencodeServer.close?.().catch(() => {});
  }
  session.opencodeServer = undefined;
  session.opencodeClient = undefined;
  session.opencodeSessionId = undefined;
}

function pruneSessions(now) {
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      sessions.delete(id);
      rm(session.workdir, { recursive: true, force: true }).catch(() => {});
      session.opencodeServer?.close?.().catch(() => {});
    }
  }
}

// ---------- Agents ----------

async function runClaudeCode({ prompt, cwd, send, session }) {
  if (!HAS_ANTHROPIC) {
    send({ type: "error", message: "ANTHROPIC_API_KEY not set in bridge env" });
    return;
  }
  let query;
  try {
    ({ query } = await import("@anthropic-ai/claude-code"));
  } catch (e) {
    send({ type: "error", message: `Install @anthropic-ai/claude-code in /bridge: ${e.message}` });
    return;
  }
  send({ type: "log", text: "→ claude-code: starting" });
  const options = { cwd, permissionMode: "bypassPermissions" };
  if (session?.claudeSessionId) {
    options.resume = session.claudeSessionId;
    send({ type: "log", text: "→ claude-code: resuming session" });
  }
  for await (const msg of query({ prompt, options })) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text") send({ type: "assistant", text: block.text });
        if (block.type === "tool_use") send({ type: "tool", name: block.name, input: block.input });
      }
    } else if (msg.type === "result") {
      if (session && msg.session_id) session.claudeSessionId = msg.session_id;
      send({ type: "log", text: `claude-code: ${msg.subtype}` });
    }
  }
}

async function runCodex({ prompt, cwd, send, session }) {
  if (!HAS_OPENAI) {
    send({ type: "error", message: "OPENAI_API_KEY not set in bridge env" });
    return;
  }
  let Codex;
  try {
    ({ Codex } = await import("@openai/codex-sdk"));
  } catch (e) {
    send({ type: "error", message: `Install @openai/codex-sdk in /bridge: ${e.message}` });
    return;
  }
  send({ type: "log", text: "→ codex: starting" });
  if (!session?.codexThread) {
    const codex = new Codex();
    session.codexThread = codex.startThread({ workingDirectory: cwd, skipGitRepoCheck: true });
    send({ type: "log", text: "→ codex: new thread" });
  } else {
    send({ type: "log", text: "→ codex: continuing thread" });
  }
  const { events } = await session.codexThread.runStreamed(prompt);
  for await (const ev of events) {
    if (ev.type === "item.completed" && ev.item?.item_type === "agent_message") {
      send({ type: "assistant", text: ev.item.text ?? "" });
    } else if (ev.type === "item.completed" && ev.item?.item_type === "command_execution") {
      send({ type: "tool", name: "exec", input: ev.item.command });
    } else if (ev.type === "turn.failed") {
      send({ type: "error", message: ev.error?.message || "codex turn failed" });
    }
  }
}

async function ensureOpencodeSession(session, cwd, send) {
  let createOpencodeServer, createOpencodeClient;
  try {
    ({ createOpencodeServer, createOpencodeClient } = await import("@opencode-ai/sdk"));
  } catch (e) {
    throw new Error(`Install @opencode-ai/sdk in /bridge: ${e.message}`);
  }

  if (!session.opencodeServer) {
    send({ type: "log", text: "→ opencode: booting local server" });
    session.opencodeServer = await createOpencodeServer({ hostname: "127.0.0.1", port: 0 });
    session.opencodeClient = createOpencodeClient({ baseUrl: session.opencodeServer.url });
  }

  if (!session.opencodeSessionId) {
    const created = await session.opencodeClient.session.create({ query: { directory: cwd } });
    if (created.error) {
      throw new Error(created.error?.data?.message || "opencode session.create failed");
    }
    session.opencodeSessionId = created.data.id;
    send({ type: "log", text: `→ opencode: session ${session.opencodeSessionId}` });
  } else {
    send({ type: "log", text: "→ opencode: continuing session" });
  }
}

function extractOpencodeText(result) {
  if (!result || result.error) return "";
  const parts = result.data?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

async function runOpencode({ prompt, cwd, send, session, ephemeral = false }) {
  try {
    await ensureOpencodeSession(session, cwd, send);

    const client = session.opencodeClient;
    const result = await client.session.prompt({
      path: { id: session.opencodeSessionId },
      query: { directory: cwd },
      body: { parts: [{ type: "text", text: prompt }] },
    });

    if (result.error) {
      send({
        type: "error",
        message: result.error?.data?.message || "opencode prompt failed",
      });
      return;
    }

    const text = extractOpencodeText(result);
    if (text) send({ type: "assistant", text });
    else send({ type: "log", text: "→ opencode: finished (no text in response)" });
  } catch (e) {
    send({ type: "error", message: e?.message || String(e) });
  } finally {
    if (ephemeral && session?.opencodeServer) {
      await session.opencodeServer.close?.().catch(() => {});
      session.opencodeServer = undefined;
      session.opencodeClient = undefined;
      session.opencodeSessionId = undefined;
    }
  }
}

// ---------- Workspace snapshot ----------

const IGNORE = new Set(["node_modules", ".git", "dist", ".next", ".cache"]);

async function snapshot(root) {
  const out = new Map();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (IGNORE.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const s = await stat(abs);
        if (s.size > 200_000) continue; // skip big files
        const rel = path.relative(root, abs).split(path.sep).join("/");
        out.set(rel, await readFile(abs, "utf8").catch(() => ""));
      }
    }
  }
  await walk(root);
  return out;
}

app.listen(PORT, () => {
  console.log(`vibe-bridge listening on http://localhost:${PORT}`);
  console.log(`  ANTHROPIC_API_KEY: ${HAS_ANTHROPIC ? "set" : "MISSING"}`);
  console.log(`  OPENAI_API_KEY:    ${HAS_OPENAI ? "set" : "MISSING"}`);
});
