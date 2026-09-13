// Route: /auth
// Complies with 作者本人开发计划 §4.6, §4.7, T24, T25

import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { startZhihuOAuth, exchangeZhihuCode } from '../auth/zhihu.js';
import { createPairingTicket, exchangePairingTicket } from '../auth/extension-pairing.js';
import { resolveSession, revokeSession } from '../auth/session.js';
import { z } from 'zod';

const StartOAuthSchema = z.object({
  redirect_uri: z.string().url().optional(),
});

const ExchangeOAuthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const CreateTicketSchema = z.object({
  device_id: z.string().min(1),
  challenge: z.string().min(1),
});

const ExchangeTicketSchema = z.object({
  device_id: z.string().min(1),
  challenge: z.string().min(1),
  ticket: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // 1. Browser navigation endpoint to start OAuth redirect
  app.get<{ Querystring: { redirect_uri?: string } }>('/auth/zhihu/login', async (request, reply) => {
    try {
      const result = await startZhihuOAuth(request.query.redirect_uri);
      return reply.redirect(result.authorization_url, 302);
    } catch (err: any) {
      const isValidation = err.message?.includes('INVALID_REDIRECT_URI');
      return reply.status(isValidation ? 400 : 500).send({
        error: {
          code: isValidation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message: err.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }
  });

  // 2. Browser callback endpoint handling redirect from Zhihu
  // Redirects code & state back to SPA AuthCallback to perform secure POST exchange
  app.get<{ Querystring: { code?: string; state?: string } }>('/auth/zhihu/callback', async (request, reply) => {
    const { code, state } = request.query;
    if (!code || !state) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing code or state in callback',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const frontendOrigin = process.env['APP_ORIGIN'] || 'http://localhost:5173';
    const redirectUrl = `${frontendOrigin}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    return reply.redirect(redirectUrl, 302);
  });

  // 3. SPA API to start Zhihu OAuth
  app.post<{ Body: unknown }>('/auth/zhihu/start', async (request, reply) => {
    const parsed = StartOAuthSchema.safeParse(request.body ?? {});
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

    try {
      const result = await startZhihuOAuth(parsed.data.redirect_uri);
      return {
        data: result,
        request_id: crypto.randomUUID(),
      };
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message,
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }
  });

  // 4. SPA API to exchange Zhihu OAuth code for session
  app.post<{ Body: unknown }>('/auth/zhihu/exchange', async (request, reply) => {
    const parsed = ExchangeOAuthSchema.safeParse(request.body);
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

    try {
      const result = await exchangeZhihuCode(parsed.data.code, parsed.data.state);
      return {
        data: result,
        request_id: crypto.randomUUID(),
      };
    } catch (err: any) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'OAuth code exchange failed',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }
  });

  // 5. Create extension pairing ticket (requires web login)
  app.post<{ Body: unknown }>('/auth/extension-ticket', async (request, reply) => {
    let uid = (request as any).user?.uid;
    if (!uid) {
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const session = await resolveSession(authHeader.slice(7).trim());
        uid = session?.uid;
      }
    }

    if (!uid) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to create pairing ticket',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }

    const parsed = CreateTicketSchema.safeParse(request.body);
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

    const ticket = await createPairingTicket(uid, parsed.data.device_id, parsed.data.challenge);

    return {
      data: { ticket },
      request_id: crypto.randomUUID(),
    };
  });

  // 6. Exchange pairing ticket for device session
  app.post<{ Body: unknown }>('/auth/extension-exchange', async (request, reply) => {
    const parsed = ExchangeTicketSchema.safeParse(request.body);
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

    try {
      const result = await exchangePairingTicket(
        parsed.data.device_id,
        parsed.data.challenge,
        parsed.data.ticket
      );

      return {
        data: result,
        request_id: crypto.randomUUID(),
      };
    } catch (err: any) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Extension pairing failed',
          retryable: false,
        },
        request_id: crypto.randomUUID(),
      });
    }
  });

  // 7. Logout
  app.post('/auth/logout', async (request) => {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      await revokeSession(token);
    }

    return {
      data: { status: 'logged_out' },
      request_id: crypto.randomUUID(),
    };
  });
};
