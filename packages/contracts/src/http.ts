// HTTP response and error types

import { z } from 'zod';

// --- Success response ---

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    request_id: z.string(),
  });

// --- Error response ---

export const ErrorCodeSchema = z.enum([
  // Auth
  'UNAUTHORIZED',
  'FORBIDDEN',
  // Validation
  'VALIDATION_ERROR',
  'INVALID_INPUT',
  // Resource
  'NOT_FOUND',
  'RESOURCE_NOT_VISIBLE',
  // Conflict
  'VERSION_CONFLICT',
  'DISCIPLINE_CONFLICT',
  'ARTICLE_RESOLVING',
  // Rate limiting
  'RATE_LIMITED',
  // Generation
  'GENERATION_FAILED',
  'GENERATION_TIMEOUT',
  // Server
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
  request_id: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// --- HTTP Status mapping ---

export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  RESOURCE_NOT_VISIBLE: 404,
  VERSION_CONFLICT: 409,
  DISCIPLINE_CONFLICT: 409,
  ARTICLE_RESOLVING: 409,
  RATE_LIMITED: 429,
  GENERATION_FAILED: 502,
  GENERATION_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
};
