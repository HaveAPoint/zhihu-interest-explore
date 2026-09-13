// Route: /articles
// Complies with 作者本人开发计划 §4.1, §4.5, T09

import type { FastifyPluginAsync } from 'fastify';
import { query, withTransaction } from '../repositories/pg-client.js';
import { classifyArticle } from '../../agent/index.js';
import {
  ResolveArticleInputSchema,
  DisciplineSlugSchema,
  type Article,
} from '@zhihu-explore/contracts';
import { z } from 'zod';

const PatchDisciplineSchema = z.object({
  discipline_slug: DisciplineSlugSchema.nullable(),
});

export const articleRoutes: FastifyPluginAsync = async (app) => {
  // Resolve article idempotently
  app.post<{ Body: unknown }>('/articles/resolve', async (request, reply) => {
    const user = (request as any).user;
    const uid = user?.uid ?? 'guest:default';

    const parsed = ResolveArticleInputSchema.safeParse(request.body);
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

    const { article_id, zhihu_id, url, title, tags, lead, content_text } = parsed.data;

    // Check if article already exists for this (uid, zhihu_id)
    const existing = await query<Article>(
      'SELECT id, uid, zhihu_id, url, title, tags, lead, discipline_slug, created_at, updated_at FROM articles WHERE uid = $1 AND zhihu_id = $2',
      [uid, zhihu_id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0]!;
      return {
        data: {
          ...row,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags as any) : row.tags,
        },
        request_id: crypto.randomUUID(),
      };
    }

    // First time resolve: classify article
    const classifyRes = await classifyArticle({ title, tags, lead });
    const slug = classifyRes.slug;

    // Insert article
    const insertRes = await query<Article>(
      `INSERT INTO articles (id, uid, zhihu_id, url, title, tags, lead, content_text, discipline_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, uid, zhihu_id, url, title, tags, lead, discipline_slug, created_at, updated_at`,
      [article_id, uid, zhihu_id, url, title, JSON.stringify(tags), lead, content_text, slug]
    );

    const created = insertRes.rows[0]!;
    return {
      data: {
        ...created,
        tags: typeof created.tags === 'string' ? JSON.parse(created.tags as any) : created.tags,
      },
      request_id: crypto.randomUUID(),
    };
  });

  // Change article discipline (cascades to trees)
  app.patch<{ Params: { id: string }; Body: unknown }>('/articles/:id/discipline', async (request, reply) => {
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

    const { id } = request.params;
    const parsed = PatchDisciplineSchema.safeParse(request.body);
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

    const newSlug = parsed.data.discipline_slug;

    const result = await withTransaction(async (client) => {
      // 1. Lock and verify article
      const artRes = await client.query(
        'SELECT id FROM articles WHERE id = $1 AND uid = $2 FOR UPDATE',
        [id, user.uid]
      );
      if (artRes.rows.length === 0) {
        return null;
      }

      // 2. Update article
      await client.query(
        'UPDATE articles SET discipline_slug = $1, updated_at = NOW() WHERE id = $2',
        [newSlug, id]
      );

      // 3. Reset all trees of this article: clear global_node_id, clear match_candidates, version + 1
      const updateTreesRes = await client.query(
        `UPDATE local_trees
         SET discipline_slug = $1,
             global_node_id = NULL,
             match_candidates = '[]'::jsonb,
             version = version + 1,
             updated_at = NOW()
         WHERE article_id = $2 AND uid = $3
         RETURNING id, version`,
        [newSlug, id, user.uid]
      );

      return {
        article_id: id,
        discipline_slug: newSlug,
        affected_trees: updateTreesRes.rows,
      };
    });

    if (!result) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Article not found',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    return {
      data: result,
      request_id: crypto.randomUUID(),
    };
  });
};
