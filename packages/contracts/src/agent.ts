// Agent interface types (shared between server and fixtures)

import { z } from 'zod';
import { DisciplineSlugSchema, DegreeSchema } from './ids.js';
import { SourceSchema } from './tree.js';

// --- Classify ---

export const ClassifyInputSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  lead: z.string(),
});
export type ClassifyInput = z.infer<typeof ClassifyInputSchema>;

export const ClassifyOutputSchema = z.object({
  slug: DisciplineSlugSchema.nullable(),
});
export type ClassifyOutput = z.infer<typeof ClassifyOutputSchema>;

// --- Skeleton node for agent input ---

export const SkeletonNodeSchema = z.object({
  id: z.string().min(1),
  parent_id: z.string().nullable(),
  title: z.string(),
  aliases: z.array(z.string()),
  definition: z.string(),
});
export type SkeletonNode = z.infer<typeof SkeletonNodeSchema>;

// --- Article context for agent ---

export const ArticleContextSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  url: z.string(),
  content_text: z.string().min(1),
});
export type ArticleContext = z.infer<typeof ArticleContextSchema>;

// --- Tree context for agent ---

export const TreeNodeContextSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  title: z.string(),
  highlight_text: z.string(),
  question_text: z.string(),
  answer_extra: z.string(),
  is_current: z.boolean(),
});

export const TreeContextSchema = z.object({
  nodes: z.array(TreeNodeContextSchema),
});
export type TreeContext = z.infer<typeof TreeContextSchema>;

// --- Generate Root ---

export const GenerateRootInputSchema = z.object({
  article: ArticleContextSchema,
  tree: TreeContextSchema,
  highlight: z.string().min(1),
  question: z.string(),
  historySummary: z.string(),
  disciplineSkeleton: z.array(SkeletonNodeSchema),
});
export type GenerateRootInput = z.infer<typeof GenerateRootInputSchema>;

export const CandidateOutputSchema = z.object({
  node_id: z.string().min(1),
  degree: DegreeSchema,
  reason: z.string(),
});

export const GenerateRootOutputSchema = z.object({
  title: z.string().min(1),
  extra: z.string().min(1),
  sources: z.array(SourceSchema),
  candidates: z.array(CandidateOutputSchema).max(3),
});
export type GenerateRootOutput = z.infer<typeof GenerateRootOutputSchema>;

// --- Generate Followup ---

export const GenerateFollowupInputSchema = z.object({
  article: ArticleContextSchema,
  tree: TreeContextSchema,
  highlight: z.string().min(1),
  question: z.string(),
});
export type GenerateFollowupInput = z.infer<typeof GenerateFollowupInputSchema>;

export const GenerateFollowupOutputSchema = z.object({
  title: z.string().min(1),
  extra: z.string().min(1),
  sources: z.array(SourceSchema),
});
export type GenerateFollowupOutput = z.infer<typeof GenerateFollowupOutputSchema>;
