import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, editorHas, editorCount, getLineInfo, setCursor, setDoc, getDoc, focusEditor, press } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await page.evaluate(() => {
    (window as any).__lume.markSaved();
    window.lume.notifyContentChanged(false);
  }).catch(() => {});
  await app.close();
});

// ── Paragraph definitions (in document order) ────────────────────
// They will be typed in REVERSE order (P10 first, P1 last),
// each prepended at position 0. The final document reads P1→P10.

const P1 = [
  '# Lume — Product & Technical Specification',
  '',
  '**Version:** 1.0 · **Date:** February 19, 2026 · **Status:** Draft for engineering handoff',
].join('\n');

const P2 = [
  '> **Lume** is a working name. Replace throughout before public release.',
].join('\n');

const P3 = [
  '---',
  '',
  '## Table of Contents',
].join('\n');

const P4 = [
  '1. [Executive Summary](#1-executive-summary)',
  '2. [Product Definition](#2-product-definition)',
  '3. [Technology Stack](#3-technology-stack)',
  '4. [Architecture](#4-architecture)',
  '5. [Editor Engine Specification](#5-editor-engine-specification)',
].join('\n');

const P5 = [
  '## 1. Executive Summary',
  '',
  'Lume is an **open-source, macOS-native markdown editor** that replicates the editing experience of Obsidian\'s Live Preview mode. It operates on **single files** (not vaults), uses the **same core technologies** as Obsidian (Electron + CodeMirror 6), and is distributed exclusively via **Homebrew**.',
].join('\n');

const P6 = [
  '### What this is NOT',
  '',
  '- Not a vault/knowledge-base tool (that\'s Obsidian)',
  '- Not a multi-file workspace (initially)',
  '- Not a plugin platform (initially)',
  '- Not cross-platform (initially)',
].join('\n');

const P7 = [
  '| # | Story | Acceptance |',
  '|---|-------|------------|',
  '| U1 | Open a `.md` file from Finder | File contents appear in the editor |',
  '| U2 | Edit markdown in Live Preview | Markdown syntax renders inline |',
].join('\n');

const P8 = [
  '```typescript',
  'function createDiv(cls: string, parent?: HTMLElement): HTMLDivElement {',
  '  const el = document.createElement(\'div\');',
  '  el.className = cls;',
  '  if (parent) parent.appendChild(el);',
  '  return el;',
  '}',
  '```',
].join('\n');

const P9 = [
  '1. **Fidelity** — The closer our DOM structure matches Obsidian\'s, the more compatible our CSS will be',
  '2. **Performance** — CM6 already manages its own DOM efficiently',
  '3. **Simplicity** — A single-file editor doesn\'t need component lifecycle management',
].join('\n');

const P10 = [
  '- [ ] Implement session persistence',
  '- [x] Add Live Preview decorations',
  '- [ ] Package for Homebrew',
].join('\n');

// ── Helper: insert text at position 0 via CM6 dispatch ──────────

async function prependText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const view = (window as any).__lume.getEditorView();
    view.dispatch({
      changes: { from: 0, to: 0, insert: t },
    });
  }, text);
  await page.waitForTimeout(200);
}

// ── Scrolling helpers ───────────────────────────────────────────
// CM6 only renders lines in the viewport. To check decorations,
// we must scroll the target region into view using CM6's dispatch
// with scrollIntoView. The cursor must be on a BLANK line to avoid
// blocking decorations via isCursorInRange.

/**
 * Scroll the top of the document into view, placing the cursor
 * on the first blank line found near the top.
 */
async function scrollToTopSafe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const view = (window as any).__lume.getEditorView();
    const doc = view.state.doc;
    // Find the first blank line
    for (let n = 1; n <= Math.min(doc.lines, 20); n++) {
      const line = doc.line(n);
      if (line.text.trim() === '') {
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        return;
      }
    }
    // Fallback: use position 0
    view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
  });
  await page.waitForTimeout(200);
}

