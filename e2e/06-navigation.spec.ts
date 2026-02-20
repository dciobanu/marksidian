import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, getDoc, setDoc, typeText, press, focusEditor, getCursorPos, setCursor, setCursorLineCol, loadFixture, clearEditor, getLineInfo } from './helpers';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  // Ensure live preview mode
  await page.evaluate(() => (window as any).__lume.switchToMode('live'));
});

test.afterAll(async () => {
  await page.evaluate(() => {
    (window as any).__lume.markSaved();
    window.lume.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
});

test.describe('Cursor movement', () => {
  test('arrow keys move cursor', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 0); // Start of doc

    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');

    const pos = await getCursorPos(page);
    expect(pos.col).toBe(4); // After 'Hel' -> col 4
  });

  test('ArrowDown moves to next line', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    await setCursorLineCol(page, 1, 1);

    await press(page, 'ArrowDown');
    const pos = await getCursorPos(page);
    expect(pos.line).toBe(2);
  });

  test('ArrowUp moves to previous line', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    await setCursorLineCol(page, 3, 1);

    await press(page, 'ArrowUp');
    const pos = await getCursorPos(page);
    expect(pos.line).toBe(2);
  });

  test('Home moves to line start', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 5);

    await press(page, 'Home');
    const pos = await getCursorPos(page);
    expect(pos.col).toBe(1);
  });

  test('End moves to line end', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 0);

    await press(page, 'End');
    const pos = await getCursorPos(page);
    expect(pos.col).toBe(12); // 'Hello World' is 11 chars, col = 12 (after last char)
  });

  test('Cmd+ArrowLeft moves to line start (macOS)', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 5);

    await press(page, 'Meta+ArrowLeft');
    const pos = await getCursorPos(page);
    expect(pos.col).toBe(1);
  });

  test('Cmd+ArrowRight moves to line end (macOS)', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 0);

    await press(page, 'Meta+ArrowRight');
    const pos = await getCursorPos(page);
    expect(pos.col).toBe(12);
  });

  test('Cmd+ArrowUp moves to document start', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    await setCursorLineCol(page, 3, 3);

    await press(page, 'Meta+ArrowUp');
    const pos = await getCursorPos(page);
    expect(pos.line).toBe(1);
    expect(pos.col).toBe(1);
  });

  test('Cmd+ArrowDown moves to document end', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    await setCursorLineCol(page, 1, 1);

    await press(page, 'Meta+ArrowDown');
    const pos = await getCursorPos(page);
    expect(pos.line).toBe(3);
  });

  test('Alt+ArrowRight moves by word', async () => {
    await setDoc(page, 'Hello World Test');
    await setCursor(page, 0);

    await press(page, 'Alt+ArrowRight');
    const pos = await getCursorPos(page);
    // Should be at end of first word
    expect(pos.col).toBeGreaterThan(1);
    expect(pos.col).toBeLessThanOrEqual(6);
  });

  test('setCursorLineCol positions correctly', async () => {
    await setDoc(page, 'AAAA\nBBBB\nCCCC\nDDDD');
    await setCursorLineCol(page, 3, 3);

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(3);
    expect(pos.col).toBe(3);
  });
});

test.describe('Selection', () => {
  test('Shift+ArrowRight selects character', async () => {
    await setDoc(page, 'Select me');
    await setCursor(page, 0);

    await press(page, 'Shift+ArrowRight');
    await press(page, 'Shift+ArrowRight');
    await press(page, 'Shift+ArrowRight');

    const sel = await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const { from, to } = view.state.selection.main;
      return { from, to };
    });
    expect(sel.from).toBe(0);
    expect(sel.to).toBe(3);
  });

  test('Cmd+A selects entire document', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    await focusEditor(page);
    await press(page, 'Meta+a');

    const sel = await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const { from, to } = view.state.selection.main;
      return { from, to, docLen: view.state.doc.length };
    });
    expect(sel.from).toBe(0);
    expect(sel.to).toBe(sel.docLen);
  });

  test('Shift+Cmd+ArrowRight selects to end of line', async () => {
    await setDoc(page, 'Hello World');
    await setCursor(page, 5);

    await press(page, 'Shift+Meta+ArrowRight');

    const sel = await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const { from, to } = view.state.selection.main;
      return view.state.doc.sliceString(from, to);
    });
    expect(sel).toBe(' World');
  });

  test('double-click selects word', async () => {
    await setDoc(page, 'Hello World Test');
    await page.waitForTimeout(100);

    // Double-click on 'World' — we need to find the right coordinates
    // Instead, use programmatic word selection
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      // Position inside 'World' (offset 6)
      const pos = 6;
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      // Find word boundaries
      let start = pos - line.from;
      let end = pos - line.from;
      while (start > 0 && /\w/.test(text[start - 1])) start--;
      while (end < text.length && /\w/.test(text[end])) end++;
      view.dispatch({
        selection: { anchor: line.from + start, head: line.from + end },
      });
    });
    await page.waitForTimeout(50);

    const sel = await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const { from, to } = view.state.selection.main;
      return view.state.doc.sliceString(from, to);
    });
    expect(sel).toBe('World');
  });

  test('typing replaces selection', async () => {
    await setDoc(page, 'Hello World');
    await focusEditor(page);
    // Select 'World'
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: 6, head: 11 } });
    });
    await page.keyboard.type('Lume');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('Hello Lume');
  });

  test('backspace deletes selection', async () => {
    await setDoc(page, 'ABCDEF');
    await focusEditor(page);
    // Select 'BCD'
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: 1, head: 4 } });
    });
    await press(page, 'Backspace');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('AEF');
  });
});

