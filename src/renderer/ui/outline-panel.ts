/**
 * Outline panel — displays document headings as a navigable, collapsible tree.
 */

import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

// ── Types ──────────────────────────────────────────────────────

export interface OutlineHeading {
  text: string;
  level: number;
  from: number;   // character offset in document
  line: number;
}

// ── State ──────────────────────────────────────────────────────

let panelEl: HTMLElement | null = null;
let treeEl: HTMLElement | null = null;
let visible = true;
let currentMode: 'live' | 'source' | 'reading' = 'live';

// Previous headings for smart diff (avoid full DOM rebuild on cursor move)
let prevHeadings: OutlineHeading[] = [];
let prevActiveIndex = -1;

// Collapsed state: preserved across rebuilds
const collapsedSet = new Set<string>();

// Callbacks set by renderer
let onNavigateEditor: ((from: number) => void) | null = null;
let onNavigateReading: ((text: string, level: number) => void) | null = null;

// Debounce timer
let updateTimer: ReturnType<typeof setTimeout> | null = null;

// ── Heading node detection ─────────────────────────────────────

const headingNodeLevels: Record<string, number> = {
  ATXHeading1: 1, ATXHeading2: 2, ATXHeading3: 3,
  ATXHeading4: 4, ATXHeading5: 5, ATXHeading6: 6,
};

// ── Public API ─────────────────────────────────────────────────

export function createOutlinePanel(): void {
  panelEl = document.getElementById('outline-panel');
  if (!panelEl) return;

  const header = document.createElement('div');
  header.className = 'outline-header';
  header.textContent = 'Outline';
  panelEl.appendChild(header);

  treeEl = document.createElement('div');
  treeEl.className = 'outline-tree';
  panelEl.appendChild(treeEl);
}

export function showOutlinePanel(): void {
  if (panelEl) panelEl.style.display = '';
  visible = true;
}

export function hideOutlinePanel(): void {
  if (panelEl) panelEl.style.display = 'none';
  visible = false;
}

export function isOutlineVisible(): boolean {
  return visible;
}

export function setOutlineMode(mode: 'live' | 'source' | 'reading'): void {
  currentMode = mode;
}

export function setOutlineNavigateEditor(cb: (from: number) => void): void {
  onNavigateEditor = cb;
}

export function setOutlineNavigateReading(cb: (text: string, level: number) => void): void {
  onNavigateReading = cb;
}

/**
 * Debounced update — call on every doc/selection change.
 */
export function scheduleOutlineUpdate(view: EditorView): void {
  if (!visible) return;
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    updateOutline(view);
  }, 100);
}

/**
 * Immediate update — call after mode switch or toggle.
 */
export function forceOutlineUpdate(view: EditorView): void {
  if (!visible) return;
  updateOutline(view);
}

// ── Internal ───────────────────────────────────────────────────

function extractHeadings(view: EditorView): OutlineHeading[] {
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);
  const headings: OutlineHeading[] = [];

  tree.iterate({
    from: 0,
    to: doc.length,
    enter(node) {
      const level = headingNodeLevels[node.name];
      if (level === undefined) return;

      const lineObj = doc.lineAt(node.from);
      const rawText = doc.sliceString(lineObj.from, lineObj.to);
      // Strip leading # markers and whitespace
      const text = rawText.replace(/^#+\s*/, '');

      headings.push({
        text,
        level,
        from: node.from,
        line: lineObj.number,
      });
    },
  });

  return headings;
}

function getActiveIndex(headings: OutlineHeading[], cursorOffset: number): number {
  let active = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].from <= cursorOffset) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

function headingsChanged(a: OutlineHeading[], b: OutlineHeading[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i].text !== b[i].text || a[i].level !== b[i].level || a[i].line !== b[i].line) return true;
  }
  return false;
}

function collapseKey(heading: OutlineHeading): string {
  return `${heading.level}:${heading.text}`;
}

/**
 * Check if heading at index `i` has any children (headings with deeper level immediately after it).
 */
function hasChildren(headings: OutlineHeading[], i: number): boolean {
  if (i + 1 >= headings.length) return false;
  return headings[i + 1].level > headings[i].level;
}

/**
 * Get the range of child indices for heading at index `parent`.
 * Children are all subsequent headings with level > parent's level,
 * until a heading with level <= parent's level is found.
 */
function getChildRange(headings: OutlineHeading[], parent: number): { start: number; end: number } {
  const parentLevel = headings[parent].level;
  let end = parent + 1;
  while (end < headings.length && headings[end].level > parentLevel) {
    end++;
  }
  return { start: parent + 1, end };
}

