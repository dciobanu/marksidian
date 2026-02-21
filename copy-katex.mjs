// copy-katex.mjs
// Copies KaTeX CSS + woff2 fonts into dist/renderer/ so they are
// available in both dev and packaged builds.

import { cpSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const katexDist = join(__dirname, 'node_modules', 'katex', 'dist');
const outDir = join(__dirname, 'dist', 'renderer');

// Ensure output directories exist
mkdirSync(join(outDir, 'fonts'), { recursive: true });

// Copy the minified CSS
cpSync(join(katexDist, 'katex.min.css'), join(outDir, 'katex.min.css'));

// Copy only woff2 fonts (Electron/Chromium only needs woff2)
for (const file of readdirSync(join(katexDist, 'fonts'))) {
  if (file.endsWith('.woff2')) {
    cpSync(join(katexDist, 'fonts', file), join(outDir, 'fonts', file));
  }
}

console.log('Copied KaTeX CSS + woff2 fonts to dist/renderer/');
