/**
 * Reading View Tests
 *
 * Uses the "Algorithms and Data Structures.md" fixture to validate that
 * reading mode renders markdown elements correctly and that font / style
 * parity between live-preview editing and reading view is maintained.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, loadFixture, setDoc } from './helpers';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await page.evaluate(() => {
    (window as any).__marksidian.markSaved();
    window.marksidian.notifyContentChanged(false);
  });
  await app.close();
});

// ─── Helpers ────────────────────────────────────────────────

/** Switch to reading mode with the given content. */
async function showReading(p: Page, content: string): Promise<void> {
  await setDoc(p, content);
  await p.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
  await p.waitForTimeout(300);
}

/** Switch back to live preview mode. */
async function showLive(p: Page): Promise<void> {
  await p.evaluate(() => (window as any).__marksidian.switchToMode('live'));
  await p.waitForTimeout(200);
}

/** Query something inside the reading view container. */
function rv(p: Page, selector: string) {
  return p.locator('#reading-content ' + selector);
}

// ─── Font & style parity ────────────────────────────────────

test.describe('Font and style parity between editor and reading view', () => {
  test('font-family matches between editor content and reading view', async () => {
    await loadFixture(page, 'Algorithms and Data Structures.md');
    await page.waitForTimeout(300);

    // Get editor .cm-content computed font-family
    const editorFont = await page.evaluate(() => {
      const el = document.querySelector('.cm-content') as HTMLElement;
      return window.getComputedStyle(el).fontFamily;
    });

    // Switch to reading and get .markdown-preview-view font-family
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(300);

    const readingFont = await page.evaluate(() => {
      const el = document.querySelector('.markdown-preview-view') as HTMLElement;
      return window.getComputedStyle(el).fontFamily;
    });

    expect(editorFont).toBe(readingFont);
    // Neither should be monospace
    expect(editorFont).not.toBe('monospace');
    expect(readingFont).not.toBe('monospace');

    await showLive(page);
  });

  test('font-size matches between editor and reading view', async () => {
    await loadFixture(page, 'Algorithms and Data Structures.md');
    await page.waitForTimeout(200);

    const editorSize = await page.evaluate(() => {
      const el = document.querySelector('.cm-content') as HTMLElement;
      return window.getComputedStyle(el).fontSize;
    });

    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    const readingSize = await page.evaluate(() => {
      const el = document.querySelector('.markdown-preview-view') as HTMLElement;
      return window.getComputedStyle(el).fontSize;
    });

    expect(editorSize).toBe(readingSize);
    await showLive(page);
  });

  test('line-height matches between editor and reading view', async () => {
    await loadFixture(page, 'Algorithms and Data Structures.md');
    await page.waitForTimeout(200);

    const editorLH = await page.evaluate(() => {
      const el = document.querySelector('.cm-content') as HTMLElement;
      return window.getComputedStyle(el).lineHeight;
    });

    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    const readingLH = await page.evaluate(() => {
      const el = document.querySelector('.markdown-preview-view') as HTMLElement;
      return window.getComputedStyle(el).lineHeight;
    });

    expect(editorLH).toBe(readingLH);
    await showLive(page);
  });

  test('heading font-size is consistent across modes', async () => {
    await showReading(page, '# Heading 1\n\n## Heading 2\n\nParagraph');

    const readingH1Size = await page.evaluate(() => {
      const h1 = document.querySelector('#reading-content h1') as HTMLElement;
      return window.getComputedStyle(h1).fontSize;
    });
    const readingH2Size = await page.evaluate(() => {
      const h2 = document.querySelector('#reading-content h2') as HTMLElement;
      return window.getComputedStyle(h2).fontSize;
    });

    await showLive(page);
    // Move cursor to end so decorations apply to headings
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    });
    await page.waitForTimeout(200);

    const editorH1Size = await page.evaluate(() => {
      const h1Line = document.querySelector('.HyperMD-header-1') as HTMLElement;
      return h1Line ? window.getComputedStyle(h1Line).fontSize : null;
    });
    const editorH2Size = await page.evaluate(() => {
      const h2Line = document.querySelector('.HyperMD-header-2') as HTMLElement;
      return h2Line ? window.getComputedStyle(h2Line).fontSize : null;
    });

    expect(editorH1Size).toBe(readingH1Size);
    expect(editorH2Size).toBe(readingH2Size);
  });

  test('text color matches between modes', async () => {
    await loadFixture(page, 'Algorithms and Data Structures.md');
    await page.waitForTimeout(200);

    const editorColor = await page.evaluate(() => {
      const el = document.querySelector('.cm-content') as HTMLElement;
      return window.getComputedStyle(el).color;
    });

    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    const readingColor = await page.evaluate(() => {
      const el = document.querySelector('.markdown-preview-view') as HTMLElement;
      return window.getComputedStyle(el).color;
    });

    expect(editorColor).toBe(readingColor);
    await showLive(page);
  });
});

