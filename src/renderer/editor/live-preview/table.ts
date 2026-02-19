import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

interface TableData {
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}

class TableWidget extends WidgetType {
  constructor(readonly data: TableData) { super(); }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-table-widget';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    for (let i = 0; i < this.data.headers.length; i++) {
      const th = document.createElement('th');
      th.textContent = this.data.headers[i].trim();
      if (this.data.alignments[i]) {
        th.style.textAlign = this.data.alignments[i];
      }
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of this.data.rows) {
      const tr = document.createElement('tr');
      for (let i = 0; i < row.length; i++) {
        const td = document.createElement('td');
        td.textContent = row[i].trim();
        if (this.data.alignments[i]) {
          td.style.textAlign = this.data.alignments[i];
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  eq(other: TableWidget) {
    return JSON.stringify(this.data) === JSON.stringify(other.data);
  }
}

function parseAlignment(cell: string): 'left' | 'center' | 'right' {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

function parsePipeRow(text: string): string[] {
  // Remove leading/trailing pipes and split
  let trimmed = text.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|');
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Table') return;
        if (isCursorInRange(view.state, node.from, node.to)) return;

        const text = view.state.doc.sliceString(node.from, node.to);
        const lines = text.split('\n');
        if (lines.length < 2) return;

        const headers = parsePipeRow(lines[0]);
        const delimCells = parsePipeRow(lines[1]);
        const alignments = delimCells.map(parseAlignment);
        const rows: string[][] = [];

        for (let i = 2; i < lines.length; i++) {
          if (lines[i].trim()) {
            rows.push(parsePipeRow(lines[i]));
          }
        }

        builder.add(node.from, node.to, Decoration.replace({
          widget: new TableWidget({ headers, alignments, rows }),
          block: true,
        }));
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
