import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from './utils';

let currentFileDir = '';

export function setFileDir(dir: string) {
  currentFileDir = dir;
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly width?: number,
  ) { super(); }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-lp-image-widget';

    const img = document.createElement('img');

    // Resolve the source URL
    let resolvedSrc = this.src;
    if (resolvedSrc.startsWith('http://') || resolvedSrc.startsWith('https://')) {
      // External URL — use directly
    } else {
      // Local path — resolve relative to file dir and use custom protocol
      if (currentFileDir && !resolvedSrc.startsWith('/')) {
        resolvedSrc = currentFileDir + '/' + resolvedSrc;
      }
      resolvedSrc = 'lume-asset://' + resolvedSrc;
    }

    img.src = resolvedSrc;
    img.alt = this.alt;
    if (this.width) img.style.width = this.width + 'px';

    img.onerror = () => {
      wrapper.innerHTML = '';
      const errorEl = document.createElement('span');
      errorEl.className = 'cm-lp-image-error';
      errorEl.textContent = this.alt ? `Image not found: ${this.alt}` : 'Image not found';
      wrapper.appendChild(errorEl);
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt && this.width === other.width;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Image') return;
        if (isCursorInRange(view.state, node.from, node.to)) return;

        const nodeRef = node.node;
        const cursor = nodeRef.cursor();
        let alt = '';
        let url = '';

        cursor.firstChild();
        do {
          if (cursor.name === 'URL') {
            url = view.state.doc.sliceString(cursor.from, cursor.to);
          }
        } while (cursor.nextSibling());

        // Extract alt text from ![alt](url) pattern
        const fullText = view.state.doc.sliceString(node.from, node.to);
        const altMatch = fullText.match(/^!\[([^\]]*)\]/);
        if (altMatch) alt = altMatch[1];

        // Check for Obsidian-style width: |300
        let width: number | undefined;
        const widthMatch = url.match(/\|(\d+)$/);
        if (widthMatch) {
          width = parseInt(widthMatch[1], 10);
          url = url.replace(/\|\d+$/, '');
        }

        if (url) {
          builder.add(node.from, node.to, Decoration.replace({
            widget: new ImageWidget(url, alt, width),
          }));
        }
      },
    });
  }

  return builder.finish();
}

export const imageDecoration = ViewPlugin.fromClass(
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
