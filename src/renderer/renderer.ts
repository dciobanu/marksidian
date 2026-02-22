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
  setHeadingIndentSettings as setEditorHeadingIndent,
} from './editor/editor';
import { setFileDir, getFileDir } from './editor/live-preview/image';
import { showReadingView, setReadingHeadingIndentSettings } from './editor/reading/reading-view';
import { updateStatusBar } from './ui/status-bar';
import { setupContainer, toggleReadableLineWidth } from './ui/container';
import { loadActiveTheme, applyThemeCss, removeThemeCss } from './ui/theme-loader';
import { openThemeModal } from './ui/theme-modal';
import {
  createOutlinePanel,
  showOutlinePanel,
  hideOutlinePanel,
  isOutlineVisible,
  setOutlineMode,
  setOutlineNavigateEditor,
  setOutlineNavigateReading,
  scheduleOutlineUpdate,
  forceOutlineUpdate,
  setActiveHeadingIndex,
  getHeadings,
} from './ui/outline-panel';
import type { EditorMode, HeadingIndentSettings, ThemeMode } from '../shared/types';

// Initialize
const editorContainer = document.getElementById('editor-container')!;
const readingContainer = document.getElementById('reading-container')!;
const readingContent = document.getElementById('reading-content')!;

// Setup container
setupContainer();

// Intercept link clicks in reading view — open external URLs in system browser
readingContent.addEventListener('click', (e) => {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  e.preventDefault();
  if ((href.startsWith('http://') || href.startsWith('https://')) && window.marksidian) {
    window.marksidian.openExternal(href);
  }
});

// ── Light/Dark theme mode ────────────────────────────────────
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentThemeMode: ThemeMode = 'system';

function applySystemTheme(): void {
  document.body.classList.toggle('theme-dark', prefersDark.matches);
  document.body.classList.toggle('theme-light', !prefersDark.matches);
}

function onSystemThemeChange(e: MediaQueryListEvent): void {
  if (currentThemeMode === 'system') {
    document.body.classList.toggle('theme-dark', e.matches);
    document.body.classList.toggle('theme-light', !e.matches);
  }
}

function applyThemeMode(mode: ThemeMode): void {
  currentThemeMode = mode;
  if (mode === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
  } else if (mode === 'light') {
    document.body.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
  } else {
    // 'system' — follow OS preference
    applySystemTheme();
  }
}

// Start with system preference; load saved mode asynchronously
applySystemTheme();
prefersDark.addEventListener('change', onSystemThemeChange);

// Create the editor
createEditor(editorContainer);

// ── Typography normalization (MarkdownIt typographer converts ASCII → Unicode) ──
function normalizeTypography(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '---')
    .replace(/\u2013/g, '--')
    .replace(/\u2026/g, '...');
}

// Create outline panel
createOutlinePanel();
setOutlineNavigateEditor((from) => {
  setCursorOffset(from);
  // Focus the editor after navigation
  const view = getEditorView();
  if (view) view.focus();
});
setOutlineNavigateReading((text, level) => {
  const tag = `H${level}`;
  const headings = readingContent.querySelectorAll(tag);
  const normalizedText = normalizeTypography(text.trim());
  for (const h of headings) {
    const headingText = normalizeTypography(h.textContent?.trim() ?? '');
    if (headingText === normalizedText) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update active heading in outline after navigation
      setTimeout(() => updateReadingActiveHeading(), 100);
      break;
    }
  }
});

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
  showOutlinePanel,
  hideOutlinePanel,
  isOutlineVisible,
  forceOutlineUpdate,
};

// Track zoom level
let zoomLevel = 0;

function applyZoom(): void {
  const size = 16 + zoomLevel * 2;
  document.documentElement.style.setProperty('--font-text-size', `${size}px`);
}

// Update status bar and outline on editor changes
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

  // Update outline panel (debounced)
  const view = getEditorView();
  if (view) scheduleOutlineUpdate(view);
});

// Initial status bar update
updateStatusBar({
  line: 1,
  col: 1,
  wordCount: 0,
  mode: 'live',
});

