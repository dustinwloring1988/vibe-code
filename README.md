# 🚀 Vibe Coding Suite (`vibe.code`)

Vibe Coding Suite is a multi-agent vibe coding IDE designed for a seamless, prompt-driven development experience. It allows you to orchestrate multiple AI agents—such as Claude Code, Codex, and OpenCode—to generate code and instantly preview the results in a live WebContainer sandbox.

## ✨ Features

- **Multi-Agent Orchestration**: Switch between different AI coding agents to find the best "vibe" for your task.
- **Live Sandbox Preview**: Integrated WebContainer API provides a full-featured browser-based environment to run and preview your code in real-time.
- **Modern IDE Interface**: 
  - **File Tree**: Navigate your project structure.
  - **Code Editor**: Powered by Monaco Editor for a familiar coding experience.
  - **Resizable Panels**: Flexible layout management using `react-resizable-panels`.
  - **Chat-Driven Workflow**: Direct interaction loop between you and the AI agents.

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React + Vite + Nitro)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide React](https://lucide.dev/)
- **Runtime Sandbox**: [WebContainer API](https://webcontainers.org/)
- **Package Manager**: Bun

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vibe-code
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

### Development

Start the development server:
```bash
bun run dev
```
The application will be available at `http://localhost:5173` (or the port specified by Vite).

### Build & Preview

Build the project for production:
```bash
bun run build
```

Preview the production build:
```bash
bun run preview
```

## 📂 Project Structure

- `src/routes/`: Application routes and page definitions.
- `src/components/ide/`: Core IDE components (Editor, File Tree, Chat, Preview).
- `src/lib/`: Utility functions and shared context (e.g., `ide-context.ts`).
- `src/router.tsx`: Router configuration and query client setup.

## 📜 Available Scripts

- `dev`: Starts the Vite development server.
- `build`: Builds the application for production.
- `build:dev`: Builds the application in development mode.
- `preview`: Previews the production build locally.
- `lint`: Runs ESLint to check for code quality issues.
- `format`: Runs Prettier to format the codebase.
