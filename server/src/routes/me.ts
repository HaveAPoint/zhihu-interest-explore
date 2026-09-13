// Route: /me
// Complies with 作者本人开发计划 §4.7

import type { FastifyPluginAsync } from 'fastify';
import { query } from '../repositories/pg-client.js';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request, reply) => {
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

    let profile = {
      uid: user.uid,
      name: `User_${user.uid.slice(0, 6)}`,
      avatar_url: null,
    };

    try {
      const userRes = await query<{ uid: string; name: string | null; avatar_url: string | null }>(
        'SELECT uid, name, avatar_url FROM users WHERE uid = $1',
        [user.uid]
      );

      if (userRes.rows.length > 0 && userRes.rows[0]) {
        profile = userRes.rows[0] as any;
      }
    } catch (err) {
      // Return default profile when PG is not connected (e.g. offline testing)
    }

    return {
      data: profile,
      request_id: crypto.randomUUID(),
    };
  });
};
