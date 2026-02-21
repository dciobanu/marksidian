import { app, ipcMain, BrowserWindow, dialog, protocol, net, shell, Menu } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writeFile } from './file-manager';
import {
  createWindow,
  openFileInWindow,
  openFileInNewWindow,
  getFilePathForWindow,
  setFilePathForWindow,
} from './window-manager';
import { buildMenu } from './menu';
import { IPC_INVOKE, IPC_SEND, IPC_PUSH } from '../shared/ipc-channels';
import { loadSession, saveSession, collectSessionState } from './session-manager';

// Register custom protocol for loading local assets (images)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'marksidian-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

// Track whether the app was opened via double-clicking a .md file
let openedViaFile = false;

// Session save-on-quit
let isCollectingSession = false;

app.on('before-quit', async (event) => {
  if (isCollectingSession) return; // re-entrant call after save — let it quit

  event.preventDefault();
  isCollectingSession = true;

  try {
    const session = await collectSessionState();
    saveSession(session);
  } catch {
    // Don't block quit if session save fails
  }

  // 5s safety timeout in case quit was cancelled (e.g. unsaved-changes dialog)
  setTimeout(() => { isCollectingSession = false; }, 5000);

  app.quit();
});

app.whenReady().then(async () => {
  // Handle marksidian-asset:// protocol for local image loading
  protocol.handle('marksidian-asset', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch(`file://${filePath}`);
  });

  buildMenu();

  // Restore previous session, or open a blank window
  if (!openedViaFile) {
    const session = loadSession();
    if (session && session.windows.length > 0) {
      await restoreSession(session);
    } else {
      createWindow();
    }
  } else {
    // open-file handler already created windows; nothing to do
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

async function restoreSession(session: import('../shared/types').SessionData): Promise<void> {
  let restoredCount = 0;

  for (const ws of session.windows) {
    // If the window had a file, check it still exists
    if (ws.filePath) {
      try {
        await fs.promises.access(ws.filePath, fs.constants.R_OK);
      } catch {
        continue; // File was deleted — skip this window
      }
    }

    const win = createWindow(ws.windowBounds);
    restoredCount++;

    if (ws.filePath) {
      win.webContents.once('did-finish-load', () => {
        openFileInWindow(win, ws.filePath!).then(() => {
          // Give the renderer a moment to process file:opened, then send restore
          setTimeout(() => {
            win.webContents.send(IPC_PUSH.SESSION_RESTORE_STATE, {
              cursorOffset: ws.cursorOffset,
              scrollTop: ws.scrollTop,
              editorMode: ws.editorMode,
              zoomLevel: ws.zoomLevel,
            });
          }, 100);
        });
      });
    } else {
      // Untitled window — just restore editor state (mode, zoom)
      win.webContents.once('did-finish-load', () => {
        win.webContents.send(IPC_PUSH.SESSION_RESTORE_STATE, {
          cursorOffset: ws.cursorOffset,
          scrollTop: ws.scrollTop,
          editorMode: ws.editorMode,
          zoomLevel: ws.zoomLevel,
        });
      });
    }
  }

  // If all session windows were skipped (e.g. all files deleted), open a blank window
  if (restoredCount === 0) {
    createWindow();
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open from Finder (double-click .md)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openedViaFile = true;
  if (app.isReady()) {
    openFileInNewWindow(filePath);
  } else {
    app.whenReady().then(() => openFileInNewWindow(filePath));
  }
});

// IPC Handlers

// Save file
ipcMain.handle(IPC_INVOKE.SAVE, async (event, { content }: { content: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error('No window found');

  let filePath = getFilePathForWindow(win);
  if (!filePath) {
    // No path yet — do Save As
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePath) {
      throw new Error('Save cancelled');
    }
    filePath = result.filePath;
    setFilePathForWindow(win, filePath);
  }

  await writeFile(filePath, content);
  win.setDocumentEdited(false);
  return { path: filePath };
});

// Save As
ipcMain.handle(IPC_INVOKE.SAVE_AS, async (event, { content }: { content: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error('No window found');

  const result = await dialog.showSaveDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  if (result.canceled || !result.filePath) {
    throw new Error('Save cancelled');
  }

  await writeFile(result.filePath, content);
  setFilePathForWindow(win, result.filePath);
  win.setDocumentEdited(false);
  return { path: result.filePath };
});

// Content changed notification
ipcMain.on(IPC_SEND.CONTENT_CHANGED, (event, { isDirty }: { isDirty: boolean }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setDocumentEdited(isDirty);
  }
});

// Open external URL
ipcMain.on(IPC_SEND.OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
  shell.openExternal(url);
});

// Get file path for current window
ipcMain.handle('file:get-path', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return getFilePathForWindow(win);
});

// Context menu (right-click)
ipcMain.on('editor:context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const menu = Menu.buildFromTemplate([
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    { role: 'selectAll' },
  ]);
  menu.popup({ window: win });
});
