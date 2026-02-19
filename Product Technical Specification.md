# Lume — Product & Technical Specification

**Version:** 1.0 · **Date:** February 19, 2026 · **Status:** Draft for engineering handoff

> **Lume** is a working name. Replace throughout before public release.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Definition](#2-product-definition)
3. [Technology Stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [Editor Engine Specification](#5-editor-engine-specification)
6. [File Operations](#6-file-operations)
7. [UI Layout & Styling](#7-ui-layout--styling)
8. [Build, Package & Distribute](#8-build-package--distribute)
9. [Future-Proofing: Themes & Plugins](#9-future-proofing-themes--plugins)
10. [Milestones & Acceptance Criteria](#10-milestones--acceptance-criteria)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

Lume is an **open-source, macOS-native markdown editor** that replicates the editing experience of Obsidian's Live Preview mode. It operates on **single files** (not vaults), uses the **same core technologies** as Obsidian (Electron + CodeMirror 6), and is distributed exclusively via **Homebrew**.

The initial release (v0.1) delivers one thing extremely well: a CodeMirror 6-based hybrid WYSIWYG/source editor that opens, edits, and saves individual `.md` files with full markdown rendering fidelity. No vault management, no file trees, no linking, no graph view. Just the best possible single-file markdown editing experience on macOS.

### What this is NOT

- Not a vault/knowledge-base tool (that's Obsidian)
- Not a multi-file workspace (initially)
- Not a plugin platform (initially)
- Not cross-platform (initially)

### Guiding Principles

1. **Obsidian editing fidelity** — The editor must feel indistinguishable from Obsidian's Live Preview mode to a daily Obsidian user
2. **Single-file simplicity** — No vault concept. Open a file, edit it, save it. Like TextEdit but for markdown
3. **Minimal dependency footprint** — Only use what's necessary. No unused libraries shipped
4. **Theme-compatible architecture** — CSS variable system must mirror Obsidian's foundation layer from day one, even if theme loading ships later
5. **Open source from day one** — MIT license. Public repository. Homebrew-installable

---

## 2. Product Definition

### 2.1 Target User

A macOS user who writes markdown daily and wants Obsidian's editing experience without Obsidian's vault model. They want to open a `.md` file from Finder, edit it with live-rendered markdown, and save it. They may use Obsidian for their knowledge base but want a lightweight editor for standalone files — READMEs, blog posts, meeting notes, quick drafts.

### 2.2 Core User Stories (v0.1)

| # | Story | Acceptance |
|---|-------|------------|
| U1 | Open a `.md` file from Finder via double-click or `File → Open` | File contents appear in the editor. macOS file association for `.md` is registered |
| U2 | Edit markdown in Live Preview mode | Markdown syntax (bold, italic, headings, links, code, etc.) renders inline. Cursor entering a rendered region reveals raw syntax. Cursor leaving restores rendering. Identical behavior to Obsidian |
| U3 | Switch to Source mode | Toggle via keyboard shortcut (`Cmd+E`) or menu. Shows raw markdown with syntax highlighting, no rendering. Identical to Obsidian's Source mode |
| U4 | Save the file | `Cmd+S` saves to the original path. "Save As" (`Cmd+Shift+S`) prompts for a new path. Dirty-file indicator (dot on close button) appears on unsaved changes |
| U5 | Create a new file | `Cmd+N` opens a new untitled editor. First `Cmd+S` prompts for save location |
| U6 | Open multiple files | Each file opens in a separate window (macOS document model). No tabs in v0.1 |
| U7 | Use standard macOS keyboard shortcuts | `Cmd+Z/Shift+Cmd+Z` undo/redo, `Cmd+C/V/X` clipboard, `Cmd+A` select all, `Cmd+F` find/replace, `Cmd+B/I` bold/italic — all work as expected |
| U8 | Choose light or dark mode | Follows macOS system appearance. Manual override in `View` menu |
| U9 | Drag-and-drop a file onto the app icon to open it | Standard macOS behavior via Electron |
| U10 | Resize the window and have the editor reflow | Responsive layout with readable line length (toggle on/off via setting) |

### 2.3 Markdown Support Matrix (v0.1)

The editor must render all of the following in Live Preview mode. "Render" means: when the cursor is not inside the syntax region, display the rendered form. When the cursor enters, reveal raw syntax.

**Must support (ship-blocking):**

| Feature | Markdown syntax | Live Preview behavior |
|---------|----------------|----------------------|
| Headings H1–H6 | `# ` through `###### ` | Renders styled heading; hides `#` marks when cursor is outside |
| Bold | `**text**` | Renders bold; hides asterisks |
| Italic | `*text*` or `_text_` | Renders italic; hides markers |
| Strikethrough | `~~text~~` | Renders strikethrough; hides tildes |
| Highlight | `==text==` | Renders highlighted; hides `==` |
| Inline code | `` `code` `` | Renders monospace with background; hides backticks |
| Code blocks | ` ```lang ` | Renders syntax-highlighted block; language label shown; hides fences |
| Blockquotes | `> text` | Renders indented quote with left border; hides `>` |
| Unordered lists | `- `, `* `, `+ ` | Renders bullet; hides marker character |
| Ordered lists | `1. ` | Renders numbered; hides raw number syntax |
| Task lists | `- [ ] ` / `- [x] ` | Renders interactive checkbox; clickable to toggle |
| Links | `[text](url)` | Renders as clickable link text; hides URL portion |
| Images | `![alt](path)` | Renders inline image; hides syntax |
| Horizontal rules | `---`, `***`, `___` | Renders horizontal line |
| Tables | GFM pipe tables | Renders formatted table |
| Footnotes | `[^1]` / `[^1]: ` | Renders footnote reference and definition |
| Math (inline) | `$LaTeX$` | Renders equation via MathJax |
| Math (block) | `$$LaTeX$$` | Renders equation block via MathJax |
| YAML frontmatter | `---` delimited block | Renders as collapsible properties panel (or hidden) |

**Should support (target for v0.1 but non-blocking):**

| Feature | Syntax |
|---------|--------|
| Callouts | `> [!note]` etc. |
| Mermaid diagrams | ` ```mermaid ` |
| Nested blockquotes | `> > text` |
| HTML inline | `<kbd>`, `<br>`, etc. |

**Explicitly deferred (not in v0.1):**

| Feature | Reason |
|---------|--------|
| `[[wikilinks]]` | Requires multi-file vault context |
| `![[embeds]]` | Requires multi-file vault context |
| `#tags` | Useful only with vault-level indexing |
| Block references `^id` | Requires multi-file vault context |

### 2.4 Keyboard Shortcuts (v0.1)

| Action | Shortcut | Notes |
|--------|----------|-------|
| Toggle Live Preview / Source | `Cmd+E` | Matches Obsidian |
| Bold | `Cmd+B` | Wraps selection in `**` |
| Italic | `Cmd+I` | Wraps selection in `*` |
| Strikethrough | `Cmd+Shift+X` | Wraps selection in `~~` |
| Inline code | `Cmd+Shift+C` | Wraps selection in backticks |
| Link | `Cmd+K` | Wraps selection in `[]()` |
| Heading increase | `Cmd+Shift+=` | Adds `#` prefix |
| Heading decrease | `Cmd+Shift+-` | Removes `#` prefix |
| Toggle checkbox | `Cmd+Enter` | Toggles `[ ]` / `[x]` |
| Indent | `Tab` | Indent list / code block |
| Outdent | `Shift+Tab` | Outdent list / code block |
| Find | `Cmd+F` | In-file search |
| Replace | `Cmd+H` | Find & replace |
| New file | `Cmd+N` | New untitled editor window |
| Open file | `Cmd+O` | macOS open dialog, filtered to `.md` |
| Save | `Cmd+S` | Save to current path |
| Save As | `Cmd+Shift+S` | Save to new path |
| Close window | `Cmd+W` | Prompts if unsaved changes |
| Undo | `Cmd+Z` | Editor undo |
| Redo | `Cmd+Shift+Z` | Editor redo |
| Toggle reading mode | `Cmd+Shift+E` | Optional — read-only rendered view |
| Zoom in/out | `Cmd+=` / `Cmd+-` | Adjust editor font size |

---

## 3. Technology Stack

### 3.1 Rationale

The goal is to match Obsidian's editing fidelity. The most reliable way to achieve that is to use the same editor engine (CodeMirror 6) in the same runtime (Electron). Alternatives like Tauri + WebView were considered but rejected because: (a) Tauri's WebView (WKWebView on macOS) has subtle rendering differences from Chromium that could affect CM6 behavior, (b) Obsidian's CSS variable system targets Chromium rendering, and (c) a lightweight Electron app with no unnecessary dependencies is still ~150MB — acceptable for a Homebrew cask.

### 3.2 Core Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Electron | Latest stable (≥ 39.x) | Chromium + Node.js shell for macOS. Provides BrowserWindow, native menus, file dialogs, app lifecycle, protocol handling |
| **Language** | TypeScript | ≥ 5.8 | All application code. Strict mode enabled |
| **Editor engine** | CodeMirror 6 | Latest (`@codemirror/view`, `@codemirror/state`, etc.) | Text editing, cursor management, undo/redo, keymaps, selection, viewport-based rendering |
| **Markdown parsing (editor)** | @lezer/markdown | Latest | Incremental markdown parsing producing a Lezer syntax tree. Used by CM6 for syntax highlighting and Live Preview decorations |
| **Markdown parsing (reading)** | markdown-it | Latest | Full markdown → HTML conversion for Reading mode. CommonMark + GFM extensions |
| **Math rendering** | MathJax 3 | Latest 3.x | Renders LaTeX in `$...$` and `$$...$$` blocks |
| **Syntax highlighting (reading)** | Prism.js | Latest | Highlights code blocks in Reading mode output. 200+ languages |
| **Bundler** | esbuild | ≥ 0.25 | Bundles TypeScript → JavaScript. Fast, minimal config |
| **Package manager** | npm | Latest | Dependency management. Lock file committed |
| **Electron packaging** | electron-builder | Latest | Produces `.dmg` and `.zip` for macOS distribution |

### 3.3 Complete npm Dependencies

**Production dependencies:**

```
electron                     # Runtime
@codemirror/view             # CM6 editor view layer
@codemirror/state            # CM6 state management
@codemirror/commands         # Standard editor commands (undo, redo, indent, etc.)
@codemirror/language         # Language support infrastructure
@codemirror/search           # Find/replace functionality
@codemirror/autocomplete     # Autocompletion (for future use; lightweight)
@codemirror/lang-markdown    # Markdown language mode (includes @lezer/markdown)
@codemirror/language-data    # Code block language detection
@lezer/markdown              # Incremental markdown parser
@lezer/common                # Shared Lezer parser types
markdown-it                  # Markdown → HTML for Reading mode
mathjax                      # MathJax 3 for LaTeX rendering
prismjs                      # Code syntax highlighting in Reading mode
```

**Dev dependencies:**

```
typescript                   # Compiler
esbuild                      # Bundler
electron-builder             # macOS packaging (.dmg, .zip)
@types/node                  # Node.js type definitions
```

That is the entire dependency list. No React, no Vue, no CSS preprocessors, no state management libraries, no utility libraries. Vanilla TypeScript with imperative DOM manipulation, matching Obsidian's approach.

### 3.4 Why No Frontend Framework

Obsidian uses no frontend framework — it manipulates the DOM directly with vanilla TypeScript. This project follows the same approach for three reasons:

1. **Fidelity** — The closer our DOM structure matches Obsidian's, the more compatible our CSS will be with Obsidian themes later
2. **Performance** — CM6 already manages its own DOM efficiently. A reactive framework adds overhead with no benefit for a text editor
3. **Simplicity** — A single-file editor doesn't need component lifecycle management, routing, or state binding

All UI construction should follow the pattern: `document.createElement()`, set classes, append children. Helper functions can abstract common patterns:

```typescript
function createDiv(cls: string, parent?: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}
```

---

## 4. Architecture

### 4.1 Process Model

Electron runs two process types:

```
┌─────────────────────────────────────────────────┐
│  Main Process (Node.js)                         │
│                                                 │
│  - App lifecycle (ready, activate, quit)        │
│  - Window management (BrowserWindow creation)   │
│  - Native menus (File, Edit, View, Help)        │
│  - File system operations (open, save, watch)   │
│  - macOS file association handling               │
│  - IPC message handling                         │
│  - Auto-update checks (future)                  │
└──────────────────────┬──────────────────────────┘
                       │ IPC (ipcMain ↔ ipcRenderer)
┌──────────────────────▼──────────────────────────┐
│  Renderer Process (Chromium) — one per window   │
│                                                 │
│  - CodeMirror 6 editor instance                 │
│  - Live Preview decoration system               │
│  - Reading mode HTML rendering                  │
│  - CSS variable-driven theming                  │
│  - In-window UI (title bar area, status bar)    │
└─────────────────────────────────────────────────┘
```

Each open file gets its own `BrowserWindow` (the standard macOS document model). All windows share the same main process but have independent renderer processes.

### 4.2 IPC Contract

Communication between main and renderer processes uses Electron's `ipcMain`/`ipcRenderer` with a strictly typed contract. All IPC channels are defined in a single shared file.

**File: `src/shared/ipc-channels.ts`**

```typescript
// Main → Renderer
export const IPC = {
  // File operations
  FILE_OPENED: 'file:opened',           // { path: string, content: string }
  FILE_SAVED: 'file:saved',             // { path: string }
  FILE_SAVE_ERROR: 'file:save-error',   // { error: string }

  // Renderer → Main
  REQUEST_SAVE: 'file:request-save',    // { content: string }
  REQUEST_SAVE_AS: 'file:request-save-as', // { content: string }
  CONTENT_CHANGED: 'file:content-changed', // { isDirty: boolean }

  // View
  SET_MODE: 'view:set-mode',            // { mode: 'live' | 'source' | 'reading' }
  SET_THEME: 'view:set-theme',          // { theme: 'light' | 'dark' | 'system' }
} as const;
```

### 4.3 Directory Structure

```
lume/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── main.ts                 # Entry point — app lifecycle, window creation
│   │   ├── menu.ts                 # macOS native menu bar construction
│   │   ├── file-manager.ts         # File read/write/watch operations
│   │   └── window-manager.ts       # BrowserWindow lifecycle
│   │
│   ├── renderer/                   # Electron renderer process
│   │   ├── index.html              # Shell HTML loaded by each BrowserWindow
│   │   ├── renderer.ts             # Entry point — initializes editor, binds IPC
│   │   ├── editor/
│   │   │   ├── editor.ts           # CM6 EditorView setup and configuration
│   │   │   ├── extensions.ts       # All CM6 extensions aggregated
│   │   │   ├── keymaps.ts          # Custom keybindings
│   │   │   ├── live-preview/
│   │   │   │   ├── decorations.ts  # Master ViewPlugin coordinating all decorations
│   │   │   │   ├── heading.ts      # Heading decoration (hide #, apply style)
│   │   │   │   ├── emphasis.ts     # Bold/italic/strikethrough decoration
│   │   │   │   ├── highlight.ts    # ==highlight== decoration
│   │   │   │   ├── code-inline.ts  # Inline code decoration
│   │   │   │   ├── code-block.ts   # Fenced code block decoration
│   │   │   │   ├── link.ts         # Link decoration (render clickable text)
│   │   │   │   ├── image.ts        # Image decoration (render inline)
│   │   │   │   ├── list.ts         # List bullet/number decoration
│   │   │   │   ├── task.ts         # Checkbox decoration
│   │   │   │   ├── blockquote.ts   # Blockquote decoration
│   │   │   │   ├── table.ts        # Table rendering decoration
│   │   │   │   ├── math.ts         # MathJax widget decoration
│   │   │   │   ├── hr.ts           # Horizontal rule decoration
│   │   │   │   ├── footnote.ts     # Footnote decoration
│   │   │   │   ├── frontmatter.ts  # YAML frontmatter decoration
│   │   │   │   └── utils.ts        # Shared helpers (cursor range checks, etc.)
│   │   │   └── reading/
│   │   │       └── reading-view.ts # markdown-it rendering for Reading mode
│   │   │
│   │   ├── ui/
│   │   │   ├── status-bar.ts       # Bottom bar (line/col, word count, mode indicator)
│   │   │   └── container.ts        # Root layout container
│   │   │
│   │   └── theme/
│   │       ├── variables.css       # CSS custom properties (Obsidian-compatible foundation)
│   │       ├── base.css            # Base element styles
│   │       ├── editor.css          # CM6 editor styles
│   │       ├── live-preview.css    # Decoration styles
│   │       ├── reading.css         # Reading mode styles
│   │       └── status-bar.css      # Status bar styles
│   │
│   └── shared/
│       ├── ipc-channels.ts         # IPC channel constants (imported by both processes)
│       └── types.ts                # Shared type definitions
│
├── resources/
│   ├── icon.icns                   # macOS app icon
│   └── entitlements.mac.plist      # macOS entitlements for code signing
│
├── esbuild.main.mjs               # esbuild config for main process
├── esbuild.renderer.mjs           # esbuild config for renderer process
├── electron-builder.yml            # electron-builder packaging config
├── tsconfig.json                   # TypeScript config (strict: true)
├── package.json
├── LICENSE                         # MIT
└── README.md
```

### 4.4 CSS Class Naming Convention

To maximize future Obsidian theme compatibility, all CSS classes must follow Obsidian's naming patterns:

```
.app-container               # Root application container
.workspace                   # Workspace area
.markdown-source-view        # Editor container (Source + Live Preview)
.markdown-source-view.is-live-preview  # Live Preview mode specifically
.markdown-reading-view       # Reading mode container
.cm-editor                   # CodeMirror root (auto-applied by CM6)
.cm-content                  # CM6 content area (auto-applied)
.cm-line                     # Individual editor line (auto-applied)
.status-bar                  # Bottom status bar
.status-bar-item             # Individual status bar element
```

For heading levels in the editor, Obsidian uses `HyperMD-header-N` classes. Replicate this:

```css
.HyperMD-header-1 { /* H1 styling */ }
.HyperMD-header-2 { /* H2 styling */ }
/* ... through .HyperMD-header-6 */
```

### 4.5 Data Flow: Opening and Editing a File

```
1. User double-clicks file.md in Finder
        │
2. macOS launches Lume (or activates it) via file association
        │
3. Main process receives 'open-file' event with file path
        │
4. main/file-manager.ts reads file as UTF-8 string
        │
5. main/window-manager.ts creates new BrowserWindow
        │
6. BrowserWindow loads renderer/index.html
        │
7. renderer.ts initializes, signals ready via IPC
        │
8. Main sends FILE_OPENED { path, content } via IPC
        │
9. renderer.ts creates CM6 EditorView with content as initial doc
        │
10. User edits → CM6 dispatches transactions → decorations update
        │
11. On Cmd+S → renderer sends REQUEST_SAVE { content } via IPC
        │
12. Main process writes content to file path via fs.writeFile
        │
13. Main sends FILE_SAVED confirmation via IPC
        │
14. Renderer clears dirty state
```

---

## 5. Editor Engine Specification

This is the most critical section. The Live Preview system is the core differentiator and the hardest part to implement.

### 5.1 How Obsidian's Live Preview Works (reference implementation)

Obsidian's Live Preview is a **CM6 ViewPlugin** that:

1. Reads the **Lezer syntax tree** from the CM6 state on every document change
2. Walks the tree to find markdown syntax nodes (headings, emphasis, links, etc.)
3. For each node, checks if the **cursor is currently inside** the node's range
4. If the cursor is **outside**: applies `Decoration.replace()` to hide syntax characters AND `Decoration.widget()` or `Decoration.mark()` to render the styled output
5. If the cursor is **inside**: removes decorations, revealing the raw markdown for editing

This creates the illusion of WYSIWYG editing while maintaining a plain-text document model underneath.

### 5.2 The Decoration ViewPlugin Pattern

Every Live Preview decoration module follows the same pattern:

```typescript
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType } from '@codemirror/view';
import { EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Decoration builder
function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursor = state.selection.main;

  syntaxTree(state).iterate({
    enter(node) {
      // Check if this is the node type we care about
      if (node.name !== 'StrongEmphasis') return;

      // Skip if cursor is inside this node
      if (cursor.from >= node.from && cursor.to <= node.to) return;

      // Hide the opening ** (2 chars)
      decorations.push(
        Decoration.replace({}).range(node.from, node.from + 2)
      );

      // Hide the closing **
      decorations.push(
        Decoration.replace({}).range(node.to - 2, node.to)
      );

      // Style the content between markers as bold
      decorations.push(
        Decoration.mark({ class: 'cm-strong' }).range(node.from + 2, node.to - 2)
      );
    }
  });

  return Decoration.set(decorations, true); // true = sort
}

// ViewPlugin that rebuilds on every change/selection
export const boldDecoration = ViewPlugin.define(
  (view) => ({ decorations: buildDecorations(view.state) }),
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.decorations.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  }
);
// Note: Actual implementation should use the `update` method for efficiency.
```

### 5.3 Decoration Specification Per Markdown Element

Each decoration module must handle exactly these Lezer node types. The node names come from `@lezer/markdown`'s syntax tree.

**Headings (`heading.ts`)**

| Lezer node | `ATXHeading1` through `ATXHeading6`, containing `HeaderMark` children |
|---|---|
| Cursor outside | Hide all `HeaderMark` characters (the `# ` prefix). Apply `.HyperMD-header-N` class to the line. Apply heading font size/weight via `Decoration.line()` |
| Cursor inside | Show raw `# Heading text`. Still apply `.HyperMD-header-N` for consistent line height |
| Edge case | Multiple `#` marks must all be hidden. Trailing `#` marks (if any) should also be hidden |

**Bold (`emphasis.ts`)**

| Lezer node | `StrongEmphasis` containing `EmphasisMark` children |
|---|---|
| Cursor outside | Hide `**` / `__` markers. Apply `.cm-strong` (font-weight: bold) to content |
| Cursor inside | Show raw `**text**` |

**Italic (`emphasis.ts`)**

| Lezer node | `Emphasis` containing `EmphasisMark` children |
|---|---|
| Cursor outside | Hide `*` / `_` markers. Apply `.cm-em` (font-style: italic) to content |
| Cursor inside | Show raw `*text*` |

**Strikethrough (`emphasis.ts`)**

| Lezer node | `Strikethrough` containing `StrikethroughMark` children |
|---|---|
| Cursor outside | Hide `~~` markers. Apply `.cm-strikethrough` (text-decoration: line-through) |
| Cursor inside | Show raw `~~text~~` |

**Highlight (`highlight.ts`)**

| Lezer node | Custom extension needed — `@lezer/markdown` does not include `==` by default |
|---|---|
| Implementation | Register a custom `@lezer/markdown` extension that parses `==text==` as a named node |
| Cursor outside | Hide `==` markers. Apply `.cm-highlight` (background-color: highlight) |
| Cursor inside | Show raw `==text==` |

**Inline code (`code-inline.ts`)**

| Lezer node | `InlineCode` containing `CodeMark` children |
|---|---|
| Cursor outside | Hide backtick markers. Apply `.cm-inline-code` (monospace font, background) |
| Cursor inside | Show raw `` `code` `` |

**Fenced code blocks (`code-block.ts`)**

| Lezer node | `FencedCode` containing `CodeMark` (fences) and `CodeInfo` (language) children |
|---|---|
| Cursor outside block | Hide opening ` ``` ` fence line. Show language label widget. Hide closing ` ``` ` fence. Apply syntax highlighting to code body using CM6's language support (not Prism). Container gets `.cm-code-block` class with background |
| Cursor inside block | Show raw fences and content. Syntax highlighting still applies |
| Language detection | Use `@codemirror/language-data` to load appropriate language grammar |

**Links (`link.ts`)**

| Lezer node | `Link` containing `LinkMark` (`[`, `]`), `URL`, and optionally `LinkTitle` |
|---|---|
| Cursor outside | Hide `[`, `](url)`. Show link text with `.cm-link` class (color, underline). Ctrl/Cmd+Click opens URL in default browser via `shell.openExternal()` |
| Cursor inside | Show raw `[text](url)` |
| Autolinks | `<https://...>` — hide angle brackets, render as clickable link |

**Images (`image.ts`)**

| Lezer node | `Image` containing `LinkMark`, `URL` children |
|---|---|
| Cursor outside | Replace entire syntax with `Decoration.widget()` containing an `<img>` element. Handle relative paths (resolve against file's directory). Handle broken images gracefully (show alt text + error icon) |
| Cursor inside | Show raw `![alt](path)` |
| Sizing | If URL contains `|300` suffix (Obsidian convention), set image width |

**Lists (`list.ts`)**

| Lezer node | `BulletList` > `ListItem` > `ListMark`; `OrderedList` > `ListItem` > `ListMark` |
|---|---|
| Cursor outside | Hide `- ` / `* ` / `+ ` / `1. ` markers. Replace with styled bullet/number widget |
| Cursor inside | Show raw marker |
| Nesting | Indentation level determines nesting. Each level gets increased left padding |

**Task lists / Checkboxes (`task.ts`)**

| Lezer node | `Task` containing `TaskMarker` |
|---|---|
| Cursor outside | Replace `[ ]` / `[x]` with interactive checkbox widget (`<input type="checkbox">`). Clicking toggles the character in the document |
| Cursor inside | Show raw `- [ ] text` |
| Toggle behavior | Clicking checkbox dispatches a CM6 transaction that replaces `[ ]` with `[x]` or vice versa at the correct offset |

**Blockquotes (`blockquote.ts`)**

| Lezer node | `Blockquote` containing `QuoteMark` children |
|---|---|
| Cursor outside | Hide `> ` markers. Apply `.cm-blockquote` class with left border and indentation |
| Cursor inside | Show `> ` markers. Left border still visible |
| Nesting | Nested `> > ` applies increased indentation. Each level adds border |

**Tables (`table.ts`)**

| Lezer node | `Table` containing `TableRow`, `TableCell`, `TableDelimiter` children |
|---|---|
| Cursor outside table | Replace entire table syntax with a rendered `<table>` widget. Cells render markdown content. Header row gets bold styling. Alignment from delimiter row (`---`, `:---:`, `---:`) is applied |
| Cursor inside table | Show raw pipe syntax. Optionally apply tab-stop alignment for readability |
| Complexity note | Table rendering is the most complex decoration. It is acceptable to ship v0.1 with tables shown in source-style with column alignment but without full widget replacement, then improve in v0.2 |

**Horizontal rules (`hr.ts`)**

| Lezer node | `HorizontalRule` |
|---|---|
| Cursor outside | Replace `---`/`***`/`___` with styled horizontal line widget |
| Cursor inside | Show raw `---` |

**Math (`math.ts`)**

| Lezer node | Custom extension — `@lezer/markdown` does not parse `$...$` by default |
|---|---|
| Implementation | Register custom inline/block extensions that parse `$...$` and `$$...$$` as named nodes |
| Cursor outside | Replace with MathJax-rendered widget. MathJax 3 must be initialized once and reused. Use `MathJax.tex2svgPromise()` for async rendering or `tex2svg()` synchronously. Cache rendered SVGs keyed by LaTeX string for performance |
| Cursor inside | Show raw `$LaTeX$` / `$$LaTeX$$` |
| Error handling | Invalid LaTeX shows error message in red within the widget |

**Footnotes (`footnote.ts`)**

| Lezer node | `Footnote` (reference) and custom parsing for definitions |
|---|---|
| Cursor outside | Render `[^1]` as superscript number. Clicking scrolls to definition at document bottom |
| Cursor inside | Show raw `[^1]` |

**YAML Frontmatter (`frontmatter.ts`)**

| Lezer node | `FrontMatter` (from `@lezer/markdown`'s frontmatter extension) |
|---|---|
| Cursor outside | Collapse to single line showing "Properties" with expand toggle. Or hide entirely. Follow Obsidian's behavior: collapsible panel |
| Cursor inside | Show raw YAML |

### 5.4 Cursor Proximity Detection

The core helper function used by every decoration module:

```typescript
/**
 * Checks if the editor's cursor(s) overlap with a given range.
 * Returns true if ANY selection cursor intersects [from, to].
 * When true, decorations should be skipped (show raw markdown).
 */
function isCursorInRange(state: EditorState, from: number, to: number): boolean {
  for (const range of state.selection.ranges) {
    // Overlap check: selection touches or is inside the node
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}
```

Important: This must handle **multiple cursors** (CM6 supports multiple selections).

### 5.5 Source Mode

Source mode is simply the CM6 editor **without** the Live Preview decoration plugins. It uses CM6's built-in markdown syntax highlighting (via `@codemirror/lang-markdown`) which applies CSS classes to syntax tokens:

```
.cm-header          → heading text
.cm-strong          → bold
.cm-emphasis        → italic
.cm-strikethrough   → strikethrough
.cm-url             → URLs
.cm-link            → link text
.cm-meta            → frontmatter delimiters, code fences
.cm-comment         → HTML comments
```

Switching modes reconfigures the CM6 extension set via a `Compartment`:

```typescript
import { Compartment } from '@codemirror/state';

const modeCompartment = new Compartment();

// Initial: Live Preview
const view = new EditorView({
  extensions: [
    // ... base extensions
    modeCompartment.of(livePreviewExtensions),
  ]
});

// Switch to Source
view.dispatch({
  effects: modeCompartment.reconfigure(sourceExtensions),
});
```

### 5.6 Reading Mode (Optional in v0.1)

Reading mode replaces the CM6 editor entirely with an HTML rendering of the document:

1. Get document content from CM6 state: `view.state.doc.toString()`
2. Parse with `markdown-it` (configured with GFM, footnotes, frontmatter plugins)
3. Post-process HTML: run MathJax on `$...$` blocks, run Prism.js on `<code>` blocks
4. Inject into a `.markdown-reading-view` container, hiding the CM6 editor

The reading view container must use Obsidian-compatible CSS classes:

```html
<div class="markdown-reading-view">
  <div class="markdown-preview-view markdown-rendered">
    <!-- rendered HTML here -->
  </div>
</div>
```

---

## 6. File Operations

### 6.1 Main Process File Manager

**File: `src/main/file-manager.ts`**

Responsibilities:

| Operation | Implementation |
|-----------|---------------|
| Read file | `fs.promises.readFile(path, 'utf-8')`. Validate UTF-8. Files > 50MB show warning dialog |
| Write file | `fs.promises.writeFile(path, content, 'utf-8')`. Write to temp file first, then `rename()` for atomicity |
| Watch file | `fs.watch(path)` — detect external changes. Notify renderer, which shows "File changed externally. Reload?" banner |
| Recent files | Store last 10 opened paths in Electron's `app.getPath('userData')/recent-files.json`. Populate `File → Open Recent` menu |

### 6.2 File Association

Register `.md` file association in `electron-builder.yml`:

```yaml
mac:
  target:
    - dmg
    - zip
  category: public.app-category.developer-tools
  fileAssociations:
    - ext: md
      name: Markdown Document
      role: Editor
      icon: icon.icns
```

And in `main.ts`, handle `open-file` events:

```typescript
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openFileInNewWindow(filePath);
});
```

### 6.3 Dirty State Management

Track unsaved changes at the renderer level:

```typescript
let isDirty = false;
let savedContent = ''; // Content at last save

// On CM6 update
view.dispatch({
  // After each transaction:
  isDirty = view.state.doc.toString() !== savedContent;
  ipcRenderer.send(IPC.CONTENT_CHANGED, { isDirty });
});

// On save success
savedContent = view.state.doc.toString();
isDirty = false;
```

Main process responds by updating the window's `documentEdited` property (shows dot on macOS close button) and `representedFilename` (shows filename in title bar with proxy icon):

```typescript
win.setDocumentEdited(isDirty);
win.setRepresentedFilename(filePath);
```

### 6.4 Window Close Behavior

On `close` event, if dirty:

```typescript
win.on('close', (event) => {
  if (isDirty) {
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save changes to "${fileName}"?`,
      detail: 'Your changes will be lost if you don't save them.',
    });
    if (choice === 0) { save().then(() => win.destroy()); }
    else if (choice === 1) { win.destroy(); }
    // choice === 2: do nothing (cancel close)
  }
});
```

---

## 7. UI Layout & Styling

### 7.1 Window Layout (v0.1)

The initial layout is minimal — just the editor and a status bar:

```
┌──────────────────────────────────────────────┐
│  macOS native title bar (with traffic lights) │
├──────────────────────────────────────────────┤
│                                              │
│               CM6 Editor                     │
│          (fills remaining space)             │
│                                              │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│  status-bar:  Ln 42, Col 8 │ 1,234 words │ Live │
└──────────────────────────────────────────────┘
```

Use Electron's default frame (not frameless) to get standard macOS title bar behavior including: traffic light buttons, title with filename, proxy icon for drag-to-Finder.

### 7.2 CSS Variable Foundation

This file is architecturally critical. It establishes the CSS custom property namespace that Obsidian themes target. Even though themes won't load in v0.1, having these variables in place ensures CSS compatibility.

**File: `src/renderer/theme/variables.css`**

```css
/* ============================================================
   Lume CSS Variables — Obsidian-Compatible Foundation
   
   These variable names match Obsidian's CSS variable system.
   Obsidian themes override these variables to restyle the app.
   DO NOT rename these without understanding the theme impact.
   ============================================================ */

:root {
  /* ── Base color palette (light mode) ── */
  --color-base-00: #ffffff;   /* Editor background */
  --color-base-05: #f7f7f7;
  --color-base-10: #f0f0f0;
  --color-base-20: #e5e5e5;
  --color-base-25: #d9d9d9;
  --color-base-30: #cccccc;
  --color-base-35: #b3b3b3;
  --color-base-40: #999999;
  --color-base-50: #808080;
  --color-base-60: #666666;
  --color-base-70: #4d4d4d;
  --color-base-100: #222222;  /* Primary text */

  /* ── Accent color (HSL for flexibility) ── */
  --accent-h: 254;
  --accent-s: 80%;
  --accent-l: 68%;
  --color-accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
  --color-accent-1: hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 5%));
  --color-accent-2: hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 10%));

  /* ── Extended colors ── */
  --color-red: #e93147;
  --color-orange: #ec7500;
  --color-yellow: #e0ac00;
  --color-green: #08b94e;
  --color-cyan: #00bfbc;
  --color-blue: #086ddd;
  --color-purple: #7852ee;
  --color-pink: #d53984;

  /* ── Typography ── */
  --font-interface-theme: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-text-theme: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-monospace-theme: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
  --font-text-size: 16px;
  --line-height-normal: 1.6;

  /* ── Editor ── */
  --editor-font-size: var(--font-text-size);
  --editor-line-height: var(--line-height-normal);

  /* ── Headings ── */
  --h1-size: 2em;
  --h2-size: 1.6em;
  --h3-size: 1.37em;
  --h4-size: 1.25em;
  --h5-size: 1.12em;
  --h6-size: 1em;
  --h1-weight: 700;
  --h2-weight: 700;
  --h3-weight: 600;
  --h4-weight: 600;
  --h5-weight: 600;
  --h6-weight: 600;
  --h1-color: var(--color-base-100);
  --h2-color: var(--color-base-100);
  --h3-color: var(--color-base-100);
  --h4-color: var(--color-base-100);
  --h5-color: var(--color-base-100);
  --h6-color: var(--color-base-100);

  /* ── Background & text ── */
  --background-primary: var(--color-base-00);
  --background-secondary: var(--color-base-05);
  --text-normal: var(--color-base-100);
  --text-muted: var(--color-base-50);
  --text-faint: var(--color-base-35);
  --text-accent: var(--color-accent);

  /* ── Code ── */
  --code-background: var(--color-base-10);
  --code-normal: var(--color-base-100);

  /* ── Interactive ── */
  --interactive-accent: var(--color-accent);
  --interactive-hover: var(--color-accent-1);

  /* ── Borders ── */
  --divider-color: var(--color-base-20);

  /* ── Readable line width ── */
  --file-line-width: 700px;
}

/* ── Dark mode ── */
.theme-dark {
  --color-base-00: #1e1e1e;
  --color-base-05: #242424;
  --color-base-10: #2b2b2b;
  --color-base-20: #363636;
  --color-base-25: #3f3f3f;
  --color-base-30: #4d4d4d;
  --color-base-35: #5c5c5c;
  --color-base-40: #6e6e6e;
  --color-base-50: #808080;
  --color-base-60: #999999;
  --color-base-70: #b3b3b3;
  --color-base-100: #dcddde;

  --code-background: var(--color-base-10);
}
```

### 7.3 Theme Toggling

Apply `.theme-light` or `.theme-dark` on `document.body`. On startup, detect macOS preference:

```typescript
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
document.body.classList.add(prefersDark.matches ? 'theme-dark' : 'theme-light');

prefersDark.addEventListener('change', (e) => {
  document.body.classList.toggle('theme-dark', e.matches);
  document.body.classList.toggle('theme-light', !e.matches);
});
```

### 7.4 Readable Line Width

When enabled (default on), constrain the editor content to `var(--file-line-width)` centered:

```css
.markdown-source-view .cm-content,
.markdown-reading-view .markdown-preview-view {
  max-width: var(--file-line-width);
  margin: 0 auto;
  padding: 0 2em;
}
```

Users can toggle this via `View → Readable Line Width` menu item.

---

## 8. Build, Package & Distribute

### 8.1 Build Pipeline

Two esbuild invocations — one for main process, one for renderer:

**Main process** (`esbuild.main.mjs`):

```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/main/main.js',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});
```

**Renderer process** (`esbuild.renderer.mjs`):

```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/renderer/renderer.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/renderer/renderer.js',
  format: 'iife',
  sourcemap: true,
  loader: { '.css': 'text' }, // Import CSS as strings if needed
});
```

CSS files are loaded via `<link>` tags in `index.html`, not bundled into JS.

### 8.2 Package Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\"",
    "dev:main": "esbuild src/main/main.ts --bundle --platform=node --target=node22 --outfile=dist/main/main.js --format=cjs --external:electron --sourcemap --watch",
    "dev:renderer": "esbuild src/renderer/renderer.ts --bundle --platform=browser --target=es2022 --outfile=dist/renderer/renderer.js --format=iife --sourcemap --watch",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "node esbuild.main.mjs",
    "build:renderer": "node esbuild.renderer.mjs",
    "start": "electron dist/main/main.js",
    "pack": "electron-builder --mac --config electron-builder.yml",
    "pack:dmg": "electron-builder --mac dmg --config electron-builder.yml",
    "pack:zip": "electron-builder --mac zip --config electron-builder.yml"
  }
}
```

