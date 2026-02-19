import type { EditorMode } from '../../shared/types';

const modeLabels: Record<EditorMode, string> = {
  live: 'Live',
  source: 'Source',
  reading: 'Reading',
};

export function updateStatusBar(data: {
  line: number;
  col: number;
  wordCount: number;
  mode: EditorMode;
}): void {
  const posEl = document.getElementById('status-position');
  const wordsEl = document.getElementById('status-words');
  const modeEl = document.getElementById('status-mode');

  if (posEl) posEl.textContent = `Ln ${data.line}, Col ${data.col}`;
  if (wordsEl) wordsEl.textContent = `${data.wordCount} words`;
  if (modeEl) modeEl.textContent = modeLabels[data.mode] || data.mode;
}
