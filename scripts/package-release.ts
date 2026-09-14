// Package Extension and Web Release Assets
// Complies with 作者本人开发计划 §4.7, T32b

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PLUGIN_DIR = path.join(ROOT_DIR, 'plugin');
const PLUGIN_DIST = path.join(PLUGIN_DIR, 'dist');
const WEB_PUBLIC_DOWNLOADS = path.join(ROOT_DIR, 'web', 'public', 'downloads');
const RELEASE_ZIP_NAME = 'zhihu-explore-extension.zip';
const RELEASE_ZIP_PATH = path.join(WEB_PUBLIC_DOWNLOADS, RELEASE_ZIP_NAME);
const MANIFEST_PATH = path.join(ROOT_DIR, 'release-manifest.json');

async function main() {
  console.log('📦 Starting release packaging process...');

  // Production origins from web/.env.production
  const apiOrigin = process.env.API_ORIGIN || 'https://hackerson-d0g0z55d2fc446485.service.tcloudbase.com/api';
  const appOrigin = process.env.APP_ORIGIN || 'https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com';

  if (apiOrigin.includes('zhihu-explore-api.app') || apiOrigin.includes('localhost')) {
    console.error(`❌ FATAL: Invalid API_ORIGIN in release: ${apiOrigin}`);
    process.exit(1);
  }
  if (appOrigin.includes('zhihu-interest-explore.web.app') || appOrigin.includes('localhost')) {
    console.error(`❌ FATAL: Invalid APP_ORIGIN in release: ${appOrigin}`);
    process.exit(1);
  }

  // 1. Clean and build Plugin (RELEASE mode enforces no localhost fallback)
  console.log('1. Cleaning and building plugin bundles via esbuild (RELEASE mode)...');
  if (fs.existsSync(PLUGIN_DIST)) {
    fs.rmSync(PLUGIN_DIST, { recursive: true, force: true });
  }
  fs.mkdirSync(PLUGIN_DIST, { recursive: true });

  execSync('node plugin/scripts/build-plugin.js', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      RELEASE: 'true',
      API_ORIGIN: apiOrigin,
      APP_ORIGIN: appOrigin,
      NODE_ENV: 'production',
    },
  });

  // Post-build: scan dist for localhost contamination
  const filesToScan = ['content.js', 'background.js'];
  for (const fname of filesToScan) {
    const fpath = path.join(PLUGIN_DIST, fname);
    if (fs.existsSync(fpath)) {
      const content = fs.readFileSync(fpath, 'utf-8');
      if (content.includes('localhost')) {
        console.error(`❌ FATAL: ${fname} contains "localhost" — release build is contaminated!`);
        process.exit(1);
      }
    }
  }
  console.log('   ✅ Production dist verified: no localhost references found.');

  // Ensure manifest.json exists in plugin dist
  const distManifest = path.join(PLUGIN_DIST, 'manifest.json');
  if (!fs.existsSync(distManifest)) {
    throw new Error('plugin/dist/manifest.json not found after build!');
  }

  // 2. Prepare Web Public Downloads Directory
  fs.mkdirSync(WEB_PUBLIC_DOWNLOADS, { recursive: true });

  // 3. Zip Plugin (ensure manifest.json is at root of archive, packaging only runtime assets)
  console.log(`2. Packaging clean plugin archive into ${RELEASE_ZIP_PATH}...`);
  if (fs.existsSync(RELEASE_ZIP_PATH)) {
    fs.unlinkSync(RELEASE_ZIP_PATH);
  }

  // Only package required runtime assets: manifest.json, content.js, background.js (and assets if present)
  execSync(`cd "${PLUGIN_DIST}" && zip -r "${RELEASE_ZIP_PATH}" manifest.json content.js background.js $([ -d assets ] && echo assets) -x "*.DS_Store"`, {
    stdio: 'inherit',
  });

  // 4. Calculate Checksum & Manifest
  const zipBuffer = fs.readFileSync(RELEASE_ZIP_PATH);
  const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const sizeBytes = zipBuffer.length;

  const releaseInfo = {
    version: '0.0.1',
    build_time: new Date().toISOString(),
    packages: {
      extension: {
        filename: RELEASE_ZIP_NAME,
        path: `web/public/downloads/${RELEASE_ZIP_NAME}`,
        sha256,
        size_bytes: sizeBytes,
      },
    },
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(releaseInfo, null, 2), 'utf-8');
  console.log(`3. Release manifest written to ${MANIFEST_PATH}`);

  // 5. Build Web Application
  console.log('4. Building web dashboard...');
  execSync('npm run build -w web', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  console.log('✅ Release packaging completed successfully!');
  console.log(`   Extension ZIP: ${RELEASE_ZIP_PATH} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`   SHA-256: ${sha256}`);
}

main().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