### 8.3 electron-builder Configuration

**File: `electron-builder.yml`**

```yaml
appId: com.lume.editor
productName: Lume
copyright: Copyright © 2026 Lume Contributors

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - src/renderer/index.html
  - src/renderer/theme/**/*.css
  - "!node_modules"

mac:
  target:
    - target: dmg
      arch: [universal]  # x64 + arm64 universal binary
    - target: zip
      arch: [universal]
  category: public.app-category.developer-tools
  icon: resources/icon.icns
  darkModeSupport: true
  fileAssociations:
    - ext: md
      name: Markdown Document
      role: Editor
      icon: resources/icon.icns
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist
  hardenedRuntime: true
  gatekeeperAssess: false

dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

### 8.4 Homebrew Distribution

Lume distributes as a **Homebrew Cask** (since it's an Electron app, not a CLI tool).

**Cask formula** (`lume.rb`, submitted to `homebrew/homebrew-cask` or hosted in a custom tap):

```ruby
cask "lume" do
  version "0.1.0"
  sha256 "TO_BE_COMPUTED_AT_RELEASE"

  url "https://github.com/YOUR_ORG/lume/releases/download/v#{version}/Lume-#{version}-mac-universal.zip"
  name "Lume"
  desc "Markdown editor with Obsidian-style Live Preview"
  homepage "https://github.com/YOUR_ORG/lume"

  auto_updates true
  depends_on macos: ">= :monterey"

  app "Lume.app"

  zap trash: [
    "~/Library/Application Support/Lume",
    "~/Library/Preferences/com.lume.editor.plist",
    "~/Library/Caches/com.lume.editor",
  ]
