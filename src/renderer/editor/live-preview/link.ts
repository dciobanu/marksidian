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
        if (node.name !== 'Link') return;
        if (isCursorInRange(view.state, node.from, node.to)) return;

        // Parse link structure: [text](url)
        const nodeRef = node.node;
        const cursor = nodeRef.cursor();
        let textFrom = -1;
        let textTo = -1;
        let urlFrom = -1;
        let urlTo = -1;
        let linkMarkPositions: { from: number; to: number }[] = [];

        cursor.firstChild();
        do {
          if (cursor.name === 'LinkMark') {
            linkMarkPositions.push({ from: cursor.from, to: cursor.to });
          } else if (cursor.name === 'URL') {
            urlFrom = cursor.from;
            urlTo = cursor.to;
          }
        } while (cursor.nextSibling());

        // Standard link: [text](url)
        // LinkMarks: [ ] ( )
        if (linkMarkPositions.length >= 2) {
          // Hide opening [
          const openBracket = linkMarkPositions[0];
          builder.add(openBracket.from, openBracket.to, Decoration.replace({}));

          // The text between [ and ] gets link styling
          textFrom = openBracket.to;
          textTo = linkMarkPositions[1].from;

          // Style the link text
          const url = urlFrom !== -1 ? view.state.doc.sliceString(urlFrom, urlTo) : '';
          builder.add(textFrom, textTo, Decoration.mark({
            class: 'cm-lp-link',
            attributes: { 'data-url': url },
          }));

          // Hide ]( ... ) - everything from ] to end
          builder.add(linkMarkPositions[1].from, node.to, Decoration.replace({}));
        }
      },
    });
  }

  return builder.finish();
}

export const linkDecoration = ViewPlugin.fromClass(
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

// Click handler for links (Cmd+Click)
export const linkClickHandler = EditorView.domEventHandlers({
  click(event: MouseEvent, view: EditorView) {
    if (!(event.metaKey || event.ctrlKey)) return false;

    const target = event.target as HTMLElement;
    const linkEl = target.closest('.cm-lp-link');
    if (!linkEl) return false;

    const url = linkEl.getAttribute('data-url');
    if (url && window.marksidian) {
      window.marksidian.openExternal(url);
      return true;
    }
    return false;
  },
});
