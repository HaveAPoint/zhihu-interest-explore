// Route: /guest
// Complies with 作者本人开发计划 §4.3, §4.7, T11

import type { FastifyPluginAsync } from 'fastify';
import { classifyArticle, generateRoot, generateFollowup } from '../../agent/index.js';
import {
  ClassifyInputSchema,
  GenerateRootInputSchema,
  GenerateFollowupInputSchema,
} from '@zhihu-explore/contracts';

// In-memory rate limiting for guest sessions (per token / IP)
const guestUsageMap = new Map<string, { count: number; resetAt: number }>();
const GUEST_MAX_REQUESTS = 30; // Max 30 generations per 10 minutes
const WINDOW_MS = 10 * 60 * 1000;

function checkGuestRateLimit(identifier: string): boolean {
  const now = Date.now();
  const usage = guestUsageMap.get(identifier);

  if (!usage || now > usage.resetAt) {
    guestUsageMap.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (usage.count >= GUEST_MAX_REQUESTS) {
    return false;
  }

  usage.count++;
  return true;
}

export const guestRoutes: FastifyPluginAsync = async (app) => {
  // Issue guest session token
  app.post('/guest/session', async (_request) => {
    const guestId = `guest_${crypto.randomUUID()}`;
    return {
      data: {
        guest_token: guestId,
        quota: GUEST_MAX_REQUESTS,
        window_minutes: 10,
      },
      request_id: crypto.randomUUID(),
    };
  });

  // Guest stateless classify
  app.post<{ Body: unknown }>('/guest/classify', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkGuestRateLimit(clientIp)) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Guest generation rate limit exceeded. Please log in or wait.',
          retryable: true,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = ClassifyInputSchema.safeParse(request.body);
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

    const res = await classifyArticle(parsed.data);
    return {
      data: res,
      request_id: crypto.randomUUID(),
    };
  });

  // Guest stateless generate root
  app.post<{ Body: unknown }>('/guest/root', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkGuestRateLimit(clientIp)) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Guest generation rate limit exceeded.',
          retryable: true,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = GenerateRootInputSchema.safeParse(request.body);
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

    const res = await generateRoot(parsed.data);
    return {
      data: res,
      request_id: crypto.randomUUID(),
    };
  });

  // Guest stateless generate followup
  app.post<{ Body: unknown }>('/guest/followup', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkGuestRateLimit(clientIp)) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Guest generation rate limit exceeded.',
          retryable: true,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = GenerateFollowupInputSchema.safeParse(request.body);
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

    const res = await generateFollowup(parsed.data);
    return {
      data: res,
      request_id: crypto.randomUUID(),
    };
  });
};