end
```

**Release workflow** (GitHub Actions):

1. Tag `vX.Y.Z`
2. CI runs `npm run build && npm run pack`
3. CI uploads `.dmg` and `.zip` to GitHub Release
4. CI computes SHA-256 of `.zip`, updates cask formula, opens PR to Homebrew tap

For initial development, use a **custom tap** (`homebrew-lume`) to avoid the approval process of `homebrew/homebrew-cask`:

```bash
# Users install with:
brew tap YOUR_ORG/lume
brew install --cask lume
```

---

## 9. Future-Proofing: Themes & Plugins

These features are **not in v0.1** but the architecture must not prevent them.

### 9.1 Theme Compatibility Layer

**Why it matters now:** If the CSS variable names and DOM structure don't match Obsidian's conventions, adding theme support later requires rewriting all styles. Getting this right from day one costs nothing extra.

**Rules to follow during v0.1 development:**

1. **All colors, fonts, and sizes must reference CSS variables**, never hardcoded values in component CSS. Every `color:`, `background:`, `font-family:`, and `font-size:` must use a `var(--...)` reference
2. **CSS class names on the editor container must match Obsidian's** (`.markdown-source-view`, `.is-live-preview`, `.cm-editor`, etc.). See Section 4.4
3. **The `.theme-dark` / `.theme-light` body class pattern** must be used for light/dark switching
4. **CSS variables must live in a single `variables.css` file** that a theme could replace entirely
5. **No CSS-in-JS, no Tailwind, no utility classes.** Plain CSS files only

**What theme loading looks like later (v0.3+):**

```typescript
// Future: load a theme CSS file and inject it
function loadTheme(themePath: string) {
  const css = fs.readFileSync(themePath, 'utf-8');
  const style = document.createElement('style');
  style.id = 'user-theme';
  style.textContent = css;
  document.head.appendChild(style);
}
```

A theme file simply overrides CSS variables and adds custom rules. Because our variables match Obsidian's namespace, Obsidian themes work with zero or minimal adaptation.

### 9.2 Plugin Architecture Considerations

Plugins are a distant maybe, but avoid these architectural traps:

1. **Do not put business logic in the renderer's global scope.** Keep the editor, file operations, and UI in clearly separated modules. A future plugin API would expose controlled interfaces to these modules
2. **Do not hardcode the extension list in CM6.** Use a registry pattern where extensions are collected from a list. Plugins would add to this list
3. **Do not hardcode post-processors for Reading mode.** Use a chain pattern (array of transform functions). Plugins would add to this chain
4. **Keep the IPC contract centralized.** Plugins would need IPC access through a controlled gateway, not ad-hoc channels

No plugin loading code, API, or manifest format should be built in v0.1.

---

## 10. Milestones & Acceptance Criteria

### Milestone 1: Skeleton App (Week 1–2)

**Deliverable:** An Electron app that opens, displays a hardcoded markdown string in a CM6 editor with syntax highlighting, and has a native macOS menu bar.

| Criterion | Test |
|-----------|------|
| App launches via `npm start` | Window appears with CM6 editor |
| Native menu bar renders | File, Edit, View, Help menus visible |
| CM6 syntax highlighting works | Pasting `# Hello **world**` shows colored tokens |
| Light/dark mode switches | Toggling macOS appearance reflects in the editor |
| App builds to .app bundle | `npm run pack` produces `Lume.app` that launches from Finder |

