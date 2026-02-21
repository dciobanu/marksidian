import MarkdownIt from 'markdown-it';
import markdownItMark from 'markdown-it-mark';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItFrontMatter from 'markdown-it-front-matter';
import markdownItKatex from '@vscode/markdown-it-katex';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// ==highlight== support (renders as <mark>)
md.use(markdownItMark);

// Footnote support [^1] and [^1]: definition
md.use(markdownItFootnote);

// Frontmatter — strip YAML front matter so it doesn't appear in reading view
md.use(markdownItFrontMatter, () => {
  // Callback receives the frontmatter string; we ignore it (just strip it)
});

// Math support — $inline$ and $$block$$ via KaTeX
md.use(markdownItKatex, {
  throwOnError: false,
});

// Enable task lists
md.use((md) => {
  const defaultRender = md.renderer.rules.list_item_open || function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    // Check if next inline token starts with checkbox syntax
    if (idx + 2 < tokens.length && tokens[idx + 2].type === 'inline') {
      const content = tokens[idx + 2].content;
      if (content.startsWith('[ ] ') || content.startsWith('[x] ') || content.startsWith('[X] ')) {
        token.attrSet('class', 'task-list-item');
        token.attrSet('style', 'list-style: none;');
      }
    }
    return defaultRender(tokens, idx, options, env, self);
  };

  // We replace checkbox patterns inline with actual checkboxes
  md.core.ruler.after('inline', 'task-lists', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue;
      const children = blockToken.children;
      if (children.length === 0) continue;

      const firstChild = children[0];
      if (firstChild.type !== 'text') continue;

      const match = firstChild.content.match(/^\[([ xX])\] /);
      if (!match) continue;

      const checked = match[1] !== ' ';
      firstChild.content = firstChild.content.slice(match[0].length);

      // Insert checkbox token before
      const checkboxToken = new state.Token('html_inline', '', 0);
      checkboxToken.content = `<input type="checkbox" ${checked ? 'checked' : ''} disabled> `;
      children.unshift(checkboxToken);
    }
  });
});

export function renderMarkdown(content: string): string {
  return md.render(content);
}

export function showReadingView(container: HTMLElement, content: string): void {
  container.innerHTML = renderMarkdown(content);
}
