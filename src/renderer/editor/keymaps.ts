import { keymap, KeyBinding } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(from, to);

  // Check if already wrapped — toggle off
  if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
    view.dispatch({
      changes: { from, to, insert: selectedText.slice(prefix.length, -suffix.length) },
      selection: EditorSelection.cursor(from + selectedText.length - prefix.length - suffix.length),
    });
    return true;
  }

  // Check if context around selection has the markers
  const beforeStart = Math.max(0, from - prefix.length);
  const afterEnd = Math.min(view.state.doc.length, to + suffix.length);
  const before = view.state.doc.sliceString(beforeStart, from);
  const after = view.state.doc.sliceString(to, afterEnd);

  if (before === prefix && after === suffix) {
    view.dispatch({
      changes: [
        { from: beforeStart, to: from, insert: '' },
        { from: to, to: afterEnd, insert: '' },
      ],
      selection: EditorSelection.range(beforeStart, to - prefix.length),
    });
    return true;
  }

  // Wrap
  view.dispatch({
    changes: { from, to, insert: prefix + selectedText + suffix },
    selection: selectedText.length > 0
      ? EditorSelection.range(from + prefix.length, from + prefix.length + selectedText.length)
      : EditorSelection.cursor(from + prefix.length),
  });
  return true;
}

function toggleHeading(view: EditorView, delta: number): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.from);
  const text = line.text;
  const headingMatch = text.match(/^(#{1,6})\s/);
  const currentLevel = headingMatch ? headingMatch[1].length : 0;

  let newLevel: number;
  if (delta > 0) {
    newLevel = Math.min(currentLevel + 1, 6);
  } else {
    newLevel = Math.max(currentLevel - 1, 0);
  }

  const prefix = newLevel > 0 ? '#'.repeat(newLevel) + ' ' : '';
  const contentStart = headingMatch ? headingMatch[0].length : 0;
  const content = text.slice(contentStart);

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: prefix + content },
  });
  return true;
}

function toggleCheckbox(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.from);
  const text = line.text;

  const uncheckedMatch = text.match(/^(\s*- )\[ \](.*)/);
  if (uncheckedMatch) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: uncheckedMatch[1] + '[x]' + uncheckedMatch[2] },
    });
    return true;
  }

  const checkedMatch = text.match(/^(\s*- )\[x\](.*)/i);
  if (checkedMatch) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: checkedMatch[1] + '[ ]' + checkedMatch[2] },
    });
    return true;
  }

  return false;
}

const customKeybindings: KeyBinding[] = [
  {
    key: 'Mod-b',
    run: (view) => wrapSelection(view, '**', '**'),
  },
  {
    key: 'Mod-i',
    run: (view) => wrapSelection(view, '*', '*'),
  },
  {
    key: 'Mod-Shift-x',
    run: (view) => wrapSelection(view, '~~', '~~'),
  },
  {
    key: 'Mod-Shift-c',
    run: (view) => wrapSelection(view, '`', '`'),
  },
  {
    key: 'Mod-k',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      const insert = `[${selected}](url)`;
      view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.range(from + selected.length + 3, from + selected.length + 6),
      });
      return true;
    },
  },
  {
    key: 'Mod-Shift-=',
    run: (view) => toggleHeading(view, 1),
  },
  {
    key: 'Mod-Shift--',
    run: (view) => toggleHeading(view, -1),
  },
  {
    key: 'Mod-Enter',
    run: (view) => toggleCheckbox(view),
  },
];

export function customKeymap() {
  return keymap.of(customKeybindings);
}
