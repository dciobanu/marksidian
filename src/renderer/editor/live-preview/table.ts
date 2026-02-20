import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

// ── Types ────────────────────────────────────────────────────────

type Alignment = 'left' | 'center' | 'right';

interface ParsedTable {
  headers: string[];
  alignments: Alignment[];
  rows: string[][];
  /** Number of raw lines consumed (header + delimiter + data rows) */
  lineCount: number;
}

// ── Parsing ──────────────────────────────────────────────────────

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

function parseAlignments(text: string): Alignment[] {
  return parsePipeRow(text).map((cell) => {
    const t = cell.trim();
    const left = t.startsWith(':');
    const right = t.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

/**
 * A valid table data row must contain at least one pipe character.
 * This filters out trailing non-table lines that Lezer's GFM parser
 * absorbs into the Table node when there's no blank line separator.
 */
function isTableRow(text: string): boolean {
  return text.indexOf('|') !== -1;
}

function parseTableMarkdown(text: string): ParsedTable | null {
  const allLines = text.split('\n');
  // Keep only non-empty lines, but stop at the first non-table line
  // after the delimiter row (line index 1)
  const lines: string[] = [];
  for (const l of allLines) {
    if (l.trim().length === 0) continue;
    // Header and delimiter always included
    if (lines.length < 2) {
      lines.push(l);
      continue;
    }
    // Data rows must look like table rows (contain pipes)
    if (isTableRow(l)) {
      lines.push(l);
    } else {
      break; // Stop at first non-table line
    }
  }

  if (lines.length < 2) return null;
  if (!isDelimiterRow(lines[1])) return null;

  const headers = parsePipeRow(lines[0]).map((c) => c.trim());
  const alignments = parseAlignments(lines[1]);
  const rows: string[][] = [];

  for (let i = 2; i < lines.length; i++) {
    rows.push(parsePipeRow(lines[i]).map((c) => c.trim()));
  }

  return { headers, alignments, rows, lineCount: lines.length };
}

// ── Widget ───────────────────────────────────────────────────────

class TableWidget extends WidgetType {
  constructor(
    readonly data: ParsedTable,
    readonly rawText: string,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-table-widget';

    const table = document.createElement('table');
    table.className = 'cm-lp-table';

    // <thead>
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let i = 0; i < this.data.headers.length; i++) {
      const th = document.createElement('th');
      th.textContent = this.data.headers[i];
      if (i < this.data.alignments.length) {
        th.style.textAlign = this.data.alignments[i];
      }
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // <tbody>
    const tbody = document.createElement('tbody');
    for (const row of this.data.rows) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.data.headers.length; c++) {
        const td = document.createElement('td');
        td.textContent = c < row.length ? row[c] : '';
        if (c < this.data.alignments.length) {
          td.style.textAlign = this.data.alignments[c];
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    wrapper.appendChild(table);
    return wrapper;
  }

  eq(other: TableWidget): boolean {
    return this.rawText === other.rawText;
  }
}

// ── Decorations ──────────────────────────────────────────────────

/**
 * Table decoration that renders a full HTML <table> widget (Typora-style).
 *
 * Uses the "frontmatter pattern" for multi-line replacement:
 *  - First line → Decoration.replace({ widget: TableWidget })
 *  - Remaining lines → Decoration.replace({}) to hide them
 *
 * When the cursor is inside the table, all decorations are skipped
 * and the raw markdown is shown for editing.
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

        const tableText = view.state.doc.sliceString(node.from, node.to);
        const parsed = parseTableMarkdown(tableText);
        if (!parsed) return;

        const startLine = view.state.doc.lineAt(node.from);
        const nodeEndLine = view.state.doc.lineAt(node.to);

        // Only decorate the actual table lines, not trailing non-table
        // lines that Lezer's GFM parser may have absorbed into the node.
        // We count non-empty lines to match parsed.lineCount.
        let nonEmptyCount = 0;
        let actualEndLineNum = startLine.number;
        for (let lineNum = startLine.number; lineNum <= nodeEndLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          if (line.text.trim().length > 0) {
            nonEmptyCount++;
          }
          actualEndLineNum = lineNum;
          if (nonEmptyCount >= parsed.lineCount) break;
        }

        // Build the raw text for only the actual table lines (for eq comparison)
        const actualTableEnd = view.state.doc.line(actualEndLineNum).to;
        const actualRawText = view.state.doc.sliceString(node.from, actualTableEnd);

        for (let lineNum = startLine.number; lineNum <= actualEndLineNum; lineNum++) {
          const line = view.state.doc.line(lineNum);

          if (lineNum === startLine.number) {
            builder.add(
              line.from,
              line.to,
              Decoration.replace({
                widget: new TableWidget(parsed, actualRawText),
              }),
            );
          } else {
            // Line decoration to collapse the empty .cm-line to zero height,
            // then replace decoration to hide the text content.
            builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-table-hidden-line' }));
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
  { decorations: (v) => v.decorations },
);
