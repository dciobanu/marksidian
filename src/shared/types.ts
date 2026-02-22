export type EditorMode = 'live' | 'source' | 'reading';
export type ThemeMode = 'light' | 'dark' | 'system';

// ── Session persistence ────────────────────────────────────────

/** State the renderer owns and reports to main on quit. */
export interface RendererSessionState {
  cursorOffset: number;
  scrollTop: number;
  editorMode: EditorMode;
  zoomLevel: number;
  outlineVisible?: boolean;
}

/** Full per-window state persisted in session.json. */
export interface WindowSessionState extends RendererSessionState {
  filePath: string | null;
  windowBounds: { x: number; y: number; width: number; height: number };
}

export interface SessionData {
  version: 1;
  windows: WindowSessionState[];
}

export interface FileOpenedPayload {
  path: string;
  content: string;
  dir: string;
}

export interface SaveResult {
  path: string;
}

// ── Theme system ──────────────────────────────────────────────

export interface ThemeRegistryEntry {
  name: string;
  author: string;
  repo: string;
  screenshot: string;
  modes: ('dark' | 'light')[];
  legacy?: boolean;
}

export interface InstalledTheme {
  name: string;
  author: string;
  version: string;
  repo: string;
}

export interface ThemeSettings {
  activeTheme: string | null;
}

// ── Heading indent ───────────────────────────────────────────

export interface HeadingIndentSettings {
  enabledInEditor: boolean;
  enabledInReading: boolean;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
}

export interface MarksidianAPI {
  save: (content: string) => Promise<SaveResult>;
  saveAs: (content: string) => Promise<SaveResult>;
  notifyContentChanged: (isDirty: boolean) => void;
  openExternal: (url: string) => void;
  showContextMenu: () => void;
  onFileOpened: (cb: (data: FileOpenedPayload) => void) => void;
  onSetMode: (cb: (data: { mode: EditorMode }) => void) => void;
  onSetTheme: (cb: (data: { theme: ThemeMode }) => void) => void;
  onMenuSave: (cb: () => void) => void;
  onMenuSaveAs: (cb: () => void) => void;
  onMenuToggleMode: (cb: () => void) => void;
  onMenuToggleReading: (cb: () => void) => void;
  onMenuToggleLineWidth: (cb: (data: { enabled: boolean }) => void) => void;
  onMenuZoom: (cb: (data: { direction: string }) => void) => void;
  onMenuToggleOutline: (cb: (data: { enabled: boolean }) => void) => void;
  getFilePath: () => Promise<string | null>;

  // Session persistence
  onCollectSessionState: (cb: () => void) => void;
  sendSessionState: (state: RendererSessionState) => void;
  onRestoreState: (cb: (data: RendererSessionState) => void) => void;

  // Theme management
  fetchThemeRegistry: () => Promise<ThemeRegistryEntry[]>;
  listInstalledThemes: () => Promise<InstalledTheme[]>;
  installTheme: (repo: string, name: string) => Promise<void>;
  uninstallTheme: (name: string) => Promise<void>;
  getThemeSettings: () => Promise<ThemeSettings>;
  setActiveTheme: (name: string | null) => Promise<void>;
  getThemeCssPath: (name: string) => Promise<string>;
  onThemeActiveChanged: (cb: (data: { name: string | null }) => void) => void;

  // Settings
  onMenuOpenSettings: (cb: () => void) => void;

  // Heading indent
  getHeadingIndentSettings: () => Promise<HeadingIndentSettings>;
  setHeadingIndentSettings: (settings: HeadingIndentSettings) => Promise<void>;
  onHeadingIndentChanged: (cb: (settings: HeadingIndentSettings) => void) => void;
}

declare global {
  interface Window {
    marksidian: MarksidianAPI;
  }
}
