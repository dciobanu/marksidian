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
        if (node.name === 'StrongEmphasis') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          // Find EmphasisMark children to determine marker length
          const text = view.state.doc.sliceString(node.from, node.to);
          const markerLen = text.startsWith('__') ? 2 : 2; // ** or __

          builder.add(node.from, node.from + markerLen, Decoration.replace({}));
          builder.add(node.from + markerLen, node.to - markerLen, Decoration.mark({ class: 'cm-lp-strong' }));
          builder.add(node.to - markerLen, node.to, Decoration.replace({}));
        } else if (node.name === 'Emphasis') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          builder.add(node.from, node.from + 1, Decoration.replace({}));
          builder.add(node.from + 1, node.to - 1, Decoration.mark({ class: 'cm-lp-em' }));
          builder.add(node.to - 1, node.to, Decoration.replace({}));
        } else if (node.name === 'Strikethrough') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          builder.add(node.from, node.from + 2, Decoration.replace({}));
          builder.add(node.from + 2, node.to - 2, Decoration.mark({ class: 'cm-lp-strikethrough' }));
          builder.add(node.to - 2, node.to, Decoration.replace({}));
        }
      },
    });
  }

  return builder.finish();
}

export const emphasisDecoration = ViewPlugin.fromClass(
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
