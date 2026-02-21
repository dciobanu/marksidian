import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, StateEffect, StateField, Extension } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

// ── State management for expand/collapse ──────────────────────

const toggleFrontmatter = StateEffect.define<boolean>();

const frontmatterExpanded = StateField.define<boolean>({
  create() { return false; },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleFrontmatter)) return effect.value;
    }
    // Reset to collapsed when the document changes (e.g., new file opened)
    if (tr.docChanged) return false;
    return value;
  },
});

// ── Widget ────────────────────────────────────────────────────

class FrontmatterWidget extends WidgetType {
  constructor(
    readonly expanded: boolean,
    readonly yamlContent: string,
  ) { super(); }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-frontmatter';

    const toggle = document.createElement('span');
    toggle.className = 'cm-lp-frontmatter-toggle';
    toggle.textContent = this.expanded ? '\u25BC Properties' : '\u25B6 Properties';

    toggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        effects: toggleFrontmatter.of(!this.expanded),
      });
    });

    wrapper.appendChild(toggle);

    if (this.expanded) {
      const propsContainer = document.createElement('div');
      propsContainer.className = 'cm-lp-frontmatter-properties';

      const lines = this.yamlContent.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        const row = document.createElement('div');
        row.className = 'cm-lp-frontmatter-property';

        const keySpan = document.createElement('span');
        keySpan.className = 'cm-lp-frontmatter-key';
        keySpan.textContent = key;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'cm-lp-frontmatter-value';
        valueSpan.textContent = value;

        row.appendChild(keySpan);
        row.appendChild(valueSpan);
        propsContainer.appendChild(row);
      }

      wrapper.appendChild(propsContainer);
    }

    return wrapper;
  }

  eq(other: FrontmatterWidget): boolean {
    return this.expanded === other.expanded && this.yamlContent === other.yamlContent;
  }

  ignoreEvent(): boolean { return false; }
}

// ── Decoration builder ────────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const expanded = view.state.field(frontmatterExpanded);

  const tree = syntaxTree(view.state);
  const cursor = tree.cursor();

  if (cursor.firstChild()) {
    do {
      if (cursor.name === 'FrontMatter') {
        if (isCursorInRange(view.state, cursor.from, cursor.to)) break;

        const startLine = view.state.doc.lineAt(cursor.from);
        const endLine = view.state.doc.lineAt(cursor.to);

        // Extract YAML content (everything between --- delimiters)
        let yamlContent = '';
        for (let lineNum = startLine.number + 1; lineNum < endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          yamlContent += (yamlContent ? '\n' : '') + line.text;
        }

        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
          const line = view.state.doc.line(lineNum);
          if (lineNum === startLine.number) {
            // First line: replace with the widget
            builder.add(line.from, line.to, Decoration.replace({
              widget: new FrontmatterWidget(expanded, yamlContent),
            }));
          } else {
            // Remaining lines: hide with line class + replace content
            builder.add(line.from, line.from, Decoration.line({ class: 'cm-lp-frontmatter-hidden-line' }));
            if (line.length > 0) {
              builder.add(line.from, line.to, Decoration.replace({}));
            }
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

// ── Export as Extension[] (StateField + ViewPlugin) ───────────

export const frontmatterDecoration: Extension = [
  frontmatterExpanded,
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged ||
            syntaxTree(update.startState) != syntaxTree(update.state) ||
            update.transactions.some(tr => tr.effects.some(e => e.is(toggleFrontmatter)))) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  ),
];
