import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: {
    'service-worker': 'src/background/service-worker.js',
    viewer: 'src/viewer/viewer.js',
  },
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  outdir: 'dist',
  logLevel: 'info',
};

async function copyStatic() {
  await cp('src/manifest.json', 'dist/manifest.json');
  await cp('src/viewer/viewer.html', 'dist/viewer.html');
  await cp('src/styles', 'dist/styles', { recursive: true });
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyStatic();
  console.log('watching...');
} else {
  await esbuild.build(buildOptions);
  await copyStatic();
}
