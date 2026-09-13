// Skeleton (discipline tree) file format and pure validators.
//
// A skeleton file is a preset, authored-once global knowledge tree for one
// discipline. Node IDs are STABLE: once published they must never change,
// because LocalTree.global_node_id references them. Personal supplement nodes
// (is_personal) live in the database only and must never appear in these files.

import { z } from 'zod';
import { DisciplineSlugSchema, SkeletonNodeIdSchema } from '@zhihu-explore/contracts';
import type { DisciplineSlug, SkeletonNode } from '@zhihu-explore/contracts';

// --- File format ---

/**
 * One node inside `disciplines/{slug}.json`.
 *
 * `.strict()` is deliberate: an unknown key such as `is_personal` must fail
 * import rather than be silently stripped.
 */
export const SkeletonFileNodeSchema = z
  .object({
    id: SkeletonNodeIdSchema,
    parent_id: SkeletonNodeIdSchema.nullable(),
    title: z.string().min(1),
    aliases: z.array(z.string()),
    definition: z.string().min(1),
    sort_order: z.number().int().min(0),
  })
  .strict();
export type SkeletonFileNode = z.infer<typeof SkeletonFileNodeSchema>;

export const DisciplineFileSchema = z
  .object({
    major: z.string().min(1),
    name: z.string().min(1),
    slug: DisciplineSlugSchema,
    origin: z.literal('preset'),
    /** Where the structure came from (course / textbook TOC), for author review. */
    source_note: z.string().min(1),
    /**
     * `draft` = generated, not yet read line-by-line by the author.
     * Only `author_reviewed` may be called an authoritative framework.
     */
    review_status: z.enum(['draft', 'author_reviewed']),
    nodes: z.array(SkeletonFileNodeSchema).min(1),
  })
  .strict();
export type DisciplineFile = z.infer<typeof DisciplineFileSchema>;

export const DisciplineIndexEntrySchema = z
  .object({
    major: z.string().min(1),
    name: z.string().min(1),
    slug: DisciplineSlugSchema,
  })
  .strict();

export const DisciplineIndexSchema = z.array(DisciplineIndexEntrySchema).min(1);
export type DisciplineIndexEntry = z.infer<typeof DisciplineIndexEntrySchema>;

// --- Validation result ---

export type SkeletonErrorCode =
  | 'SCHEMA_INVALID'
  | 'DUPLICATE_ID'
  | 'NO_ROOT'
  | 'MULTIPLE_ROOTS'
  | 'MISSING_PARENT'
  | 'CYCLE'
  | 'ID_PREFIX_MISMATCH'
  | 'ROOT_ID_MISMATCH'
  | 'SELF_PARENT'
  | 'CROSS_DISCIPLINE_DUPLICATE_ID'
  | 'DUPLICATE_SLUG'
  | 'INDEX_MISMATCH';

export type SkeletonError = {
  code: SkeletonErrorCode;
  message: string;
  /** Node id or slug the problem is attached to, when there is one. */
  at?: string;
};

export type ValidatedSkeleton = {
  slug: DisciplineSlug;
  name: string;
  major: string;
  reviewStatus: DisciplineFile['review_status'];
  rootId: string;
  nodes: SkeletonFileNode[];
  /** id -> direct children ids, in sort_order then id order. */
  childrenById: Map<string, string[]>;
  /** id -> titles from root to this node inclusive. */
  pathById: Map<string, string[]>;
};

export type SkeletonValidation =
  | { ok: true; skeleton: ValidatedSkeleton; errors: [] }
  | { ok: false; errors: SkeletonError[] };

/** Root node id convention for a discipline. */
export function rootIdFor(slug: string): string {
  return `${slug}/root`;
}

/** Node ids are namespaced by discipline so they stay unique across all trees. */
export function idPrefixFor(slug: string): string {
  return `${slug}/`;
}

// --- Core validator ---

/**
 * Validate one discipline file. Pure: no IO, no import side effects.
 * Returns every problem found rather than throwing on the first one.
 */