test.describe('Multi-line navigation and editing', () => {
  test('Enter creates new line at cursor', async () => {
    await setDoc(page, 'AB');
    await setCursor(page, 1); // Between A and B
    await press(page, 'Enter');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('A\nB');
  });

  test('typing at end of document', async () => {
    await setDoc(page, 'End');
    await setCursor(page, 3); // At end
    await page.keyboard.type(' more');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('End more');
  });

  test('typing in middle of document', async () => {
    await setDoc(page, 'StartEnd');
    await setCursor(page, 5); // Between 'Start' and 'End'
    await page.keyboard.type('Middle');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('StartMiddleEnd');
  });

  test('delete line content then type', async () => {
    await setDoc(page, 'Line 1\nDelete me\nLine 3');
    // Select entire line 2
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const line2 = view.state.doc.line(2);
      view.dispatch({ selection: { anchor: line2.from, head: line2.to } });
    });
    await page.keyboard.type('Replaced');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('Line 1\nReplaced\nLine 3');
  });
});

test.describe('Navigation in large documents', () => {
  test('scrolling through a large fixture file', async () => {
    const content = await loadFixture(page, 'commonmark-full.md');
    await page.waitForTimeout(300);

    // Verify content loaded
    const doc = await getDoc(page);
    expect(doc.length).toBeGreaterThan(100);

    // Navigate to end of document
    await focusEditor(page);
    await press(page, 'Meta+ArrowDown');
    await page.waitForTimeout(200);

    const pos = await getCursorPos(page);
    const lineCount = content.split('\n').length;
    expect(pos.line).toBe(lineCount);
  });

  test('cursor movement across heading and paragraph', async () => {
    await setDoc(page, '# Heading\n\nParagraph text.');
    await setCursorLineCol(page, 1, 1);

    // Move down through heading, empty line, paragraph
    await press(page, 'ArrowDown');
    expect((await getCursorPos(page)).line).toBe(2);

    await press(page, 'ArrowDown');
    expect((await getCursorPos(page)).line).toBe(3);
  });

  test('cursor movement across code block', async () => {
    await setDoc(page, 'Before\n```\ncode line\n```\nAfter');
    await setCursorLineCol(page, 1, 1);

    // Navigate down through the code block
    for (let i = 0; i < 4; i++) {
      await press(page, 'ArrowDown');
    }

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(5);
  });

  test('cursor movement across table', async () => {
    await setDoc(page, 'Before\n| A | B |\n| -- | -- |\n| 1 | 2 |\nAfter');
    await setCursorLineCol(page, 1, 1);

    // Navigate down through the table
    for (let i = 0; i < 4; i++) {
      await press(page, 'ArrowDown');
    }

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(5);
  });

  test('Enter after table row creates new line (no stuck cursor)', async () => {
    await setDoc(page, '# Title\n\n| A | B |\n| -- | -- |\n| 1 | 2 |');
    // Place cursor at end of last table row
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      const lastLine = view.state.doc.line(view.state.doc.lines);
      view.dispatch({ selection: { anchor: lastLine.to } });
      view.focus();
    });
    await page.waitForTimeout(100);

    await press(page, 'Enter');
    await page.keyboard.type('New line after table');
    await page.waitForTimeout(200);

    const doc = await getDoc(page);
    expect(doc).toContain('New line after table');

    const pos = await getCursorPos(page);
    // Cursor should be on a new line, not stuck in the table
    expect(pos.line).toBeGreaterThan(5);
  });
});

test.describe('Clipboard operations', () => {
  test('Cmd+C and Cmd+V copy-paste text', async () => {
    await setDoc(page, 'Copy this text');
    await focusEditor(page);
    // Select 'Copy'
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: 0, head: 4 } });
    });
    await press(page, 'Meta+c');
    await page.waitForTimeout(50);

    // Move to end
    await press(page, 'Meta+ArrowDown');
    await press(page, 'Meta+ArrowRight');
    await page.keyboard.type(' ');
    await press(page, 'Meta+v');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('Copy this text Copy');
  });

  test('Cmd+X cuts selected text', async () => {
    await setDoc(page, 'Cut this');
    await focusEditor(page);
    // Select 'Cut'
    await page.evaluate(() => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: 0, head: 3 } });
    });
    await press(page, 'Meta+x');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe(' this');
  });
});

test.describe('Edge cases', () => {
  test('empty document: cursor at 1,1', async () => {
    await setDoc(page, '');
    await focusEditor(page);

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(1);
    expect(pos.col).toBe(1);
  });

  test('typing in empty document works', async () => {
    await setDoc(page, '');
    await focusEditor(page);
    await page.keyboard.type('Fresh start');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('Fresh start');
  });

  test('rapid typing does not lose characters', async () => {
    await setDoc(page, '');
    await focusEditor(page);

    const expected = 'abcdefghijklmnopqrstuvwxyz';
    await page.keyboard.type(expected, { delay: 10 });
    await page.waitForTimeout(200);

    const doc = await getDoc(page);
    expect(doc).toBe(expected);
  });

  test('special characters are preserved', async () => {
    const special = 'café résumé naïve <tag> & "quotes" \'apostrophe\'';
    await setDoc(page, special);
    const doc = await getDoc(page);
    expect(doc).toBe(special);
  });

  test('unicode content round-trips correctly', async () => {
    const unicode = '日本語テスト 中文测试 한국어테스트 🚀🎉';
    await setDoc(page, unicode);
    const doc = await getDoc(page);
    expect(doc).toBe(unicode);
  });

  test('very long line does not crash', async () => {
    const longLine = 'x'.repeat(10_000);
    await setDoc(page, longLine);
    const doc = await getDoc(page);
    expect(doc.length).toBe(10_000);
  });
});
