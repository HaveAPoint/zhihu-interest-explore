import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LocalTreeMockServer } from './mock-api.js';

describe('LocalTreeMockServer (LT01)', () => {
  let server: LocalTreeMockServer;
  let origin: string;

  beforeAll(async () => {
    server = new LocalTreeMockServer();
    origin = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset();
  });

  it('handles guest classify and records request', async () => {
    const res = await fetch(`${origin}/guest/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', tags: ['ai'], lead: 'lead' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.slug).toBe('agent-app-dev');

    expect(server.recordedRequests).toHaveLength(1);
    expect(server.recordedRequests[0]?.path).toBe('/guest/classify');
    expect(server.recordedRequests[0]?.body.title).toBe('Test');
  });

  it('handles generateRoot via POST /trees', async () => {
    const res = await fetch(`${origin}/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tree_id: 'tree-1',
        anchor_highlight: 'Function Calling',
        mode: 'generate_only',
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toContain('Function');
    expect(json.data.candidates).toHaveLength(1);
  });

  it('handles generateFollowup via POST /trees/:id/nodes', async () => {
    const res = await fetch(`${origin}/trees/tree-1/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: 'node-2',
        highlight_text: 'JSON Schema',
        mode: 'generate_only',
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.extra).toContain('JSON Schema');
  });

  it('supports failNext error injection', async () => {
    server.failNext(503, 'Service unavailable during test');
    const res = await fetch(`${origin}/guest/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.message).toBe('Service unavailable during test');

    // Subsequent request should succeed again
    const okRes = await fetch(`${origin}/guest/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(okRes.status).toBe(200);
  });

  it('supports manual release of pending requests', async () => {
    server.setManualRelease(true);
    let resolved = false;

    const requestPromise = fetch(`${origin}/guest/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(() => {
      resolved = true;
    });

    // Verify it is suspended
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Release and verify it completes
    server.releaseAll();
    await requestPromise;
    expect(resolved).toBe(true);
  });
});