### Milestone 2: File Operations (Week 2–3)

**Deliverable:** Open, save, and create `.md` files via native dialogs. Dirty state tracking. macOS file association.

| Criterion | Test |
|-----------|------|
| `Cmd+O` opens file picker filtered to `.md` | Selected file content loads into editor |
| `Cmd+S` saves to original path | File on disk matches editor content after save |
| `Cmd+S` on untitled file prompts Save As | Save dialog appears, file saves to chosen path |
| `Cmd+N` opens new window | New empty editor window appears |
| Dirty indicator shows | After editing, macOS title bar dot appears. After save, it disappears |
| Close with unsaved changes prompts | Save/Don't Save/Cancel dialog appears |
| `.md` file association works | Double-clicking a `.md` file in Finder opens it in Lume |

### Milestone 3: Live Preview MVP (Week 3–6)

**Deliverable:** The core Live Preview decorations for the most common markdown elements.

| Criterion | Test |
|-----------|------|
| Headings render with size/weight, `#` hidden | Type `## Hello`, move cursor away. `##` disappears, text is large/bold. Move cursor back, `##` reappears |
| Bold/italic/strikethrough render | Type `**bold**`, move away. Markers hidden, text bold. Same for `*italic*` and `~~strike~~` |
| Inline code renders | Type `` `code` ``, move away. Backticks hidden, monospace + background applied |
| Links render as clickable text | Type `[Google](https://google.com)`, move away. Shows "Google" as blue underlined text. URL hidden |
| Images render inline | Type `![](./image.png)` with valid image path. Image appears when cursor leaves. Raw syntax appears when cursor enters |
| Lists render with bullets/numbers | Type `- item`. Dash hidden, bullet shown. Same for `1. item` with number |
| Checkboxes are interactive | Type `- [ ] task`. Checkbox appears. Clicking toggles to `[x]` in the document |
| Code blocks render with highlighting | Type ` ```js ` block. Fences hidden when cursor is outside. Syntax highlighting inside |
| Blockquotes render with left border | Type `> quote`. `>` hidden, left border + indent applied |
| Math renders via MathJax | Type `$E=mc^2$`, move away. Rendered equation appears. Raw LaTeX shows on cursor enter |
| `Cmd+E` toggles Source mode | All decorations removed. Raw markdown with syntax highlighting shown |

### Milestone 4: Polish & Release (Week 6–8)

**Deliverable:** Horizontal rules, frontmatter, tables (basic), find/replace, status bar, Homebrew cask. Final QA pass.

| Criterion | Test |
|-----------|------|
| `Cmd+F` opens find bar | Search highlights matches in editor, Enter cycles through them |
| `Cmd+H` opens find/replace | Replace and Replace All work correctly |
| Status bar shows line, column, word count, mode | All values update in real-time during editing |
| Frontmatter collapses | YAML block between `---` delimiters collapses when cursor is outside |
| Tables render (at minimum: aligned, header bold) | GFM pipe table renders with alignment and header styling |
| Horizontal rules render | `---` becomes a horizontal line |
| Readable line width toggles | `View → Readable Line Width` constrains/releases content width |
| Zoom in/out works | `Cmd+=` / `Cmd+-` adjusts editor font size |
| App installs via Homebrew | `brew install --cask lume` installs and launches successfully |
| Clean uninstall | `brew uninstall --cask lume --zap` removes all traces |

---

## 11. Appendices

### Appendix A: Lezer Markdown Node Types Reference

These are the syntax tree node names produced by `@lezer/markdown` that the decoration system must handle. This list was derived from the Lezer markdown grammar source.

```
Document
  ATXHeading1, ATXHeading2, ..., ATXHeading6
    HeaderMark                    # The "# " characters
  SetextHeading1, SetextHeading2
  Paragraph
  Blockquote
    QuoteMark                     # The "> " characters
  BulletList
    ListItem
      ListMark                    # "- ", "* ", "+ "
  OrderedList
    ListItem
      ListMark                    # "1. "
  Task
    TaskMarker                    # "[ ]" or "[x]"
  FencedCode
    CodeMark                      # "```"
    CodeInfo                      # Language identifier
    CodeText
  HorizontalRule
  Link
    LinkMark                      # "[", "]", "(", ")"
    URL
    LinkTitle
  Image
    LinkMark
    URL
    LinkTitle
  Emphasis
    EmphasisMark                  # "*" or "_"
  StrongEmphasis
    EmphasisMark                  # "**" or "__"
  Strikethrough (GFM extension)
    StrikethroughMark             # "~~"
  InlineCode
    CodeMark                      # "`"
  Table (GFM extension)
    TableHeader
    TableDelimiter
    TableRow
    TableCell
  Footnote
  FrontMatter (frontmatter extension)
    FrontMatterMark               # "---"
