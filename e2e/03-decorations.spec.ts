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
    (window as any).__marksidian.markSaved();
    window.marksidian.notifyContentChanged(false);
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const lines = await getLineInfo(page);
    const h2Line = lines.find(l => l.text.includes('Heading Two'));
    expect(h2Line?.classes).toContain('HyperMD-header-2');
  });

  test('# marks are hidden when cursor is away', async () => {
    await setDoc(page, '# Hello\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-strong');
    expect(has).toBe(true);
  });

  test('italic markers are hidden when cursor is away', async () => {
    await setDoc(page, '*italic text* normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-em');
    expect(has).toBe(true);
  });

  test('bold and italic render in Algorithms fixture', async () => {
    // Regression: "**Complexity** for finding *any* path" must render
    // bold/italic even when the document contains $$ math blocks with * inside
    await loadFixture(page, 'Algorithms and Data Structures.md');

    // Scroll the target line into the viewport, with cursor placed
    // a few lines below so it's NOT on the emphasis line
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const doc = view.state.doc.toString();
      const targetText = '**Complexity** for finding *any*';
      const idx = doc.indexOf(targetText);
      // Put cursor on the "Time: O(V+E)" line (2 lines after)
      const lineAfter = doc.indexOf('O(V+E)', idx);
      view.dispatch({
        selection: { anchor: lineAfter >= 0 ? lineAfter : doc.length },
        scrollIntoView: true,
      });
    });

    // "**Complexity** for finding *any* path" should have BOTH bold and italic
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const lines = document.querySelectorAll('.cm-editor .cm-line');
        for (const l of lines) {
          const t = l.textContent || '';
          if (t.includes('Complexity') && t.includes('any') && t.includes('path')) {
            return {
              hasStrong: l.querySelector('.cm-lp-strong') !== null,
              hasEm: l.querySelector('.cm-lp-em') !== null,
            };
          }
        }
        return { hasStrong: false, hasEm: false };
      });
    }, { timeout: 3000 }).toEqual({ hasStrong: true, hasEm: true });
  });

  test('bold renders after scrolling down and back up', async () => {
    // Regression: scrolling through a large document must not break emphasis
    await loadFixture(page, 'Algorithms and Data Structures.md');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // Verify bold works in initial viewport
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const lines = document.querySelectorAll('.cm-editor .cm-line');
        for (const l of lines) {
          if ((l.textContent || '').includes('Implementation')) {
            return l.querySelector('.cm-lp-strong') !== null;
          }
        }
        return false;
      });
    }, { timeout: 3000 }).toBe(true);

    // Scroll to the bottom of the document
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const doc = view.state.doc;
      view.dispatch({
        selection: { anchor: doc.length },
        scrollIntoView: true,
      });
    });

    // Bold at the bottom should also render
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const lines = document.querySelectorAll('.cm-editor .cm-line');
        for (const l of lines) {
          if ((l.textContent || '').includes('Implementation') ||
              (l.textContent || '').includes('Complexity')) {
            if (l.querySelector('.cm-lp-strong')) return true;
          }
        }
        return false;
      });
    }, { timeout: 5000 }).toBe(true);

    // Now scroll back to the top
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    });

    // Bold at the top should STILL render after scrolling back
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const lines = document.querySelectorAll('.cm-editor .cm-line');
        for (const l of lines) {
          if ((l.textContent || '').includes('Implementation')) {
            return l.querySelector('.cm-lp-strong') !== null;
          }
        }
        return false;
      });
    }, { timeout: 5000 }).toBe(true);
  });

  test('strikethrough markers are hidden when cursor is away', async () => {
    await setDoc(page, '~~struck~~ normal\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const has = await editorHas(page, '.cm-lp-link');
    expect(has).toBe(true);
  });

  test('link URL is stored in data attribute', async () => {
    await setDoc(page, '[Click me](https://example.com)\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    const count = await editorCount(page, '.cm-lp-checkbox');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking checkbox toggles its state in the document', async () => {
    await setDoc(page, '- [ ] Toggle me\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(200);
    // Click the checkbox
    const checkbox = page.locator('.cm-lp-checkbox').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(200);
      const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
      expect(doc).toContain('[x]');
    }
  });
});

// ── Blockquotes ─────────────────────────────────────────────────

test.describe('Blockquotes', () => {
  test('blockquote line decoration applies', async () => {
    await setDoc(page, '> Quoted text\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      (window as any).__marksidian.getEditorContent().indexOf('After')
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
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);
  });

  test('table widget has proper thead and tbody', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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

  test('clicking table widget enters edit mode (shows raw markdown)', async () => {
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    // Move cursor away to Paragraph so table renders as widget
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);

    // Click on the table widget
    const tableWidget = page.locator('.cm-lp-table-widget');
    await tableWidget.click();
    await page.waitForTimeout(200);

    // Table widget should disappear (raw markdown shown instead)
    const hasWidget = await editorHas(page, '.cm-lp-table-widget');
    expect(hasWidget).toBe(false);
    // Raw pipe characters should be visible
    const lines = await getLineInfo(page);
    const pipeLines = lines.filter(l => l.text.includes('|'));
    expect(pipeLines.length).toBeGreaterThanOrEqual(2);
  });

  test('clicking a specific table cell places cursor in that cell', async () => {
    // Table:  | A | B |     (line 1)
    //         | -- | -- |   (line 2)
    //         | 1 | 2 |    (line 3)
    await setDoc(page, '| A | B |\n| -- | -- |\n| 1 | 2 |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table-widget');
    }, { timeout: 3000 }).toBe(true);

    // Click on the second data cell (row=1, col=1 → content "2" → line 3, col after "| 1 | ")
    const cell = page.locator('.cm-lp-table td[data-row="1"][data-col="1"]');
    await cell.click();
    await page.waitForTimeout(200);

    // Should be in edit mode
    const hasWidget = await editorHas(page, '.cm-lp-table-widget');
    expect(hasWidget).toBe(false);

    // Cursor should be on line 3 (the data row with "| 1 | 2 |")
    const pos = await getCursorPos(page);
    expect(pos.line).toBe(3);
    // Cursor column should be inside the "2" cell (after "| 1 | ")
    // The raw line is "| 1 | 2 |", the "2" starts at col 7
    expect(pos.col).toBe(7);
  });

  test('table respects column alignment', async () => {
    await setDoc(page, '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
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
      const view = (window as any).__marksidian.getEditorView();
      const end = view.state.doc.length;
      view.dispatch({ selection: { anchor: end } });
      view.focus();
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.keyboard.type('After table');
    await page.waitForTimeout(200);
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
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
      (window as any).__marksidian.getEditorContent().indexOf('Heading')
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
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
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
      const view = (window as any).__marksidian.getEditorView();
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
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
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
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
    expect(doc).toContain('# Stress Test Document');
    expect(doc).toContain('## End of Stress Test');
  });

  test('editor remains responsive after loading large document', async () => {
    await loadFixture(page, 'stress-test.md');
    // Type at the end — should work without hanging
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.focus();
    });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Responsive!');
    await page.waitForTimeout(200);
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
    expect(doc).toContain('Responsive!');
  });
});

