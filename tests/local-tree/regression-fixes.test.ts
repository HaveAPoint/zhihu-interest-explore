import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const pluginDist = path.resolve(__dirname, '../../plugin/dist');

describe('Regression Unit Tests: Production Security & Zero Localhost Guard', () => {
  it('P0 Guard 1: package-release.ts must use real CloudBase production domains, not dummy domains', () => {
    const pkgReleasePath = path.join(rootDir, 'scripts/package-release.ts');
    expect(fs.existsSync(pkgReleasePath)).toBe(true);

    const scriptContent = fs.readFileSync(pkgReleasePath, 'utf8');

    // Must NOT contain dummy domains
    expect(scriptContent).not.toContain('https://zhihu-explore-api.app');
    expect(scriptContent).not.toContain('https://zhihu-interest-explore.web.app');

    // Must contain real CloudBase production URLs matching web/.env.production
    expect(scriptContent).toContain('https://hackerson-d0g0z55d2fc446485.service.tcloudbase.com/api');
    expect(scriptContent).toContain('https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com');
  });

  it('P0 Guard 2: plugin/manifest.json externally_connectable and host_permissions must target real CloudBase domain', () => {
    const manifestPath = path.join(rootDir, 'plugin/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Must NOT contain legacy dummy domain
    const matches: string[] = manifest.externally_connectable?.matches || [];
    expect(matches).not.toContain('https://zhihu-explore.tcloudbaseapp.com/*');

    // Must contain real CloudBase web app URL
    expect(matches).toContain('https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/*');

    // Host permissions must cover tcloudbase API and web app
    const hostPerms: string[] = manifest.host_permissions || [];
    expect(hostPerms).toContain('https://*.tcloudbase.com/*');
    expect(hostPerms).toContain('https://*.tcloudbaseapp.com/*');
  });

  it('P0 Guard 3: Fresh RELEASE build must produce 0 occurrences of localhost across all dist files', () => {
    // Run an actual RELEASE build to test the pipeline deterministically
    execSync('node plugin/scripts/build-plugin.js', {
      cwd: rootDir,
      env: {
        ...process.env,
        RELEASE: 'true',
        API_ORIGIN: 'https://hackerson-d0g0z55d2fc446485.service.tcloudbase.com/api',
        APP_ORIGIN: 'https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com',
        NODE_ENV: 'production',
      },
    });

    const filesToScan = ['content.js', 'background.js', 'manifest.json'];
    for (const fname of filesToScan) {
      const fpath = path.join(pluginDist, fname);
      expect(fs.existsSync(fpath), `${fname} must exist after release build`).toBe(true);

      const content = fs.readFileSync(fpath, 'utf8');
      const localhostMatches = content.match(/localhost/gi) || [];
      const loopbackMatches = content.match(/127\.0\.0\.1/g) || [];

      expect(localhostMatches.length, `${fname} must contain 0 localhost occurrences in release`).toBe(0);
      expect(loopbackMatches.length, `${fname} must contain 0 127.0.0.1 occurrences in release`).toBe(0);
    }
  });
});