export function validateSkeleton(input: unknown): SkeletonValidation {
  const parsed = DisciplineFileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        code: 'SCHEMA_INVALID' as const,
        message: issue.message,
        at: issue.path.join('.'),
      })),
    };
  }

  const file = parsed.data;
  const errors: SkeletonError[] = [];
  const { nodes, slug } = file;
  const prefix = idPrefixFor(slug);
  const expectedRootId = rootIdFor(slug);

  // Duplicate ids.
  const byId = new Map<string, SkeletonFileNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      errors.push({ code: 'DUPLICATE_ID', message: `Duplicate node id "${node.id}"`, at: node.id });
      continue;
    }
    byId.set(node.id, node);
  }

  // Id namespacing.
  for (const node of nodes) {
    if (!node.id.startsWith(prefix)) {
      errors.push({
        code: 'ID_PREFIX_MISMATCH',
        message: `Node id "${node.id}" must start with "${prefix}"`,
        at: node.id,
      });
    }
  }

  // Roots.
  const roots = nodes.filter((n) => n.parent_id === null);
  if (roots.length === 0) {
    errors.push({ code: 'NO_ROOT', message: 'Skeleton has no root node (parent_id null)' });
  } else if (roots.length > 1) {
    for (const extra of roots.slice(1)) {
      errors.push({
        code: 'MULTIPLE_ROOTS',
        message: `Skeleton must have exactly one root, also found "${extra.id}"`,
        at: extra.id,
      });
    }
  }
  const root = roots[0];
  if (root && root.id !== expectedRootId) {
    errors.push({
      code: 'ROOT_ID_MISMATCH',
      message: `Root id must be "${expectedRootId}", got "${root.id}"`,
      at: root.id,
    });
  }

  // Parent references.
  for (const node of nodes) {
    if (node.parent_id === null) continue;
    if (node.parent_id === node.id) {
      errors.push({
        code: 'SELF_PARENT',
        message: `Node "${node.id}" is its own parent`,
        at: node.id,
      });
      continue;
    }
    if (!byId.has(node.parent_id)) {
      errors.push({
        code: 'MISSING_PARENT',
        message: `Node "${node.id}" references missing parent "${node.parent_id}"`,
        at: node.id,
      });
    }
  }

  // Cycles: walk parents upward; a repeat within one walk is a cycle.
  const settled = new Set<string>();
  const inCycle = new Set<string>();
  for (const start of nodes) {
    if (settled.has(start.id)) continue;
    const seen = new Set<string>();
    const walked: string[] = [];
    let cur: SkeletonFileNode | undefined = start;
    while (cur) {
      if (seen.has(cur.id)) {
        if (!inCycle.has(cur.id)) {
          inCycle.add(cur.id);
          errors.push({
            code: 'CYCLE',
            message: `Node "${cur.id}" is part of a parent cycle`,
            at: cur.id,
          });
        }
        break;
      }
      if (settled.has(cur.id)) break;
      seen.add(cur.id);
      walked.push(cur.id);
      if (cur.parent_id === null) break;
      cur = byId.get(cur.parent_id);
    }
    for (const id of walked) settled.add(id);
  }

  if (errors.length > 0) return { ok: false, errors };
  if (!root) return { ok: false, errors: [{ code: 'NO_ROOT', message: 'Skeleton has no root node' }] };

  // Children, deterministically ordered.
  const childrenById = new Map<string, string[]>();
  for (const node of nodes) childrenById.set(node.id, []);
  const sorted = [...nodes].sort(
    (a, b) => a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const node of sorted) {
    if (node.parent_id === null) continue;
    childrenById.get(node.parent_id)?.push(node.id);
  }

  // Paths from root.
  const pathById = new Map<string, string[]>();
  const walkPath = (id: string, trail: string[]): void => {
    const node = byId.get(id);
    if (!node) return;
    const next = [...trail, node.title];
    pathById.set(id, next);
    for (const childId of childrenById.get(id) ?? []) walkPath(childId, next);
  };
  walkPath(root.id, []);

  return {
    ok: true,
    errors: [],
    skeleton: {
      slug: file.slug,
      name: file.name,
      major: file.major,
      reviewStatus: file.review_status,
      rootId: root.id,
      nodes: sorted,
      childrenById,
      pathById,
    },
  };
}

