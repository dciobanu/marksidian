export type EditorMode = 'live' | 'source' | 'reading';
export type ThemeMode = 'light' | 'dark' | 'system';

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
}

declare global {
  interface Window {
    lume: LumeAPI;
  }
}
