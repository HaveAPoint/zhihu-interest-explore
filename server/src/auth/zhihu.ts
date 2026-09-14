// Zhihu OAuth2 authorization and session exchange
// Complies with 作者本人开发计划 §4.6, T24

import crypto from 'node:crypto';
import { query } from '../repositories/pg-client.js';
import { createSession } from './session.js';

const getZhihuClientId = () => process.env['ZHIHU_CLIENT_ID'] ?? '';
const getZhihuClientSecret = () => process.env['ZHIHU_CLIENT_SECRET'] ?? '';
const getZhihuAuthUrl = () => process.env['ZHIHU_AUTH_URL'] ?? 'https://www.zhihu.com/oauth/authorize';
const getZhihuTokenUrl = () => process.env['ZHIHU_TOKEN_URL'] ?? 'https://www.zhihu.com/oauth/token';
const getZhihuUserUrl = () => process.env['ZHIHU_USER_URL'] ?? 'https://api.zhihu.com/people/self';
const getRedirectUri = () => process.env['ZHIHU_REDIRECT_URI'] ?? 'http://localhost:5173/auth/callback';

export interface OAuthStartResult {
  authorization_url: string;
  state: string;
}

export interface OAuthExchangeResult {
  token: string;
  user: {
    uid: string;
    name: string;
    avatar_url: string | null;
  };
}

const ALLOWED_REDIRECT_URIS = new Set([
  process.env['ZHIHU_REDIRECT_URI'] || 'http://localhost:5173/auth/callback',
  'http://localhost:5173/auth/callback',
  'https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/auth/callback',
  'https://zhihu-explore.tcloudbaseapp.com/auth/callback',
]);

export function isAllowedRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_URIS.has(uri);
}

export async function startZhihuOAuth(redirectUri: string = getRedirectUri()): Promise<OAuthStartResult> {
  if (!isAllowedRedirectUri(redirectUri)) {
    throw new Error(`INVALID_REDIRECT_URI: "${redirectUri}" is not in the allowed redirect whitelist.`);
  }

  const isProduction = process.env['NODE_ENV'] === 'production';
  const clientId = getZhihuClientId();
  if (!clientId && isProduction) {
    throw new Error('ZHIHU_OAUTH_CONFIG_MISSING: Missing ZHIHU_CLIENT_ID');
  }

  const state = crypto.randomUUID();
  const verifier = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL

  await query(
    `INSERT INTO oauth_states (state, code_verifier, redirect_uri, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [state, verifier, redirectUri, expiresAt.toISOString()]
  );

  const effectiveClientId = clientId || 'test_zhihu_client_id';
  const authUrl = `${getZhihuAuthUrl()}?response_type=code&client_id=${encodeURIComponent(
    effectiveClientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=basic`;

  return {
    authorization_url: authUrl,
    state,
  };
}

export async function exchangeZhihuCode(
  code: string,
  state: string,
): Promise<OAuthExchangeResult> {
  // 1. Single-use state verification and deletion
  const stateRes = await query<{ redirect_uri: string }>(
    'DELETE FROM oauth_states WHERE state = $1 AND expires_at > NOW() RETURNING redirect_uri',
    [state]
  );

  if (stateRes.rows.length === 0) {
    throw new Error('INVALID_OR_EXPIRED_OAUTH_STATE');
  }

  const redirectUri = stateRes.rows[0]!.redirect_uri;

  // 2. Resolve User Identity from Official OAuth Exchange
  const isProduction = process.env['NODE_ENV'] === 'production';
  const allowMockOAuth = process.env['ALLOW_MOCK_OAUTH'] === 'true' && !isProduction;

  let zhihuUid: string;
  let name: string;
  let avatarUrl: string | null = null;

  if (allowMockOAuth && code.startsWith('test_mock_code_')) {
    // Only in explicit non-production test mode with controlled prefix
    const rawUid = code.replace(/^test_mock_code_/, '');
    if (!rawUid) {
      throw new Error('INVALID_OAUTH_CODE');
    }
    zhihuUid = rawUid;
    name = `知乎测试用户_${rawUid.slice(0, 6)}`;
  } else {
    // Live official exchange: NEVER fabricate fake identities in production!
    const clientId = getZhihuClientId();
    const clientSecret = getZhihuClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('ZHIHU_OAUTH_CONFIG_MISSING: Missing ZHIHU_CLIENT_ID or ZHIHU_CLIENT_SECRET');
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(getZhihuTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    }).catch((err) => {
      throw new Error(`ZHIHU_OAUTH_NETWORK_ERROR: ${err.message}`);
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text().catch(() => '');
      throw new Error(`ZHIHU_OAUTH_TOKEN_FAILED: ${tokenRes.status} ${errorText}`);
    }

    const tokenData = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('ZHIHU_OAUTH_NO_ACCESS_TOKEN');
    }

    const userRes = await fetch(getZhihuUserUrl(), {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).catch((err) => {
      throw new Error(`ZHIHU_OAUTH_USER_NETWORK_ERROR: ${err.message}`);
    });

    if (!userRes.ok) {
      throw new Error(`ZHIHU_OAUTH_USER_INFO_FAILED: ${userRes.status}`);
    }

    const userData = (await userRes.json().catch(() => ({}))) as {
      id?: string | number;
      name?: string;
      avatar_url?: string;
    };

    if (!userData.id) {
      throw new Error('ZHIHU_OAUTH_INVALID_USER_DATA');
    }

    zhihuUid = String(userData.id);
    name = userData.name ?? `知乎用户_${zhihuUid.slice(0, 6)}`;
    avatarUrl = userData.avatar_url ?? null;
  }

  // 3. Upsert into database
  const uid = `zhihu_${zhihuUid}`;
  await query(
    `INSERT INTO users (uid, zhihu_uid, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uid) DO UPDATE
     SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()`,
    [uid, zhihuUid, name, avatarUrl]
  );

  // 4. Generate product session
  const token = await createSession(uid);

  return {
    token,
    user: {
      uid,
      name,
      avatar_url: avatarUrl,
    },
  };
}
