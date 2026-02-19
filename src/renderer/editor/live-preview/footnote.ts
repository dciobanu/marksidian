import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { isCursorInRange } from './utils';

class FootnoteRefWidget extends WidgetType {
  constructor(readonly label: string) { super(); }
  toDOM(): HTMLElement {
    const sup = document.createElement('sup');
    const a = document.createElement('a');
    a.className = 'cm-lp-footnote-ref';
    a.textContent = this.label;
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      // Scroll to footnote definition
      const target = document.querySelector(`[data-footnote-def="${this.label}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
    sup.appendChild(a);
    return sup;
  }
  eq(other: FootnoteRefWidget) { return this.label === other.label; }
}

// Regex patterns for footnote references and definitions
const footnoteRefRegex = /\[\^([^\]]+)\](?!:)/g;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    footnoteRefRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = footnoteRefRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;

      if (isCursorInRange(view.state, start, end)) continue;

      builder.add(start, end, Decoration.replace({
        widget: new FootnoteRefWidget(match[1]),
      }));
    }
  }

  return builder.finish();
}

export const footnoteDecoration = ViewPlugin.fromClass(
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
