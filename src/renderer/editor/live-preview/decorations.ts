import { Extension } from '@codemirror/state';
import { headingDecoration } from './heading';
import { emphasisDecoration } from './emphasis';
import { highlightDecoration } from './highlight';
import { codeInlineDecoration } from './code-inline';
import { codeBlockDecoration } from './code-block';
import { linkDecoration, linkClickHandler } from './link';
import { imageDecoration } from './image';
import { listDecoration } from './list';
import { taskDecoration } from './task';
import { blockquoteDecoration } from './blockquote';
import { hrDecoration } from './hr';
import { mathDecoration } from './math';
import { footnoteDecoration } from './footnote';
import { frontmatterDecoration } from './frontmatter';
import { tableDecoration } from './table';

export function livePreviewExtensions(): Extension[] {
  return [
    headingDecoration,
    emphasisDecoration,
    highlightDecoration,
    codeInlineDecoration,
    codeBlockDecoration,
    linkDecoration,
    linkClickHandler,
    imageDecoration,
    listDecoration,
    taskDecoration,
    blockquoteDecoration,
    hrDecoration,
    mathDecoration,
    footnoteDecoration,
    frontmatterDecoration,
    tableDecoration,
  ];
}
