import * as esbuild from 'esbuild';

// Build main process
await esbuild.build({
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/main/main.js',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});

// Build preload script separately
await esbuild.build({
  entryPoints: ['src/main/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/main/preload.js',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});
