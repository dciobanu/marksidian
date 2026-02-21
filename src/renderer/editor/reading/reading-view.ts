import MarkdownIt from 'markdown-it';
import markdownItMark from 'markdown-it-mark';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItFrontMatter from 'markdown-it-front-matter';
import markdownItKatex from '@vscode/markdown-it-katex';
import mermaid from 'mermaid';

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

// Mermaid — render ```mermaid code blocks as placeholder divs for async post-processing
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);

md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.info.trim().toLowerCase() === 'mermaid') {
    const source = token.content.trim();
    const encoded = source
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="mermaid-diagram" data-mermaid-source="${encoded}"><pre><code>${encoded}</code></pre></div>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

function getMermaidTheme(): string {
  return document.body.classList.contains('theme-dark') ? 'dark' : 'default';
}

export function renderMarkdown(content: string): string {
  return md.render(content);
}

export async function showReadingView(container: HTMLElement, content: string, fileDir?: string): Promise<void> {
  // Reinitialize mermaid with current theme each time
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: getMermaidTheme(),
  });

  container.innerHTML = renderMarkdown(content);

  // Post-process mermaid diagrams
  const diagrams = container.querySelectorAll<HTMLElement>('.mermaid-diagram');
  for (let i = 0; i < diagrams.length; i++) {
    const el = diagrams[i];
    const source = el.dataset.mermaidSource;
    if (!source) continue;

    try {
      const { svg } = await mermaid.render(`mermaid-diagram-${i}`, source);
      el.innerHTML = svg;
      el.classList.add('mermaid-rendered');
    } catch (err) {
      // On error, keep the raw source visible as fallback
      el.classList.add('mermaid-error');
      console.warn('Mermaid rendering failed:', err);
    }
  }

  // Post-process images: resolve local paths via marksidian-asset:// protocol
  if (fileDir) {
    const images = container.querySelectorAll<HTMLImageElement>('img');
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('marksidian-asset:')) continue;
      // Local path — resolve relative to file dir, same as live preview (image.ts)
      let resolved = src;
      if (!resolved.startsWith('/')) {
        resolved = fileDir + '/' + resolved;
      }
      img.src = 'marksidian-asset://' + resolved;
    }
  }
}
