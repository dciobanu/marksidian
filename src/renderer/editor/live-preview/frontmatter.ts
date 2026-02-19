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

  // Frontmatter must be at the very start of the document
  const tree = syntaxTree(view.state);
  const cursor = tree.cursor();

  // Walk top-level looking for FrontMatter
  cursor.firstChild();
  do {
    if (cursor.name === 'FrontMatter') {
      if (isCursorInRange(view.state, cursor.from, cursor.to)) break;

      builder.add(cursor.from, cursor.to, Decoration.replace({
        widget: new FrontmatterWidget(),
        block: true,
      }));
      break;
    }
    // Frontmatter must be the first element
    break;
  } while (cursor.nextSibling());

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