/**
 * Scroll the bottom of the document into view, placing the cursor
 * on the last blank line (the trailing newline after P10).
 */
async function scrollToBottomSafe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const view = (window as any).__lume.getEditorView();
    const doc = view.state.doc;
    // Search backward from end for a blank line
    for (let n = doc.lines; n >= 1; n--) {
      const line = doc.line(n);
      if (line.text.trim() === '') {
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        return;
      }
    }
    // Fallback: doc end
    view.dispatch({ selection: { anchor: doc.length }, scrollIntoView: true });
  });
  await page.waitForTimeout(200);
}

/**
 * Scroll to a specific text string in the document, placing the cursor
 * on a nearby blank line (searching backward from the match). This
 * brings the target content into the viewport without cursor interference.
 */
async function scrollToText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const view = (window as any).__lume.getEditorView();
    const doc = view.state.doc;
    const docText = doc.toString();
    const idx = docText.indexOf(t);
    if (idx < 0) return;
    const targetLine = doc.lineAt(idx);
    // Search backward from target for a blank line
    for (let n = targetLine.number - 1; n >= 1; n--) {
      const line = doc.line(n);
      if (line.text.trim() === '') {
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        return;
      }
    }
    // Search forward for a blank line
    for (let n = targetLine.number + 1; n <= doc.lines; n++) {
      const line = doc.line(n);
      if (line.text.trim() === '') {
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        return;
      }
    }
    // Fallback: put cursor at the start of the target line
    view.dispatch({ selection: { anchor: targetLine.from }, scrollIntoView: true });
  }, text);
  await page.waitForTimeout(200);
}

// ── The test ─────────────────────────────────────────────────────

