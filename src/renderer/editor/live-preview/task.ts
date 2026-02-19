import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) { super(); }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'cm-lp-checkbox';
    input.checked = this.checked;
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const newChar = this.checked ? ' ' : 'x';
      // The TaskMarker is [ ] or [x], we need to replace the character inside brackets
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: newChar },
      });
    });
    return input;
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.pos === other.pos;
  }

  ignoreEvent() { return false; }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'TaskMarker') return;

        const line = view.state.doc.lineAt(node.from);
        if (isCursorInRange(view.state, line.from, line.to)) return;

        const text = view.state.doc.sliceString(node.from, node.to);
        const checked = text.includes('x') || text.includes('X');

        builder.add(node.from, node.to, Decoration.replace({
          widget: new CheckboxWidget(checked, node.from),
        }));
      },
    });
  }

  return builder.finish();
}

export const taskDecoration = ViewPlugin.fromClass(
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
