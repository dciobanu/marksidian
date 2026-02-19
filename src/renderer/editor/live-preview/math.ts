import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { isCursorInRange } from './utils';

// MathJax lazy loading and caching
let mathjaxReady = false;
let mathjaxLoading = false;
const mathCache = new Map<string, HTMLElement>();

async function ensureMathJax(): Promise<void> {
  if (mathjaxReady) return;
  if (mathjaxLoading) {
    // Wait for loading to complete
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (mathjaxReady) { clearInterval(check); resolve(); }
      }, 50);
    });
    return;
  }
  mathjaxLoading = true;

  // MathJax is bundled; configure it
  if (!(window as any).MathJax) {
    (window as any).MathJax = {
      tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
      svg: { fontCache: 'global' },
      startup: { typeset: false },
    };
  }

  try {
    // MathJax should be available if bundled
    const MJ = (window as any).MathJax;
    if (MJ && MJ.startup && MJ.startup.promise) {
      await MJ.startup.promise;
    }
    mathjaxReady = true;
  } catch {
    // MathJax not available — render as text
    mathjaxReady = false;
  }
  mathjaxLoading = false;
}

function renderMath(latex: string, display: boolean): HTMLElement {
  const cacheKey = `${display ? 'D' : 'I'}:${latex}`;
  const cached = mathCache.get(cacheKey);
  if (cached) return cached.cloneNode(true) as HTMLElement;

  const MJ = (window as any).MathJax;
  if (!MJ || !MJ.tex2svg) {
    const span = document.createElement('span');
    span.className = 'cm-lp-math-error';
    span.textContent = latex;
    return span;
  }

  try {
    const node = MJ.tex2svg(latex, { display });
    const svg = node.querySelector('svg');
    if (svg) {
      mathCache.set(cacheKey, svg.cloneNode(true) as HTMLElement);
      return svg;
    }
    const span = document.createElement('span');
    span.textContent = latex;
    return span;
  } catch (e: any) {
    const span = document.createElement('span');
    span.className = 'cm-lp-math-error';
    span.textContent = e.message || 'Math error';
    return span;
  }
}

class InlineMathWidget extends WidgetType {
  constructor(readonly latex: string) { super(); }
  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-lp-math-widget';
    if (mathjaxReady) {
      wrapper.appendChild(renderMath(this.latex, false));
    } else {
      wrapper.textContent = this.latex;
      ensureMathJax().then(() => {
        wrapper.innerHTML = '';
        wrapper.appendChild(renderMath(this.latex, false));
      });
    }
    return wrapper;
  }
  eq(other: InlineMathWidget) { return this.latex === other.latex; }
}

class BlockMathWidget extends WidgetType {
  constructor(readonly latex: string) { super(); }
  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-math-block-widget';
    if (mathjaxReady) {
      wrapper.appendChild(renderMath(this.latex, true));
    } else {
      wrapper.textContent = this.latex;
      ensureMathJax().then(() => {
        wrapper.innerHTML = '';
        wrapper.appendChild(renderMath(this.latex, true));
      });
    }
    return wrapper;
  }
  eq(other: BlockMathWidget) { return this.latex === other.latex; }
}

// Regex-based parsing since @lezer/markdown doesn't have math support
const inlineMathRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Block math first (so inline doesn't match inside blocks)
    const blockRanges: [number, number][] = [];
    blockMathRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockMathRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      blockRanges.push([start, end]);

      if (isCursorInRange(view.state, start, end)) continue;

      const latex = match[1].trim();
      builder.add(start, end, Decoration.replace({
        widget: new BlockMathWidget(latex),
      }));
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
      builder.add(start, end, Decoration.replace({
        widget: new InlineMathWidget(latex),
      }));
    }
  }

  return builder.finish();
}

export const mathDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      ensureMathJax().then(() => {
        this.decorations = buildDecorations(view);
        view.requestMeasure();
      });
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
