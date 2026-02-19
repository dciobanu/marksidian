import { EditorState } from '@codemirror/state';

/**
 * Checks if any of the editor's cursor(s) overlap with the given range.
 * Returns true if ANY selection cursor intersects [from, to].
 * When true, decorations should be skipped (show raw markdown).
 */
export function isCursorInRange(state: EditorState, from: number, to: number): boolean {
  for (const range of state.selection.ranges) {
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}

/**
 * Check if a line contains the cursor.
 */
export function isCursorOnLine(state: EditorState, lineFrom: number, lineTo: number): boolean {
  return isCursorInRange(state, lineFrom, lineTo);
}
