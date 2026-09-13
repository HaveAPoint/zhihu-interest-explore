// Extension pairing service
// Complies with 作者本人开发计划 §4.6, T25

import crypto from 'node:crypto';
import { query } from '../repositories/pg-client.js';
import { createSession, hashToken } from './session.js';

export async function createPairingTicket(
  uid: string,
  deviceId: string,
  challenge: string,
): Promise<string> {
  const ticket = crypto.randomBytes(32).toString('hex');
  const ticketHash = hashToken(ticket);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL

  await query(
    `INSERT INTO extension_pairings (ticket_hash, uid, device_id, challenge, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketHash, uid, deviceId, challenge, expiresAt.toISOString()]
  );

  return ticket;
}

export async function exchangePairingTicket(
  deviceId: string,
  challenge: string,
  ticket: string,
): Promise<{ device_token: string; uid: string }> {
  const ticketHash = hashToken(ticket);

  // Atomic single-use check
  const pairingRes = await query<{ uid: string }>(
    `UPDATE extension_pairings
     SET used_at = NOW()
     WHERE ticket_hash = $1
       AND device_id = $2
       AND challenge = $3
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING uid`,
    [ticketHash, deviceId, challenge]
  );

  if (pairingRes.rows.length === 0) {
    throw new Error('INVALID_OR_EXPIRED_PAIRING_TICKET');
  }

  const uid = pairingRes.rows[0]!.uid;

  // Create dedicated device session
  const deviceToken = await createSession(uid, deviceId);

  return {
    device_token: deviceToken,
    uid,
  };
}
