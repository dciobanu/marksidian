import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

class BulletWidget extends WidgetType {
  constructor(readonly ordered: boolean, readonly index: number) { super(); }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-lp-bullet';
    span.textContent = this.ordered ? `${this.index}.` : '\u2022';
    return span;
  }
  eq(other: BulletWidget) {
    return this.ordered === other.ordered && this.index === other.index;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let orderedIndex = 0;
    let inOrderedList = false;

    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name === 'OrderedList') {
          inOrderedList = true;
          orderedIndex = 0;
        } else if (node.name === 'BulletList') {
          inOrderedList = false;
        } else if (node.name === 'ListItem' && inOrderedList) {
          orderedIndex++;
        } else if (node.name === 'ListMark') {
          const line = view.state.doc.lineAt(node.from);
          if (isCursorInRange(view.state, line.from, line.to)) return;

          // Replace the list mark with a styled bullet/number
          const markEnd = node.to;
          // Include trailing space
          const afterMark = view.state.doc.sliceString(markEnd, markEnd + 1);
          const end = afterMark === ' ' ? markEnd + 1 : markEnd;

          builder.add(node.from, end, Decoration.replace({
            widget: new BulletWidget(inOrderedList, orderedIndex),
          }));
        }
      },
      leave(node) {
        if (node.name === 'OrderedList' || node.name === 'BulletList') {
          inOrderedList = false;
          orderedIndex = 0;
        }
      },
    });
  }

  return builder.finish();
}

export const listDecoration = ViewPlugin.fromClass(
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
