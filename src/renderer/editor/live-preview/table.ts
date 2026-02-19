import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

function parsePipeRow(text: string): string[] {
  let trimmed = text.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|');
}

function isDelimiterRow(text: string): boolean {
  const cells = parsePipeRow(text);
  return cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

/**
 * Table decoration using per-line styling instead of a single block replace.
 *
 * A block Decoration.replace() over a multi-line range causes CM6 to treat
 * the entire table as an atomic widget. This breaks cursor placement, Enter
 * key handling, and click positioning — the cursor gets stuck or jumps to
 * wrong regions because CM6 cannot resolve positions inside a replaced range.
 *
 * Instead we apply line-level decorations:
 *  - All table lines get a table styling class
 *  - The header row gets a bold class
 *  - The delimiter row (| -- | -- |) is hidden via a single-line replace
 *  - Pipe characters at line edges are hidden for cleaner appearance
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Table') return;
        if (isCursorInRange(view.state, node.from, node.to)) return;

        const startLine = view.state.doc.lineAt(node.from);
        const endLine = view.state.doc.lineAt(node.to);

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          const lineText = line.text.trim();
          if (!lineText) continue;

          const lineIndex = lineNum - startLine.number;

          // Style every table line
          builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-table-line' }));

          if (lineIndex === 0) {
            // Header row
            builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-table-header' }));
          } else if (lineIndex === 1 && isDelimiterRow(lineText)) {
            // Delimiter row — hide it (single-line replace is safe)
            builder.add(line.from, line.to, Decoration.replace({}));
          }
        }
      },
    });
  }

  return builder.finish();
}

export const tableDecoration = ViewPlugin.fromClass(
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