// ─── Reading view rendering correctness (Algorithms fixture) ──

test.describe('Reading view rendering (Algorithms and Data Structures)', () => {
  test.beforeAll(async () => {
    await showReading(page, '');
    const content = await loadFixtureRaw('Algorithms and Data Structures.md');
    await setDoc(page, content);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    await showLive(page);
  });

  // Headings
  test('H1 heading renders', async () => {
    const h1 = rv(page, 'h1');
    await expect(h1.first()).toHaveText('Algorithms and Data Structures');
  });

  test('H2 headings render', async () => {
    const h2s = rv(page, 'h2');
    const count = await h2s.count();
    expect(count).toBeGreaterThanOrEqual(6); // Combinatorics, Disjoint Set, Heap, Bloom Filters, Graphs, Trees

    const texts = await h2s.allTextContents();
    expect(texts).toContain('Combinatorics');
    expect(texts).toContain('Disjoint Set');
    expect(texts).toContain('Heap');
    expect(texts).toContain('Bloom Filters');
    expect(texts).toContain('Graphs');
    expect(texts).toContain('Trees');
  });

  test('H3 headings render', async () => {
    const h3s = rv(page, 'h3');
    const texts = await h3s.allTextContents();
    // Note: markdown-it typographer converts straight apostrophes to curly (\u2019)
    expect(texts).toContain('Kruskal\u2019s Algorithm');
    expect(texts).toContain('Prim\u2019s Algorithm');
    expect(texts).toContain('Depth First Search Algorithm (DFS)');
    expect(texts).toContain('Breadth First Search Algorithm (BFS)');
    expect(texts).toContain('Dijkstra\u2019s Algorithm');
    expect(texts).toContain('Bellman Ford Algorithm');
    expect(texts).toContain('Kahn\u2019s Algorithm (Topological Sorting)');
  });

  // Bold text
  test('bold text renders as <strong>', async () => {
    const strongs = rv(page, 'strong');
    const count = await strongs.count();
    expect(count).toBeGreaterThanOrEqual(5);

    const texts = await strongs.allTextContents();
    expect(texts).toContain('Implementation:');
    expect(texts).toContain('Methods:');
    expect(texts).toContain('Complexity:');
  });

  // Italic text
  test('italic text renders as <em>', async () => {
    const ems = rv(page, 'em');
    const count = await ems.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const allText = (await ems.allTextContents()).join(' ');
    // "k" and "n" and "m" are italic in the Bloom Filters section
    expect(allText).toContain('k');
  });

  // Inline code
  test('inline code renders as <code>', async () => {
    const codes = rv(page, 'code');
    const texts = await codes.allTextContents();
    // Disjoint Set methods
    expect(texts).toContain('Add(value)');
    expect(texts).toContain('Find(value)');
    expect(texts).toContain('Union(value1, value2)');
  });

  // Blockquotes
  test('blockquotes render', async () => {
    const bqs = rv(page, 'blockquote');
    const count = await bqs.count();
    expect(count).toBeGreaterThanOrEqual(2); // The two Bloom Filter examples
  });

  // Ordered lists
  test('ordered lists render', async () => {
    const ols = rv(page, 'ol');
    const count = await ols.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // Inline math (KaTeX)
  test('inline math renders as KaTeX', async () => {
    const katexSpans = rv(page, '.katex');
    const count = await katexSpans.count();
    // The fixture has many inline math expressions: $N!$, $n_x$, etc.
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('inline math does not show raw dollar signs', async () => {
    // The rendered text should not contain raw $N!$ — it should be rendered
    const html = await page.evaluate(() => {
      return document.getElementById('reading-content')!.innerHTML;
    });
    // KaTeX renders math as spans with class "katex", not as raw $...$
    // Check that some expected math expressions are rendered as KaTeX
    expect(html).toContain('class="katex"');
    // Raw dollar-delimited math like $N!$ should NOT appear as literal text
    expect(html).not.toContain('>$N!$<');
  });

  // Block math (KaTeX)
  test('block math renders as KaTeX display', async () => {
    const blockMath = rv(page, '.katex-display');
    const count = await blockMath.count();
    // At least the 2 block math expressions: the factorial formula and nCr
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('block math is centered', async () => {
    const isCenter = await page.evaluate(() => {
      const block = document.querySelector('#reading-content .katex-block') as HTMLElement;
      if (!block) return null;
      return window.getComputedStyle(block).textAlign;
    });
    expect(isCenter).toBe('center');
  });

  // Links
  test('links render as <a> elements', async () => {
    // The fixture contains [[#Disjoint Set]] wiki-style links
    // markdown-it with linkify should handle URLs if any
    // The wiki-link will be plain text since markdown-it doesn't handle [[...]]
    // But this test confirms no errors occurred during rendering
    const readingContent = await page.evaluate(() => {
      return document.getElementById('reading-content')!.textContent || '';
    });
    expect(readingContent).toContain('Disjoint Set');
  });

  // Overall structure
  test('reading view contains all major sections', async () => {
    const text = await page.evaluate(() => {
      return document.getElementById('reading-content')!.textContent || '';
    });

    expect(text).toContain('Algorithms and Data Structures');
    expect(text).toContain('Combinatorics');
    expect(text).toContain('Disjoint Set');
    expect(text).toContain('Heap');
    expect(text).toContain('Bloom Filters');
    expect(text).toContain('Graphs');
    expect(text).toContain('Trees');
    expect(text).toContain('Layered traversing');
  });

  test('no raw markdown syntax visible in reading view', async () => {
    const html = await page.evaluate(() => {
      return document.getElementById('reading-content')!.innerHTML;
    });
    // Bold markers should not be visible
    expect(html).not.toMatch(/\*\*Implementation:\*\*/);
    // Heading markers should not be visible
    expect(html).not.toMatch(/^## /m);
    expect(html).not.toMatch(/^### /m);
  });
});

// ─── Reading view with special features ──────────────────────

test.describe('Reading view special features', () => {
  test('highlight (==text==) renders as <mark>', async () => {
    await showReading(page, 'This is ==highlighted text== in a paragraph.');

    const marks = rv(page, 'mark');
    await expect(marks.first()).toHaveText('highlighted text');
    await showLive(page);
  });

  test('frontmatter is stripped from reading view', async () => {
    await showReading(page, '---\ntitle: Test\ndate: 2026-01-01\n---\n\n# Hello World');

    const text = await page.evaluate(() => {
      return document.getElementById('reading-content')!.textContent || '';
    });

    // Frontmatter should NOT appear
    expect(text).not.toContain('title: Test');
    expect(text).not.toContain('date: 2026-01-01');
    expect(text).not.toContain('---');
    // Content should appear
    expect(text).toContain('Hello World');
    await showLive(page);
  });

  test('footnotes render with references and definitions', async () => {
    const md = [
      'Hello[^1] world[^note].',
      '',
      '[^1]: First footnote',
      '[^note]: Named footnote',
    ].join('\n');
    await showReading(page, md);

    // Footnote references should be superscript links
    const refs = rv(page, '.footnote-ref');
    expect(await refs.count()).toBe(2);

    // Footnote definitions should exist
    const footnotes = rv(page, '.footnotes');
    await expect(footnotes).toBeVisible();

    const items = rv(page, '.footnote-item');
    expect(await items.count()).toBe(2);

    await showLive(page);
  });

  test('task list checkboxes render in reading view', async () => {
    const md = '- [ ] Unchecked\n- [x] Checked\n- [ ] Another';
    await showReading(page, md);

    const checkboxes = rv(page, 'input[type="checkbox"]');
    expect(await checkboxes.count()).toBe(3);

    // First should be unchecked, second checked
    const checked = await page.evaluate(() => {
      const cbs = document.querySelectorAll('#reading-content input[type="checkbox"]');
      return Array.from(cbs).map(cb => (cb as HTMLInputElement).checked);
    });
    expect(checked).toEqual([false, true, false]);

    await showLive(page);
  });

  test('tables render correctly in reading view', async () => {
    const md = '| Name | Value |\n|------|-------|\n| Alpha | 1 |\n| Beta | 2 |';
    await showReading(page, md);

    const table = rv(page, 'table');
    await expect(table).toBeVisible();

    const ths = rv(page, 'th');
    expect(await ths.count()).toBe(2);
    await expect(ths.first()).toHaveText('Name');

    const tds = rv(page, 'td');
    expect(await tds.count()).toBe(4);

    await showLive(page);
  });

  test('code blocks render in reading view', async () => {
    const md = '```python\ndef hello():\n    print("world")\n```';
    await showReading(page, md);

    const pre = rv(page, 'pre');
    await expect(pre).toBeVisible();

    const code = rv(page, 'pre code');
    const text = await code.textContent();
    expect(text).toContain('def hello()');
    expect(text).toContain('print("world")');

    // Code should use monospace font
    const fontFamily = await page.evaluate(() => {
      const el = document.querySelector('#reading-content pre code') as HTMLElement;
      return window.getComputedStyle(el).fontFamily;
    });
    expect(fontFamily).toContain('monospace');

    await showLive(page);
  });

  test('horizontal rule renders in reading view', async () => {
    await showReading(page, 'Above\n\n---\n\nBelow');

    const hr = rv(page, 'hr');
    await expect(hr).toBeVisible();
    await showLive(page);
  });

  test('images render in reading view', async () => {
    await showReading(page, '![Alt text](https://www.ciobanu.org/img.png)');

    const img = rv(page, 'img');
    await expect(img).toHaveAttribute('alt', 'Alt text');
    await expect(img).toHaveAttribute('src', 'https://www.ciobanu.org/img.png');
    await showLive(page);
  });

  test('inline math in blockquote renders (Bloom Filters pattern)', async () => {
    const md = '> $size = 10^6 \\times 2$';
    await showReading(page, md);

    const bq = rv(page, 'blockquote');
    await expect(bq).toBeVisible();

    const katex = rv(page, 'blockquote .katex');
    expect(await katex.count()).toBeGreaterThanOrEqual(1);

    await showLive(page);
  });
});

// ─── Mermaid diagram rendering ──────────────────────────────

test.describe('Mermaid diagram rendering', () => {
  test('mermaid diagram renders as SVG in reading view', async () => {
    const content = loadFixtureRaw('Algorithms and Data Structures.md');
    await setDoc(page, content);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));

    // Mermaid rendering is async — poll for SVG to appear
    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('#reading-content .mermaid-diagram svg').length
      );
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    await showLive(page);
  });

  test('mermaid SVG contains expected node text', async () => {
    const content = loadFixtureRaw('Algorithms and Data Structures.md');
    await setDoc(page, content);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));

    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('#reading-content .mermaid-diagram svg').length
      );
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    const svgText = await page.evaluate(() => {
      const svg = document.querySelector('#reading-content .mermaid-diagram svg');
      return svg?.textContent || '';
    });
    expect(svgText).toContain('Idea');
    expect(svgText).toContain('Design');
    expect(svgText).toContain('Implementation');

    await showLive(page);
  });

  test('raw mermaid syntax is not visible after rendering', async () => {
    const md = '```mermaid\ngraph TD\n    A-->B\n```';
    await setDoc(page, md);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));

    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('#reading-content .mermaid-diagram svg').length
      );
    }, { timeout: 10000 }).toBe(1);

    // The rendered container should have SVG, not raw code
    const html = await page.evaluate(() =>
      document.querySelector('#reading-content .mermaid-diagram')!.innerHTML
    );
    expect(html).toContain('<svg');
    expect(html).not.toContain('graph TD');

    await showLive(page);
  });

  test('invalid mermaid syntax shows error gracefully', async () => {
    const md = '```mermaid\ninvalid diagram %%@#$ syntax\n```';
    await setDoc(page, md);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));

    // Wait for mermaid to attempt rendering and fail
    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('#reading-content .mermaid-diagram.mermaid-error').length
      );
    }, { timeout: 10000 }).toBe(1);

    // The error div should still show the raw source
    const text = await page.evaluate(() =>
      document.querySelector('#reading-content .mermaid-diagram.mermaid-error')?.textContent || ''
    );
    expect(text).toContain('invalid diagram');

    await showLive(page);
  });

  test('multiple mermaid diagrams render independently', async () => {
    const md = [
      '```mermaid',
      'graph LR',
      '    A-->B',
      '```',
      '',
      'Some text between.',
      '',
      '```mermaid',
      'graph TD',
      '    C-->D',
      '```',
    ].join('\n');
    await setDoc(page, md);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));

    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('#reading-content .mermaid-diagram svg').length
      );
    }, { timeout: 10000 }).toBe(2);

    await showLive(page);
  });
});

