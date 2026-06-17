# Vibe Bridge

Tiny local HTTP server that runs the **Claude Code**, **Codex**, and **OpenCode** SDKs and streams their output back to the browser app. The Lovable webapp can't host these SDKs itself (Cloudflare Workers can't spawn subprocesses), so they live here on your machine.

## Setup

```bash
cd bridge
npm install
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
node server.mjs
```

The server listens on `http://localhost:8787`. Override with `PORT=9000 node server.mjs`.

In the webapp top-right, click the **bridge** chip and confirm it shows `online`.

## How it works

1. Browser POSTs `/run` with `{ agent, prompt, files, sessionId }`.
2. Server seeds or reuses a temp workspace for that `sessionId` (same directory for the whole browser conversation).
3. The chosen SDK runs against that workspace, streaming `assistant`, `tool`, and `log` events back as newline-delimited JSON.
4. After the agent finishes, the server diffs the workspace and emits a `file` event for each changed file (and `delete` for removed ones).
5. The browser applies those changes to its in-memory file map, the Monaco editor, and the WebContainer preview.

## Agents

| Agent       | Package                       | Key needed          |
|-------------|-------------------------------|---------------------|
| claude-code | `@anthropic-ai/claude-code`   | `ANTHROPIC_API_KEY` |
| codex       | `@openai/codex-sdk`           | `OPENAI_API_KEY`    |
| opencode    | `@opencode-ai/sdk`            | provider key (configured in opencode's own config) |

If a package fails to install, the agent endpoint will return an `error` event explaining what to install — the others still work.

## Notes

- `permissionMode: "bypassPermissions"` is used for Claude Code so it can edit files without prompting. Workspaces are kept for the lifetime of a browser conversation (`sessionId`) and cleaned up after 24h of inactivity.
- File diffs skip `node_modules`, `.git`, `dist`, and files larger than 200KB.
- This server has no auth. Don't expose it to the public internet.
