import * as path from 'path';
import { BrowserWindow, dialog } from 'electron';
import { readFile, addRecentFile } from './file-manager';
import { IPC_PUSH } from '../shared/ipc-channels';

const windowFileMap = new Map<BrowserWindow, string | null>();

export function getFilePathForWindow(win: BrowserWindow | null): string | null {
  if (!win) return null;
  return windowFileMap.get(win) ?? null;
}

export function setFilePathForWindow(win: BrowserWindow, filePath: string | null): void {
  windowFileMap.set(win, filePath);
  if (filePath) {
    win.setRepresentedFilename(filePath);
    win.setTitle(path.basename(filePath));
  } else {
    win.setRepresentedFilename('');
    win.setTitle('Untitled');
  }
}

export function createWindow(bounds?: { x: number; y: number; width: number; height: number }): BrowserWindow {
  const win = new BrowserWindow({
    width: bounds?.width ?? 900,
    height: bounds?.height ?? 700,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 400,
    minHeight: 300,
    show: false,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '..', '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  windowFileMap.set(win, null);

  // __dirname is dist/main at runtime; index.html is at src/renderer/
  win.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', (event) => {
    if (win.isDocumentEdited()) {
      event.preventDefault();
      const filePath = getFilePathForWindow(win);
      const fileName = filePath ? path.basename(filePath) : 'Untitled';
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: `Do you want to save changes to "${fileName}"?`,
        detail: 'Your changes will be lost if you don\'t save them.',
      });
      if (choice === 0) {
        // Save then close
        win.webContents.send('request:content');
        // The renderer will respond with save, and we handle closing after
        // For simplicity, just destroy for now — the save flow is handled via IPC
        win.destroy();
      } else if (choice === 1) {
        win.destroy();
      }
      // choice === 2: cancel, do nothing
    }
  });

  win.on('closed', () => {
    windowFileMap.delete(win);
  });

  return win;
}

export async function openFileInWindow(win: BrowserWindow, filePath: string): Promise<void> {
  const content = await readFile(filePath);
  setFilePathForWindow(win, filePath);
  win.setDocumentEdited(false);
  addRecentFile(filePath);
  win.webContents.send(IPC_PUSH.FILE_OPENED, {
    path: filePath,
    content,
    dir: path.dirname(filePath),
  });
}

export async function openFileInNewWindow(filePath: string): Promise<BrowserWindow> {
  const win = createWindow();
  win.webContents.once('did-finish-load', () => {
    openFileInWindow(win, filePath);
  });
  return win;
}

export function getAllWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows();
}
