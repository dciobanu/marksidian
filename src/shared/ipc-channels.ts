// Request-response (invoke/handle)
export const IPC_INVOKE = {
  SAVE: 'file:save',
  SAVE_AS: 'file:save-as',
  THEME_FETCH_REGISTRY: 'theme:fetch-registry',
  THEME_LIST_INSTALLED: 'theme:list-installed',
  THEME_INSTALL: 'theme:install',
  THEME_UNINSTALL: 'theme:uninstall',
  THEME_GET_SETTINGS: 'theme:get-settings',
  THEME_SET_ACTIVE: 'theme:set-active',
  THEME_GET_CSS_PATH: 'theme:get-css-path',
} as const;

// Fire-and-forget (send)
export const IPC_SEND = {
  CONTENT_CHANGED: 'file:content-changed',
  OPEN_EXTERNAL: 'shell:open-external',
  SESSION_STATE_RESPONSE: 'session:state-response',
} as const;

// Main → Renderer push (webContents.send)
export const IPC_PUSH = {
  FILE_OPENED: 'file:opened',
  SET_MODE: 'view:set-mode',
  SET_THEME: 'view:set-theme',
  SESSION_COLLECT_STATE: 'session:collect-state',
  SESSION_RESTORE_STATE: 'session:restore-state',
  THEME_ACTIVE_CHANGED: 'theme:active-changed',
} as const;
