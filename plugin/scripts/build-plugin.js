import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '..');

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
};

async function build() {
  const distDir = path.join(pluginDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json
  const manifestSrc = path.join(pluginDir, 'manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log('Copied manifest.json to dist/');
  }

  // Content script
  const contentCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [path.join(pluginDir, 'src/content/index.ts')],
    outfile: path.join(distDir, 'content.js'),
  });

  // Background service worker
  const bgCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [path.join(pluginDir, 'src/background/index.ts')],
    outfile: path.join(distDir, 'background.js'),
  });

  if (isWatch) {
    await contentCtx.watch();
    await bgCtx.watch();
    console.log('Watching for changes...');
  } else {
    await contentCtx.rebuild();
    await bgCtx.rebuild();
    await contentCtx.dispose();
    await bgCtx.dispose();
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
