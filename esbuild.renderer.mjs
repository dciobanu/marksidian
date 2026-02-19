import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/renderer/renderer.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/renderer/renderer.js',
  format: 'iife',
  sourcemap: true,
});
