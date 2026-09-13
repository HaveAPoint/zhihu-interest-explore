// Extension bridge message types (plugin ↔ web)

import { z } from 'zod';

export const BridgeActionSchema = z.enum([
  'HELLO',
  'GET_SNAPSHOT',
  'GET_TREE',
  'GET_PAIRING_CHALLENGE',
  'PAIR_SESSION',
  'LOGOUT',
  'APPLY_TREE_ACTION',
  'CREATE_PERSONAL_NODE',
  'SYNC_NOW',
]);
export type BridgeAction = z.infer<typeof BridgeActionSchema>;

export const BridgeProtocolVersion = 1;

export const BridgeRequestSchema = z.object({
  action: BridgeActionSchema,
  version: z.literal(BridgeProtocolVersion),
  payload: z.unknown(),
});
export type BridgeRequest = z.infer<typeof BridgeRequestSchema>;

export const BridgeResponseSchema = z.object({
  success: z.boolean(),
  action: BridgeActionSchema,
  version: z.literal(BridgeProtocolVersion),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
export type BridgeResponse = z.infer<typeof BridgeResponseSchema>;

// --- Snapshot (GET_SNAPSHOT response) ---

export const SnapshotTreeSummarySchema = z.object({
  tree_id: z.string().uuid(),
  root_node_id: z.string().uuid(),
  article_id: z.string().uuid(),
  discipline_slug: z.string().nullable(),
  global_node_id: z.string().nullable(),
  root_title: z.string(),
  article_title: z.string(),
  version: z.number().int().positive(),
  node_count: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SnapshotSchema = z.object({
  partition: z.string(),
  trees: z.array(SnapshotTreeSummarySchema),
  personal_nodes: z.array(z.object({
    id: z.string().uuid(),
    discipline_slug: z.string(),
    parent_id: z.string(),
    title: z.string(),
  })),
  logged_in: z.boolean(),
  uid: z.string().nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
