// Route: /disciplines
// Complies with 作者本人开发计划 §4.7, T08

import type { FastifyPluginAsync } from 'fastify';
import { TreeRepository } from '../repositories/tree-repository.js';
import {
  DisciplineSlugSchema,
  CreatePersonalNodeInputSchema,
} from '@zhihu-explore/contracts';

export const disciplineRoutes: FastifyPluginAsync = async (app) => {
  const repo = new TreeRepository();

  // List disciplines (public)
  app.get('/disciplines', async () => {
    const list = await repo.listDisciplines();
    return {
      data: list,
      request_id: crypto.randomUUID(),
    };
  });

  // Get full tree for discipline
  app.get<{ Params: { slug: string } }>('/disciplines/:slug/tree', async (request, reply) => {
    const parsedSlug = DisciplineSlugSchema.safeParse(request.params.slug);
    if (!parsedSlug.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid discipline slug "${request.params.slug}"`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const uid = (request as any).user?.uid ?? 'guest:anonymous';
    const tree = await repo.getDisciplineTree(parsedSlug.data, uid);

    return {
      data: tree,
      request_id: crypto.randomUUID(),
    };
  });

  // Create personal supplement node (requires authentication)
  app.post<{ Params: { slug: string }; Body: unknown }>('/disciplines/:slug/nodes', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to create personal nodes',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsedSlug = DisciplineSlugSchema.safeParse(request.params.slug);
    if (!parsedSlug.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid discipline slug "${request.params.slug}"`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsedBody = CreatePersonalNodeInputSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsedBody.error.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { parent_id, title, definition, id } = parsedBody.data;

    const created = await repo.createPersonalNode(
      user.uid,
      parsedSlug.data,
      parent_id,
      title,
      definition,
      id
    );

    return {
      data: created,
      request_id: crypto.randomUUID(),
    };
  });
};
