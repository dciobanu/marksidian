import { app, ipcMain, BrowserWindow, dialog, protocol, net, shell } from 'electron';
import * as path from 'path';
import { writeFile } from './file-manager';
import {
  createWindow,
  openFileInNewWindow,
  getFilePathForWindow,
  setFilePathForWindow,
} from './window-manager';
import { buildMenu } from './menu';
import { IPC_INVOKE, IPC_SEND } from '../shared/ipc-channels';

// Register custom protocol for loading local assets (images)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lume-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

app.whenReady().then(() => {
  // Handle lume-asset:// protocol for local image loading
  protocol.handle('lume-asset', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch(`file://${filePath}`);
  });

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open from Finder (double-click .md)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
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
