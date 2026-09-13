// Release validation script to verify package integrity and secret safety
// Complies with 作者本人开发计划 §4.7, T35

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const RELEASE_ZIP_PATH = path.join(ROOT_DIR, 'web', 'public', 'downloads', 'zhihu-explore-extension.zip');
const MANIFEST_PATH = path.join(ROOT_DIR, 'release-manifest.json');
const WEB_DIST = path.join(ROOT_DIR, 'dist', 'web');
const PLUGIN_DIST = path.join(ROOT_DIR, 'plugin', 'dist');

const FORBIDDEN_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/, // Google API Key
  /sk-[a-zA-Z0-9]{48}/, // OpenAI API Key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub Token
  /AKID[a-zA-Z0-9]{16}/, // Tencent Cloud SecretId
  /TENCENTCLOUD_SECRET_KEY/,
];

function checkDirectoryForSecrets(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        checkDirectoryForSecrets(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.json'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          throw new Error(`[SECURITY VIOLATION] Suspicious credential pattern matched in ${fullPath}`);
        }
      }
    }
  }
}

function checkNoProcessEnvInDist(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      checkNoProcessEnvInDist(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('process.env')) {
        throw new Error(`[RELEASE CHECK FAILED] Literal "process.env" found in browser bundle: ${fullPath}`);
      }
    }
  }
}

function checkManifestSecurity(manifestPath: string) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json at ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const matches: string[] = manifest.externally_connectable?.matches || [];
  if (matches.length === 0) {
    throw new Error('[SECURITY ERROR] externally_connectable.matches cannot be empty');
  }
  for (const pattern of matches) {
    if (pattern.includes('*.') || pattern === '*' || pattern === '<all_urls>') {
      throw new Error(`[SECURITY ERROR] Wildcard domain in externally_connectable is forbidden: "${pattern}"`);
    }
  }
  console.log('✓ manifest.json externally_connectable verified: strictly bounded (no wildcards)');
}

async function main() {
  console.log('🔍 Executing release pre-flight verification (T35)...');

  // 1. Verify release manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing release-manifest.json at ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`✓ Release manifest verified (v${manifest.version})`);

  // 2. Verify extension zip existence and SHA-256 hash
  if (!fs.existsSync(RELEASE_ZIP_PATH)) {
    throw new Error(`Missing extension package at ${RELEASE_ZIP_PATH}`);
  }

  const zipBuffer = fs.readFileSync(RELEASE_ZIP_PATH);
  const actualSha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const expectedSha256 = manifest.packages?.extension?.sha256;

  if (actualSha256 !== expectedSha256) {
    throw new Error(`SHA256 mismatch for extension package!\nExpected: ${expectedSha256}\nActual:   ${actualSha256}`);
  }
  console.log(`✓ Extension zip hash matches release-manifest.json (${actualSha256.substring(0, 16)}...)`);

  // 3. Verify web build artifacts
  const webIndexHtml = path.join(WEB_DIST, 'index.html');
  if (!fs.existsSync(webIndexHtml)) {
    throw new Error(`Web build index.html missing at ${webIndexHtml}`);
  }
  console.log('✓ Web dashboard dist output verified');

  // 4. Verify manifest security in plugin dist
  const distManifestPath = path.join(PLUGIN_DIST, 'manifest.json');
  checkManifestSecurity(distManifestPath);

  // 5. Verify no "process.env" in plugin distribution
  console.log('Checking for unbundled process.env references in extension...');
  checkNoProcessEnvInDist(PLUGIN_DIST);
  console.log('✓ Zero process.env references in plugin bundles');

  // 6. Scan distribution assets for leaked secrets
  console.log('Scanning build artifacts for forbidden secrets...');
  checkDirectoryForSecrets(WEB_DIST);
  checkDirectoryForSecrets(PLUGIN_DIST);
  console.log('✓ No hardcoded credentials detected in distribution bundles');

  console.log('🎉 Release check passed successfully! All assets are valid, secure, and ready for deployment.');
}

main().catch((err) => {
  console.error('❌ Release check failed:', err.message);
  process.exit(1);
});
