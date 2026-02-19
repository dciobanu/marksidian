import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'InlineCode') return;
        if (isCursorInRange(view.state, node.from, node.to)) return;

        // Determine backtick length (could be `` for escaped)
        const text = view.state.doc.sliceString(node.from, node.to);
        let tickLen = 0;
        while (tickLen < text.length && text[tickLen] === '`') tickLen++;

        if (tickLen === 0 || node.to - node.from <= tickLen * 2) return;

        builder.add(node.from, node.from + tickLen, Decoration.replace({}));
        builder.add(node.from + tickLen, node.to - tickLen, Decoration.mark({ class: 'cm-lp-inline-code' }));
        builder.add(node.to - tickLen, node.to, Decoration.replace({}));
      },
    });
  }

  return builder.finish();
}

export const codeInlineDecoration = ViewPlugin.fromClass(
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