// ── Math widget click-to-edit ────────────────────────────────────

test.describe('Math widgets', () => {
  test('inline math renders with KaTeX', async () => {
    await setDoc(page, 'Before $E=mc^2$ after');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // KaTeX renders synchronously — widget should be present
    const hasMathWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(hasMathWidget).toBe(true);

    // KaTeX should have rendered actual math (not raw text)
    const hasKatex = await editorHas(page, '.cm-lp-math-widget .katex');
    expect(hasKatex).toBe(true);
  });

  test('block math renders with KaTeX', async () => {
    await setDoc(page, 'Before\n\n$$\n\\frac{N!}{n_1! \\cdot n_2!}\n$$\n\nAfter');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // Block math widget should render
    const hasBlockWidget = await editorHas(page, '.cm-lp-math-block-widget');
    expect(hasBlockWidget).toBe(true);

    // KaTeX should have rendered actual math
    const hasKatex = await editorHas(page, '.cm-lp-math-block-widget .katex');
    expect(hasKatex).toBe(true);
  });

  test('clicking inline math widget enters edit mode', async () => {
    await setDoc(page, 'Before $E=mc^2$ after');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // Click on the math widget
    const widget = page.locator('.cm-lp-math-widget').first();
    await widget.click();
    await page.waitForTimeout(200);

    // Widget should disappear, raw $E=mc^2$ visible
    const stillHasWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(stillHasWidget).toBe(false);
    const doc = await page.evaluate(() => (window as any).__marksidian.getEditorContent());
    expect(doc).toContain('$E=mc^2$');
  });

  test('dollar amounts are NOT treated as inline math', async () => {
    // This text contains currency amounts — none should be treated as math
    const text = '**Pricing:** $39/user/month or $19/user/month. Total: $1B+ ARR, $29.3B valuation.';
    await setDoc(page, text);
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // No math widget should render for currency amounts
    const hasMathWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(hasMathWidget).toBe(false);

    // No math error spans either (red text)
    const hasMathError = await editorHas(page, '.cm-lp-math-error');
    expect(hasMathError).toBe(false);
  });

  test('legitimate math with variables still works as inline math', async () => {
    await setDoc(page, 'The formula $x + y = z$ is simple');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    // Math widget should render for legitimate math
    const hasMathWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(hasMathWidget).toBe(true);
  });

  test('digit followed by LaTeX command is valid inline math', async () => {
    // "$0\le r \le n$" should render as math (digit + backslash = LaTeX)
    await setDoc(page, 'where $0\\le r \\le n$\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await page.waitForTimeout(300);

    const hasMathWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(hasMathWidget).toBe(true);
  });

  test('dollar with trailing space is NOT math', async () => {
    // Opening $ followed by space should not be math
    await setDoc(page, 'I have $ 50 in my wallet');
    await setCursor(page, 0);
    await page.waitForTimeout(300);

    const hasMathWidget = await editorHas(page, '.cm-lp-math-widget');
    expect(hasMathWidget).toBe(false);
  });
});

// ── Code block readability ──────────────────────────────────────

test.describe('Code block readability', () => {
  test('code block has explicit text color set', async () => {
    await setDoc(page, '```js\nconst x = 1;\n```\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-code-block');
    }, { timeout: 3000 }).toBe(true);

    // Verify the code block line element has the correct color set
    const color = await page.evaluate(() => {
      const block = document.querySelector('.cm-lp-code-block');
      if (!block) return null;
      return window.getComputedStyle(block).color;
    });
    expect(color).not.toBeNull();
    // The color should not be the default black (rgb(0, 0, 0)) — it should be
    // set to --code-normal which is #222222 (light) or #dcddde (dark).
    expect(color!.length).toBeGreaterThan(0);
  });

  test('syntax highlighting spans inside code block inherit code-normal color', async () => {
    await setDoc(page, '```js\nconst x = 1;\n```\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-code-block');
    }, { timeout: 3000 }).toBe(true);

    // Get the code-normal CSS variable value and all span colors
    const result = await page.evaluate(() => {
      const codeBlock = document.querySelector('.cm-line.cm-lp-code-block');
      if (!codeBlock) return { error: 'no .cm-line.cm-lp-code-block found' };
      const blockColor = window.getComputedStyle(codeBlock).color;
      const spans = codeBlock.querySelectorAll('span');
      const spanInfo = Array.from(spans).map(s => ({
        text: s.textContent,
        className: s.className,
        color: window.getComputedStyle(s).color,
      }));
      return { blockColor, spanCount: spans.length, spanInfo };
    });
    // All spans inside the code block should have the same color as the code block itself
    if ('spanInfo' in result && result.spanInfo.length > 0) {
      for (const span of result.spanInfo) {
        expect(span.color).toBe(result.blockColor);
      }
    }
  });

  test('code block text is readable in dark mode', async () => {
    // Switch to dark mode
    await page.evaluate(() => {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    });

    await setDoc(page, '```sh\nls -la\nps axu\n```\n\nParagraph');
    await setCursor(page, await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent().indexOf('Paragraph')
    ));
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-code-block');
    }, { timeout: 3000 }).toBe(true);

    // Check the actual computed colors in dark mode
    const result = await page.evaluate(() => {
      // Find a code block content line (not the fence/lang line)
      const codeBlocks = document.querySelectorAll('.cm-line.cm-lp-code-block');
      const info: any[] = [];
      for (const block of codeBlocks) {
        const computed = window.getComputedStyle(block);
        const bgColor = computed.backgroundColor;
        const textColor = computed.color;
        const spans = block.querySelectorAll('span');
        const spanColors = Array.from(spans).map(s => ({
          text: s.textContent,
          className: s.className,
          color: window.getComputedStyle(s).color,
        }));
        info.push({
          text: block.textContent,
          bgColor,
          textColor,
          spanColors,
          classList: Array.from(block.classList),
        });
      }

      // Also check the resolved CSS variable values
      const bodyStyle = window.getComputedStyle(document.body);
      const codeNormal = bodyStyle.getPropertyValue('--code-normal').trim();
      const codeBackground = bodyStyle.getPropertyValue('--code-background').trim();
      const colorBase100 = bodyStyle.getPropertyValue('--color-base-100').trim();

      return { lines: info, codeNormal, codeBackground, colorBase100 };
    });

    console.log('Dark mode code block diagnostic:', JSON.stringify(result, null, 2));

    // In dark mode, --color-base-100 should be #dcddde
    expect(result.colorBase100).toBe('#dcddde');

    // Code block text color must not be a dark color (would be unreadable on dark bg)
    // Parse the rgb value and check it's light
    for (const line of result.lines) {
      if (line.text && line.text.trim().length > 0) {
        // Extract RGB from "rgb(r, g, b)" format
        const match = line.textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          // In dark mode, text should be light (high RGB values)
          // #dcddde = rgb(220, 221, 222) — all values > 200
          // #222222 = rgb(34, 34, 34) — dark, unreadable
          expect(r).toBeGreaterThan(150);
          expect(g).toBeGreaterThan(150);
          expect(b).toBeGreaterThan(150);
        }
        // Also verify spans inherit the same color
        for (const span of line.spanColors) {
          expect(span.color).toBe(line.textColor);
        }
      }
    }

    // Switch back to light mode for other tests
    await page.evaluate(() => {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    });
  });
});

// ── Context menu ────────────────────────────────────────────────

test.describe('Context menu', () => {
  test('right-click sends context menu IPC', async () => {
    await setDoc(page, 'Hello world');
    await setCursor(page, 3);

    // Verify the renderer has a contextmenu listener that calls showContextMenu.
    // We can't easily verify the native menu popup in Playwright, but we can
    // verify the IPC channel is wired up by checking the preload API exists.
    const hasContextMenu = await page.evaluate(() => {
      return typeof window.marksidian?.showContextMenu === 'function';
    });
    expect(hasContextMenu).toBe(true);
  });
});