/**
 * Validate all three files together plus the index.
 * Catches ids reused across disciplines and index/file drift.
 */
export function validateSkeletonSet(
  files: unknown[],
  index?: unknown,
): { ok: boolean; errors: SkeletonError[]; skeletons: ValidatedSkeleton[] } {
  const errors: SkeletonError[] = [];
  const skeletons: ValidatedSkeleton[] = [];

  for (const file of files) {
    const result = validateSkeleton(file);
    if (!result.ok) {
      errors.push(...result.errors);
      continue;
    }
    skeletons.push(result.skeleton);
  }

  const seenSlugs = new Set<string>();
  for (const skeleton of skeletons) {
    if (seenSlugs.has(skeleton.slug)) {
      errors.push({
        code: 'DUPLICATE_SLUG',
        message: `Discipline slug "${skeleton.slug}" appears twice`,
        at: skeleton.slug,
      });
    }
    seenSlugs.add(skeleton.slug);
  }

  const owner = new Map<string, string>();
  for (const skeleton of skeletons) {
    for (const node of skeleton.nodes) {
      const existing = owner.get(node.id);
      if (existing && existing !== skeleton.slug) {
        errors.push({
          code: 'CROSS_DISCIPLINE_DUPLICATE_ID',
          message: `Node id "${node.id}" used by both "${existing}" and "${skeleton.slug}"`,
          at: node.id,
        });
        continue;
      }
      owner.set(node.id, skeleton.slug);
    }
  }

  if (index !== undefined) {
    const parsedIndex = DisciplineIndexSchema.safeParse(index);
    if (!parsedIndex.success) {
      errors.push(
        ...parsedIndex.error.issues.map((issue) => ({
          code: 'SCHEMA_INVALID' as const,
          message: issue.message,
          at: `index.${issue.path.join('.')}`,
        })),
      );
    } else {
      const indexSlugs = new Set(parsedIndex.data.map((e) => e.slug));
      for (const skeleton of skeletons) {
        if (!indexSlugs.has(skeleton.slug)) {
          errors.push({
            code: 'INDEX_MISMATCH',
            message: `Discipline "${skeleton.slug}" missing from index.json`,
            at: skeleton.slug,
          });
        }
      }
      for (const entry of parsedIndex.data) {
        const match = skeletons.find((s) => s.slug === entry.slug);
        if (!match) {
          errors.push({
            code: 'INDEX_MISMATCH',
            message: `index.json lists "${entry.slug}" with no skeleton file`,
            at: entry.slug,
          });
          continue;
        }
        if (match.name !== entry.name || match.major !== entry.major) {
          errors.push({
            code: 'INDEX_MISMATCH',
            message: `index.json name/major for "${entry.slug}" does not match the skeleton file`,
            at: entry.slug,
          });
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, skeletons };
}

// --- Derived views ---

/** Project to the agent-facing SkeletonNode shape (no sort_order). */
export function toAgentSkeleton(skeleton: ValidatedSkeleton): SkeletonNode[] {
  return skeleton.nodes.map((node) => ({
    id: node.id,
    parent_id: node.parent_id,
    title: node.title,
    aliases: node.aliases,
    definition: node.definition,
  }));
}

/** True when the node has no children — the depth a paragraph should bind to. */
export function isLeaf(skeleton: ValidatedSkeleton, id: string): boolean {
  return (skeleton.childrenById.get(id) ?? []).length === 0;
}

export function leafIds(skeleton: ValidatedSkeleton): string[] {
  return skeleton.nodes.filter((n) => isLeaf(skeleton, n.id)).map((n) => n.id);
}

/** 1 for the root, 2 for its children, and so on. */
export function depthOf(skeleton: ValidatedSkeleton, id: string): number {
  return skeleton.pathById.get(id)?.length ?? 0;
}

export function maxDepth(skeleton: ValidatedSkeleton): number {
  let max = 0;
  for (const path of skeleton.pathById.values()) max = Math.max(max, path.length);
  return max;
}

/** Every id present, for candidate validation ("node_id must come from the skeleton"). */
export function skeletonNodeIds(skeleton: ValidatedSkeleton): Set<string> {
  return new Set(skeleton.nodes.map((n) => n.id));
}
