import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  // Collect all decorations first, then sort by position.
  // Tree iteration is depth-first, so nested emphasis (e.g. *foo **bar***) can
  // produce out-of-order ranges that RangeSetBuilder would reject.
  const decos: { from: number; to: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name === 'StrongEmphasis') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          const text = view.state.doc.sliceString(node.from, node.to);
          const markerLen = text.startsWith('__') ? 2 : 2; // ** or __

          decos.push({ from: node.from, to: node.from + markerLen, deco: Decoration.replace({}) });
          decos.push({ from: node.from + markerLen, to: node.to - markerLen, deco: Decoration.mark({ class: 'cm-lp-strong' }) });
          decos.push({ from: node.to - markerLen, to: node.to, deco: Decoration.replace({}) });
        } else if (node.name === 'Emphasis') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          decos.push({ from: node.from, to: node.from + 1, deco: Decoration.replace({}) });
          decos.push({ from: node.from + 1, to: node.to - 1, deco: Decoration.mark({ class: 'cm-lp-em' }) });
          decos.push({ from: node.to - 1, to: node.to, deco: Decoration.replace({}) });
        } else if (node.name === 'Strikethrough') {
          if (isCursorInRange(view.state, node.from, node.to)) return;

          decos.push({ from: node.from, to: node.from + 2, deco: Decoration.replace({}) });
          decos.push({ from: node.from + 2, to: node.to - 2, deco: Decoration.mark({ class: 'cm-lp-strikethrough' }) });
          decos.push({ from: node.to - 2, to: node.to, deco: Decoration.replace({}) });
        }
      },
    });
  }

  // Sort by position (RangeSetBuilder requires non-decreasing order)
  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const { from: f, to: t, deco } of decos) {
    builder.add(f, t, deco);
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
      if (update.docChanged || update.selectionSet || update.viewportChanged ||
          syntaxTree(update.startState) != syntaxTree(update.state)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