```

**Custom extensions required** (not in stock `@lezer/markdown`):

| Feature | Node name to register | Parser extension needed |
|---------|----------------------|------------------------|
| `==highlight==` | `Highlight`, `HighlightMark` | Custom `MarkdownExtension` using `defineNodes` + `parseInline` |
| `$math$` | `InlineMath`, `MathMark` | Custom `MarkdownExtension` |
| `$$block math$$` | `BlockMath`, `MathMark` | Custom `MarkdownExtension` |
| Callouts | `Callout`, `CalloutType` | Custom `MarkdownExtension` wrapping blockquotes |

### Appendix B: Key CodeMirror 6 APIs Used

| API | Module | Purpose |
|-----|--------|---------|
| `EditorView` | `@codemirror/view` | Root editor component |
| `EditorState` | `@codemirror/state` | Immutable document state |
| `ViewPlugin` | `@codemirror/view` | Stateful view extension (used for decoration management) |
| `Decoration` | `@codemirror/view` | `.mark()`, `.replace()`, `.widget()`, `.line()` — the four decoration types |
| `WidgetType` | `@codemirror/view` | Base class for widget decorations (images, checkboxes, math, etc.) |
| `DecorationSet` | `@codemirror/view` | Immutable sorted set of decorations |
| `Compartment` | `@codemirror/state` | Dynamic extension reconfiguration (mode switching) |
| `syntaxTree()` | `@codemirror/language` | Access the Lezer syntax tree from state |
| `keymap` | `@codemirror/view` | Keybinding registration |
| `markdown()` | `@codemirror/lang-markdown` | Markdown language support with Lezer parser |

### Appendix C: Electron Security Configuration

The renderer process must have this `webPreferences` configuration:

```typescript
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,       // Renderer cannot access Node.js directly
    nodeIntegration: false,        // No require() in renderer
    sandbox: false,                // Needed for preload script IPC
  },
});
```

The **preload script** (`src/main/preload.ts`) exposes a minimal API to the renderer:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lume', {
  // File operations
  onFileOpened: (cb: (data: { path: string; content: string }) => void) =>
    ipcRenderer.on('file:opened', (_, data) => cb(data)),
  onFileSaved: (cb: (data: { path: string }) => void) =>
    ipcRenderer.on('file:saved', (_, data) => cb(data)),
  onFileSaveError: (cb: (data: { error: string }) => void) =>
    ipcRenderer.on('file:save-error', (_, data) => cb(data)),
  requestSave: (content: string) =>
    ipcRenderer.send('file:request-save', { content }),
  requestSaveAs: (content: string) =>
    ipcRenderer.send('file:request-save-as', { content }),
  notifyContentChanged: (isDirty: boolean) =>
    ipcRenderer.send('file:content-changed', { isDirty }),

  // View
  onSetMode: (cb: (data: { mode: string }) => void) =>
    ipcRenderer.on('view:set-mode', (_, data) => cb(data)),
  onSetTheme: (cb: (data: { theme: string }) => void) =>
    ipcRenderer.on('view:set-theme', (_, data) => cb(data)),

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:open-external', { url }),
});
```