function updateOutline(view: EditorView): void {
  if (!treeEl) return;

  const headings = extractHeadings(view);
  const cursorOffset = view.state.selection.main.head;
  const activeIndex = getActiveIndex(headings, cursorOffset);

  const structureChanged = headingsChanged(headings, prevHeadings);

  if (!structureChanged && activeIndex === prevActiveIndex) {
    return; // Nothing changed
  }

  if (structureChanged) {
    // Full rebuild
    rebuildTree(headings, activeIndex);
  } else {
    // Just move active highlight
    moveActiveHighlight(activeIndex);
  }

  prevHeadings = headings;
  prevActiveIndex = activeIndex;

  // Auto-scroll to active item
  scrollToActive();
}

function rebuildTree(headings: OutlineHeading[], activeIndex: number): void {
  if (!treeEl) return;
  treeEl.innerHTML = '';

  if (headings.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'outline-empty';
    empty.textContent = 'No headings';
    treeEl.appendChild(empty);
    return;
  }

  // Build flat list with collapse grouping
  // We render items in document order; collapsible parents control visibility of their children
  let i = 0;
  while (i < headings.length) {
    i = renderHeadingItem(headings, i, activeIndex, treeEl);
  }
}

function renderHeadingItem(
  headings: OutlineHeading[],
  index: number,
  activeIndex: number,
  container: HTMLElement,
): number {
  const heading = headings[index];
  const item = document.createElement('div');
  item.className = 'outline-item';
  item.dataset.level = String(heading.level);
  item.dataset.index = String(index);

  if (index === activeIndex) {
    item.classList.add('outline-item-active');
  }

  const key = collapseKey(heading);
  const isCollapsed = collapsedSet.has(key);
  const hasKids = hasChildren(headings, index);

  if (hasKids) {
    if (isCollapsed) item.classList.add('collapsed');

    const collapseIcon = document.createElement('span');
    collapseIcon.className = 'outline-collapse-icon';
    collapseIcon.textContent = '\u25BC'; // ▼
    collapseIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      if (collapsedSet.has(key)) {
        collapsedSet.delete(key);
        item.classList.remove('collapsed');
      } else {
        collapsedSet.add(key);
        item.classList.add('collapsed');
      }
      // Toggle child group visibility
      const childGroup = item.nextElementSibling;
      if (childGroup && childGroup.classList.contains('outline-child-group')) {
        childGroup.style.display = collapsedSet.has(key) ? 'none' : '';
      }
    });
    item.appendChild(collapseIcon);
  } else {
    // Spacer for alignment
    const spacer = document.createElement('span');
    spacer.className = 'outline-collapse-icon';
    spacer.style.visibility = 'hidden';
    item.appendChild(spacer);
  }

  const textEl = document.createElement('span');
  textEl.className = 'outline-item-text';
  textEl.textContent = heading.text || '(untitled)';
  item.appendChild(textEl);

  // Click navigates to heading
  item.addEventListener('click', () => {
    if (currentMode === 'reading') {
      if (onNavigateReading) onNavigateReading(heading.text, heading.level);
    } else {
      if (onNavigateEditor) onNavigateEditor(heading.from);
    }
  });

  container.appendChild(item);

  // If this heading has children, wrap them in a group div
  if (hasKids) {
    const { start, end } = getChildRange(headings, index);
    const childGroup = document.createElement('div');
    childGroup.className = 'outline-child-group';
    if (isCollapsed) childGroup.style.display = 'none';

    let childIdx = start;
    while (childIdx < end) {
      childIdx = renderHeadingItem(headings, childIdx, activeIndex, childGroup);
    }

    container.appendChild(childGroup);
    return end;
  }

  return index + 1;
}

/**
 * Externally set the active heading index (e.g. from reading view scroll).
 */
export function setActiveHeadingIndex(index: number): void {
  if (index === prevActiveIndex) return;
  moveActiveHighlight(index);
  prevActiveIndex = index;
  scrollToActive();
}

/**
 * Return the current headings array (for external mapping, e.g. scroll handler).
 */
export function getHeadings(): readonly OutlineHeading[] {
  return prevHeadings;
}

function moveActiveHighlight(newActiveIndex: number): void {
  if (!treeEl) return;

  // Remove old active
  const oldActive = treeEl.querySelector('.outline-item-active');
  if (oldActive) oldActive.classList.remove('outline-item-active');

  // Add new active
  if (newActiveIndex >= 0) {
    const items = treeEl.querySelectorAll('.outline-item');
    for (const item of items) {
      if ((item as HTMLElement).dataset.index === String(newActiveIndex)) {
        item.classList.add('outline-item-active');
        break;
      }
    }
  }
}

function scrollToActive(): void {
  if (!treeEl) return;
  const active = treeEl.querySelector('.outline-item-active');
  if (active) {
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
