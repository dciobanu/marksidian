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
        if (node.name !== 'Blockquote') return;

        // Apply blockquote styling to all lines in the blockquote
        const startLine = view.state.doc.lineAt(node.from);
        const endLine = view.state.doc.lineAt(node.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-blockquote' }));
        }

        // If cursor is inside, don't hide the > marks
        if (isCursorInRange(view.state, node.from, node.to)) return;

        // Hide QuoteMark children
        const nodeRef = node.node;
        const cursor = nodeRef.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === 'QuoteMark') {
              const markEnd = cursor.to;
              const afterMark = view.state.doc.sliceString(markEnd, markEnd + 1);
              const end = afterMark === ' ' ? markEnd + 1 : markEnd;
              builder.add(cursor.from, end, Decoration.replace({}));
            }
          } while (cursor.nextSibling());
        }
      },
    });
  }

  return builder.finish();
}

export const blockquoteDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged ||
          syntaxTree(update.startState) != syntaxTree(update.state)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
