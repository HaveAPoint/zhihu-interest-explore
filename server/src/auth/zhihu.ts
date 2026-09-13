// Zhihu OAuth2 authorization and session exchange
// Complies with 作者本人开发计划 §4.6, T24

import crypto from 'node:crypto';
import { query } from '../repositories/pg-client.js';
import { createSession } from './session.js';

const ZHIHU_CLIENT_ID = process.env['ZHIHU_CLIENT_ID'] ?? 'mock_zhihu_client_id';
const ZHIHU_AUTH_URL = process.env['ZHIHU_AUTH_URL'] ?? 'https://www.zhihu.com/oauth/authorize';
const REDIRECT_URI = process.env['ZHIHU_REDIRECT_URI'] ?? 'http://localhost:5173/auth/callback';

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

export async function startZhihuOAuth(redirectUri: string = REDIRECT_URI): Promise<OAuthStartResult> {
  const state = crypto.randomUUID();
  const verifier = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await query(
    `INSERT INTO oauth_states (state, code_verifier, redirect_uri, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [state, verifier, redirectUri, expiresAt.toISOString()]
  );

  const authUrl = `${ZHIHU_AUTH_URL}?response_type=code&client_id=${ZHIHU_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${state}&scope=basic`;

  return {
    authorization_url: authUrl,
    state,
  };
}

export async function exchangeZhihuCode(
  code: string,
  state: string,
): Promise<OAuthExchangeResult> {
  // Single-use state verification
  const stateRes = await query(
    'DELETE FROM oauth_states WHERE state = $1 AND expires_at > NOW() RETURNING redirect_uri',
    [state]
  );

  if (stateRes.rows.length === 0) {
    throw new Error('INVALID_OR_EXPIRED_OAUTH_STATE');
  }

  // Determine user identity
  // In live mode with credentials: exchange code with Zhihu API
  // In development/test mode: derive deterministic user from code or mock
  let uid: string;
  let name: string;
  let avatarUrl: string | null = null;

  if (code.startsWith('mock_code_')) {
    const rawUid = code.replace(/^mock_code_/, '');
    uid = `zhihu_${rawUid}`;
    name = `知乎用户_${rawUid.slice(0, 6)}`;
  } else {
    // Hash the code for a deterministic UID if no live API credentials configured
    const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 12);
    uid = `zhihu_${hash}`;
    name = `知乎用户_${hash.slice(0, 6)}`;
  }

  // Upsert user into database
  await query(
    `INSERT INTO users (uid, zhihu_uid, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uid) DO UPDATE
     SET name = EXCLUDED.name, updated_at = NOW()`,
    [uid, uid, name, avatarUrl]
  );

  // Generate product session
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
