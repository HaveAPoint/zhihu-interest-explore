// Route: /sync
// Complies with 作者本人开发计划 §4.4, §4.7, T15

import type { FastifyPluginAsync } from 'fastify';
import { query } from '../repositories/pg-client.js';
import {
  SyncCreateRequestSchema,
  SyncUpdateRequestSchema,
  normalizeTreeForHash,
  type SyncManifestEntry,
} from '@zhihu-explore/contracts';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  // GET /sync/trees: Full manifest for current user
  app.get('/sync/trees', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for sync',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    // 1. Fetch all trees for this uid
    const treesRes = await query<{
      root_node_id: string;
      id: string;
      version: number;
      content_hash: string;
    }>(
      `SELECT root_node_id, id, version, content_hash
       FROM local_trees
       WHERE uid = $1
       ORDER BY created_at ASC`,
      [user.uid]
    );

    const trees: SyncManifestEntry[] = treesRes.rows.map((row) => ({
      root_id: row.root_node_id,
      tree_id: row.id,
      version: row.version,
      hash: row.content_hash,
    }));

    // 2. Fetch device last_create_seq if device session
    let lastCreateSeq: number | null = null;
    if (user.deviceId) {
      const devRes = await query<{ last_create_seq: number }>(
        'SELECT last_create_seq FROM sync_devices WHERE uid = $1 AND device_id = $2',
        [user.uid, user.deviceId]
      );
      if (devRes.rows.length > 0) {
        lastCreateSeq = devRes.rows[0]!.last_create_seq;
      }
    }

    return {
      data: {
        trees,
        last_create_seq: lastCreateSeq,
      },
      request_id: crypto.randomUUID(),
    };
  });

  // POST /sync/trees: Create tree with sequential device idempotency
  app.post<{ Body: unknown }>('/sync/trees', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for sync creation',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const deviceId = user.deviceId || 'default-device';

    const parsed = SyncCreateRequestSchema.safeParse(request.body);
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

    const { snapshot, device_create_seq } = parsed.data;

    // Calculate content hash
    const hash = normalizeTreeForHash(snapshot as any);
    const treePayload = {
      ...snapshot,
      content_hash: hash,
      creation_device_id: deviceId,
      create_seq: device_create_seq,
    };

    const res = await query<{ rpc_sync_create_tree: any }>(
      'SELECT rpc_sync_create_tree($1, $2, $3, $4)',
      [user.uid, deviceId, device_create_seq, JSON.stringify(treePayload)]
    );

    const result = res.rows[0]?.rpc_sync_create_tree;

    return {
      data: result,
      request_id: crypto.randomUUID(),
    };
  });

  // PUT /sync/trees/:rootId: Update existing tree
  app.put<{ Params: { rootId: string }; Body: unknown }>('/sync/trees/:rootId', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for sync update',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const { rootId } = request.params;
    const isDevice = !!user.deviceId;

    const parsed = SyncUpdateRequestSchema.safeParse(request.body);
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

    const { snapshot, base_version, base_hash } = parsed.data;
    const hash = normalizeTreeForHash(snapshot as any);
    const treePayload = {
      ...snapshot,
      content_hash: hash,
    };

    const res = await query<{ rpc_sync_update_tree: any }>(
      'SELECT rpc_sync_update_tree($1, $2, $3, $4, $5, $6)',
      [user.uid, isDevice, rootId, base_version, base_hash, JSON.stringify(treePayload)]
    );

    const result = res.rows[0]?.rpc_sync_update_tree;

    if (result?.result === 'not_found') {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Tree with root "${rootId}" not found`,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    if (result?.result === 'conflict') {
      return reply.status(409).send({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Conflict detected: cloud version has diverged',
          retryable: false,
        },
        data: result,
        request_id: crypto.randomUUID(),
      });
    }

    return {
      data: result,
      request_id: crypto.randomUUID(),
    };
  });
};
