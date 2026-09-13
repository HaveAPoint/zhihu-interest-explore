// Route: /trees
// Complies with 作者本人开发计划 §4.3, §4.5, T10

import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../repositories/pg-client.js';
import { TreeRepository } from '../repositories/tree-repository.js';
import { generateRoot, generateFollowup } from '../../agent/index.js';
import {
  CreateTreeInputSchema,
  AddNodeInputSchema,
  PatchTreeInputSchema,
  PatchNodeTitleSchema,
  type LocalTree,
  type LocalNode,
  type SkeletonNode,
} from '@zhihu-explore/contracts';

export const treeRoutes: FastifyPluginAsync = async (app) => {
  const repo = new TreeRepository();

  // Get tree details with nodes
  app.get<{ Params: { id: string } }>('/trees/:id', async (request, reply) => {
    const user = (request as any).user;
    const uid = user?.uid ?? 'guest:default';
    const { id } = request.params;

    const tree = await repo.getTree(id, uid);
    if (!tree) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Tree "${id}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    return {
      data: tree,
      request_id: crypto.randomUUID(),
    };
  });

  // Create root node / tree (generate_only or persist)
  app.post<{ Body: unknown }>('/trees', async (request, reply) => {
    const user = (request as any).user;
    const uid = user?.uid ?? 'guest:default';

    const parsed = CreateTreeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const {
      tree_id,
      root_node_id,
      article_id,
      anchor_paragraph,
      anchor_highlight,
      question_text,
      mode,
      local_article,
      history_summary,
    } = parsed.data;

    // Get article info (either from DB or local_article)
    let articleInfo = local_article;
    let disciplineSlug = 'agent-app-dev';
    if (!articleInfo) {
      const artRes = await query(
        'SELECT title, tags, url, content_text, discipline_slug FROM articles WHERE id = $1',
        [article_id]
      );
      if (artRes.rows.length > 0) {
        const row = artRes.rows[0];
        articleInfo = {
          title: row.title,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
          url: row.url,
          content_text: row.content_text,
        };
        disciplineSlug = row.discipline_slug ?? 'agent-app-dev';
      } else {
        articleInfo = {
          title: '未知文章',
          tags: [],
          url: '',
          content_text: anchor_paragraph,
        };
      }
    }

    // Load skeleton for discipline
    let skeleton: SkeletonNode[] = [];
    try {
      const discTree = await repo.getDisciplineTree(disciplineSlug as any, uid);
      skeleton = discTree.nodes.map((n) => ({
        id: n.id,
        parent_id: n.parent_id,
        title: n.title,
        aliases: n.aliases,
        definition: n.definition,
      }));
    } catch {
      const discPath = path.resolve(process.cwd(), `disciplines/${disciplineSlug}.json`);
      if (fs.existsSync(discPath)) {
        const fileData = JSON.parse(fs.readFileSync(discPath, 'utf-8'));
        skeleton = (fileData.nodes ?? []).map((n: any) => ({
          id: n.id,
          parent_id: n.parent_id,
          title: n.title,
          aliases: n.aliases ?? [],
          definition: n.definition ?? '',
        }));
      }
    }

    // Call Agent
    const agentOutput = await generateRoot({
      article: articleInfo,
      tree: { nodes: [] },
      highlight: anchor_highlight,
      question: question_text,
      historySummary: history_summary,
      disciplineSkeleton: skeleton,
    });

    // If generate_only: return generation output immediately without DB write
    if (mode === 'generate_only') {
      return {
        data: {
          tree_id,
          root_node_id,
          ...agentOutput,
        },
        request_id: crypto.randomUUID(),
      };
    }

    // Persist mode: build LocalTree and insert via RPC
    const firstCandidate = agentOutput.candidates[0];
    const autoBindId = firstCandidate && firstCandidate.degree === 'exact' ? firstCandidate.node_id : null;

    const rootNode: LocalNode = {
      id: root_node_id,
      tree_id,
      parent_id: null,
      highlight_text: anchor_highlight,
      question_text,
      title: agentOutput.title,
      answer_original: anchor_paragraph,
      answer_extra: agentOutput.extra,
      sources: agentOutput.sources,
      created_at: new Date().toISOString(),
    };

    const localTree: LocalTree = {
      id: tree_id,
      root_node_id,
      uid,
      article_id,
      discipline_slug: disciplineSlug as any,
      global_node_id: autoBindId,
      match_candidates: agentOutput.candidates.map((c: any) => ({
        global_node_id: c.node_id,
        title: skeleton.find((s) => s.id === c.node_id)?.title ?? c.node_id,
        degree: c.degree,
        reason: c.reason,
      })),
      anchor_paragraph,
      anchor_highlight,
      version: 1,
      nodes: [rootNode],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await query('SELECT rpc_create_tree($1, $2)', [uid, JSON.stringify(localTree)]);

    return {
      data: localTree,
      request_id: crypto.randomUUID(),
    };
  });

  // Add followup node
  app.post<{ Params: { id: string }; Body: unknown }>('/trees/:id/nodes', async (request, reply) => {
    const user = (request as any).user;
    const uid = user?.uid ?? 'guest:default';
    const treeId = request.params.id;

    const parsed = AddNodeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { node_id, parent_id, highlight_text, question_text, mode, local_article } = parsed.data;

    let tree: LocalTree | null = null;
    try {
      tree = await repo.getTree(treeId, uid);
    } catch {
      // Ignore if DB not reachable in generate_only mode
    }

    if (!tree && mode !== 'generate_only') {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Tree "${treeId}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parentNode = tree?.nodes.find((n) => n.id === parent_id);
    const answerOriginal = parentNode ? parentNode.answer_extra : highlight_text;

    // Call Agent followup
    const agentOutput = await generateFollowup({
      article: local_article ?? {
        title: '',
        tags: [],
        url: '',
        content_text: highlight_text,
      },
      tree: {
        nodes: (tree?.nodes ?? []).map((n) => ({
          id: n.id,
          parent_id: n.parent_id,
          title: n.title,
          highlight_text: n.highlight_text,
          question_text: n.question_text,
          answer_extra: n.answer_extra,
          is_current: n.id === parent_id,
        })),
      },
      highlight: highlight_text,
      question: question_text,
    });

    if (mode === 'generate_only') {
      return {
        data: {
          node_id,
          parent_id,
          ...agentOutput,
        },
        request_id: crypto.randomUUID(),
      };
    }

    const newNode: LocalNode = {
      id: node_id,
      tree_id: treeId,
      parent_id,
      highlight_text,
      question_text,
      title: agentOutput.title,
      answer_original: answerOriginal,
      answer_extra: agentOutput.extra,
      sources: agentOutput.sources,
      created_at: new Date().toISOString(),
    };

    const updatedTree: LocalTree = {
      ...tree!,
      version: tree!.version + 1,
      nodes: [...tree!.nodes, newNode],
      updated_at: new Date().toISOString(),
    };

    await query('SELECT rpc_replace_tree($1, $2, $3)', [
      uid,
      JSON.stringify(updatedTree),
      tree!.version,
    ]);

    return {
      data: newNode,
      request_id: crypto.randomUUID(),
    };
  });

  // Delete node or subtree
  app.delete<{ Params: { id: string; nodeId: string } }>('/trees/:id/nodes/:nodeId', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { id: treeId, nodeId } = request.params;

    const res = await query<{ rpc_delete_node_or_tree: any }>(
      'SELECT rpc_delete_node_or_tree($1, $2, $3)',
      [user.uid, treeId, nodeId]
    );

    return {
      data: res.rows[0]?.rpc_delete_node_or_tree,
      request_id: crypto.randomUUID(),
    };
  });

  // Patch tree binding
  app.patch<{ Params: { id: string }; Body: unknown }>('/trees/:id/bind', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = PatchTreeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { id } = request.params;
    const { global_node_id } = parsed.data;

    const res = await query(
      `UPDATE local_trees
       SET global_node_id = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 AND uid = $3
       RETURNING id, global_node_id, version`,
      [global_node_id, id, user.uid]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Tree "${id}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    return {
      data: res.rows[0],
      request_id: crypto.randomUUID(),
    };
  });

  // Patch node title
  app.patch<{ Params: { id: string; nodeId: string }; Body: unknown }>('/trees/:id/nodes/:nodeId', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = PatchNodeTitleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { id: treeId, nodeId } = request.params;
    const { title } = parsed.data;

    // Verify tree belongs to user
    const treeCheck = await query(
      'SELECT id FROM local_trees WHERE id = $1 AND uid = $2',
      [treeId, user.uid]
    );
    if (treeCheck.rows.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Tree "${treeId}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    await query(
      'UPDATE local_nodes SET title = $1 WHERE id = $2 AND tree_id = $3',
      [title, nodeId, treeId]
    );

    const updateTree = await query(
      'UPDATE local_trees SET version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING version',
      [treeId]
    );

    return {
      data: {
        node_id: nodeId,
        title,
        tree_version: updateTree.rows[0]?.version,
      },
      request_id: crypto.randomUUID(),
    };
  });
};
