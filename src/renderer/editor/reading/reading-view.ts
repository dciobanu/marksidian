import MarkdownIt from 'markdown-it';
import markdownItMark from 'markdown-it-mark';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItFrontMatter from 'markdown-it-front-matter';
import markdownItKatex from '@vscode/markdown-it-katex';
import mermaid from 'mermaid';
import type { HeadingIndentSettings } from '../../../shared/types';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// ==highlight== support (renders as <mark>)
md.use(markdownItMark);

// Footnote support [^1] and [^1]: definition
md.use(markdownItFootnote);

// Frontmatter — capture YAML front matter for structured display
let capturedFrontmatter = '';
md.use(markdownItFrontMatter, (fm: string) => {
  capturedFrontmatter = fm;
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

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildFrontmatterHTML(yaml: string): string {
  const lines = yaml.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  let propsHTML = '';
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    propsHTML += `<div class="reading-frontmatter-property">` +
      `<span class="reading-frontmatter-key">${escapeHTML(key)}</span>` +
      `<span class="reading-frontmatter-value">${escapeHTML(value)}</span>` +
      `</div>`;
  }

  return `<div class="reading-frontmatter">` +
    `<div class="reading-frontmatter-toggle">\u25B6 Properties</div>` +
    `<div class="reading-frontmatter-properties" style="display: none;">${propsHTML}</div>` +
    `</div>`;
}

// ── Heading indent for reading view ──────────────────────────

let headingIndentSettings: HeadingIndentSettings | null = null;

export function setReadingHeadingIndentSettings(settings: HeadingIndentSettings): void {
  headingIndentSettings = settings;
}

const headingTags: Record<string, keyof HeadingIndentSettings> = {
  H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6',
};

// Maps a heading tag to its PARENT level's settings key.
// H1 has no parent (indent 0), H2's parent is H1, H3's parent is H2, etc.
const parentIndentKeys: Record<string, keyof HeadingIndentSettings> = {
  H2: 'h1', H3: 'h2', H4: 'h3', H5: 'h4', H6: 'h5',
};

function applyReadingHeadingIndent(container: HTMLElement): void {
  if (!headingIndentSettings || !headingIndentSettings.enabledInReading) return;

  const settings = headingIndentSettings;
  // contentIndent: the indent applied to content under the current heading
  let contentIndent = 0;

  for (let i = 0; i < container.children.length; i++) {
    const el = container.children[i] as HTMLElement;
    const key = headingTags[el.tagName];
    if (key) {
      // Heading sits at its PARENT level's indent (level N-1), not the
      // previous contentIndent — this avoids the bug where H2 after H3
      // would inherit H3's deeper indent.
      const parentKey = parentIndentKeys[el.tagName];
      const headingIndent = parentKey ? (settings[parentKey] as number) : 0;
      if (headingIndent > 0) {
        el.style.paddingLeft = `${headingIndent}px`;
      }
      // Update contentIndent for subsequent content lines
      contentIndent = settings[key] as number;
    } else if (contentIndent > 0) {
      el.style.paddingLeft = `${contentIndent}px`;
    }
  }
}

export function renderMarkdown(content: string): string {
  capturedFrontmatter = '';
  return md.render(content);
}

export async function showReadingView(container: HTMLElement, content: string, fileDir?: string): Promise<void> {
  // Reinitialize mermaid with current theme each time
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: getMermaidTheme(),
  });

  const rendered = renderMarkdown(content);
  const fmHTML = capturedFrontmatter ? buildFrontmatterHTML(capturedFrontmatter) : '';
  container.innerHTML = fmHTML + rendered;

  // Wire up frontmatter toggle
  const fmToggle = container.querySelector('.reading-frontmatter-toggle');
  if (fmToggle) {
    fmToggle.addEventListener('click', () => {
      const props = container.querySelector('.reading-frontmatter-properties') as HTMLElement;
      if (!props) return;
      const isHidden = props.style.display === 'none';
      props.style.display = isHidden ? '' : 'none';
      fmToggle.textContent = (isHidden ? '\u25BC' : '\u25B6') + ' Properties';
    });
  }

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

  // Post-process heading level indent
  applyReadingHeadingIndent(container);
}
