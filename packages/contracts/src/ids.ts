// ID types and validation

import { z } from 'zod';

/** UUID format validation */
export const UUIDSchema = z.string().uuid();

/** User uid - always string, never convert to number */
export const UidSchema = z.string().min(1).max(100);

/** Discipline slug */
export const DisciplineSlugSchema = z.enum([
  'agent-app-dev',
  'cognitive-psychology',
  'distributed-systems',
]);
export type DisciplineSlug = z.infer<typeof DisciplineSlugSchema>;

/** Skeleton node IDs: stable, discipline-prefixed kebab-case */
export const SkeletonNodeIdSchema = z.string().min(1).max(200).regex(/^[a-z0-9][a-z0-9-/]*$/);

/** Version: positive integer */
export const VersionSchema = z.number().int().positive();

/** Degree of match for binding candidates */
export const DegreeSchema = z.enum(['exact', 'broader', 'related']);
export type Degree = z.infer<typeof DegreeSchema>;

/** Proficiency: null or 0-5 integer */
export const ProficiencySchema = z.union([z.null(), z.number().int().min(0).max(5)]);
export type Proficiency = z.infer<typeof ProficiencySchema>;
