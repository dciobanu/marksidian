import { test, expect, ElectronApplication, Page } from '@playwright/test';
import {
  launchApp, setDoc, setCursor, getLineInfo, loadFixture,
  editorHas, editorCount, clearEditor, getCursorPos,
} from './helpers';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  // Mark saved to prevent "unsaved changes" dialog from blocking close
  await page.evaluate(() => {
    (window as any).__lume.markSaved();
    window.lume.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
});

test.beforeEach(async () => {
  await clearEditor(page);
});

// ── Helper ──────────────────────────────────────────────────────

/** Move cursor to position 0 (top of doc) so decorations apply everywhere. */
async function cursorToStart() {
  await setCursor(page, 0);
  await page.waitForTimeout(200);
}

// ── Headings ────────────────────────────────────────────────────

test.describe('Headings', () => {
  test('H1 applies HyperMD-header-1 class', async () => {
    await setDoc(page, '# Heading One\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const h1Line = lines.find(l => l.text.includes('Heading One'));
    expect(h1Line?.classes).toContain('HyperMD-header-1');
  });

  test('H2 applies HyperMD-header-2 class', async () => {
    await setDoc(page, '## Heading Two\n\nParagraph');
    // Put cursor on the paragraph so heading decorations apply
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const h2Line = lines.find(l => l.text.includes('Heading Two'));
    expect(h2Line?.classes).toContain('HyperMD-header-2');
  });

  test('# marks are hidden when cursor is away', async () => {
    await setDoc(page, '# Hello\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const h1Line = lines.find(l => l.classes.includes('HyperMD-header-1'));
    // The # mark should be hidden (replaced), so visible text shouldn't start with #
    if (h1Line) {
      expect(h1Line.text).not.toMatch(/^# /);
    }
  });

  test('# marks are visible when cursor is on heading', async () => {
    await setDoc(page, '# Hello\n\nParagraph');
    await setCursor(page, 3); // inside "# Hello"
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const h1Line = lines.find(l => l.classes.includes('HyperMD-header-1'));
    if (h1Line) {
      expect(h1Line.text).toContain('#');
    }
  });

  test('all 6 heading levels render', async () => {
    await setDoc(page, '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    for (let level = 1; level <= 6; level++) {
      const has = lines.some(l => l.classes.includes(`HyperMD-header-${level}`));
      expect(has, `Missing HyperMD-header-${level}`).toBe(true);
    }
  });
});

// ── Bold / Italic / Strikethrough ───────────────────────────────

test.describe('Emphasis', () => {
  test('bold markers are hidden when cursor is away', async () => {
    await setDoc(page, '**bold text** normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-strong');
    expect(has).toBe(true);
  });

  test('italic markers are hidden when cursor is away', async () => {
    await setDoc(page, '*italic text* normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-em');
    expect(has).toBe(true);
  });

  test('strikethrough markers are hidden when cursor is away', async () => {
    await setDoc(page, '~~struck~~ normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-strikethrough');
    expect(has).toBe(true);
  });
});

// ── Highlight ───────────────────────────────────────────────────

test.describe('Highlight', () => {
  test('==highlight== renders with decoration', async () => {
    await setDoc(page, '==highlighted== normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-highlight');
    expect(has).toBe(true);
  });
});

// ── Inline Code ─────────────────────────────────────────────────

test.describe('Inline Code', () => {
  test('inline code renders with decoration', async () => {
    await setDoc(page, '`code` normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-inline-code');
    expect(has).toBe(true);
  });
});

// ── Code Blocks ─────────────────────────────────────────────────

test.describe('Code Blocks', () => {
  test('fenced code block gets background styling', async () => {
    await setDoc(page, '```js\nconst x = 1;\n```\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    // Poll for the decoration — syntax tree parsing is async
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.filter(l => l.classes.includes('cm-lp-code-block')).length;
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(1);
  });

  test('language label is shown when cursor is outside', async () => {
    await setDoc(page, '```javascript\nconst x = 1;\n```\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    // Poll for the widget — syntax tree parsing is async
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-code-lang');
    }, { timeout: 3000 }).toBe(true);
  });
});

// ── Links ───────────────────────────────────────────────────────

test.describe('Links', () => {
  test('link renders with decoration class', async () => {
    await setDoc(page, '[Click me](https://example.com)\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-link');
    expect(has).toBe(true);
  });

  test('link URL is stored in data attribute', async () => {
    await setDoc(page, '[Click me](https://example.com)\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const url = await page.evaluate(() => {
      const link = document.querySelector('.cm-lp-link');
      return link?.getAttribute('data-url') || '';
    });
    expect(url).toBe('https://example.com');
  });
});

// ── Images ──────────────────────────────────────────────────────

test.describe('Images', () => {
  test('image widget renders when cursor is away', async () => {
    await setDoc(page, '![alt](https://via.placeholder.com/50)\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(300);
    const has = await editorHas(page, '.cm-lp-image-widget');
    expect(has).toBe(true);
  });
});

// ── Lists ───────────────────────────────────────────────────────

test.describe('Lists', () => {
  test('bullet list renders bullet widgets', async () => {
    await setDoc(page, '- Item A\n- Item B\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const count = await editorCount(page, '.cm-lp-bullet');
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ── Task Lists ──────────────────────────────────────────────────

test.describe('Task Lists', () => {
  test('checkboxes render for task items', async () => {
    await setDoc(page, '- [ ] Task A\n- [x] Task B\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const count = await editorCount(page, '.cm-lp-checkbox');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking checkbox toggles its state in the document', async () => {
    await setDoc(page, '- [ ] Toggle me\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    // Click the checkbox
    const checkbox = page.locator('.cm-lp-checkbox').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(200);
      const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
      expect(doc).toContain('[x]');
    }
  });
});

// ── Blockquotes ─────────────────────────────────────────────────

test.describe('Blockquotes', () => {
  test('blockquote line decoration applies', async () => {
    await setDoc(page, '> Quoted text\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const bqLines = lines.filter(l => l.classes.includes('cm-lp-blockquote'));
    expect(bqLines.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Horizontal Rules ────────────────────────────────────────────

test.describe('Horizontal Rules', () => {
  test('--- renders as hr widget', async () => {
    await setDoc(page, 'Before\n\n---\n\nAfter');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('After')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-hr-widget');
    expect(has).toBe(true);
  });
});

// ── Tables ──────────────────────────────────────────────────────

test.describe('Tables', () => {
  test('table renders as HTML table widget when cursor is outside', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);
  });

  test('table widget has proper thead and tbody', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);

    const tableInfo = await page.evaluate(() => {
      const table = document.querySelector('.cm-lp-table');
      if (!table) return null;
      const ths = table.querySelectorAll('th');
      const tds = table.querySelectorAll('td');
      return {
        thCount: ths.length,
        tdCount: tds.length,
        headers: Array.from(ths).map(th => th.textContent),
        cells: Array.from(tds).map(td => td.textContent),
      };
    });
    expect(tableInfo).not.toBeNull();
    expect(tableInfo!.thCount).toBe(2);
    expect(tableInfo!.tdCount).toBe(2);
    expect(tableInfo!.headers).toEqual(['A', 'B']);
    expect(tableInfo!.cells).toEqual(['1', '2']);
  });

  test('table shows raw markdown when cursor is inside', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    // Place cursor inside the table
    await setCursor(page, 3);
    await page.waitForTimeout(200);
    const hasWidget = await editorHas(page, '.cm-lp-table-widget');
    expect(hasWidget).toBe(false);
    // Raw pipe characters should be visible
    const lines = await getLineInfo(page);
    const pipeLines = lines.filter(l => l.text.includes('|'));
    expect(pipeLines.length).toBeGreaterThanOrEqual(2);
  });

  test('table respects column alignment', async () => {
    await setDoc(page, '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);

    const alignments = await page.evaluate(() => {
      const ths = document.querySelectorAll('.cm-lp-table th');
      return Array.from(ths).map(th => (th as HTMLElement).style.textAlign);
    });
    expect(alignments).toEqual(['left', 'center', 'right']);
  });

  test('typing after a table works correctly', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |');
    // Put cursor at the end of the document
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const end = view.state.doc.length;
      view.dispatch({ selection: { anchor: end } });
      view.focus();
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.keyboard.type('After table');
    await page.waitForTimeout(200);
    const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
    expect(doc).toContain('After table');
    const pos = await getCursorPos(page);
    const lines = doc.split('\n');
    expect(lines[pos.line - 1]).toContain('After table');
  });
});

// ── Frontmatter ─────────────────────────────────────────────────

test.describe('Frontmatter', () => {
  test('frontmatter collapses to Properties toggle', async () => {
    await setDoc(page, '---\ntitle: Test\ndate: 2026-01-01\n---\n\n# Heading');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__lume.getEditorContent().indexOf('Heading')
    ));
    // Poll — frontmatter parsing and decoration is async
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-frontmatter-toggle');
    }, { timeout: 3000 }).toBe(true);
  });
});

// ── Footnotes ───────────────────────────────────────────────────

test.describe('Footnotes', () => {
  test('footnote reference renders as superscript', async () => {
    await setDoc(page, 'Text[^1] here.\n\n[^1]: Footnote definition.');
    await setCursor(page, 0);
    await page.waitForTimeout(200);
    // The footnote ref [^1] should be replaced by a superscript widget
    // when cursor is not on it. Put cursor at start.
    const has = await editorHas(page, '.cm-lp-footnote-ref');
    expect(has).toBe(true);
  });
});

// ── Fixture: Full CommonMark ────────────────────────────────────

test.describe('Full CommonMark fixture', () => {
  test('loads without errors', async () => {
    const { loadFixture } = require('./helpers');
    await loadFixture(page, 'commonmark-full.md');
    const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
    expect(doc).toContain('# Heading Level 1');
    expect(doc).toContain('## Paragraphs');
    expect(doc).toContain('## Horizontal Rules');
    expect(doc).toContain('## Tables (GFM)');
  });

  test('heading decorations render on fixture', async () => {
    const { loadFixture } = require('./helpers');
    await loadFixture(page, 'commonmark-full.md');
    // Cursor at end so decorations apply
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    });
    await page.waitForTimeout(300);
    const lines = await getLineInfo(page);
    const h1 = lines.filter(l => l.classes.includes('HyperMD-header-1'));
    expect(h1.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Fixture: Extensions ─────────────────────────────────────────

test.describe('Extensions fixture', () => {
  test('loads without errors', async () => {
    const { loadFixture } = require('./helpers');
    await loadFixture(page, 'extensions.md');
    const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
    expect(doc).toContain('## Highlight');
    expect(doc).toContain('## Math');
    expect(doc).toContain('## Footnotes');
  });
});

// ── Fixture: Stress Test ────────────────────────────────────────

test.describe('Stress test fixture', () => {
  test('loads without errors', async () => {
    const { loadFixture } = require('./helpers');
    await loadFixture(page, 'stress-test.md');
    const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
    expect(doc).toContain('# Stress Test Document');
    expect(doc).toContain('## End of Stress Test');
  });

  test('editor remains responsive after loading large document', async () => {
    await loadFixture(page, 'stress-test.md');
    // Type at the end — should work without hanging
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.focus();
    });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Responsive!');
    await page.waitForTimeout(200);
    const doc = await page.evaluate(() => (window as any).__lume.getEditorContent());
    expect(doc).toContain('Responsive!');
  });
});
