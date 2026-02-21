import { EditorView } from '@codemirror/view';
import { EditorState, Text } from '@codemirror/state';
import { allExtensions, modeCompartment, sourceExtensions } from './extensions';
import { livePreviewExtensions } from './live-preview/decorations';
import type { EditorMode } from '../../shared/types';

let editorView: EditorView | null = null;
let savedDoc: Text = Text.empty;
let currentMode: EditorMode = 'live';
let onUpdate: ((view: EditorView) => void) | null = null;

export function createEditor(parent: HTMLElement, initialDoc?: string): EditorView {
  const doc = initialDoc || '';

  const state = EditorState.create({
    doc,
    extensions: [
      ...allExtensions(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          if (onUpdate) onUpdate(update.view);
        }
      }),
    ],
  });

  editorView = new EditorView({
    state,
    parent,
  });

  savedDoc = editorView.state.doc;
  return editorView;
}

export function getEditorView(): EditorView | null {
  return editorView;
}

export function setEditorContent(content: string): void {
  if (!editorView) return;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content },
  });
  savedDoc = editorView.state.doc;
}

export function getEditorContent(): string {
  if (!editorView) return '';
  return editorView.state.doc.toString();
}

export function isDirty(): boolean {
  if (!editorView) return false;
  return !editorView.state.doc.eq(savedDoc);
}

export function markSaved(): void {
  if (!editorView) return;
  savedDoc = editorView.state.doc;
}

export function setMode(mode: EditorMode): void {
  if (!editorView || mode === currentMode) return;

  currentMode = mode;

  if (mode === 'source') {
    editorView.dispatch({
      effects: modeCompartment.reconfigure(sourceExtensions()),
    });
  } else if (mode === 'live') {
    editorView.dispatch({
      effects: modeCompartment.reconfigure(livePreviewExtensions()),
    });
  }
  // 'reading' mode is handled by the renderer (hides CM6, shows reading view)
}

export function getMode(): EditorMode {
  return currentMode;
}

export function setUpdateListener(listener: (view: EditorView) => void): void {
  onUpdate = listener;
}

export function getCursorPosition(): { line: number; col: number } {
  if (!editorView) return { line: 1, col: 1 };
  const pos = editorView.state.selection.main.head;
  const line = editorView.state.doc.lineAt(pos);
  return {
    line: line.number,
    col: pos - line.from + 1,
  };
}

export function getWordCount(): number {
  if (!editorView) return 0;
  const text = editorView.state.doc.toString();
  const words = text.match(/\S+/g);
  return words ? words.length : 0;
}

// ── Session persistence helpers ────────────────────────────────

export function getCursorOffset(): number {
  if (!editorView) return 0;
  return editorView.state.selection.main.head;
}

export function getScrollTop(): number {
  if (!editorView) return 0;
  return editorView.scrollDOM.scrollTop;
}

export function setCursorOffset(offset: number): void {
  if (!editorView) return;
  const clamped = Math.max(0, Math.min(offset, editorView.state.doc.length));
  editorView.dispatch({
    selection: { anchor: clamped },
    scrollIntoView: true,
  });
}

export function setScrollTop(scrollTop: number): void {
  if (!editorView) return;
  // requestAnimationFrame ensures the DOM has laid out after content change
  requestAnimationFrame(() => {
    if (editorView) {
      editorView.scrollDOM.scrollTop = scrollTop;
    }
  });
}
