import { contextBridge, ipcRenderer } from 'electron';
import { IPC_INVOKE, IPC_SEND, IPC_PUSH } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('marksidian', {
  // Request-response (invoke → Promise)
  save: (content: string) =>
    ipcRenderer.invoke('file:save', { content }),
  saveAs: (content: string) =>
    ipcRenderer.invoke('file:save-as', { content }),

  // Fire-and-forget (send)
  notifyContentChanged: (isDirty: boolean) =>
    ipcRenderer.send('file:content-changed', { isDirty }),
  openExternal: (url: string) =>
    ipcRenderer.send('shell:open-external', { url }),
  showContextMenu: () =>
    ipcRenderer.send('editor:context-menu'),

  // Main → Renderer listeners
  onFileOpened: (cb: (data: { path: string; content: string; dir: string }) => void) =>
    ipcRenderer.on('file:opened', (_event, data) => cb(data)),
  onSetMode: (cb: (data: { mode: string }) => void) =>
    ipcRenderer.on('view:set-mode', (_event, data) => cb(data)),
  onSetTheme: (cb: (data: { theme: string }) => void) =>
    ipcRenderer.on('view:set-theme', (_event, data) => cb(data)),
  onNewFile: (cb: () => void) =>
    ipcRenderer.on('file:new', () => cb()),

  // Menu triggers
  onMenuSave: (cb: () => void) =>
    ipcRenderer.on('menu:save', () => cb()),
  onMenuSaveAs: (cb: () => void) =>
    ipcRenderer.on('menu:save-as', () => cb()),
  onMenuToggleMode: (cb: () => void) =>
    ipcRenderer.on('menu:toggle-mode', () => cb()),
  onMenuToggleReading: (cb: () => void) =>
    ipcRenderer.on('menu:toggle-reading', () => cb()),
  onMenuToggleLineWidth: (cb: (data: { enabled: boolean }) => void) =>
    ipcRenderer.on('menu:toggle-line-width', (_event, data) => cb(data)),
  onMenuZoom: (cb: (data: { direction: string }) => void) =>
    ipcRenderer.on('menu:zoom', (_event, data) => cb(data)),
  onMenuToggleOutline: (cb: (data: { enabled: boolean }) => void) =>
    ipcRenderer.on('menu:toggle-outline', (_event, data) => cb(data)),

  getFilePath: () =>
    ipcRenderer.invoke('file:get-path'),

  // Session persistence
  onCollectSessionState: (cb: () => void) =>
    ipcRenderer.on(IPC_PUSH.SESSION_COLLECT_STATE, () => cb()),
  sendSessionState: (state: import('../shared/types').RendererSessionState) =>
    ipcRenderer.send(IPC_SEND.SESSION_STATE_RESPONSE, state),
  onRestoreState: (cb: (data: import('../shared/types').RendererSessionState) => void) =>
    ipcRenderer.on(IPC_PUSH.SESSION_RESTORE_STATE, (_event, data) => cb(data)),

  // Theme management
  fetchThemeRegistry: () =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_FETCH_REGISTRY),
  listInstalledThemes: () =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_LIST_INSTALLED),
  installTheme: (repo: string, name: string) =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_INSTALL, { repo, name }),
  uninstallTheme: (name: string) =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_UNINSTALL, { name }),
  getThemeSettings: () =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_GET_SETTINGS),
  setActiveTheme: (name: string | null) =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_SET_ACTIVE, { name }),
  getThemeCssPath: (name: string) =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_GET_CSS_PATH, { name }),
  onThemeActiveChanged: (cb: (data: { name: string | null }) => void) =>
    ipcRenderer.on(IPC_PUSH.THEME_ACTIVE_CHANGED, (_event, data) => cb(data)),

  // Settings
  onMenuOpenSettings: (cb: () => void) =>
    ipcRenderer.on('menu:open-settings', () => cb()),

  // Theme mode (light/dark/system)
  getThemeModeSettings: () =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_MODE_GET),
  setThemeModeSettings: (settings: import('../shared/types').ThemeModeSettings) =>
    ipcRenderer.invoke(IPC_INVOKE.THEME_MODE_SET, settings),
  onThemeModeChanged: (cb: (settings: import('../shared/types').ThemeModeSettings) => void) =>
    ipcRenderer.on(IPC_PUSH.THEME_MODE_CHANGED, (_event, data) => cb(data)),

  // Heading indent
  getHeadingIndentSettings: () =>
    ipcRenderer.invoke(IPC_INVOKE.HEADING_INDENT_GET_SETTINGS),
  setHeadingIndentSettings: (settings: import('../shared/types').HeadingIndentSettings) =>
    ipcRenderer.invoke(IPC_INVOKE.HEADING_INDENT_SET_SETTINGS, settings),
  onHeadingIndentChanged: (cb: (settings: import('../shared/types').HeadingIndentSettings) => void) =>
    ipcRenderer.on(IPC_PUSH.HEADING_INDENT_CHANGED, (_event, data) => cb(data)),
});
