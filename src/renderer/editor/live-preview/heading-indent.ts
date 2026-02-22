import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view';
import { RangeSetBuilder, Facet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { HeadingIndentSettings } from '../../../shared/types';

const defaultSettings: HeadingIndentSettings = {
  enabledInEditor: true,
  enabledInReading: true,
  h1: 30, h2: 50, h3: 70, h4: 90, h5: 110, h6: 130,
};

export const headingIndentConfig = Facet.define<HeadingIndentSettings, HeadingIndentSettings>({
  combine(values) { return values[0] ?? defaultSettings; },
});

const headingNodeLevels: Record<string, number> = {
  ATXHeading1: 1, ATXHeading2: 2, ATXHeading3: 3,
  ATXHeading4: 4, ATXHeading5: 5, ATXHeading6: 6,
};

interface LineInfo {
  level: number;
  isHeading: boolean;
}

/**
 * Scan the ENTIRE document syntax tree to build a map of lineNumber → { level, isHeading }.
 * Lines before any heading get no entry (no indent).
 *
 * Heading lines are distinguished from content lines so that decorations can
 * place headings at the PARENT level's indent (level N−1) while content stays
 * at the heading's own level (N).
 */
function buildHeadingMap(view: EditorView): Map<number, LineInfo> {
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);

  // Collect heading lines and their levels
  const headingLines: { lineNum: number; level: number }[] = [];

  tree.iterate({
    from: 0,
    to: doc.length,
    enter(node) {
      const level = headingNodeLevels[node.name];
      if (level !== undefined) {
        headingLines.push({ lineNum: doc.lineAt(node.from).number, level });
      }
    },
  });

  // Build the map: every line gets the level of the most recent heading above it
  const headingLineSet = new Set(headingLines.map((h) => h.lineNum));
  const map = new Map<number, LineInfo>();
  let currentLevel = 0;
  let headingIdx = 0;

  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    while (headingIdx < headingLines.length && headingLines[headingIdx].lineNum <= lineNum) {
      currentLevel = headingLines[headingIdx].level;
      headingIdx++;
    }
    if (currentLevel > 0) {
      map.set(lineNum, { level: currentLevel, isHeading: headingLineSet.has(lineNum) });
    }
  }

  return map;
}

function buildDecorations(view: EditorView): DecorationSet {
  const config = view.state.facet(headingIndentConfig);
  if (!config.enabledInEditor) return Decoration.none;

  const headingMap = buildHeadingMap(view);
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from);
    const endLine = view.state.doc.lineAt(to);

    for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
      const info = headingMap.get(lineNum);
      if (!info) continue;

      // Heading lines sit at their parent's indent level (N-1).
      // Content lines sit at their heading's indent level (N).
      const indentLevel = info.isHeading ? info.level - 1 : info.level;

      if (indentLevel >= 1 && indentLevel <= 6) {
        const line = view.state.doc.line(lineNum);
        builder.add(line.from, line.from, Decoration.line({ class: `heading-indent-${indentLevel}` }));
      }
    }
  }

  return builder.finish();
}

export const headingIndentPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
