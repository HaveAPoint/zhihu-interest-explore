// Article types

import { z } from 'zod';
import { UUIDSchema, UidSchema, DisciplineSlugSchema } from './ids.js';

export const ArticleSchema = z.object({
  id: UUIDSchema,
  uid: UidSchema,
  zhihu_id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  tags: z.array(z.string()),
  lead: z.string().max(2000),
  content_text: z.string().max(100000),
  discipline_slug: DisciplineSlugSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const ResolveArticleInputSchema = z.object({
  article_id: UUIDSchema,
  zhihu_id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  tags: z.array(z.string()),
  lead: z.string().max(2000),
  content_text: z.string().min(1).max(100000),
});
export type ResolveArticleInput = z.infer<typeof ResolveArticleInputSchema>;

export const PatchArticleDisciplineSchema = z.object({
  discipline_slug: DisciplineSlugSchema,
});
