// Route: /nodes
// Complies with 作者本人开发计划 §4.7, T08

import type { FastifyPluginAsync } from 'fastify';
import { TreeRepository } from '../repositories/tree-repository.js';
import { PatchProficiencySchema } from '@zhihu-explore/contracts';

export const nodeRoutes: FastifyPluginAsync = async (app) => {
  const repo = new TreeRepository();

  // Get global node detail
  app.get<{ Params: { id: string } }>('/nodes/:id', async (request, reply) => {
    const { id } = request.params;
    const uid = (request as any).user?.uid ?? 'guest:anonymous';

    const detail = await repo.getNodeDetail(id, uid);
    if (!detail) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Node "${id}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    return {
      data: detail,
      request_id: crypto.randomUUID(),
    };
  });

  // Update proficiency for node (requires authentication)
  app.patch<{ Params: { id: string }; Body: unknown }>('/nodes/:id/proficiency', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to update proficiency',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsedBody = PatchProficiencySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Proficiency must be null or an integer from 0 to 5',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { id } = request.params;
    await repo.updateProficiency(user.uid, id, parsedBody.data.value);

    return {
      data: {
        id,
        proficiency: parsedBody.data.value,
      },
      request_id: crypto.randomUUID(),
    };
  });
};
