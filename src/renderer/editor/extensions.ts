import { Extension, Compartment } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightSpecialChars, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { GFM } from '@lezer/markdown';
import { Frontmatter } from './live-preview/frontmatter-parser';
import { livePreviewExtensions } from './live-preview/decorations';
import { customKeymap } from './keymaps';

export const modeCompartment = new Compartment();

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
  ];
}
