import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '..');

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(ROOT, 'dist', 'main', 'main.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const page = await app.firstWindow();
  // Wait for CM6 to mount
  await page.waitForSelector('.cm-editor', { timeout: 10_000 });
  return { app, page };
}

/** Get the raw document string from the editor via CM6 API. */
export async function getDoc(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__lume.getEditorContent());
}

/** Replace the entire document with `text` via CM6 dispatch. */
export async function setDoc(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => (window as any).__lume.setEditorContent(t), text);
  // Give CM6 + decorations a tick to settle
  await page.waitForTimeout(100);
}

/** Load a fixture file into the editor. */
export async function loadFixture(page: Page, name: string): Promise<string> {
  const fixturePath = path.join(ROOT, 'e2e', 'fixtures', name);
  const content = fs.readFileSync(fixturePath, 'utf-8');
  await setDoc(page, content);
  return content;
}

/** Move the cursor to a specific character offset. */
export async function setCursor(page: Page, pos: number): Promise<void> {
  await page.evaluate((p) => {
    const view = (window as any).__lume.getEditorView();
    view.dispatch({ selection: { anchor: p } });
    view.focus();
  }, pos);
  await page.waitForTimeout(50);
}

/** Move the cursor to a line and column (both 1-based). */
export async function setCursorLineCol(page: Page, line: number, col: number): Promise<void> {
  await page.evaluate(({ line, col }) => {
    const view = (window as any).__lume.getEditorView();
    const lineObj = view.state.doc.line(line);
    const pos = lineObj.from + col - 1;
    view.dispatch({ selection: { anchor: pos } });
    view.focus();
  }, { line, col });
  await page.waitForTimeout(50);
}

/** Get the current cursor position as {line, col}. */
export async function getCursorPos(page: Page): Promise<{ line: number; col: number }> {
  return page.evaluate(() => (window as any).__lume.getCursorPosition());
}

/** Get the current editor mode. */
export async function getMode(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__lume.getMode());
}

/** Click inside the CM6 content area to focus the editor. */
export async function focusEditor(page: Page): Promise<void> {
  await page.locator('.cm-content').click();
}

/** Type text using real keyboard events through the focused editor. */
export async function typeText(page: Page, text: string): Promise<void> {
  await focusEditor(page);
  await page.keyboard.type(text);
  // Let decorations settle
  await page.waitForTimeout(150);
}

/** Press a key combo (e.g. 'Meta+a', 'Enter', 'Backspace'). */
export async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(50);
}

/** Select all text, delete it, leaving an empty editor. */
export async function clearEditor(page: Page): Promise<void> {
  await focusEditor(page);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
}

/**
 * Query a CSS class on cm-line elements. Returns an array of objects
 * describing which lines carry the class.
 */
export async function getLinesWithClass(page: Page, cls: string): Promise<{ lineIndex: number; text: string }[]> {
  return page.evaluate((cls) => {
    const lines = document.querySelectorAll('.cm-line');
    const result: { lineIndex: number; text: string }[] = [];
    lines.forEach((el, i) => {
      if (el.classList.contains(cls) || el.closest('.' + cls)) {
        result.push({ lineIndex: i, text: el.textContent || '' });
      }
    });
    return result;
  }, cls);
}

/** Check if an element matching `selector` exists in the editor DOM. */
export async function editorHas(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    return document.querySelector('.cm-editor ' + sel) !== null;
  }, selector);
}

/** Count elements matching `selector` in the editor DOM. */
export async function editorCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    return document.querySelectorAll('.cm-editor ' + sel).length;
  }, selector);
}

/** Get the text content of the status bar items. */
export async function getStatusBar(page: Page): Promise<{ position: string; words: string; mode: string }> {
  return page.evaluate(() => ({
    position: document.getElementById('status-position')?.textContent || '',
    words: document.getElementById('status-words')?.textContent || '',
    mode: document.getElementById('status-mode')?.textContent || '',
  }));
}

/** Get info about every .cm-line in the editor. */
export async function getLineInfo(page: Page): Promise<{ text: string; classes: string }[]> {
  return page.evaluate(() => {
    const lines = document.querySelectorAll('.cm-editor .cm-line');
    return Array.from(lines).map((el) => ({
      text: el.textContent || '',
      classes: el.className,
    }));
  });
}