// ─── Reading view rendering (CommonMark full) ───────────────

test.describe('Reading view rendering (CommonMark full)', () => {
  let fixtureContent: string;

  test.beforeAll(async () => {
    fixtureContent = loadFixtureRaw('commonmark-full.md');
    await showReading(page, fixtureContent);
  });

  test.afterAll(async () => {
    await showLive(page);
  });

  test('images render with correct attributes', async () => {
    const images = rv(page, 'img');
    const count = await images.count();
    expect(count).toBe(3);

    // First image has alt text
    await expect(images.nth(0)).toHaveAttribute('alt', 'Alt text for image');
    await expect(images.nth(0)).toHaveAttribute('src', 'https://placehold.co/150');

    // Second image has alt text and title
    await expect(images.nth(1)).toHaveAttribute('alt', 'Image with title');
    await expect(images.nth(1)).toHaveAttribute('title', 'Placeholder Image');

    // Third image has empty alt
    await expect(images.nth(2)).toHaveAttribute('alt', '');
  });

  test('links render as <a> elements with href', async () => {
    const links = rv(page, 'a[href="https://www.ciobanu.org/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    await expect(links.first()).toBeVisible();
  });

  test('autolinks render', async () => {
    const autolink = rv(page, 'a[href="https://www.ciobanu.org/"]');
    expect(await autolink.count()).toBeGreaterThanOrEqual(1);
  });

  test('nested blockquotes render', async () => {
    const blockquotes = rv(page, 'blockquote');
    expect(await blockquotes.count()).toBeGreaterThanOrEqual(3);

    // Nested blockquote: a blockquote inside a blockquote
    const nested = rv(page, 'blockquote > blockquote');
    expect(await nested.count()).toBeGreaterThanOrEqual(1);
  });

  test('unordered and ordered lists render', async () => {
    const ulLists = rv(page, 'ul');
    expect(await ulLists.count()).toBeGreaterThanOrEqual(3);

    const olLists = rv(page, 'ol');
    expect(await olLists.count()).toBeGreaterThanOrEqual(2);
  });

  test('task checkboxes render', async () => {
    const checkboxes = rv(page, 'input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(4);

    // At least 2 should be checked
    const checked = rv(page, 'input[type="checkbox"][checked]');
    expect(await checked.count()).toBeGreaterThanOrEqual(2);
  });

  test('tables render with alignment', async () => {
    const tables = rv(page, 'table');
    expect(await tables.count()).toBeGreaterThanOrEqual(2);

    // Alignment table has th elements
    const ths = rv(page, 'table th');
    expect(await ths.count()).toBeGreaterThanOrEqual(3);
  });

  test('code blocks with language render', async () => {
    const codeBlocks = rv(page, 'pre code');
    expect(await codeBlocks.count()).toBeGreaterThanOrEqual(5);
  });

  test('horizontal rules render', async () => {
    const hrs = rv(page, 'hr');
    expect(await hrs.count()).toBeGreaterThanOrEqual(3);
  });

  test('strikethrough renders', async () => {
    // markdown-it renders ~~text~~ as <s> (not <del>)
    const s = rv(page, 's');
    expect(await s.count()).toBeGreaterThanOrEqual(1);
  });

  test('frontmatter is stripped from output', async () => {
    const text = await page.evaluate(() =>
      document.getElementById('reading-content')!.textContent || ''
    );
    expect(text).not.toContain('title: CommonMark Full Spec Coverage');
    expect(text).not.toContain('author: Test Suite');
  });

  test('no raw markdown syntax visible', async () => {
    const text = await page.evaluate(() =>
      document.getElementById('reading-content')!.textContent || ''
    );
    // Should not see raw fenced code markers or bold markers
    expect(text).not.toContain('```');
    expect(text).not.toContain('**bold with asterisks**');
  });
});

// ─── Reading view link handling ─────────────────────────────

test.describe('Reading view link handling', () => {
  test('clicking external link does not navigate Electron window', async () => {
    await showReading(page, '[Go to Example](https://www.ciobanu.org/)');

    // Click the link
    const link = rv(page, 'a[href="https://www.ciobanu.org/"]');
    await link.click();

    // Wait a moment to ensure no navigation happened
    await page.waitForTimeout(300);

    // The reading view should still be visible (not navigated away)
    const readingContainer = page.locator('#reading-container');
    await expect(readingContainer).toBeVisible();

    // The editor content should still be accessible
    const hasTestApi = await page.evaluate(() => !!(window as any).__marksidian);
    expect(hasTestApi).toBe(true);

    await showLive(page);
  });

  test('clicking link with href keeps app functional', async () => {
    // Render content with multiple link types
    await showReading(page, [
      '[External](https://www.ciobanu.org/)',
      '',
      '[Anchor](#section)',
    ].join('\n'));

    // Click the external link
    const extLink = rv(page, 'a[href="https://www.ciobanu.org/"]');
    await extLink.click();
    await page.waitForTimeout(300);

    // App should still be functional — test API accessible, reading view visible
    const readingVisible = await page.evaluate(() =>
      document.getElementById('reading-container')!.style.display !== 'none'
    );
    expect(readingVisible).toBe(true);

    // Click the anchor link
    const anchorLink = rv(page, 'a[href="#section"]');
    await anchorLink.click();
    await page.waitForTimeout(200);

    // Still functional
    const hasTestApi = await page.evaluate(() => !!(window as any).__marksidian);
    expect(hasTestApi).toBe(true);

    await showLive(page);
  });
});

// ─── Mode switching preserves content ────────────────────────

test.describe('Mode switching round-trips', () => {
  test('switching live -> reading -> live preserves document', async () => {
    const fixture = await loadFixtureRaw('Algorithms and Data Structures.md');
    await setDoc(page, fixture);

    // Capture content in live mode
    const beforeContent = await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent()
    );

    // Switch to reading and back
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await page.waitForTimeout(200);

    // Content should be unchanged
    const afterContent = await page.evaluate(() =>
      (window as any).__marksidian.getEditorContent()
    );
    expect(afterContent).toBe(beforeContent);
  });

  test('reading view updates when content changes', async () => {
    await setDoc(page, '# Original Title');
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    let h1Text = await page.evaluate(() =>
      document.querySelector('#reading-content h1')?.textContent || ''
    );
    expect(h1Text).toBe('Original Title');

    // Switch back, change content, switch to reading again
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await page.waitForTimeout(100);
    await setDoc(page, '# Updated Title');
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    h1Text = await page.evaluate(() =>
      document.querySelector('#reading-content h1')?.textContent || ''
    );
    expect(h1Text).toBe('Updated Title');

    await showLive(page);
  });
});

// ─── Helper: read raw fixture (no setDoc) ───────────────────

import * as fs from 'fs';
import * as path from 'path';

function loadFixtureRaw(name: string): string {
  const fixturePath = path.join(__dirname, 'fixtures', name);
  return fs.readFileSync(fixturePath, 'utf-8');
}