// Switch between editor and reading view
async function switchToMode(mode: EditorMode): Promise<void> {
  if (mode === 'reading') {
    editorContainer.style.display = 'none';
    readingContainer.style.display = '';
    await showReadingView(readingContent, getEditorContent(), getFileDir());
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

  // Update outline mode so clicks navigate correctly
  setOutlineMode(mode);
  const view = getEditorView();
  if (view) forceOutlineUpdate(view);
}

// Add switchToMode to test API
(window as any).__marksidian.switchToMode = switchToMode;

// ── Reading view scroll → outline active heading tracking ────
let readingScrollTimer: ReturnType<typeof setTimeout> | null = null;

function updateReadingActiveHeading(): void {
  if (!isOutlineVisible()) return;
  const headings = getHeadings();
  if (headings.length === 0) return;

  const headingEls = readingContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headingEls.length === 0) return;

  const containerRect = readingContainer.getBoundingClientRect();
  const threshold = containerRect.top + 20;

  let activeIndex = -1;
  let outlineIdx = 0;
  for (const el of headingEls) {
    if (outlineIdx >= headings.length) break;
    const rect = el.getBoundingClientRect();
    if (rect.top <= threshold) {
      activeIndex = outlineIdx;
    }
    outlineIdx++;
  }

  if (activeIndex >= 0) {
    setActiveHeadingIndex(activeIndex);
  }
}

readingContainer.addEventListener('scroll', () => {
  if (readingScrollTimer) clearTimeout(readingScrollTimer);
  readingScrollTimer = setTimeout(updateReadingActiveHeading, 50);
}, { passive: true });

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
  window.marksidian.onMenuToggleMode(async () => {
    const current = getMode();
    if (current === 'reading') {
      await switchToMode('live');
    } else {
      await switchToMode(current === 'live' ? 'source' : 'live');
    }
  });

  // Menu: Toggle reading mode
  window.marksidian.onMenuToggleReading(async () => {
    const current = getMode();
    await switchToMode(current === 'reading' ? 'live' : 'reading');
  });

  // Menu: Toggle readable line width
  window.marksidian.onMenuToggleLineWidth((data) => {
    toggleReadableLineWidth(data.enabled);
  });

  // Menu: Toggle outline panel
  window.marksidian.onMenuToggleOutline((data) => {
    if (data.enabled) {
      showOutlinePanel();
      const view = getEditorView();
      if (view) forceOutlineUpdate(view);
    } else {
      hideOutlinePanel();
    }
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
  window.marksidian.onSetMode(async (data) => {
    await switchToMode(data.mode);
  });

  // Theme mode: load saved preference on startup
  window.marksidian.getThemeModeSettings().then((settings) => {
    applyThemeMode(settings.mode);
  });

  // Theme mode: respond to changes from menu
  window.marksidian.onThemeModeChanged((settings) => {
    applyThemeMode(settings.mode);
  });

  // Session: collect state on quit
  window.marksidian.onCollectSessionState(() => {
    window.marksidian.sendSessionState({
      cursorOffset: getCursorOffset(),
      scrollTop: getScrollTop(),
      editorMode: getMode(),
      zoomLevel,
      outlineVisible: isOutlineVisible(),
    });
  });

  // Session: restore state on launch
  window.marksidian.onRestoreState(async (data) => {
    await switchToMode(data.editorMode);
    zoomLevel = data.zoomLevel;
    applyZoom();
    setCursorOffset(data.cursorOffset);
    setScrollTop(data.scrollTop);
    // Restore outline visibility (default is visible; hide only if explicitly false)
    if (data.outlineVisible === false) {
      hideOutlinePanel();
    } else {
      showOutlinePanel();
      const view = getEditorView();
      if (view) forceOutlineUpdate(view);
    }
  });

  // Theme: load active theme on startup
  loadActiveTheme();

  // Theme: respond to active theme changes from other windows
  window.marksidian.onThemeActiveChanged(async (data) => {
    if (data.name) {
      try {
        const cssPath = await window.marksidian.getThemeCssPath(data.name);
        applyThemeCss(cssPath);
      } catch {
        removeThemeCss();
      }
    } else {
      removeThemeCss();
    }
  });

  // Settings: open settings modal
  window.marksidian.onMenuOpenSettings(() => {
    openThemeModal();
  });

  // Heading indent: load on startup and listen for changes
  function applyHeadingIndent(settings: HeadingIndentSettings): void {
    const root = document.documentElement;
    root.style.setProperty('--heading-indent-h1', `${settings.h1}px`);
    root.style.setProperty('--heading-indent-h2', `${settings.h2}px`);
    root.style.setProperty('--heading-indent-h3', `${settings.h3}px`);
    root.style.setProperty('--heading-indent-h4', `${settings.h4}px`);
    root.style.setProperty('--heading-indent-h5', `${settings.h5}px`);
    root.style.setProperty('--heading-indent-h6', `${settings.h6}px`);
    setEditorHeadingIndent(settings);
    setReadingHeadingIndentSettings(settings);
  }

  window.marksidian.getHeadingIndentSettings().then(applyHeadingIndent);
  window.marksidian.onHeadingIndentChanged(applyHeadingIndent);
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
