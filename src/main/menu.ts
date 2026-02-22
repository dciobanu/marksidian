import { app, Menu, dialog, BrowserWindow, shell, MenuItemConstructorOptions } from 'electron';
import { createWindow, openFileInWindow, openFileInNewWindow, getFilePathForWindow } from './window-manager';
import { getRecentFiles } from './file-manager';
import { IPC_PUSH } from '../shared/ipc-channels';
import { saveThemeModeSettings } from './theme-mode-manager';
import type { ThemeMode } from '../shared/types';

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

export function buildMenu(themeMode: ThemeMode = 'system'): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:open-settings');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          },
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const win = getFocusedWindow();
              // If current window is untitled and clean, reuse it
              if (win && !getFilePathForWindow(win) && !win.isDocumentEdited()) {
                await openFileInWindow(win, filePath);
              } else {
                await openFileInNewWindow(filePath);
              }
            }
          },
        },
        {
          label: 'Open Recent',
          submenu: buildRecentFilesMenu(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:save');
          },
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:save-as');
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Live Preview / Source',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-mode');
          },
        },
        {
          label: 'Toggle Reading Mode',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-reading');
          },
        },
        { type: 'separator' },
        {
          label: 'Readable Line Width',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-line-width', { enabled: menuItem.checked });
          },
        },
        {
          label: 'Show Outline',
          type: 'checkbox',
          checked: true,
          accelerator: 'CmdOrCtrl+Shift+O',
          click: (menuItem) => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-outline', { enabled: menuItem.checked });
          },
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Light',
              type: 'radio',
              checked: themeMode === 'light',
              click: () => {
                saveThemeModeSettings({ mode: 'light' });
                for (const win of BrowserWindow.getAllWindows()) {
                  win.webContents.send(IPC_PUSH.THEME_MODE_CHANGED, { mode: 'light' });
                }
              },
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: themeMode === 'dark',
              click: () => {
                saveThemeModeSettings({ mode: 'dark' });
                for (const win of BrowserWindow.getAllWindows()) {
                  win.webContents.send(IPC_PUSH.THEME_MODE_CHANGED, { mode: 'dark' });
                }
              },
            },
            {
              label: 'Use System Setting',
              type: 'radio',
              checked: themeMode === 'system',
              click: () => {
                saveThemeModeSettings({ mode: 'system' });
                for (const win of BrowserWindow.getAllWindows()) {
                  win.webContents.send(IPC_PUSH.THEME_MODE_CHANGED, { mode: 'system' });
                }
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:zoom', { direction: 'in' });
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:zoom', { direction: 'out' });
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const win = getFocusedWindow();
            if (win) win.webContents.send('menu:zoom', { direction: 'reset' });
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
      ],
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/YOUR_ORG/marksidian');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function buildRecentFilesMenu(): MenuItemConstructorOptions[] {
  const recent = getRecentFiles();
  if (recent.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }];
  }
  return recent.map((filePath) => ({
    label: filePath,
    click: () => openFileInNewWindow(filePath),
  }));
}
