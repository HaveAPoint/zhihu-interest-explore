/**
 * Regression tests for tree-service bugs found in third-batch review.
 * Tests run with fake-indexeddb (no real browser/DB needed).
 *
 * Covered:
 *  T-REG-1: Stale followup response must not revive a deleted tree
 *  T-REG-2: classify routes guest→/guest/classify, logged-in→/articles/resolve (+Authorization)
 *  T-REG-3: classify failure is NOT cached; next resolve retries
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginStorageRepository } from '../../plugin/src/storage/indexeddb-repo.js';
import { LocalTreeService } from '../../plugin/src/background/tree-service.js';
import type { LocalTree, Article } from '@zhihu-explore/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: crypto.randomUUID(),
    uid: 'guest:default',
    zhihu_id: 'zh-001',
    url: 'https://zhuanlan.zhihu.com/p/123',
    title: 'Test Article',
    tags: ['ai'],
    lead: 'A test article about AI agents.',
    content_text: 'Full content text of the article.',
    discipline_slug: 'agent-app-dev',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTree(articleId: string, overrides: Partial<LocalTree> = {}): LocalTree {
  const rootNodeId = crypto.randomUUID();
  const treeId = crypto.randomUUID();
  return {
    id: treeId,
    root_node_id: rootNodeId,
    uid: 'guest:default',
    article_id: articleId,
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: 'Some paragraph text',
    anchor_highlight: 'paragraph',
    version: 1,
    nodes: [
      {
        id: rootNodeId,
        tree_id: treeId,
        parent_id: null,
        highlight_text: 'paragraph',
        question_text: 'What is this?',
        title: 'Root Concept',
        answer_original: 'Some paragraph text',
        answer_extra: 'Root answer explanation.',
        sources: [],
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const SYNC_META = (partition: string) => ({
  partition: partition as any,
  cloudState: 'never_created' as const,
  ackVersion: null,
  dirty: true,
  pendingDelete: false,
  createSeq: null,
});

// ---------------------------------------------------------------------------
// T-REG-1: Stale followup response must not revive a deleted tree
// ---------------------------------------------------------------------------

describe('T-REG-1: stale followup after tree deletion', () => {
  it('discards response and throws STALE_RESPONSE when tree deleted mid-flight', async () => {
    const repo = new PluginStorageRepository(`db-stale-${crypto.randomUUID()}`);
    const article = makeArticle();
    const tree = makeTree(article.id);
    const partition = 'guest:default';

    await repo.saveArticle(partition, article);
    await repo.saveTreeAtomic(partition, tree, SYNC_META(partition));

    const mockFetch = vi.fn(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/nodes')) {
        // Delete tree while HTTP is "in-flight"
        await repo.deleteTreeAtomic(partition, tree.id, tree.root_node_id);
        return {
          ok: true, status: 200,
          json: async () => ({ data: { title: 'Late', extra: 'Too late.', sources: [] } }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', mockFetch);

    const service = new LocalTreeService(repo, partition, 'http://localhost:9000', async () => null);

    await expect(service.addFollowupNode({
      tree_id: tree.id,
      parent_id: tree.root_node_id,
      highlight_text: 'paragraph',
      question_text: 'Follow?',
    })).rejects.toThrow('STALE_RESPONSE');

    // Tree must remain deleted
    expect(await repo.getTree(partition, tree.id)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('discards response and throws STALE_RESPONSE when parent pruned mid-flight', async () => {
    const repo = new PluginStorageRepository(`db-prune-${crypto.randomUUID()}`);
    const article = makeArticle();
    const baseTree = makeTree(article.id);
    const partition = 'guest:default';
    const childId = crypto.randomUUID();

    const treeWithChild: LocalTree = {
      ...baseTree, version: 2,
      nodes: [...baseTree.nodes, {
        id: childId, tree_id: baseTree.id, parent_id: baseTree.root_node_id,
        highlight_text: 'child', question_text: 'Child Q', title: 'Child',
        answer_original: 'Root answer explanation.',
        answer_extra: 'Child answer.', sources: [],
        created_at: new Date().toISOString(),
      }],
    };

    await repo.saveArticle(partition, article);
    await repo.saveTreeAtomic(partition, treeWithChild, SYNC_META(partition));

    const mockFetch = vi.fn(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/nodes')) {
        // Prune child while in-flight
        const pruned: LocalTree = {
          ...treeWithChild, version: 3,
          nodes: treeWithChild.nodes.filter((n) => n.id !== childId),
        };
        await repo.saveTreeAtomic(partition, pruned, SYNC_META(partition));
        return {
          ok: true, status: 200,
          json: async () => ({ data: { title: 'Orphan', extra: 'Orphaned.', sources: [] } }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', mockFetch);

    const service = new LocalTreeService(repo, partition, 'http://localhost:9000', async () => null);

    await expect(service.addFollowupNode({
      tree_id: treeWithChild.id,
      parent_id: childId,
      highlight_text: 'child',
      question_text: 'Grandchild Q',
    })).rejects.toThrow('STALE_RESPONSE');

    // Tree must still exist but no new node added
    const stored = await repo.getTree(partition, treeWithChild.id);
    expect(stored).not.toBeNull();
    expect(stored!.nodes.some((n) => n.question_text === 'Grandchild Q')).toBe(false);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// T-REG-2: classify routing by auth state
// ---------------------------------------------------------------------------

describe('T-REG-2: classify routes by auth state', () => {
  it('guest (no token) calls /guest/classify without Authorization', async () => {
    const captured: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: RequestInit) => {
      captured.push({ url, headers: (opts?.headers ?? {}) as Record<string, string> });
      if (url.includes('/guest/classify')) {
        return { ok: true, status: 200, json: async () => ({ data: { slug: 'agent-app-dev' } }) } as unknown as Response;
      }
      throw new Error(`Unexpected: ${url}`);
    }));

    const repo = new PluginStorageRepository(`db-gc-${crypto.randomUUID()}`);
    const svc = new LocalTreeService(repo, 'guest:default', 'http://localhost:9000', async () => null);
    await svc.resolveLocalArticle({ zhihu_id: 'zh-g1', url: 'https://zhuanlan.zhihu.com/p/1', title: 'T', tags: [], lead: 'L', content_text: 'C' });

    const req = captured.find((r) => r.url.includes('/guest/classify'));
    expect(req).toBeDefined();
    expect(req!.headers['Authorization']).toBeUndefined();
    expect(captured.find((r) => r.url.includes('/articles/resolve'))).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('logged-in user calls /articles/resolve with Authorization: Bearer <token>', async () => {
    const TOKEN = 'device-token-xyz';
    const captured: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: RequestInit) => {
      captured.push({ url, headers: (opts?.headers ?? {}) as Record<string, string> });
      if (url.includes('/articles/resolve')) {
        return { ok: true, status: 200, json: async () => ({ data: { id: crypto.randomUUID(), discipline_slug: 'cognitive-psychology' } }) } as unknown as Response;
      }
      throw new Error(`Unexpected: ${url}`);
    }));

    const repo = new PluginStorageRepository(`db-li-${crypto.randomUUID()}`);
    const svc = new LocalTreeService(repo, 'uid:u1', 'http://localhost:9000', async () => TOKEN);
    await svc.resolveLocalArticle({ zhihu_id: 'zh-l1', url: 'https://zhuanlan.zhihu.com/p/2', title: 'T2', tags: [], lead: 'L2', content_text: 'C2' });

    const req = captured.find((r) => r.url.includes('/articles/resolve'));
    expect(req).toBeDefined();
    expect(req!.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(captured.find((r) => r.url.includes('/guest/classify'))).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// T-REG-3: classify failure NOT cached — retried on next resolve
// ---------------------------------------------------------------------------

describe('T-REG-3: classify failure is not cached', () => {
  it('throws and does not persist article when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));

    const repo = new PluginStorageRepository(`db-err1-${crypto.randomUUID()}`);
    const svc = new LocalTreeService(repo, 'guest:default', 'http://localhost:9000', async () => null);
    const input = { zhihu_id: 'zh-r1', url: 'https://zhuanlan.zhihu.com/p/3', title: 'T3', tags: [], lead: 'L3', content_text: 'C3' };

    await expect(svc.resolveLocalArticle(input)).rejects.toThrow('classification failed');
    expect(await repo.getArticleByZhihuId('guest:default', 'zh-r1')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('succeeds on retry after server recovers', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls++;
      if (calls === 1) throw new Error('ECONNREFUSED');
      return { ok: true, status: 200, json: async () => ({ data: { slug: 'distributed-systems' } }) } as unknown as Response;
    }));

    const repo = new PluginStorageRepository(`db-retry-${crypto.randomUUID()}`);
    const svc = new LocalTreeService(repo, 'guest:default', 'http://localhost:9000', async () => null);
    const input = { zhihu_id: 'zh-r2', url: 'https://zhuanlan.zhihu.com/p/4', title: 'T4', tags: [], lead: 'L4', content_text: 'C4' };

    await expect(svc.resolveLocalArticle(input)).rejects.toThrow('classification failed');
    const article = await svc.resolveLocalArticle(input);
    expect(article.discipline_slug).toBe('distributed-systems');
    const stored = await repo.getArticleByZhihuId('guest:default', 'zh-r2');
    expect(stored!.discipline_slug).toBe('distributed-systems');
    vi.unstubAllGlobals();
  });

  it('re-classifies articles stored with null discipline on next resolve', async () => {
    const repo = new PluginStorageRepository(`db-reclass-${crypto.randomUUID()}`);
    const partition = 'guest:default';
    const article = makeArticle({ zhihu_id: 'zh-rc1', discipline_slug: null });
    await repo.saveArticle(partition, article);

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/guest/classify')) {
        return { ok: true, status: 200, json: async () => ({ data: { slug: 'agent-app-dev' } }) } as unknown as Response;
      }
      throw new Error(`Unexpected: ${url}`);
    }));

    const svc = new LocalTreeService(repo, partition, 'http://localhost:9000', async () => null);
    const resolved = await svc.resolveLocalArticle({ zhihu_id: 'zh-rc1', url: article.url, title: article.title, tags: article.tags, lead: article.lead, content_text: article.content_text });

    expect(resolved.discipline_slug).toBe('agent-app-dev');
    const stored = await repo.getArticleByZhihuId(partition, 'zh-rc1');
    expect(stored!.discipline_slug).toBe('agent-app-dev');
    vi.unstubAllGlobals();
  });
});
