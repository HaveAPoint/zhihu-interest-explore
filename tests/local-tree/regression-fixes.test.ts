import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDist = path.resolve(__dirname, '../../plugin/dist');

describe('Regression Unit Tests: Production Security & Zero Localhost Guard', () => {
  it('P0: plugin/dist/content.js and background.js must contain zero hardcoded localhost defaults', () => {
    const contentJsPath = path.join(pluginDist, 'content.js');
    const backgroundJsPath = path.join(pluginDist, 'background.js');

    expect(fs.existsSync(contentJsPath), 'content.js must exist').toBe(true);
    expect(fs.existsSync(backgroundJsPath), 'background.js must exist').toBe(true);

    const contentCode = fs.readFileSync(contentJsPath, 'utf8');
    const backgroundCode = fs.readFileSync(backgroundJsPath, 'utf8');

    // Check that neither file contains un-substituted hardcoded localhost defaults
    // from tree-service or network-client constructors.
    expect(contentCode).not.toContain('http://localhost:9000/api');
    expect(contentCode).not.toContain("this.apiOrigin = 'http://localhost:9000'");
    expect(backgroundCode).not.toContain("apiOrigin = 'http://localhost:9000'");
  });
});
