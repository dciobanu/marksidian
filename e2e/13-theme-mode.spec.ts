import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ROOT = path.resolve(__dirname, '..');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marksidian-theme-mode-test-'));
  try { fs.unlinkSync(path.join(userDataDir, 'session.json')); } catch {}
  try { fs.unlinkSync(path.join(userDataDir, 'theme-mode-settings.json')); } catch {}

  app = await electron.launch({
    args: [path.join(ROOT, 'dist', 'main', 'main.js'), '--user-data-dir=' + userDataDir],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  page = await app.firstWindow();
  await page.waitForSelector('.cm-editor', { timeout: 10_000 });
});

test.afterAll(async () => {
  await page.evaluate(() => {
    (window as any).__marksidian.markSaved();
    window.marksidian.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test.describe('Theme mode (light/dark/system)', () => {

  test('default mode is system', async () => {
    // body should have either theme-light or theme-dark based on system
    const hasLight = await page.evaluate(() => document.body.classList.contains('theme-light'));
    const hasDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    expect(hasLight || hasDark).toBe(true);
    // Should not have both
    expect(hasLight && hasDark).toBe(false);
  });

  test('setting mode to dark applies theme-dark class', async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('theme-mode:changed', { mode: 'dark' });
    });
    await page.waitForTimeout(100);

    const hasDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    const hasLight = await page.evaluate(() => document.body.classList.contains('theme-light'));
    expect(hasDark).toBe(true);
    expect(hasLight).toBe(false);
  });

  test('setting mode to light applies theme-light class', async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('theme-mode:changed', { mode: 'light' });
    });
    await page.waitForTimeout(100);

    const hasLight = await page.evaluate(() => document.body.classList.contains('theme-light'));
    const hasDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    expect(hasLight).toBe(true);
    expect(hasDark).toBe(false);
  });

  test('setting mode to system follows OS preference', async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('theme-mode:changed', { mode: 'system' });
    });
    await page.waitForTimeout(100);

    // Should have exactly one of theme-light or theme-dark
    const hasLight = await page.evaluate(() => document.body.classList.contains('theme-light'));
    const hasDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    expect(hasLight || hasDark).toBe(true);
    expect(hasLight && hasDark).toBe(false);
  });

  test('theme mode persists via IPC invoke', async () => {
    // Set mode to dark via the IPC invoke handler (same as what the menu does)
    await page.evaluate(async () => {
      await window.marksidian.setThemeModeSettings({ mode: 'dark' });
    });

    // Read back the setting
    const settings = await page.evaluate(async () => {
      return window.marksidian.getThemeModeSettings();
    });
    expect(settings.mode).toBe('dark');

    // Reset to system for other tests
    await page.evaluate(async () => {
      await window.marksidian.setThemeModeSettings({ mode: 'system' });
    });
  });

  test('theme mode persists across restart', async () => {
    // Save dark mode setting to disk
    await page.evaluate(async () => {
      await window.marksidian.setThemeModeSettings({ mode: 'dark' });
    });
    await page.waitForTimeout(100);

    // Close the app cleanly
    await page.evaluate(() => {
      (window as any).__marksidian.markSaved();
      window.marksidian.notifyContentChanged(false);
    });
    await app.close();

    // Relaunch with same user data dir
    app = await electron.launch({
      args: [path.join(ROOT, 'dist', 'main', 'main.js'), '--user-data-dir=' + userDataDir],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.cm-editor', { timeout: 10_000 });
    await page.waitForTimeout(300);

    // Body should have dark theme from persisted setting
    const hasDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    expect(hasDark).toBe(true);

    // Reset to system for clean state
    await page.evaluate(async () => {
      await window.marksidian.setThemeModeSettings({ mode: 'system' });
    });
  });
});
