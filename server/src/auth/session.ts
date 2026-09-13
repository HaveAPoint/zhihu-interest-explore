// Session authentication and token hash verification
// Complies with 作者本人开发计划 §4.6

import crypto from 'node:crypto';
import { query } from '../repositories/pg-client.js';

export interface SessionData {
  uid: string;
  deviceId?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateBearerToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(uid: string, deviceId?: string, ttlDays: number = 30): Promise<string> {
  const token = generateBearerToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO sessions (token_hash, uid, device_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenHash, uid, deviceId ?? null, expiresAt.toISOString()]
  );

  return token;
}

export async function resolveSession(token: string): Promise<SessionData | null> {
  const tokenHash = hashToken(token);
  const res = await query<{ uid: string; device_id: string | null }>(
    `SELECT uid, device_id FROM sessions
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0]!;
  return {
    uid: row.uid,
    deviceId: row.device_id ?? undefined,
  };
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}
