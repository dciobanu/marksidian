import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, getDoc, focusEditor, getStatusBar } from './helpers';

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

// ── App Launch ──────────────────────────────────────────────────

test('app window opens', async () => {
  const windows = app.windows();
  expect(windows.length).toBeGreaterThanOrEqual(1);
});

test('window has a title', async () => {
  const title = await page.title();
  expect(title).toBeTruthy();
});

test('main process reports not packaged', async () => {
  const isPackaged = await app.evaluate(({ app }) => app.isPackaged);
  expect(isPackaged).toBe(false);
});

// ── Editor Presence ─────────────────────────────────────────────

test('CodeMirror editor is mounted', async () => {
  await expect(page.locator('.cm-editor')).toBeVisible();
});

test('editor content area exists', async () => {
  await expect(page.locator('.cm-content')).toBeVisible();
});

test('editor is focusable', async () => {
  await focusEditor(page);
  const focused = await page.evaluate(() =>
    document.activeElement?.closest('.cm-editor') !== null
  );
  expect(focused).toBe(true);
});

test('editor starts with empty document', async () => {
  const doc = await getDoc(page);
  // May be empty or have a single newline
  expect(doc.trim()).toBe('');
});

// ── UI Chrome ───────────────────────────────────────────────────

test('status bar is visible', async () => {
  await expect(page.locator('.status-bar')).toBeVisible();
});

test('status bar shows initial position', async () => {
  const sb = await getStatusBar(page);
  expect(sb.position).toContain('Ln');
  expect(sb.position).toContain('Col');
});

test('status bar shows word count', async () => {
  const sb = await getStatusBar(page);
  expect(sb.words).toContain('words');
});

test('status bar shows mode', async () => {
  const sb = await getStatusBar(page);
  expect(sb.mode).toBe('Live');
});

// ── Theme ───────────────────────────────────────────────────────

test('body has a theme class', async () => {
  const hasTheme = await page.evaluate(() =>
    document.body.classList.contains('theme-light') ||
    document.body.classList.contains('theme-dark')
  );
  expect(hasTheme).toBe(true);
});

// ── Layout ──────────────────────────────────────────────────────

test('readable line width is enabled by default', async () => {
  const has = await page.evaluate(() =>
    document.querySelector('.app-container')?.classList.contains('readable-line-width')
  );
  expect(has).toBe(true);
});

test('reading view is hidden by default', async () => {
  await expect(page.locator('#reading-container')).toBeHidden();
});
