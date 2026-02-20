/**
 * Custom Lezer markdown extension for YAML frontmatter.
 *
 * Recognizes `---` delimited frontmatter at the start of a document
 * and produces a `FrontMatter` node in the syntax tree.
 */
import type { MarkdownConfig, BlockParser, BlockContext, Line } from '@lezer/markdown';

const FrontMatterParser: BlockParser = {
  name: 'FrontMatter',
  // Must run before other block parsers so --- isn't treated as HorizontalRule
  before: 'HorizontalRule',

  parse(cx: BlockContext, line: Line): boolean {
    // Frontmatter must start at the very beginning of the document
    if (cx.lineStart !== 0) return false;
    // Must be exactly ---
    if (line.text.trim() !== '---') return false;

    const start = cx.lineStart;
    let end = start;

    // Consume opening ---
    if (!cx.nextLine()) return false;

    // Read until we find closing ---
    while (true) {
      if (line.text.trim() === '---') {
        // Found closing delimiter — consume it
        end = cx.lineStart + line.text.length;
        cx.nextLine();
        break;
      }
      if (!cx.nextLine()) {
        // Reached end of document without closing ---
        return false;
      }
    }

    cx.addElement(cx.elt('FrontMatter', start, end));
    return true;
  },
};

export const Frontmatter: MarkdownConfig = {
  defineNodes: ['FrontMatter'],
  parseBlock: [FrontMatterParser],
};
