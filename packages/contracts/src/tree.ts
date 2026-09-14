// Tree and node types

import { z } from 'zod';
import { UUIDSchema, UidSchema, DisciplineSlugSchema, DegreeSchema, VersionSchema } from './ids.js';

// --- Candidate ---

export const CandidateSchema = z.object({
  global_node_id: z.string().min(1),
  title: z.string(),
  degree: DegreeSchema,
  reason: z.string(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

// --- Source ---

export const SourceSchema = z.object({
  title: z.string(),
  url: z.string().url().refine(u => u.startsWith('http://') || u.startsWith('https://'), {
    message: 'Source URL must be http or https',
  }),
});
export type Source = z.infer<typeof SourceSchema>;

// --- Highlight anchor ---

export const HighlightAnchorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  paragraph_index: z.number().int().min(0).optional(),
  start_offset: z.number().int().min(0).optional(),
  end_offset: z.number().int().min(0).optional(),
});
export type HighlightAnchor = z.infer<typeof HighlightAnchorSchema>;

// --- Local Node ---

export const LocalNodeSchema = z.object({
  id: UUIDSchema,
  tree_id: UUIDSchema,
  parent_id: UUIDSchema.nullable(),
  highlight_text: z.string().min(1),
  highlight_anchor: HighlightAnchorSchema.optional(),
  question_text: z.string(), // can be empty
  title: z.string().min(1).max(50),
  answer_original: z.string(), // verbatim from article/parent answer
  answer_extra: z.string(), // agent explanation
  sources: z.array(SourceSchema),
  created_at: z.string().datetime(),
});
export type LocalNode = z.infer<typeof LocalNodeSchema>;

// --- Local Tree ---

export const LocalTreeSchema = z.object({
  id: UUIDSchema,
  root_node_id: UUIDSchema,
  uid: UidSchema,
  article_id: UUIDSchema,
  discipline_slug: DisciplineSlugSchema.nullable(),
  global_node_id: z.string().nullable(), // null = pending binding
  match_candidates: z.array(CandidateSchema).max(3),
  anchor_paragraph: z.string().min(1),
  anchor_highlight: z.string().min(1),
  version: VersionSchema,
  nodes: z.array(LocalNodeSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type LocalTree = z.infer<typeof LocalTreeSchema>;

// --- Create tree input ---

export const CreateTreeModeSchema = z.enum(['generate_only', 'persist']);

export const CreateTreeInputSchema = z.object({
  tree_id: UUIDSchema,
  root_node_id: UUIDSchema,
  article_id: UUIDSchema,
  anchor_paragraph: z.string().min(1).max(10000),
  anchor_highlight: z.string().min(1).max(5000),
  question_text: z.string().max(1000),
  mode: CreateTreeModeSchema.default('persist'),
  // For generate_only: full local context
  local_article: z.object({
    title: z.string(),
    tags: z.array(z.string()),
    url: z.string(),
    content_text: z.string(),
    // Pass the pre-classified discipline so server does not default to agent-app-dev
    discipline_slug: DisciplineSlugSchema.optional(),
  }).optional(),
  local_tree_context: z.any().optional(), // full tree for generate_only
  history_summary: z.string().max(5000).default(''),
});
export type CreateTreeInput = z.infer<typeof CreateTreeInputSchema>;

// --- Add node input ---

export const AddNodeInputSchema = z.object({
  node_id: UUIDSchema,
  parent_id: UUIDSchema,
  highlight_text: z.string().min(1).max(5000),
  highlight_anchor: HighlightAnchorSchema.optional(),
  question_text: z.string().max(1000),
  mode: CreateTreeModeSchema.default('persist'),
  local_article: z.object({
    title: z.string(),
    tags: z.array(z.string()),
    url: z.string(),
    content_text: z.string(),
  }).optional(),
  local_tree_context: z.any().optional(),
});
export type AddNodeInput = z.infer<typeof AddNodeInputSchema>;

// --- Patch tree (bind) ---

export const PatchTreeInputSchema = z.object({
  global_node_id: z.string().min(1),
});

// --- Patch node (rename) ---

export const PatchNodeTitleSchema = z.object({
  title: z.string().min(1).max(50),
});

// --- Patch proficiency ---

export const PatchProficiencySchema = z.object({
  value: z.union([z.null(), z.number().int().min(0).max(5)]),
});

// --- Personal Node ---

export const PersonalNodeSchema = z.object({
  id: UUIDSchema,
  uid: UidSchema,
  discipline_slug: DisciplineSlugSchema,
  parent_id: z.string().min(1),
  title: z.string().min(1).max(50),
  definition: z.string().min(1).max(500),
  created_at: z.string().datetime(),
});
export type PersonalNode = z.infer<typeof PersonalNodeSchema>;

export const CreatePersonalNodeInputSchema = z.object({
  id: UUIDSchema.optional(),
  parent_id: z.string().min(1),
  title: z.string().min(1).max(50),
  definition: z.string().min(1).max(500),
});
export type CreatePersonalNodeInput = z.infer<typeof CreatePersonalNodeInputSchema>;

