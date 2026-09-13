// Sync types per §4.4

import { z } from 'zod';
import { UUIDSchema, VersionSchema } from './ids.js';
import { LocalTreeSchema } from './tree.js';

// --- Local sync metadata (plugin-side only) ---

export const PartitionSchema = z.union([
  z.string().startsWith('guest:'),
  z.string().startsWith('uid:'),
]);

export const CloudStateSchema = z.enum(['never_created', 'create_inflight', 'confirmed']);

export const LocalSyncMetaSchema = z.object({
  partition: PartitionSchema,
  cloudState: CloudStateSchema,
  ackVersion: z.number().int().nullable(),
  dirty: z.boolean(),
  pendingDelete: z.boolean(),
  createSeq: z.number().int().nullable(),
});
export type LocalSyncMeta = z.infer<typeof LocalSyncMetaSchema>;

// --- Sync manifest entry (from server) ---

export const SyncManifestEntrySchema = z.object({
  root_id: UUIDSchema,
  tree_id: UUIDSchema,
  version: VersionSchema,
  hash: z.string(),
});
export type SyncManifestEntry = z.infer<typeof SyncManifestEntrySchema>;

export const SyncManifestResponseSchema = z.object({
  trees: z.array(SyncManifestEntrySchema),
  last_create_seq: z.number().int().nullable().optional(), // only for device sessions
});
export type SyncManifestResponse = z.infer<typeof SyncManifestResponseSchema>;

// --- Sync create request ---

export const SyncCreateRequestSchema = z.object({
  snapshot: LocalTreeSchema,
  device_create_seq: z.number().int().positive(),
});

// --- Sync update request ---

export const SyncUpdateRequestSchema = z.object({
  snapshot: LocalTreeSchema,
  base_version: VersionSchema,
  base_hash: z.string(),
});

// --- Sync update response ---

export const SyncUpdateResultSchema = z.enum(['applied', 'cloud_newer', 'aligned', 'conflict']);
export type SyncUpdateResult = z.infer<typeof SyncUpdateResultSchema>;

// --- Normalize tree for hash computation ---

/**
 * Compute a normalized hash for a tree's business content.
 * Excludes sync time, UI state. Nodes sorted by ID.
 */
export function normalizeTreeForHash(tree: {
  id: string;
  root_node_id: string;
  discipline_slug: string | null;
  global_node_id: string | null;
  match_candidates: unknown[];
  anchor_paragraph: string;
  anchor_highlight: string;
  version: number;
  nodes: Array<{
    id: string;
    parent_id: string | null;
    highlight_text: string;
    question_text: string;
    title: string;
    answer_original: string;
    answer_extra: string;
    sources: unknown[];
  }>;
}): string {
  const sortedNodes = [...tree.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = JSON.stringify({
    id: tree.id,
    root_node_id: tree.root_node_id,
    discipline_slug: tree.discipline_slug,
    global_node_id: tree.global_node_id,
    match_candidates: tree.match_candidates,
    anchor_paragraph: tree.anchor_paragraph,
    anchor_highlight: tree.anchor_highlight,
    version: tree.version,
    nodes: sortedNodes.map(n => ({
      id: n.id,
      parent_id: n.parent_id,
      highlight_text: n.highlight_text,
      question_text: n.question_text,
      title: n.title,
      answer_original: n.answer_original,
      answer_extra: n.answer_extra,
      sources: n.sources,
    })),
  });

  // Simple hash - sufficient for comparison only
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}
