import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

class CodeLangWidget extends WidgetType {
  constructor(readonly lang: string) { super(); }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-lp-code-lang';
    span.textContent = this.lang;
    return span;
  }
  eq(other: CodeLangWidget) { return this.lang === other.lang; }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'FencedCode') return;

        const cursorInside = isCursorInRange(view.state, node.from, node.to);

        // Apply code block background to all lines in the block
        const startLine = view.state.doc.lineAt(node.from);
        const endLine = view.state.doc.lineAt(node.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-code-block' }));
        }

        if (cursorInside) return;

        // Find CodeInfo (language) and CodeMark (fences)
        let lang = '';
        const nodeRef = node.node;
        const cursor = nodeRef.cursor();
        let firstFenceFrom = -1;
        let lastFenceFrom = -1;

        if (cursor.firstChild()) {
          do {
            if (cursor.name === 'CodeMark') {
              if (firstFenceFrom === -1) {
                firstFenceFrom = cursor.from;
              } else {
                lastFenceFrom = cursor.from;
              }
            } else if (cursor.name === 'CodeInfo') {
              lang = view.state.doc.sliceString(cursor.from, cursor.to).trim();
            }
          } while (cursor.nextSibling());
        }

        // Hide opening fence line
        if (firstFenceFrom !== -1) {
          const fenceLine = view.state.doc.lineAt(firstFenceFrom);
          builder.add(fenceLine.from, fenceLine.to, Decoration.replace({
            widget: lang ? new CodeLangWidget(lang) : undefined,
          }));
        }

        // Hide closing fence line
        if (lastFenceFrom !== -1) {
          const fenceLine = view.state.doc.lineAt(lastFenceFrom);
          builder.add(fenceLine.from, fenceLine.to, Decoration.replace({}));
        }
      },
    });
  }

  return builder.finish();
}

export const codeBlockDecoration = ViewPlugin.fromClass(
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
