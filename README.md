# Marksidian

A Markdown editor with Obsidian-style Live Preview, built on Electron and CodeMirror 6.

## Features

- **Three editing modes** — Live Preview, Source, and Reading
- **Live Preview decorations** — headings, bold/italic, links, images, code blocks (Prism.js syntax highlighting), tables, task lists, blockquotes, horizontal rules, footnotes, highlights, and collapsible YAML frontmatter
- **Math rendering** — inline (`$...$`) and block (`$$...$$`) via KaTeX
- **Mermaid diagrams** — rendered as SVG in Reading view
- **Obsidian theme support** — browse and install 1000+ community themes (Settings, `Cmd+,`)
- **Session persistence** — restores open files, cursor position, scroll, editor mode, and zoom on relaunch
- **Keyboard shortcuts** — `Cmd+B` bold, `Cmd+I` italic, `Cmd+K` link, `Cmd+E` toggle mode, `Cmd+Shift+E` reading mode, and more
- **System theme** — follows macOS light/dark preference

## Getting Started

**Prerequisites:** Node.js 22+ and npm.

```bash
git clone https://github.com/CodingHaus/marksidian.git
cd marksidian
npm install
npm run build
npm start
```

## Development

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with esbuild watch (main + renderer) |
| `npm run build` | Production build (main CJS + renderer IIFE + KaTeX assets) |
| `npm start` | Launch the Electron app |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run pack` | Package for macOS (DMG + ZIP) |

### Project Structure

```
src/
├── main/                  # Electron main process
│   ├── main.ts            # App lifecycle, IPC handlers, custom protocol
│   ├── preload.ts         # Context-isolated bridge (window.marksidian)
│   ├── window-manager.ts  # Window creation, unsaved-changes dialog
│   ├── file-manager.ts    # Atomic writes, recent files
│   ├── session-manager.ts # Save/restore session on quit/launch
│   ├── theme-manager.ts   # Obsidian theme registry, install/uninstall
│   └── menu.ts            # Application menu and accelerators
├── renderer/              # Renderer process
│   ├── renderer.ts        # Entry point, IPC listeners, mode switching
│   ├── index.html
│   ├── editor/
│   │   ├── editor.ts      # CodeMirror 6 setup and API
│   │   ├── extensions.ts  # Base CM6 extensions
│   │   ├── keymaps.ts     # Custom keyboard shortcuts
│   │   ├── live-preview/  # 15 decoration plugins
│   │   └── reading/       # markdown-it based reading view
│   ├── ui/                # Theme modal, status bar, container
│   └── theme/             # CSS (variables, editor, reading, settings)
├── shared/                # IPC channel constants and TypeScript types
└── e2e/                   # Playwright E2E tests
```

### Architecture

Marksidian follows the standard Electron two-process model:

- **Main process** handles file I/O, window management, session persistence, and theme management. All filesystem and network access lives here.
- **Renderer process** runs the CodeMirror 6 editor with 15 live-preview decoration plugins, a markdown-it reading view, and the theme/settings UI.
- **Preload bridge** (`window.marksidian`) exposes a typed API across the context-isolation boundary. The renderer never accesses Node.js directly.
- **IPC** uses three patterns: `invoke` (request-response), `send` (fire-and-forget), and `push` (main-to-renderer broadcast).

Local images and theme CSS are loaded through the `marksidian-asset://` custom protocol, which bypasses CSP restrictions.

## Testing

```bash
npm run build
npm run test:e2e
```

Tests require a build first. Playwright runs 223 tests across 10 suites:

| Suite | Coverage |
|-------|----------|
| 01-launch | App startup, editor mount, status bar |
| 02-typing | Text input, undo/redo, indentation |
| 03-decorations | All 15 live-preview plugins, math, code blocks |
| 04-file-operations | Save, open, dirty state tracking |
| 05-mode-switching | Live/Source/Reading transitions, formatting shortcuts, zoom |
| 06-navigation | Cursor movement, selection, clipboard, edge cases |
| 07-session | Session save/restore across restarts |
| 08-reverse-typing | Stress tests: reverse assembly, section swaps |
| 09-reading-view | Rendering, mermaid, frontmatter, font parity, link handling |
| 10-themes | Theme install/activate/persist, settings modal |

Tests run serially (`workers: 1`) since Electron requires a single app instance.

## Packaging

```bash
npm run pack
```

Produces a macOS DMG and ZIP in the `release/` directory. The app registers as a handler for `.md` files.

## License

MIT
