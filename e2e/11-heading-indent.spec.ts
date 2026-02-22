import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ROOT = path.resolve(__dirname, '..');

let userDataDir: string;

test.beforeAll(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marksidian-indent-test-'));
});

test.afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

function writeIndentSettings(settings: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(userDataDir, 'heading-indent-settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8',
  );
}

function clearIndentSettings(): void {
  try { fs.unlinkSync(path.join(userDataDir, 'heading-indent-settings.json')); } catch {}
}

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
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

const MULTI_HEADING_DOC = [
  '# Heading 1',
  'Content under H1',
  '## Heading 2',
  'Content under H2',
  '### Heading 3',
  'Content under H3',
  '## Back to H2',
  'More H2 content',
].join('\n');

test.describe('Heading level indent', () => {

  test('heading indent classes are applied to heading and content lines', async () => {
    clearIndentSettings();
    const { app, page } = await launchApp();

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, MULTI_HEADING_DOC);

    // Wait for async tree parsing + decoration
    await expect.poll(async () => {
      return page.locator('.cm-line.heading-indent-1').count();
    }, { timeout: 5000 }).toBeGreaterThan(0);

    // Headings sit at parent level, content at own level:
    // H1 heading = no class (level 0)
    // H1 content + H2 heading + "Back to H2" heading = 3 lines with heading-indent-1
    const h1Lines = await page.locator('.cm-line.heading-indent-1').count();
    expect(h1Lines).toBe(3);

    // H2 content + H3 heading + "More H2 content" = 3 lines with heading-indent-2
    const h2Lines = await page.locator('.cm-line.heading-indent-2').count();
    expect(h2Lines).toBe(3);

    // H3 content = 1 line with heading-indent-3
    const h3Lines = await page.locator('.cm-line.heading-indent-3').count();
    expect(h3Lines).toBe(1);

    // H1 heading line should NOT have any heading-indent class
    const firstLine = page.locator('.cm-line').first();
    const firstClasses = await firstLine.getAttribute('class');
    expect(firstClasses).not.toContain('heading-indent');

    await cleanClose(app, page);
  });

  test('lines before any heading have no indent class', async () => {
    clearIndentSettings();
    const { app, page } = await launchApp();

    const doc = 'No heading above\n# First Heading\nContent';
    await page.evaluate((d) => {
      (window as any).__marksidian.setEditorContent(d);
    }, doc);

    await expect.poll(async () => {
      return page.locator('.cm-line.heading-indent-1').count();
    }, { timeout: 5000 }).toBeGreaterThan(0);

    // First line should NOT have any heading-indent class
    const firstLine = page.locator('.cm-line').first();
    const classes = await firstLine.getAttribute('class');
    expect(classes).not.toContain('heading-indent');

    await cleanClose(app, page);
  });

  test('disabling in editor removes indent classes', async () => {
    writeIndentSettings({ enabledInEditor: false, enabledInReading: true, h1: 30, h2: 50, h3: 70, h4: 90, h5: 110, h6: 130 });
    const { app, page } = await launchApp();

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, MULTI_HEADING_DOC);

    // Wait a moment for any potential decorations to apply
    await page.waitForTimeout(500);

    // No indent classes should be present
    const indentLines = await page.locator('.cm-line[class*="heading-indent"]').count();
    expect(indentLines).toBe(0);

    await cleanClose(app, page);
  });

  test('reading view applies padding-left to elements under headings', async () => {
    clearIndentSettings();
    const { app, page } = await launchApp();

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, MULTI_HEADING_DOC);

    // Switch to reading mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('reading');
    });

    await page.waitForSelector('#reading-content h1', { timeout: 5000 });

    // H1 should have NO inline padding (it's the top-level heading)
    const h1Style = await page.locator('#reading-content h1').evaluate(
      (el) => (el as HTMLElement).style.paddingLeft,
    );
    expect(h1Style).toBe('');

    // The paragraph under H1 should have padding-left: 30px (h1 content indent)
    const h1ContentPadding = await page.locator('#reading-content').evaluate((container) => {
      const h1 = container.querySelector('h1');
      const nextP = h1?.nextElementSibling as HTMLElement;
      return nextP ? nextP.style.paddingLeft : '';
    });
    expect(h1ContentPadding).toBe('30px');

    // H2 heading should have padding-left: 30px (same as H1 content)
    const h2Padding = await page.locator('#reading-content h2').first().evaluate(
      (el) => (el as HTMLElement).style.paddingLeft,
    );
    expect(h2Padding).toBe('30px');

    // The paragraph under H2 should have padding-left: 50px
    const h2ContentPadding = await page.locator('#reading-content').evaluate((container) => {
      const h2 = container.querySelector('h2');
      const nextP = h2?.nextElementSibling as HTMLElement;
      return nextP ? nextP.style.paddingLeft : '';
    });
    expect(h2ContentPadding).toBe('50px');

    await cleanClose(app, page);
  });

  test('reading view disabled does not apply padding', async () => {
    writeIndentSettings({ enabledInEditor: true, enabledInReading: false, h1: 30, h2: 50, h3: 70, h4: 90, h5: 110, h6: 130 });
    const { app, page } = await launchApp();

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, MULTI_HEADING_DOC);

    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('reading');
    });

    await page.waitForSelector('#reading-content h1', { timeout: 5000 });

    // H1 should NOT have inline padding-left
    const h1Style = await page.locator('#reading-content h1').evaluate(
      (el) => (el as HTMLElement).style.paddingLeft,
    );
    expect(h1Style).toBe('');

    await cleanClose(app, page);
  });

  test('settings persist across restarts', async () => {
    writeIndentSettings({ enabledInEditor: true, enabledInReading: true, h1: 40, h2: 60, h3: 80, h4: 100, h5: 120, h6: 140 });

    const { app, page } = await launchApp();

    // Verify the CSS variable was set from persisted settings
    const h1Var = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--heading-indent-h1').trim(),
    );
    expect(h1Var).toBe('40px');

    await cleanClose(app, page);
  });

  test('settings modal shows heading indent section', async () => {
    clearIndentSettings();
    const { app, page } = await launchApp();

    // Open settings modal via IPC
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('menu:open-settings');
    });

    await page.waitForSelector('.settings-heading-indent', { timeout: 5000 });

    // Check label is present
    const label = await page.locator('.settings-heading-indent .settings-active-theme-label').textContent();
    expect(label).toBe('Heading Level Indent');

    // Check toggle rows exist
    const toggles = await page.locator('.settings-heading-indent .settings-toggle-row').count();
    expect(toggles).toBe(2);

    // Check number inputs exist (H1-H6)
    const inputs = await page.locator('.settings-heading-indent .settings-number-input').count();
    expect(inputs).toBe(6);

    await cleanClose(app, page);
  });
});