### Appendix D: Recommended Development Workflow

1. **Clone repo, install deps:** `npm install`
2. **Start dev mode:** `npm run dev` (watches both main and renderer)
3. **In a second terminal:** `npm start` (launches Electron)
4. **Hot reload:** Renderer changes auto-rebuild. Press `Cmd+R` in the Electron window to reload. Main process changes require `Ctrl+C` and `npm start` again
5. **Test a specific decoration:** Open a test `.md` file with examples of the target syntax. Verify cursor-in/cursor-out behavior
6. **Build for distribution:** `npm run build && npm run pack`
7. **Test the packaged app:** Open `release/mac-universal/Lume.app` from Finder. Verify file association by double-clicking a `.md` file

### Appendix E: Open Questions for Implementer

These are decisions that the spec author considered non-blocking and intentionally left to the implementer's judgment:

1. **Table rendering complexity:** Full `<table>` widget replacement is complex. An acceptable v0.1 alternative is tab-aligned source display with header bold — decide based on time available
2. **MathJax loading strategy:** MathJax 3 is large (~2MB). Options: bundle it (increases app size), lazy-load on first `$` encounter (delay on first render), or load at startup (slower launch). Recommend: lazy-load
3. **Image path resolution:** When the user types `![](./image.png)`, how should the relative path resolve? Options: relative to the `.md` file's directory (recommended, matches Obsidian), or relative to CWD. Document the choice
4. **Undo granularity:** CM6's default undo grouping may differ from Obsidian's. Test and adjust `historyMinDepth` if needed
5. **Font picker:** Obsidian has a font picker in settings. Defer for v0.1? Or add a simple `View → Font` menu with system font dialog?
6. **Window state persistence:** Remember window position/size between launches? Recommended: yes, via `electron-window-state` or manual `localStorage`

### Appendix F: License

The project is released under the **MIT License**. All dependencies listed in Section 3.3 are MIT or MIT-compatible (CodeMirror is MIT, Electron is MIT, markdown-it is MIT, MathJax is Apache-2.0, Prism.js is MIT).

Verify license compatibility at project setup with `npx license-checker --summary`.

---

*End of specification. This document contains all context needed to build v0.1 of Lume. No prior conversation history is required.*
