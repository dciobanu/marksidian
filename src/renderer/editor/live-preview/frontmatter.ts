import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

class FrontmatterWidget extends WidgetType {
  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-frontmatter';
    const toggle = document.createElement('span');
    toggle.className = 'cm-lp-frontmatter-toggle';
    toggle.textContent = '\u25B6 Properties';
    wrapper.appendChild(toggle);
    return wrapper;
  }
  eq() { return true; }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  const tree = syntaxTree(view.state);
  const cursor = tree.cursor();

  if (cursor.firstChild()) {
    do {
      if (cursor.name === 'FrontMatter') {
        if (isCursorInRange(view.state, cursor.from, cursor.to)) break;

        // Use per-line approach: hide each line individually, show widget on first line.
        // This avoids the block-replace cursor issues.
        const startLine = view.state.doc.lineAt(cursor.from);
        const endLine = view.state.doc.lineAt(cursor.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          if (lineNum === startLine.number) {
            // First line: replace with the widget
            builder.add(line.from, line.to, Decoration.replace({
              widget: new FrontmatterWidget(),
            }));
          } else {
            // Remaining lines: hide
            builder.add(line.from, line.to, Decoration.replace({}));
          }
        }
        break;
      }
      // Frontmatter must be the first element
      break;
    } while (cursor.nextSibling());
  }

  return builder.finish();
}

export const frontmatterDecoration = ViewPlugin.fromClass(
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