test.describe('Reverse-typing stress test (Product Technical Specification)', () => {

  test('typing paragraphs in reverse order builds document with correct decorations', async () => {
    // Clear any pre-existing content (e.g. from session restore)
    await setDoc(page, '');

    // ─── Step 1: Type P10 (task list) ────────────────────────────────
    // Add trailing \n so there's a blank line at doc end for safe cursor parking
    await prependText(page, P10 + '\n');
    await scrollToBottomSafe(page); // cursor on trailing blank line

    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-checkbox');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ─── Step 2: Prepend P9 (numbered list with bold) ────────────────
    await prependText(page, P9 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-strong');
    }, { timeout: 3000 }).toBe(true);

    // Verify P10 task checkboxes survive after being pushed down
    await scrollToBottomSafe(page);
    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-checkbox');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ─── Step 3: Prepend P8 (fenced code block) ─────────────────────
    await prependText(page, P8 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.filter(l => l.classes.includes('cm-lp-code-block')).length;
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(1);

    // ─── Step 4: Prepend P7 (GFM table) ─────────────────────────────
    await prependText(page, P7 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table');
    }, { timeout: 3000 }).toBe(true);

    // Verify code block still renders after being pushed down
    await scrollToText(page, 'function createDiv');
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.filter(l => l.classes.includes('cm-lp-code-block')).length;
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(1);

    // ─── Step 5: Prepend P6 (H3 + bullet list) ──────────────────────
    await prependText(page, P6 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-3'));
    }, { timeout: 3000 }).toBe(true);

    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-bullet');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ─── Step 6: Prepend P5 (H2 + bold paragraph) ───────────────────
    await prependText(page, P5 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-2'));
    }, { timeout: 3000 }).toBe(true);

    // Check multiple bold spans
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return document.querySelectorAll('.cm-editor .cm-lp-strong').length;
      });
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ─── Step 7: Prepend P4 (ordered list with links) ────────────────
    await prependText(page, P4 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-link');
    }, { timeout: 3000 }).toBe(true);

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return document.querySelectorAll('.cm-editor .cm-lp-link').length;
      });
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ─── Step 8: Prepend P3 (HR + H2 heading) ───────────────────────
    // When `---` is at position 0 (document start), the parser may treat
    // it as frontmatter rather than HR. Skip HR/H2 validation here;
    // it will be checked after P2 is prepended above in step 9.
    await prependText(page, P3 + '\n\n');

    // ─── Step 9: Prepend P2 (blockquote with bold) ───────────────────
    await prependText(page, P2 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('cm-lp-blockquote'));
    }, { timeout: 3000 }).toBe(true);

    // Now P2 is above P3, so `---` is no longer at position 0 → HR renders
    await scrollToText(page, '---');
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-hr-widget');
    }, { timeout: 3000 }).toBe(true);

    // Also check P3's "## Table of Contents" H2
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l =>
        l.classes.includes('HyperMD-header-2') &&
        l.text.includes('Table of Contents')
      );
    }, { timeout: 3000 }).toBe(true);

    // ─── Step 10: Prepend P1 (H1 heading + bold) ─────────────────────
    await prependText(page, P1 + '\n\n');
    await scrollToTopSafe(page);

    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-1'));
    }, { timeout: 3000 }).toBe(true);

    // ═══ FINAL VALIDATION: Full document is now assembled ═══════════

    // Verify document starts with the H1 heading
    const lines = await getLineInfo(page);
    expect(lines[0].text).toContain('Lume');
    expect(lines[0].classes).toContain('HyperMD-header-1');
  });

  test('scroll stress: decorations survive full-document scrolling after reverse assembly', async () => {
    // Document is fully assembled from previous test.

    // 1. Scroll to bottom → verify task checkboxes
    await scrollToBottomSafe(page);
    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-checkbox');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // 2. Scroll to top → verify H1 heading + bold
    await scrollToTopSafe(page);
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-1'));
    }, { timeout: 3000 }).toBe(true);

    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-strong');
    }, { timeout: 3000 }).toBe(true);

    // 3. Scroll to bottom again → verify checkboxes still render
    await scrollToBottomSafe(page);
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-checkbox');
    }, { timeout: 3000 }).toBe(true);

    // 4. Scroll back to top rapidly
    await scrollToTopSafe(page);
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-strong');
    }, { timeout: 3000 }).toBe(true);

    // 5. Scroll to middle → verify blockquote
    await scrollToText(page, 'working name');
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('cm-lp-blockquote'));
    }, { timeout: 3000 }).toBe(true);

    // 6. Verify HR widget
    await scrollToText(page, '---');
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-hr-widget');
    }, { timeout: 3000 }).toBe(true);

    // 7. Verify links
    await scrollToText(page, 'Executive Summary');
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-link');
    }, { timeout: 3000 }).toBe(true);
  });

  test('all decoration types present in final assembled document', async () => {
    // Check decorations section by section, scrolling to each one.

    // ── Top section: H1, bold, blockquote ──
    await scrollToTopSafe(page);
    await page.waitForTimeout(300);

    // H1 heading
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-1'));
    }, { timeout: 3000 }).toBe(true);

    // Bold (visible in P1's version line or P2's blockquote)
    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('.cm-editor .cm-lp-strong').length
      );
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(1);

    // Blockquote
    await scrollToText(page, 'working name');
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('cm-lp-blockquote'));
    }, { timeout: 3000 }).toBe(true);

    // ── HR section ──
    await scrollToText(page, '---');
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-hr-widget');
    }, { timeout: 3000 }).toBe(true);

    // H2 heading (Table of Contents or Executive Summary)
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-2'));
    }, { timeout: 3000 }).toBe(true);

    // ── Links section ──
    await scrollToText(page, 'Executive Summary](#');
    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.querySelectorAll('.cm-editor .cm-lp-link').length
      );
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ── Middle section: H2, H3, bullets, bold ──
    await scrollToText(page, 'What this is NOT');

    // H3 heading
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.some(l => l.classes.includes('HyperMD-header-3'));
    }, { timeout: 3000 }).toBe(true);

    // Bullet list
    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-bullet');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);

    // ── Table section ──
    await scrollToText(page, 'Story');
    await expect.poll(async () => {
      return await editorHas(page, '.cm-lp-table');
    }, { timeout: 3000 }).toBe(true);

    // ── Code block section ──
    await scrollToText(page, 'createDiv');
    await expect.poll(async () => {
      const lines = await getLineInfo(page);
      return lines.filter(l => l.classes.includes('cm-lp-code-block')).length;
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(1);

    // ── Bottom section: task checkboxes ──
    await scrollToBottomSafe(page);
    await expect.poll(async () => {
      return await editorCount(page, '.cm-lp-checkbox');
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Cut & Paste stress test — swap two real sections from the full spec
// ═════════════════════════════════════════════════════════════════════

test.describe('Cut & paste stress test (swap sections 4.3 ↔ 4.4)', () => {
  const SEC_43 = '### 4.3 Directory Structure';
  const SEC_44 = '### 4.4 CSS Class Naming Convention';
  const SEC_45 = '### 4.5 Data Flow: Opening and Editing a File';

  /**
   * Select a range [from, to) in the editor, cut it with Cmd+X.
   */
  async function selectAndCut(page: Page, from: number, to: number): Promise<void> {
    await page.evaluate(([f, t]) => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: f, head: t } });
      view.focus();
    }, [from, to]);
    await page.waitForTimeout(100);
    await press(page, 'Meta+x');
    await page.waitForTimeout(200);
  }

  /**
   * Place cursor at `offset` and paste with Cmd+V.
   */
  async function pasteAt(page: Page, offset: number): Promise<void> {
    await page.evaluate((o) => {
      const view = (window as any).__lume.getEditorView();
      view.dispatch({ selection: { anchor: o } });
      view.focus();
    }, offset);
    await page.waitForTimeout(100);
    await press(page, 'Meta+v');
    await page.waitForTimeout(200);
  }

  /**
   * Get the offset of a text needle in the document. Throws if not found.
   */
  async function indexOf(page: Page, needle: string): Promise<number> {
    const idx = await page.evaluate((n) => {
      const view = (window as any).__lume.getEditorView();
      return view.state.doc.toString().indexOf(n);
    }, needle);
    if (idx < 0) throw new Error(`"${needle.slice(0, 50)}" not found`);
    return idx;
  }

  /**
   * Get the offset right after the end of a heading's line (i.e. past
   * the trailing \n of the heading line).
   */
  async function headingEnd(page: Page, heading: string): Promise<number> {
    return page.evaluate((h) => {
      const view = (window as any).__lume.getEditorView();
      const text = view.state.doc.toString();
      const idx = text.indexOf(h);
      if (idx < 0) throw new Error(`Heading "${h}" not found`);
      return idx + h.length + 1; // +1 for the \n
    }, heading);
  }

  test('swap sections 4.3 and 4.4, then swap back to restore original', async () => {
    // ─── Load the full Product Technical Specification ────────────
    const specPath = path.resolve(__dirname, '..', 'Product Technical Specification.md');
    const original = fs.readFileSync(specPath, 'utf-8');
    await setDoc(page, original);
    await focusEditor(page);
    await page.waitForTimeout(300);

    // Sanity checks
    const doc0 = await getDoc(page);
    expect(doc0).toContain(SEC_43);
    expect(doc0).toContain(SEC_44);
    expect(doc0).toContain(SEC_45);

    // ── Capture exact original bodies for later matching ──────────
    // Body = everything from the heading line (inclusive) + 1 newline
    // through to just before the NEXT heading line.
    // So body43 = "\n```\nlume/\n...\n```\n\n"
    // (starts with the \n after heading, ends with the \n before next heading)
    const origBody43 = original.slice(
      original.indexOf(SEC_43) + SEC_43.length + 1,  // after heading's \n
      original.indexOf(SEC_44),                       // up to next heading
    );
    const origBody44 = original.slice(
      original.indexOf(SEC_44) + SEC_44.length + 1,
      original.indexOf(SEC_45),
    );

    // ═══ FORWARD SWAP: move 4.3 body ↔ 4.4 body ══════════════════
    // We use headingEnd(h) to get the offset right after h's trailing \n.
    // We use indexOf(nextH) to get the offset of the next heading.
    // The range [headingEnd(h), indexOf(nextH)) is the body including
    // all separating blank lines.

    // ── Step 1: Cut section 4.3's body ───────────────────────────
    let cutFrom = await headingEnd(page, SEC_43);
    let cutTo = await indexOf(page, SEC_44);
    await selectAndCut(page, cutFrom, cutTo);

    // After cutting, 4.3 heading is immediately followed by 4.4 heading
    let doc = await getDoc(page);
    expect(doc.indexOf(SEC_44) - doc.indexOf(SEC_43)).toBe(SEC_43.length + 1);

    // ── Step 2: Paste 4.3's body before section 4.5 ─────────────
    let pastePos = await indexOf(page, SEC_45);
    await pasteAt(page, pastePos);

    // Verify both bodies visible between 4.4 and 4.5
    doc = await getDoc(page);
    expect(doc.slice(doc.indexOf(SEC_44), doc.indexOf(SEC_45))).toContain('lume/');
    expect(doc.slice(doc.indexOf(SEC_44), doc.indexOf(SEC_45))).toContain('.app-container');

    // ── Step 3: Cut section 4.4's ORIGINAL body ──────────────────
    // 4.4 now contains: [orig 4.4 body][orig 4.3 body]
    // We cut from after 4.4 heading up to where orig 4.3 body begins.
    // We find orig 4.3 body by searching for its EXACT text.
    cutFrom = await headingEnd(page, SEC_44);
    // origBody43 is exact. Find it in the document.
    cutTo = await indexOf(page, origBody43);
    await selectAndCut(page, cutFrom, cutTo);

    // ── Step 4: Paste 4.4's original body after 4.3 heading ─────
    pastePos = await headingEnd(page, SEC_43);
    await pasteAt(page, pastePos);

    // ═══ VERIFY: Sections are swapped ═════════════════════════════
    doc = await getDoc(page);
    const swp43 = doc.indexOf(SEC_43);
    const swp44 = doc.indexOf(SEC_44);
    const swp45 = doc.indexOf(SEC_45);
    expect(swp43).toBeLessThan(swp44);
    expect(swp44).toBeLessThan(swp45);
    // 4.3 now has CSS naming content (was 4.4's)
    expect(doc.slice(swp43, swp44)).toContain('.app-container');
    expect(doc.slice(swp43, swp44)).not.toContain('lume/');
    // 4.4 now has directory tree content (was 4.3's)
    expect(doc.slice(swp44, swp45)).toContain('lume/');
    expect(doc.slice(swp44, swp45)).not.toContain('.app-container');

    // ═══ REVERSE SWAP: restore original order ═════════════════════
    // Repeat the same logic in reverse.

    // ── Step 5: Cut 4.3's body (currently CSS naming = orig 4.4) ─
    cutFrom = await headingEnd(page, SEC_43);
    cutTo = await indexOf(page, SEC_44);
    await selectAndCut(page, cutFrom, cutTo);

    // ── Step 6: Paste it before 4.5 ──────────────────────────────
    pastePos = await indexOf(page, SEC_45);
    await pasteAt(page, pastePos);

    // ── Step 7: Cut 4.4's current body (directory tree = orig 4.3)
    // 4.4 now has: [orig 4.3 body][orig 4.4 body just pasted]
    // Cut from after 4.4 heading up to the start of orig 4.4 body.
    cutFrom = await headingEnd(page, SEC_44);
    cutTo = await indexOf(page, origBody44);
    await selectAndCut(page, cutFrom, cutTo);

    // ── Step 8: Paste it after 4.3 heading ───────────────────────
    pastePos = await headingEnd(page, SEC_43);
    await pasteAt(page, pastePos);

    // ═══ FINAL: Document must match the original ══════════════════
    const restored = await getDoc(page);
    expect(restored).toBe(original);
  });
});
