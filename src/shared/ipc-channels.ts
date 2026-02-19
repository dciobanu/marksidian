// Request-response (invoke/handle)
export const IPC_INVOKE = {
  SAVE: 'file:save',
  SAVE_AS: 'file:save-as',
} as const;

// Fire-and-forget (send)
export const IPC_SEND = {
  CONTENT_CHANGED: 'file:content-changed',
  OPEN_EXTERNAL: 'shell:open-external',
} as const;

// Main → Renderer push (webContents.send)
export const IPC_PUSH = {
  FILE_OPENED: 'file:opened',
  SET_MODE: 'view:set-mode',
  SET_THEME: 'view:set-theme',
} as const;
