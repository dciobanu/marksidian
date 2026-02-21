import { contextBridge, ipcRenderer } from 'electron';
import { IPC_SEND, IPC_PUSH } from '../shared/ipc-channels';

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

  getFilePath: () =>
    ipcRenderer.invoke('file:get-path'),

  // Session persistence
  onCollectSessionState: (cb: () => void) =>
    ipcRenderer.on(IPC_PUSH.SESSION_COLLECT_STATE, () => cb()),
  sendSessionState: (state: import('../shared/types').RendererSessionState) =>
    ipcRenderer.send(IPC_SEND.SESSION_STATE_RESPONSE, state),
  onRestoreState: (cb: (data: import('../shared/types').RendererSessionState) => void) =>
    ipcRenderer.on(IPC_PUSH.SESSION_RESTORE_STATE, (_event, data) => cb(data)),
});
