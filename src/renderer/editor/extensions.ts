import { Extension, Compartment } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightSpecialChars, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { search, searchKeymap } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { GFM } from '@lezer/markdown';
import { Frontmatter } from './live-preview/frontmatter-parser';
import { livePreviewExtensions } from './live-preview/decorations';
import { customKeymap } from './keymaps';

export const modeCompartment = new Compartment();
export const headingIndentCompartment = new Compartment();

/**
 * Override for defaultHighlightStyle's heading rule.
 * The default applies both bold + underline to tags.heading, which affects
 * GFM TableHeader cells in edit mode. We keep bold but remove the underline.
 */
const headingOverride = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'bold', textDecoration: 'none' },
]);

function baseExtensions(): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorView.lineWrapping,
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    bracketMatching(),
    closeBrackets(),
    search(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    syntaxHighlighting(headingOverride),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [GFM, Frontmatter],
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    customKeymap(),
  ];
}

export function sourceExtensions(): Extension[] {
  return [];
}

export function allExtensions(): Extension[] {
  return [
    ...baseExtensions(),
    modeCompartment.of(livePreviewExtensions()),
    headingIndentCompartment.of([]),
  ];
}
