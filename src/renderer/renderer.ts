import {
  createEditor,
  getEditorView,
  setEditorContent,
  getEditorContent,
  isDirty,
  markSaved,
  setMode,
  getMode,
  setUpdateListener,
  getCursorPosition,
  getWordCount,
  getCursorOffset,
  getScrollTop,
  setCursorOffset,
  setScrollTop,
} from './editor/editor';
import { setFileDir } from './editor/live-preview/image';
import { showReadingView } from './editor/reading/reading-view';
import { updateStatusBar } from './ui/status-bar';
import { setupContainer, toggleReadableLineWidth } from './ui/container';
import type { EditorMode } from '../shared/types';

// Initialize
const editorContainer = document.getElementById('editor-container')!;
const readingContainer = document.getElementById('reading-container')!;
const readingContent = document.getElementById('reading-content')!;

// Setup container
setupContainer();

// Apply theme based on system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
document.body.classList.toggle('theme-dark', prefersDark.matches);
document.body.classList.toggle('theme-light', !prefersDark.matches);

prefersDark.addEventListener('change', (e) => {
  document.body.classList.toggle('theme-dark', e.matches);
  document.body.classList.toggle('theme-light', !e.matches);
});

// Create the editor
createEditor(editorContainer);

// Expose editor API for E2E testing (switchToMode added below after definition)
(window as any).__marksidian = {
  getEditorView,
  setEditorContent,
  getEditorContent,
  isDirty,
  markSaved,
  setMode,
  getMode,
  getCursorPosition,
  getWordCount,
  getCursorOffset,
  getScrollTop,
  setCursorOffset,
  setScrollTop,
};

// Track zoom level
let zoomLevel = 0;

function applyZoom(): void {
  const size = 16 + zoomLevel * 2;
  document.documentElement.style.setProperty('--font-text-size', `${size}px`);
}

// Update status bar on editor changes
setUpdateListener(() => {
  const pos = getCursorPosition();
  const words = getWordCount();
  updateStatusBar({
    line: pos.line,
    col: pos.col,
    wordCount: words,
    mode: getMode(),
  });

  // Notify main process of dirty state
  if (window.marksidian) {
    window.marksidian.notifyContentChanged(isDirty());
  }
});

// Initial status bar update
updateStatusBar({
  line: 1,
  col: 1,
  wordCount: 0,
  mode: 'live',
});

// Switch between editor and reading view
function switchToMode(mode: EditorMode): void {
  if (mode === 'reading') {
    editorContainer.style.display = 'none';
    readingContainer.style.display = '';
    showReadingView(readingContent, getEditorContent());
    setMode(mode);
  } else {
    readingContainer.style.display = 'none';
    editorContainer.style.display = '';
    setMode(mode);
  }

  // Update the source view class
  if (mode === 'live') {
    editorContainer.classList.add('is-live-preview');
  } else {
    editorContainer.classList.remove('is-live-preview');
  }

  // Update status bar
  const pos = getCursorPosition();
  updateStatusBar({
    line: pos.line,
    col: pos.col,
    wordCount: getWordCount(),
    mode,
  });
}

// Add switchToMode to test API
(window as any).__marksidian.switchToMode = switchToMode;

// Save helper
async function doSave(): Promise<void> {
  const content = getEditorContent();
  await window.marksidian.save(content);
  markSaved();
  window.marksidian.notifyContentChanged(false);
}

async function doSaveAs(): Promise<void> {
  const content = getEditorContent();
  await window.marksidian.saveAs(content);
  markSaved();
  window.marksidian.notifyContentChanged(false);
}

// IPC listeners
if (window.marksidian) {
  // File opened from main process
  window.marksidian.onFileOpened((data) => {
    setEditorContent(data.content);
    setFileDir(data.dir);
    markSaved();
    const pos = getCursorPosition();
    updateStatusBar({
      line: pos.line,
      col: pos.col,
      wordCount: getWordCount(),
      mode: getMode(),
    });
  });

  // Menu: Save
  window.marksidian.onMenuSave(async () => {
    try {
      await doSave();
    } catch (e: any) {
      if (e.message !== 'Save cancelled') {
        console.error('Save failed:', e);
      }
    }
  });

  // Menu: Save As
  window.marksidian.onMenuSaveAs(async () => {
    try {
      await doSaveAs();
    } catch (e: any) {
      if (e.message !== 'Save cancelled') {
        console.error('Save As failed:', e);
      }
    }
  });

  // Menu: Toggle mode (Live Preview <-> Source)
  window.marksidian.onMenuToggleMode(() => {
    const current = getMode();
    if (current === 'reading') {
      switchToMode('live');
    } else {
      switchToMode(current === 'live' ? 'source' : 'live');
    }
  });

  // Menu: Toggle reading mode
  window.marksidian.onMenuToggleReading(() => {
    const current = getMode();
    switchToMode(current === 'reading' ? 'live' : 'reading');
  });

  // Menu: Toggle readable line width
  window.marksidian.onMenuToggleLineWidth((data) => {
    toggleReadableLineWidth(data.enabled);
  });

  // Menu: Zoom
  window.marksidian.onMenuZoom((data) => {
    if (data.direction === 'in') {
      zoomLevel = Math.min(zoomLevel + 1, 10);
    } else if (data.direction === 'out') {
      zoomLevel = Math.max(zoomLevel - 1, -5);
    } else {
      zoomLevel = 0;
    }
    applyZoom();
  });

  // Set mode from main process
  window.marksidian.onSetMode((data) => {
    switchToMode(data.mode);
  });

  // Set theme from main process
  window.marksidian.onSetTheme((data) => {
    if (data.theme === 'dark') {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else if (data.theme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
  });

  // Session: collect state on quit
  window.marksidian.onCollectSessionState(() => {
    window.marksidian.sendSessionState({
      cursorOffset: getCursorOffset(),
      scrollTop: getScrollTop(),
      editorMode: getMode(),
      zoomLevel,
    });
  });

  // Session: restore state on launch
  window.marksidian.onRestoreState((data) => {
    switchToMode(data.editorMode);
    zoomLevel = data.zoomLevel;
    applyZoom();
    setCursorOffset(data.cursorOffset);
    setScrollTop(data.scrollTop);
  });
}

// Right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (window.marksidian) {
    window.marksidian.showContextMenu();
  }
});

// Keyboard shortcut: Cmd+S / Cmd+Shift+S
document.addEventListener('keydown', async (e) => {
  if (!window.marksidian) return;

  if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
    e.preventDefault();
    try { await doSave(); } catch { /* cancelled */ }
  } else if ((e.metaKey || e.ctrlKey) && e.key === 's' && e.shiftKey) {
    e.preventDefault();
    try { await doSaveAs(); } catch { /* cancelled */ }
  }
});
