import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { resolveSession } from './auth/session.js';
import { meRoutes } from './routes/me.js';
import { disciplineRoutes } from './routes/disciplines.js';
import { nodeRoutes } from './routes/nodes.js';
import { articleRoutes } from './routes/articles.js';
import { treeRoutes } from './routes/trees.js';
import { guestRoutes } from './routes/guest.js';
import { syncRoutes } from './routes/sync.js';
import { authRoutes } from './routes/auth.js';

const APP_ORIGIN = process.env['APP_ORIGIN'] ?? 'http://localhost:5173';
const IS_DEV = process.env['NODE_ENV'] !== 'production';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // CORS - allow web app origin and chrome extensions
  await app.register(cors, {
    origin: [
      APP_ORIGIN,
      /^http:\/\/localhost:\d+$/,
      /^chrome-extension:\/\/.+$/,
    ],
    credentials: true,
  });

  // Session & Auth PreHandler
  app.addHook('onRequest', async (request) => {
    // 1. Check test injection in dev mode
    const testUid = request.headers['x-test-uid'];
    if (IS_DEV && typeof testUid === 'string' && testUid.length > 0) {
      (request as any).user = { uid: testUid };
      return;
    }

    // 2. Bearer token
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const session = await resolveSession(token);
        if (session) {
          (request as any).user = session;
        }
      } catch (err) {
        // If DB not connected or error, fail open or stay anonymous
      }
    }
  });

  // Health check
  app.get('/health', async () => {
    return {
      data: {
        status: 'ok',
        version: '0.0.1',
        mode: process.env['NODE_ENV'] ?? 'development',
      },
      request_id: crypto.randomUUID(),
    };
  });

  // Register business routes
  await app.register(meRoutes);
  await app.register(disciplineRoutes);
  await app.register(nodeRoutes);
  await app.register(articleRoutes);
  await app.register(treeRoutes);
  await app.register(guestRoutes);
  await app.register(syncRoutes);
  await app.register(authRoutes);

  return app;
}
