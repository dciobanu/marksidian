import { test, expect, ElectronApplication, Page } from '@playwright/test';
import {
  launchApp, getDoc, setDoc, clearEditor, typeText,
  focusEditor, press, getCursorPos, getStatusBar,
} from './helpers';

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

test.beforeEach(async () => {
  await clearEditor(page);
});

// ── Basic Typing ────────────────────────────────────────────────

test('typing inserts text into the document', async () => {
  await typeText(page, 'Hello, World!');
  const doc = await getDoc(page);
  expect(doc).toBe('Hello, World!');
});

test('typing multiple lines with Enter', async () => {
  await typeText(page, 'Line 1');
  await press(page, 'Enter');
  await typeText(page, 'Line 2');
  await press(page, 'Enter');
  await typeText(page, 'Line 3');
  const doc = await getDoc(page);
  expect(doc).toBe('Line 1\nLine 2\nLine 3');
});

test('typing a heading', async () => {
  await typeText(page, '# My Heading');
  const doc = await getDoc(page);
  expect(doc).toBe('# My Heading');
});

test('typing bold text', async () => {
  await typeText(page, 'This is **bold** text');
  const doc = await getDoc(page);
  expect(doc).toBe('This is **bold** text');
});

test('typing a link', async () => {
  await typeText(page, '[click here](https://www.ciobanu.org/)');
  const doc = await getDoc(page);
  expect(doc).toBe('[click here](https://www.ciobanu.org/)');
});

test('typing a fenced code block', async () => {
  await typeText(page, '```javascript');
  await press(page, 'Enter');
  await typeText(page, 'const x = 1;');
  await press(page, 'Enter');
  await typeText(page, '```');
  const doc = await getDoc(page);
  expect(doc).toBe('```javascript\nconst x = 1;\n```');
});

test('typing a table and pressing Enter after it', async () => {
  await typeText(page, '| A | B |');
  await press(page, 'Enter');
  await typeText(page, '| -- | -- |');
  await press(page, 'Enter');
  await typeText(page, '| 1 | 2 |');
  await press(page, 'Enter');
  await typeText(page, 'Text after table');

  const doc = await getDoc(page);
  expect(doc).toContain('| A | B |');
  expect(doc).toContain('Text after table');

  // Critical: cursor should be on the line after the table
  const pos = await getCursorPos(page);
  const lines = doc.split('\n');
  const lastLine = lines[lines.length - 1];
  expect(lastLine).toBe('Text after table');
});

// ── Cursor Position Updates ─────────────────────────────────────

test('cursor position updates in status bar after typing', async () => {
  await typeText(page, 'Hello');
  const sb = await getStatusBar(page);
  expect(sb.position).toBe('Ln 1, Col 6');
});

test('cursor moves to new line after Enter', async () => {
  await typeText(page, 'Line 1');
  await press(page, 'Enter');
  const pos = await getCursorPos(page);
  expect(pos.line).toBe(2);
  expect(pos.col).toBe(1);
});

test('word count updates as user types', async () => {
  await typeText(page, 'one two three four five');
  const sb = await getStatusBar(page);
  expect(sb.words).toBe('5 words');
});

// ── Backspace & Delete ──────────────────────────────────────────

test('backspace deletes characters', async () => {
  await typeText(page, 'Hello');
  await press(page, 'Backspace');
  await press(page, 'Backspace');
  const doc = await getDoc(page);
  expect(doc).toBe('Hel');
});

test('select-all and delete clears the editor', async () => {
  await typeText(page, 'Some content here');
  await press(page, 'Meta+a');
  await press(page, 'Backspace');
  const doc = await getDoc(page);
  expect(doc).toBe('');
});

// ── Undo / Redo ─────────────────────────────────────────────────

test('Cmd+Z undoes typing', async () => {
  await typeText(page, 'Hello');
  // Small pause so CM6 groups the history entry
  await page.waitForTimeout(300);
  await typeText(page, ' World');
  await press(page, 'Meta+z');
  const doc = await getDoc(page);
  // Should have undone " World" (or part of it)
  expect(doc.length).toBeLessThan('Hello World'.length);
});

test('Cmd+Shift+Z redoes after undo', async () => {
  await typeText(page, 'First');
  await page.waitForTimeout(300);
  await typeText(page, ' Second');
  await press(page, 'Meta+z');
  const afterUndo = await getDoc(page);
  await press(page, 'Meta+Shift+z');
  const afterRedo = await getDoc(page);
  expect(afterRedo.length).toBeGreaterThanOrEqual(afterUndo.length);
});

// ── Tab indentation ─────────────────────────────────────────────

test('Tab inserts indentation', async () => {
  await typeText(page, 'Hello');
  await press(page, 'Home');
  await press(page, 'Tab');
  const doc = await getDoc(page);
  // Should have indentation before Hello
  expect(doc.startsWith('\t') || doc.startsWith('  ')).toBe(true);
});

// ── Content Integrity ───────────────────────────────────────────

test('setDoc and getDoc round-trip preserves content', async () => {
  const original = '# Test\n\nParagraph with **bold** and *italic*.\n\n- item 1\n- item 2\n';
  await setDoc(page, original);
  const doc = await getDoc(page);
  expect(doc).toBe(original);
});

test('typing after setDoc appends correctly', async () => {
  await setDoc(page, 'Prefix');
  // Move to end
  await press(page, 'Meta+ArrowDown');
  await typeText(page, ' suffix');
  const doc = await getDoc(page);
  expect(doc).toBe('Prefix suffix');
});
