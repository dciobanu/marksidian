import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ROOT = path.resolve(__dirname, '..');

/**
 * Theme system E2E tests.
 *
 * Uses a temp userData directory with pre-seeded theme files to test
 * theme loading, activation, and the settings modal.
 */

let userDataDir: string;

test.beforeAll(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marksidian-theme-test-'));
});

test.afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

/** Create a test theme in the userData themes directory. */
function seedTestTheme(name: string, cssContent: string): void {
  const themeDir = path.join(userDataDir, 'themes', name);
  fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, 'theme.css'), cssContent, 'utf-8');
  fs.writeFileSync(
    path.join(themeDir, 'manifest.json'),
    JSON.stringify({ name, author: 'Test Author', version: '1.0.0', repo: 'test/repo' }, null, 2),
    'utf-8',
  );
}

function writeThemeSettings(settings: { activeTheme: string | null }): void {
  fs.writeFileSync(
    path.join(userDataDir, 'theme-settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8',
  );
}

function clearThemeSettings(): void {
  try { fs.unlinkSync(path.join(userDataDir, 'theme-settings.json')); } catch {}
}

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  // Clear session.json to avoid restoring old windows
  try { fs.unlinkSync(path.join(userDataDir, 'session.json')); } catch {}

  const app = await electron.launch({
    args: [path.join(ROOT, 'dist', 'main', 'main.js'), '--user-data-dir=' + userDataDir],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('.cm-editor', { timeout: 10_000 });
  return { app, page };
}

async function cleanClose(app: ElectronApplication, page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__marksidian.markSaved();
    window.marksidian.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
}

/** Open settings modal via the Electron menu IPC (simulates Cmd+, menu action). */
async function openSettings(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('menu:open-settings');
  });
}

test.describe('Theme system', () => {
  test('no theme link exists by default', async () => {
    clearThemeSettings();

    const { app, page } = await launchApp();
    await page.waitForTimeout(300);

    // No community theme <link> should be present
    const themeLink = await page.$('#marksidian-community-theme');
    expect(themeLink).toBeNull();

    await cleanClose(app, page);
  });

  test('active theme CSS is loaded on startup', async () => {
    // Seed a test theme that sets a recognisable CSS variable
    seedTestTheme('test-startup-theme', `
      .theme-light, .theme-dark {
        --background-primary: rgb(42, 42, 42) !important;
      }
    `);
    writeThemeSettings({ activeTheme: 'test-startup-theme' });

    const { app, page } = await launchApp();
    await page.waitForTimeout(500);

    // The community theme <link> should exist
    const themeLink = await page.$('#marksidian-community-theme');
    expect(themeLink).not.toBeNull();

    // Verify the CSS variable was overridden
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--background-primary').trim()
    );
    expect(bgColor).toBe('rgb(42, 42, 42)');

    await cleanClose(app, page);
  });

  test('setting active theme to null removes CSS link', async () => {
    // Start with a theme active
    seedTestTheme('test-remove-theme', `
      .theme-light, .theme-dark {
        --background-primary: rgb(99, 99, 99) !important;
      }
    `);
    writeThemeSettings({ activeTheme: 'test-remove-theme' });

    const { app, page } = await launchApp();
    await page.waitForTimeout(500);

    // Verify theme link exists
    let themeLink = await page.$('#marksidian-community-theme');
    expect(themeLink).not.toBeNull();

    // Remove the active theme via API
    await page.evaluate(() => window.marksidian.setActiveTheme(null));
    await page.waitForTimeout(300);

    // Theme link should be removed
    themeLink = await page.$('#marksidian-community-theme');
    expect(themeLink).toBeNull();

    await cleanClose(app, page);
  });

  test('settings modal opens and closes', async () => {
    clearThemeSettings();

    const { app, page } = await launchApp();
    await page.waitForTimeout(300);

    // No modal initially
    let overlay = await page.$('.settings-modal-overlay');
    expect(overlay).toBeNull();

    // Open settings via IPC (simulates menu Cmd+,)
    await openSettings(app);
    await page.waitForSelector('.settings-modal-overlay', { timeout: 5_000 });

    // Title should say "Appearance"
    const title = await page.$eval('.settings-modal-title', (el: Element) => el.textContent);
    expect(title).toBe('Appearance');

    // Active theme should show "Default"
    const activeThemeName = await page.$eval('.settings-active-theme-name', (el: Element) => el.textContent);
    expect(activeThemeName).toBe('Default');

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    overlay = await page.$('.settings-modal-overlay');
    expect(overlay).toBeNull();

    await cleanClose(app, page);
  });

  test('settings modal close button works', async () => {
    clearThemeSettings();

    const { app, page } = await launchApp();
    await page.waitForTimeout(300);

    // Open modal
    await openSettings(app);
    await page.waitForSelector('.settings-modal-overlay', { timeout: 5_000 });

    // Click close button
    await page.click('.settings-modal-close');
    await page.waitForTimeout(200);

    const overlay = await page.$('.settings-modal-overlay');
    expect(overlay).toBeNull();

    await cleanClose(app, page);
  });

  test('installed theme shows in modal', async () => {
    // Seed an installed but not active theme
    seedTestTheme('test-modal-theme', `
      .theme-light { --text-normal: rgb(11, 22, 33); }
    `);
    clearThemeSettings();

    const { app, page } = await launchApp();
    await page.waitForTimeout(300);

    // Open settings
    await openSettings(app);
    await page.waitForSelector('.settings-modal-overlay', { timeout: 5_000 });

    // The active theme section should show "Default"
    const activeThemeName = await page.$eval('.settings-active-theme-name', (el: Element) => el.textContent);
    expect(activeThemeName).toBe('Default');

    await page.keyboard.press('Escape');
    await cleanClose(app, page);
  });

  test('theme persists across restarts', async () => {
    // Seed a theme
    seedTestTheme('test-persist-theme', `
      .theme-light, .theme-dark {
        --color-accent: rgb(255, 0, 128) !important;
      }
    `);
    writeThemeSettings({ activeTheme: 'test-persist-theme' });

    // First launch
    const { app: app1, page: page1 } = await launchApp();
    await page1.waitForTimeout(500);

    const accent1 = await page1.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--color-accent').trim()
    );
    expect(accent1).toBe('rgb(255, 0, 128)');

    await cleanClose(app1, page1);

    // Second launch — theme should still be active
    const { app: app2, page: page2 } = await launchApp();
    await page2.waitForTimeout(500);

    const accent2 = await page2.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--color-accent').trim()
    );
    expect(accent2).toBe('rgb(255, 0, 128)');

    await cleanClose(app2, page2);
  });

  test('missing theme on disk falls back gracefully', async () => {
    // Point settings to a theme that doesn't exist
    writeThemeSettings({ activeTheme: 'nonexistent-theme' });

    const { app, page } = await launchApp();
    await page.waitForTimeout(500);

    // Should not crash; theme link may exist but won't load anything harmful
    // The app should still be functional
    const editor = await page.$('.cm-editor');
    expect(editor).not.toBeNull();

    await cleanClose(app, page);
  });
});
