import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { isCursorInRange } from './utils';

// Since @lezer/markdown doesn't support ==highlight== natively,
// we do a regex-based scan on visible lines
const highlightRegex = /==((?:[^=]|=[^=])+)==/g;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    highlightRegex.lastIndex = 0;

    while ((match = highlightRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;

      if (isCursorInRange(view.state, start, end)) continue;

      builder.add(start, start + 2, Decoration.replace({}));
      builder.add(start + 2, end - 2, Decoration.mark({ class: 'cm-lp-highlight' }));
      builder.add(end - 2, end, Decoration.replace({}));
    }
  }

  return builder.finish();
}

export const highlightDecoration = ViewPlugin.fromClass(
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
