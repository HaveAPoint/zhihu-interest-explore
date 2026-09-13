import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../server/src/app.js';
import { agentArticleFixture } from '@zhihu-explore/fixtures';

describe('Server API Integration Tests (app.inject)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  describe('Health and System Routes', () => {
    it('GET /health returns 200 with ok status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.status).toBe('ok');
      expect(json.data.version).toBe('0.0.1');
      expect(json.request_id).toBeDefined();
    });
  });

  describe('Authentication and User Profile', () => {
    it('GET /me without credentials returns 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /me with test injection returns authenticated user profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: {
          'x-test-uid': 'test-user-123',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.uid).toBe('test-user-123');
    });
  });

  describe('Guest Endpoints', () => {
    it('POST /guest/session issues guest token with quota', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/guest/session',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.guest_token).toMatch(/^guest_/);
      expect(json.data.quota).toBeGreaterThan(0);
    });

    it('POST /guest/classify performs stateless classification', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/guest/classify',
        payload: {
          title: agentArticleFixture.title,
          tags: agentArticleFixture.tags,
          lead: '关于大语言模型智能体应用开发',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.slug).toBe('agent-app-dev');
    });

    it('POST /guest/root performs stateless root generation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/guest/root',
        payload: {
          article: agentArticleFixture,
          tree: { nodes: [] },
          highlight: '工具调用（Function Calling）',
          question: '它是如何运行的？',
          historySummary: '',
          disciplineSkeleton: [
            {
              id: 'agent-app-dev/tool-calling',
              parent_id: 'agent-app-dev/root',
              title: '工具调用',
              aliases: [],
              definition: '工具调用定义',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.title).toBeDefined();
      expect(json.data.extra).toBeDefined();
      expect(json.data.candidates).toBeDefined();
    });

    it('POST /guest/followup performs stateless followup generation without candidates', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/guest/followup',
        payload: {
          article: agentArticleFixture,
          tree: { nodes: [] },
          highlight: '结构化参数解析',
          question: '有什么校验方法？',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.title).toBeDefined();
      expect(json.data.extra).toBeDefined();
      expect(json.data.candidates).toBeUndefined();
    });
  });

  describe('Tree generate_only mode', () => {
    it('POST /trees with mode=generate_only returns generation without DB write', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/trees',
        payload: {
          tree_id: '550e8400-e29b-41d4-a716-446655440001',
          root_node_id: '550e8400-e29b-41d4-a716-446655440002',
          article_id: '550e8400-e29b-41d4-a716-446655440003',
          anchor_paragraph: '这是引文段落。',
          anchor_highlight: '引文高亮',
          question_text: '问题',
          mode: 'generate_only',
          local_article: agentArticleFixture,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.tree_id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(json.data.title).toBeDefined();
      expect(json.data.extra).toBeDefined();
      expect(json.data.candidates).toBeDefined();
    });

    it('POST /trees/:id/nodes with mode=generate_only returns followup without DB write', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/trees/550e8400-e29b-41d4-a716-446655440001/nodes',
        payload: {
          node_id: '550e8400-e29b-41d4-a716-446655440004',
          parent_id: '550e8400-e29b-41d4-a716-446655440002',
          highlight_text: '回答中的高亮',
          question_text: '追问',
          mode: 'generate_only',
          local_article: agentArticleFixture,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.node_id).toBe('550e8400-e29b-41d4-a716-446655440004');
      expect(json.data.title).toBeDefined();
      expect(json.data.extra).toBeDefined();
      expect(json.data.candidates).toBeUndefined();
    });
  });
});
