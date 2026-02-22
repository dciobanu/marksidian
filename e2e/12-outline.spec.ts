import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ROOT = path.resolve(__dirname, '..');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marksidian-outline-test-'));
  try { fs.unlinkSync(path.join(userDataDir, 'session.json')); } catch {}

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

test.describe('Outline panel', () => {

  test('outline panel is visible by default', async () => {
    const display = await page.locator('#outline-panel').evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(display).not.toBe('none');
  });

  test('toggle outline via IPC hides and shows panel', async () => {
    // Hide (panel starts visible)
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('menu:toggle-outline', { enabled: false });
    });

    await page.waitForTimeout(100);
    const displayAfterHide = await page.locator('#outline-panel').evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(displayAfterHide).toBe('none');

    // Show
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('menu:toggle-outline', { enabled: true });
    });

    await page.waitForTimeout(100);
    const displayAfterShow = await page.locator('#outline-panel').evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(displayAfterShow).not.toBe('none');
  });

  test('outline shows headings in correct order', async () => {
    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
      const view = (window as any).__marksidian.getEditorView();
      if (view) (window as any).__marksidian.forceOutlineUpdate(view);
    }, MULTI_HEADING_DOC);

    // Wait for outline items to appear
    await expect.poll(async () => {
      return page.locator('.outline-item').count();
    }, { timeout: 5000 }).toBeGreaterThan(0);

    const items = await page.locator('.outline-item .outline-item-text').allTextContents();
    expect(items).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Back to H2',
    ]);
  });

  test('heading levels are reflected in data-level attribute', async () => {
    const levels = await page.locator('.outline-item').evaluateAll(
      (els) => els.map((el) => (el as HTMLElement).dataset.level),
    );
    expect(levels).toEqual(['1', '2', '3', '2']);
  });

  test('clicking outline item moves cursor to heading', async () => {
    // Click on "Heading 2" (second item)
    await page.locator('.outline-item .outline-item-text', { hasText: 'Heading 2' }).click();

    await page.waitForTimeout(200);

    // Cursor should be on line 3 (## Heading 2)
    const pos = await page.evaluate(() => {
      return (window as any).__marksidian.getCursorPosition();
    });
    expect(pos.line).toBe(3);
  });

  test('active heading highlights on cursor navigation', async () => {
    // Move cursor to content under H3 (line 6)
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const line6 = view.state.doc.line(6);
      (window as any).__marksidian.setCursorOffset(line6.from);
    });

    // Wait for debounced outline update
    await page.waitForTimeout(200);

    // Active item should be "Heading 3"
    const activeText = await page.locator('.outline-item-active .outline-item-text').textContent();
    expect(activeText).toBe('Heading 3');
  });

  test('collapsing a heading hides its children', async () => {
    // There should be 4 items initially visible
    const initialCount = await page.locator('.outline-item:visible').count();
    expect(initialCount).toBe(4);

    // Click the collapse icon on "Heading 1" (first item)
    await page.locator('.outline-item[data-level="1"] .outline-collapse-icon').click();

    await page.waitForTimeout(100);

    // Only "Heading 1" should be visible now (all others are children)
    const afterCollapseCount = await page.locator('.outline-item:visible').count();
    expect(afterCollapseCount).toBe(1);

    // Expand again
    await page.locator('.outline-item[data-level="1"] .outline-collapse-icon').click();

    await page.waitForTimeout(100);

    const afterExpandCount = await page.locator('.outline-item:visible').count();
    expect(afterExpandCount).toBe(4);
  });

  test('outline updates when document content changes', async () => {
    // Change content to a simpler document
    await page.evaluate(() => {
      (window as any).__marksidian.setEditorContent('# Only Heading\nSome content');
    });

    // Wait for debounced update
    await page.waitForTimeout(300);

    const items = await page.locator('.outline-item .outline-item-text').allTextContents();
    expect(items).toEqual(['Only Heading']);
  });

  test('outline shows "No headings" for empty document', async () => {
    await page.evaluate(() => {
      (window as any).__marksidian.setEditorContent('No headings here');
    });

    await page.waitForTimeout(300);

    const emptyMsg = await page.locator('.outline-empty').textContent();
    expect(emptyMsg).toBe('No headings');

    // Restore multi-heading doc for remaining tests
    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, MULTI_HEADING_DOC);
    await page.waitForTimeout(300);
  });

  test('reading view: clicking outline scrolls to heading', async () => {
    // Switch to reading mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('reading');
    });

    await page.waitForSelector('#reading-content h1', { timeout: 5000 });
    await page.waitForTimeout(200);

    // Click on "Heading 3" in outline
    await page.locator('.outline-item .outline-item-text', { hasText: 'Heading 3' }).click();

    await page.waitForTimeout(300);

    // Verify H3 is visible in reading view
    const h3Visible = await page.locator('#reading-content h3').isVisible();
    expect(h3Visible).toBe(true);

    // Switch back to live mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('live');
    });
  });

  test('reading view: active heading updates on scroll', async () => {
    // Load a long document so scrolling is meaningful
    const longDoc = [
      '# Section 1',
      ...Array(60).fill('Paragraph content that is long enough to take up space on screen.'),
      '## Section 2',
      ...Array(60).fill('More content that is long enough to take up space on screen.'),
      '### Section 3',
      ...Array(60).fill('Even more content for the third section.'),
    ].join('\n');

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, longDoc);

    // Switch to reading mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('reading');
    });
    await page.waitForSelector('#reading-content h1', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Initially, Section 1 should be active
    await expect.poll(async () => {
      return page.locator('.outline-item-active .outline-item-text').textContent();
    }, { timeout: 3000 }).toBe('Section 1');

    // Scroll reading container so that H2 is at the top
    await page.evaluate(() => {
      const container = document.getElementById('reading-container');
      const h2 = document.querySelector('#reading-content h2') as HTMLElement;
      if (container && h2) {
        container.scrollTop = h2.offsetTop;
      }
    });
    await page.waitForTimeout(300);

    // Active heading should now be Section 2
    await expect.poll(async () => {
      return page.locator('.outline-item-active .outline-item-text').textContent();
    }, { timeout: 3000 }).toBe('Section 2');

    // Switch back to live mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('live');
    });
  });

  test('reading view: outline click navigates to heading with apostrophe', async () => {
    const doc = "# Dijkstra's Algorithm\nContent here.\n## Another Heading\nMore content.";

    await page.evaluate((doc) => {
      (window as any).__marksidian.setEditorContent(doc);
    }, doc);

    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('reading');
    });
    await page.waitForSelector('#reading-content h1', { timeout: 5000 });
    await page.waitForTimeout(200);

    // Click on "Dijkstra's Algorithm" in outline (raw ASCII apostrophe from syntax tree)
    await page.locator('.outline-item .outline-item-text', { hasText: "Dijkstra" }).click();
    await page.waitForTimeout(300);

    // Verify H1 is visible in reading view (scrolled into view)
    const h1Visible = await page.locator('#reading-content h1').isVisible();
    expect(h1Visible).toBe(true);

    // Switch back to live mode
    await page.evaluate(async () => {
      await (window as any).__marksidian.switchToMode('live');
    });
  });
});
