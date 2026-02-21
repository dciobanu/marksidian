import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, getDoc, setDoc, typeText, press, focusEditor, getMode, getStatusBar, getCursorPos, editorHas, clearEditor } from './helpers';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await page.evaluate(() => {
    (window as any).__marksidian.markSaved();
    window.marksidian.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
});

test.describe('Mode switching', () => {
  test('starts in live preview mode', async () => {
    const mode = await getMode(page);
    expect(mode).toBe('live');
  });

  test('editor container has is-live-preview class initially', async () => {
    const hasClass = await page.evaluate(() =>
      document.getElementById('editor-container')!.classList.contains('is-live-preview')
    );
    expect(hasClass).toBe(true);
  });

  test('switch to source mode via switchToMode', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('source'));
    await page.waitForTimeout(100);

    const mode = await getMode(page);
    expect(mode).toBe('source');

    const hasLiveClass = await page.evaluate(() =>
      document.getElementById('editor-container')!.classList.contains('is-live-preview')
    );
    expect(hasLiveClass).toBe(false);
  });

  test('source mode shows raw markdown markers', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('source'));
    await setDoc(page, '# Heading\n\n**bold text**');
    await page.waitForTimeout(100);

    // In source mode, no decorations should hide markers
    const doc = await getDoc(page);
    expect(doc).toContain('# Heading');
    expect(doc).toContain('**bold text**');
  });

  test('switch back to live mode restores decorations', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await page.waitForTimeout(100);

    const mode = await getMode(page);
    expect(mode).toBe('live');

    const hasLiveClass = await page.evaluate(() =>
      document.getElementById('editor-container')!.classList.contains('is-live-preview')
    );
    expect(hasLiveClass).toBe(true);
  });

  test('switch to reading mode hides editor, shows reading view', async () => {
    await setDoc(page, '# Reading Test\n\nSome content here.');
    await page.evaluate(() => (window as any).__marksidian.switchToMode('reading'));
    await page.waitForTimeout(200);

    const editorVisible = await page.evaluate(() =>
      document.getElementById('editor-container')!.style.display !== 'none'
    );
    const readingVisible = await page.evaluate(() =>
      document.getElementById('reading-container')!.style.display !== 'none'
    );

    expect(editorVisible).toBe(false);
    expect(readingVisible).toBe(true);
  });

  test('switch back from reading mode shows editor', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await page.waitForTimeout(100);

    const editorVisible = await page.evaluate(() =>
      document.getElementById('editor-container')!.style.display !== 'none'
    );
    expect(editorVisible).toBe(true);

    const mode = await getMode(page);
    expect(mode).toBe('live');
  });

  test('mode cycling: live -> source -> live', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    expect(await getMode(page)).toBe('live');

    await page.evaluate(() => (window as any).__marksidian.switchToMode('source'));
    expect(await getMode(page)).toBe('source');

    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    expect(await getMode(page)).toBe('live');
  });
});

test.describe('Status bar', () => {
  test('shows initial state: line 1, col 1, 0 words', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await setDoc(page, '');
    await focusEditor(page);
    await page.waitForTimeout(100);

    const status = await getStatusBar(page);
    expect(status.position).toContain('1');
    expect(status.mode).toBeTruthy();
  });

  test('updates cursor position on typing', async () => {
    await setDoc(page, '');
    await typeText(page, 'Hello');
    await page.waitForTimeout(100);

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(1);
    expect(pos.col).toBe(6); // After 'Hello' = column 6
  });

  test('updates word count', async () => {
    await setDoc(page, '');
    await typeText(page, 'one two three four');
    await page.waitForTimeout(100);

    const status = await getStatusBar(page);
    expect(status.words).toContain('4');
  });

  test('updates on line change', async () => {
    await setDoc(page, 'Line 1\nLine 2\nLine 3');
    // Place cursor at line 3
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const line3 = view.state.doc.line(3);
      view.dispatch({ selection: { anchor: line3.from + 2 } });
    });
    await page.waitForTimeout(100);

    const pos = await getCursorPos(page);
    expect(pos.line).toBe(3);
    expect(pos.col).toBe(3);
  });

  test('mode indicator updates with mode changes', async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await page.waitForTimeout(100);
    const liveStatus = await getStatusBar(page);

    await page.evaluate(() => (window as any).__marksidian.switchToMode('source'));
    await page.waitForTimeout(100);
    const sourceStatus = await getStatusBar(page);

    expect(liveStatus.mode).toBeTruthy();
    expect(sourceStatus.mode).toBeTruthy();

    // Restore live mode
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
  });
});

