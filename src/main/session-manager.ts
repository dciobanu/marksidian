import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { IPC_PUSH, IPC_SEND } from '../shared/ipc-channels';
import { getFilePathForWindow } from './window-manager';
import type { SessionData, WindowSessionState, RendererSessionState } from '../shared/types';

const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');

// ── Persistence ────────────────────────────────────────────────

export function loadSession(): SessionData | null {
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf-8');
    const data = JSON.parse(raw) as SessionData;
    if (data.version !== 1 || !Array.isArray(data.windows)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionData): void {
  try {
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), 'utf-8');
  } catch {
    // Ignore write errors (permissions, disk full, etc.)
  }
}

// ── Collect state from all open windows ────────────────────────

/**
 * Sends `session:collect-state` to every renderer window and waits for
 * `session:state-response` replies.  Returns a complete SessionData
 * ready to be persisted.
 *
 * Timeout ensures we don't hang forever if a renderer is unresponsive.
 */
export function collectSessionState(): Promise<SessionData> {
  return new Promise((resolve) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      resolve({ version: 1, windows: [] });
      return;
    }

    const results: WindowSessionState[] = [];
    let pending = windows.length;

    const finish = () => {
      resolve({ version: 1, windows: results });
    };

    // 2-second timeout
    const timer = setTimeout(() => {
      // Fill in defaults for windows that didn't respond
      for (const win of windows) {
        const already = results.find(
          (r) => r.filePath === getFilePathForWindow(win),
        );
        if (!already) {
          const bounds = win.getBounds();
          results.push({
            filePath: getFilePathForWindow(win),
            windowBounds: bounds,
            cursorOffset: 0,
            scrollTop: 0,
            editorMode: 'live',
            zoomLevel: 0,
          });
        }
      }
      finish();
    }, 2000);

    const { ipcMain } = require('electron') as typeof import('electron');

    const handler = (event: Electron.IpcMainEvent, state: RendererSessionState) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;

      const bounds = win.getBounds();
      results.push({
        ...state,
        filePath: getFilePathForWindow(win),
        windowBounds: bounds,
      });

      pending--;
      if (pending <= 0) {
        clearTimeout(timer);
        ipcMain.removeListener(IPC_SEND.SESSION_STATE_RESPONSE, handler);
        finish();
      }
    };

    ipcMain.on(IPC_SEND.SESSION_STATE_RESPONSE, handler);

    // Ask each renderer to report its state
    for (const win of windows) {
      win.webContents.send(IPC_PUSH.SESSION_COLLECT_STATE);
    }
  });
}
