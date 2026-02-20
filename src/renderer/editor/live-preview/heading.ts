import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorOnLine } from './utils';

const headingNodeNames = new Set([
  'ATXHeading1', 'ATXHeading2', 'ATXHeading3',
  'ATXHeading4', 'ATXHeading5', 'ATXHeading6',
]);

function getHeadingLevel(name: string): number {
  return parseInt(name.charAt(name.length - 1), 10);
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (!headingNodeNames.has(node.name)) return;

        const level = getHeadingLevel(node.name);
        const lineClass = `HyperMD-header-${level}`;

        // Always apply line class for consistent styling
        const line = view.state.doc.lineAt(node.from);
        builder.add(line.from, line.from, Decoration.line({ class: lineClass }));

        // If cursor is on this line, show raw markdown
        if (isCursorOnLine(view.state, node.from, node.to)) return;

        // Hide the header marks (# characters and trailing space)
        const nodeRef = node.node;
        const cursor = nodeRef.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === 'HeaderMark') {
              const markEnd = cursor.to;
              const nextChar = view.state.doc.sliceString(markEnd, markEnd + 1);
              const end = nextChar === ' ' ? markEnd + 1 : markEnd;
              builder.add(cursor.from, end, Decoration.replace({}));
            }
          } while (cursor.nextSibling());
        }
      },
    });
  }

  return builder.finish();
}

export const headingDecoration = ViewPlugin.fromClass(
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