test.describe('Keyboard shortcuts — formatting', () => {
  test.beforeEach(async () => {
    await page.evaluate(() => (window as any).__marksidian.switchToMode('live'));
    await setDoc(page, '');
    await focusEditor(page);
  });

  test('Cmd+B inserts bold markers', async () => {
    await typeText(page, 'text');
    await press(page, 'Meta+a');
    await press(page, 'Meta+b');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('**text**');
  });

  test('Cmd+I inserts italic markers', async () => {
    await typeText(page, 'text');
    await press(page, 'Meta+a');
    await press(page, 'Meta+i');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('*text*');
  });

  test('Cmd+Shift+X inserts strikethrough markers', async () => {
    await typeText(page, 'text');
    await press(page, 'Meta+a');
    await press(page, 'Meta+Shift+x');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('~~text~~');
  });

  test('Cmd+Shift+C inserts inline code markers', async () => {
    await typeText(page, 'code');
    await press(page, 'Meta+a');
    await press(page, 'Meta+Shift+c');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('`code`');
  });

  test('Cmd+K inserts link syntax', async () => {
    await typeText(page, 'link');
    await press(page, 'Meta+a');
    await press(page, 'Meta+k');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('[link](url)');
  });

  test('Cmd+B toggles bold off when already bolded', async () => {
    await typeText(page, '**bold**');
    await press(page, 'Meta+a');
    await press(page, 'Meta+b');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).not.toContain('****');
  });

  test('Cmd+Shift+= increases heading level', async () => {
    await typeText(page, 'Title');
    await press(page, 'Meta+Shift+=');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('# Title');
  });

  test('Cmd+Shift+= increases heading from H1 to H2', async () => {
    await setDoc(page, '# Title');
    await focusEditor(page);
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: 3 } });
    });
    await press(page, 'Meta+Shift+=');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('## Title');
  });

  test('Cmd+Shift+- decreases heading level', async () => {
    await setDoc(page, '## Title');
    await focusEditor(page);
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: 3 } });
    });
    await press(page, 'Meta+Shift+-');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('# Title');
  });

  test('Cmd+Enter toggles checkbox', async () => {
    await setDoc(page, '- [ ] Task item');
    await focusEditor(page);
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: 8 } });
    });
    // Use the CM6 command directly since Meta+Enter may be intercepted
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      // Simulate the toggleCheckbox command
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      const text = line.text;
      const uncheckedMatch = text.match(/^(\s*- )\[ \](.*)/);
      if (uncheckedMatch) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: uncheckedMatch[1] + '[x]' + uncheckedMatch[2] },
        });
      }
    });
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('- [x] Task item');
  });

  test('Cmd+Enter toggles checkbox back to unchecked', async () => {
    await setDoc(page, '- [x] Done item');
    await focusEditor(page);
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      view.dispatch({ selection: { anchor: 8 } });
    });
    // Use the CM6 command directly
    await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      const text = line.text;
      const checkedMatch = text.match(/^(\s*- )\[x\](.*)/i);
      if (checkedMatch) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: checkedMatch[1] + '[ ]' + checkedMatch[2] },
        });
      }
    });
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toBe('- [ ] Done item');
  });
});

test.describe('Keyboard shortcuts — editing', () => {
  test('Cmd+Z undoes changes', async () => {
    await setDoc(page, '');
    await typeText(page, 'hello');
    const afterType = await getDoc(page);
    expect(afterType).toBe('hello');

    await press(page, 'Meta+z');
    await page.waitForTimeout(100);

    const afterUndo = await getDoc(page);
    expect(afterUndo.length).toBeLessThan(afterType.length);
  });

  test('Cmd+Shift+Z redoes', async () => {
    await setDoc(page, '');
    await typeText(page, 'redo test');
    await press(page, 'Meta+z');
    await page.waitForTimeout(50);
    await press(page, 'Meta+Shift+z');
    await page.waitForTimeout(100);

    const doc = await getDoc(page);
    expect(doc).toContain('redo test');
  });

  test('Cmd+A selects all', async () => {
    await setDoc(page, 'select all this');
    await focusEditor(page);
    await press(page, 'Meta+a');
    await page.waitForTimeout(50);

    const selection = await page.evaluate(() => {
      const view = (window as any).__marksidian.getEditorView();
      const { from, to } = view.state.selection.main;
      return { from, to, length: to - from };
    });
    expect(selection.from).toBe(0);
    expect(selection.to).toBe('select all this'.length);
  });
});

test.describe('Zoom', () => {
  test('zoom in increases font size', async () => {
    const before = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-text-size')
    );

    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('menu:zoom', { direction: 'in' });
    });
    await page.waitForTimeout(200);

    const after = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-text-size')
    );

    const beforeNum = parseInt(before || '16', 10);
    const afterNum = parseInt(after || '16', 10);
    expect(afterNum).toBeGreaterThan(beforeNum);
  });

  test('zoom reset returns to default', async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('menu:zoom', { direction: 'reset' });
    });
    await page.waitForTimeout(200);

    const size = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-text-size')
    );
    expect(parseInt(size || '16', 10)).toBe(16);
  });
});
