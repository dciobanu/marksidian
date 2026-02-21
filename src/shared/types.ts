export type EditorMode = 'live' | 'source' | 'reading';
export type ThemeMode = 'light' | 'dark' | 'system';

// ── Session persistence ────────────────────────────────────────

/** State the renderer owns and reports to main on quit. */
export interface RendererSessionState {
  cursorOffset: number;
  scrollTop: number;
  editorMode: EditorMode;
  zoomLevel: number;
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

export interface LumeAPI {
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
  getFilePath: () => Promise<string | null>;

  // Session persistence
  onCollectSessionState: (cb: () => void) => void;
  sendSessionState: (state: RendererSessionState) => void;
  onRestoreState: (cb: (data: RendererSessionState) => void) => void;
}

declare global {
  interface Window {
    lume: LumeAPI;
  }
}
