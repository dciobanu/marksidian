import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { isCursorInRange } from './utils';
import katex from 'katex';

// Render cache to avoid re-rendering identical expressions
const mathCache = new Map<string, string>();

function renderMathHTML(latex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D' : 'I'}:${latex}`;
  const cached = mathCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,   // Render error message instead of throwing
      errorColor: 'var(--color-red)',
      trust: false,
      strict: false,
    });
    mathCache.set(cacheKey, html);
    return html;
  } catch {
    // Fallback — should not happen with throwOnError: false
    return `<span class="cm-lp-math-error">${latex}</span>`;
  }
}

class InlineMathWidget extends WidgetType {
  constructor(readonly latex: string, readonly from: number) { super(); }
  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-lp-math-widget';
    wrapper.innerHTML = renderMathHTML(this.latex, false);
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return wrapper;
  }
  eq(other: InlineMathWidget) { return this.latex === other.latex; }
  ignoreEvent() { return false; }
}

class BlockMathWidget extends WidgetType {
  constructor(readonly latex: string, readonly from: number) { super(); }
  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-math-block-widget';
    wrapper.innerHTML = renderMathHTML(this.latex, true);
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return wrapper;
  }
  eq(other: BlockMathWidget) { return this.latex === other.latex; }
  ignoreEvent() { return false; }
}

const hiddenLine = Decoration.line({ class: 'cm-lp-math-hidden-line' });

// Regex-based parsing since @lezer/markdown doesn't have math support.
//
// Inline math heuristics (matches Obsidian / markdown-it-dollarmath defaults):
//   - Opening $ must NOT be preceded by another $ or a digit (avoids $$, 100$)
//   - Opening $ must NOT be followed by a space, digit, or $ (avoids $ text, $39, $$)
//   - Closing $ must NOT be preceded by a space or $ (avoids text $, $$)
//   - Closing $ must NOT be followed by a digit or $ (avoids $100, $$)
//   - Content must stay on one line (.+? doesn't match \n by default)
//
// This prevents currency like "$39" or "$19/month" from being treated as math,
// while still matching legitimate math like "$E=mc^2$" or "$x + 1$".
const inlineMathRegex = /(?<!\$|[0-9])\$(?!\$| |[0-9])(.+?)(?<! )(?<!\$)\$(?!\$|[0-9])/g;
const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Block math first — collect ranges (so inline doesn't match inside blocks)
    const blockRanges: [number, number][] = [];
    blockMathRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    // Collect all decorations so we can sort them by position
    // (block math produces per-line decos that must interleave properly with inline)
    const decos: { from: number; to: number; deco: Decoration }[] = [];

    while ((match = blockMathRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      blockRanges.push([start, end]);

      if (isCursorInRange(view.state, start, end)) continue;

      const latex = match[1].trim();
      const startLine = view.state.doc.lineAt(start);
      const endLine = view.state.doc.lineAt(end);

      // Per-line decorations (CM6 plugins can't replace across line breaks)
      for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
        const line = view.state.doc.line(lineNum);

        if (lineNum === startLine.number) {
          // First line: replace content with widget
          decos.push({
            from: line.from,
            to: line.to,
            deco: Decoration.replace({ widget: new BlockMathWidget(latex, start) }),
          });
        } else {
          // Subsequent lines: hide with line class + replace content
          decos.push({
            from: line.from,
            to: line.from,
            deco: hiddenLine,
          });
          if (line.length > 0) {
            decos.push({
              from: line.from,
              to: line.to,
              deco: Decoration.replace({}),
            });
          }
        }
      }
    }

    // Inline math
    inlineMathRegex.lastIndex = 0;
    while ((match = inlineMathRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;

      // Skip if inside a block math range
      if (blockRanges.some(([bs, be]) => start >= bs && end <= be)) continue;

      if (isCursorInRange(view.state, start, end)) continue;

      const latex = match[1];
      decos.push({
        from: start,
        to: end,
        deco: Decoration.replace({ widget: new InlineMathWidget(latex, start) }),
      });
    }

    // Sort by position and add to builder (RangeSetBuilder requires non-decreasing order)
    decos.sort((a, b) => a.from - b.from || a.to - b.to);
    for (const { from: f, to: t, deco } of decos) {
      builder.add(f, t, deco);
    }
  }

  return builder.finish();
}

export const mathDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
