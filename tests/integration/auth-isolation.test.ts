// Comprehensive test suite for Auth & Account Isolation (T24 ~ T26)
// Complies with 作者本人开发计划 §4.6, T24, T25, T26

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../server/src/app.js';
import { startZhihuOAuth } from '../../server/src/auth/zhihu.js';
import { createSession } from '../../server/src/auth/session.js';
import { clearMemoryDb } from '../../server/src/repositories/pg-client.js';

describe('Auth & Account Isolation Test Suite (T24 ~ T26)', () => {
  let app: FastifyInstance;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env['USE_MEMORY_DB'] = 'true';
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    process.env = originalEnv;
    await app.close();
  });

  describe('P0: OAuth Fake Code & Replay Protection (T24)', () => {
    it('rejects unwhitelisted redirect_uri to prevent open redirect vulnerabilities', async () => {
      const evilRes = await app.inject({
        method: 'GET',
        url: '/auth/zhihu/login?redirect_uri=https://evil-phishing-site.com/steal',
      });

      expect(evilRes.statusCode).toBe(400);
      const json = evilRes.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('INVALID_REDIRECT_URI');

      // Valid redirect uri returns 302
      const validRes = await app.inject({
        method: 'GET',
        url: '/auth/zhihu/login?redirect_uri=http://localhost:5173/auth/callback',
      });
      expect(validRes.statusCode).toBe(302);
      expect(validRes.headers.location).toContain('https://www.zhihu.com/oauth/authorize');
    });

    it('rejects startZhihuOAuth in production if ZHIHU_CLIENT_ID is missing', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['ZHIHU_CLIENT_ID'] = '';

      await expect(startZhihuOAuth('http://localhost:5173/auth/callback')).rejects.toThrow(
        'ZHIHU_OAUTH_CONFIG_MISSING'
      );

      process.env['NODE_ENV'] = 'test';
    });

    it('rejects forged codes in production mode without fabricating fake identities', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['ALLOW_MOCK_OAUTH'] = 'false';
      process.env['ZHIHU_CLIENT_ID'] = 'test_client_id';

      // 1. Start OAuth to obtain a valid state
      const { state } = await startZhihuOAuth('http://localhost:5173/auth/callback');

      // 2. Submit forged code
      const res = await app.inject({
        method: 'POST',
        url: '/auth/zhihu/exchange',
        payload: {
          code: 'forged_fake_code_attacker_123',
          state,
        },
      });

      // Must be rejected with 401 UNAUTHORIZED
      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
      // Must not generate any user session
      expect(json.data).toBeUndefined();
    });

    it('enforces single-use state and rejects replayed OAuth states', async () => {
      process.env['NODE_ENV'] = 'test';
      process.env['ALLOW_MOCK_OAUTH'] = 'true';

      // 1. Start OAuth
      const { state } = await startZhihuOAuth('http://localhost:5173/auth/callback');

      // 2. First exchange succeeds in test mode with valid test mock code
      const res1 = await app.inject({
        method: 'POST',
        url: '/auth/zhihu/exchange',
        payload: {
          code: 'test_mock_code_user999',
          state,
        },
      });

      expect(res1.statusCode).toBe(200);
      const json1 = res1.json();
      expect(json1.data.user.uid).toBe('zhihu_user999');
      expect(json1.data.token).toBeDefined();

      // 3. Replaying the exact same state MUST fail
      const res2 = await app.inject({
        method: 'POST',
        url: '/auth/zhihu/exchange',
        payload: {
          code: 'test_mock_code_user999',
          state,
        },
      });

      expect(res2.statusCode).toBe(401);
      const json2 = res2.json();
      expect(json2.error.code).toBe('UNAUTHORIZED');
      expect(json2.error.message).toContain('INVALID_OR_EXPIRED_OAUTH_STATE');
    });

    it('rejects expired or non-existent OAuth states', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/zhihu/exchange',
        payload: {
          code: 'test_mock_code_any',
          state: 'non_existent_random_state_123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('P0: Extension Pairing Ticket & Challenge Isolation (T25)', () => {
    let validWebToken: string;
    const testUid = 'user_pairing_test_1001';

    beforeAll(async () => {
      validWebToken = await createSession(testUid);
    });

    it('requires authenticated web session to generate pairing ticket', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/extension-ticket',
        payload: {
          device_id: 'device_test_01',
          challenge: 'challenge_test_01',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    });

    it('generates pairing ticket for authenticated web user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/extension-ticket',
        headers: {
          Authorization: `Bearer ${validWebToken}`,
        },
        payload: {
          device_id: 'device_test_01',
          challenge: 'challenge_test_01',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.ticket).toBeDefined();
      expect(typeof json.data.ticket).toBe('string');
    });

    it('rejects pairing exchange if device_id or challenge does not match', async () => {
      // 1. Create ticket
      const ticketRes = await app.inject({
        method: 'POST',
        url: '/auth/extension-ticket',
        headers: { Authorization: `Bearer ${validWebToken}` },
        payload: {
          device_id: 'device_correct_1',
          challenge: 'challenge_correct_1',
        },
      });
      const ticket = ticketRes.json().data.ticket;

      // 2. Attempt exchange with mismatched device_id
      const wrongDeviceRes = await app.inject({
        method: 'POST',
        url: '/auth/extension-exchange',
        payload: {
          device_id: 'device_wrong_2',
          challenge: 'challenge_correct_1',
          ticket,
        },
      });
      expect(wrongDeviceRes.statusCode).toBe(401);

      // 3. Attempt exchange with mismatched challenge
      const wrongChallengeRes = await app.inject({
        method: 'POST',
        url: '/auth/extension-exchange',
        payload: {
          device_id: 'device_correct_1',
          challenge: 'challenge_wrong_2',
          ticket,
        },
      });
      expect(wrongChallengeRes.statusCode).toBe(401);
    });

    it('enforces single-use consumption and rejects replayed pairing ticket', async () => {
      // 1. Create ticket
      const ticketRes = await app.inject({
        method: 'POST',
        url: '/auth/extension-ticket',
        headers: { Authorization: `Bearer ${validWebToken}` },
        payload: {
          device_id: 'device_replay_test',
          challenge: 'challenge_replay_test',
        },
      });
      const ticket = ticketRes.json().data.ticket;

      // 2. First exchange succeeds
      const exchange1 = await app.inject({
        method: 'POST',
        url: '/auth/extension-exchange',
        payload: {
          device_id: 'device_replay_test',
          challenge: 'challenge_replay_test',
          ticket,
        },
      });

      expect(exchange1.statusCode).toBe(200);
      const json1 = exchange1.json();
      expect(json1.data.uid).toBe(testUid);
      expect(json1.data.device_token).toBeDefined();

      // 3. Replay attack: attempting to use the same ticket second time MUST fail
      const exchange2 = await app.inject({
        method: 'POST',
        url: '/auth/extension-exchange',
        payload: {
          device_id: 'device_replay_test',
          challenge: 'challenge_replay_test',
          ticket,
        },
      });

      expect(exchange2.statusCode).toBe(401);
      expect(exchange2.json().error.code).toBe('UNAUTHORIZED');
    });
  });
});
