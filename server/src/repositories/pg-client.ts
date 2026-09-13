// PostgreSQL client wrapper for Fastify server & migrations
// Connects using DATABASE_URL or standard PG environment variables
// Includes robust in-memory fallback for test and offline development

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

// In-memory fallback stores
interface MemOAuthState {
  state: string;
  code_verifier: string;
  redirect_uri: string;
  expires_at: string;
}

interface MemSession {
  token_hash: string;
  uid: string;
  device_id: string | null;
  expires_at: string;
}

interface MemPairing {
  ticket_hash: string;
  uid: string;
  device_id: string;
  challenge: string;
  expires_at: string;
  used_at: string | null;
}

interface MemUser {
  uid: string;
  zhihu_uid: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const memoryDb = {
  oauth_states: new Map<string, MemOAuthState>(),
  sessions: new Map<string, MemSession>(),
  extension_pairings: new Map<string, MemPairing>(),
  users: new Map<string, MemUser>(),
};

export function clearMemoryDb() {
  memoryDb.oauth_states.clear();
  memoryDb.sessions.clear();
  memoryDb.extension_pairings.clear();
  memoryDb.users.clear();
}

export function setUseMemoryDb(val: boolean) {
  process.env['USE_MEMORY_DB'] = val ? 'true' : 'false';
}

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env['DATABASE_URL'];
    pool = new Pool(
      connectionString
        ? { connectionString }
        : {
            host: process.env['PGHOST'] ?? 'localhost',
            port: parseInt(process.env['PGPORT'] ?? '5432', 10),
            user: process.env['PGUSER'] ?? 'postgres',
            password: process.env['PGPASSWORD'] ?? '',
            database: process.env['PGDATABASE'] ?? 'zhihu_explore',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 1000,
          },
    );

    pool.on('error', (err) => {
      console.warn('PostgreSQL client error, fallback to memory if offline:', err.message);
    });
  }

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}

function handleMemoryQuery<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): pg.QueryResult<T> {
  const norm = text.trim().replace(/\s+/g, ' ');

  // 1. oauth_states INSERT
  if (norm.startsWith('INSERT INTO oauth_states')) {
    const [state, code_verifier, redirect_uri, expires_at] = params;
    memoryDb.oauth_states.set(state, { state, code_verifier, redirect_uri, expires_at });
    return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 2. oauth_states DELETE RETURNING
  if (norm.startsWith('DELETE FROM oauth_states WHERE state = $1 AND expires_at > NOW() RETURNING redirect_uri')) {
    const [state] = params;
    const item = memoryDb.oauth_states.get(state);
    if (item && new Date(item.expires_at).getTime() > Date.now()) {
      memoryDb.oauth_states.delete(state);
      return { rows: [{ redirect_uri: item.redirect_uri } as any], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: 'DELETE', oid: 0, fields: [] };
  }

  // 3. sessions INSERT
  if (norm.startsWith('INSERT INTO sessions')) {
    const [token_hash, uid, device_id, expires_at] = params;
    memoryDb.sessions.set(token_hash, { token_hash, uid, device_id: device_id ?? null, expires_at });
    return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 4. sessions SELECT
  if (norm.startsWith('SELECT uid, device_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW()')) {
    const [token_hash] = params;
    const item = memoryDb.sessions.get(token_hash);
    if (item && new Date(item.expires_at).getTime() > Date.now()) {
      return { rows: [{ uid: item.uid, device_id: item.device_id } as any], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
  }

  // 5. sessions DELETE
  if (norm.startsWith('DELETE FROM sessions WHERE token_hash = $1')) {
    const [token_hash] = params;
    const deleted = memoryDb.sessions.delete(token_hash);
    return { rows: [], rowCount: deleted ? 1 : 0, command: 'DELETE', oid: 0, fields: [] };
  }

  // 6. extension_pairings INSERT
  if (norm.startsWith('INSERT INTO extension_pairings')) {
    const [ticket_hash, uid, device_id, challenge, expires_at] = params;
    memoryDb.extension_pairings.set(ticket_hash, {
      ticket_hash,
      uid,
      device_id,
      challenge,
      expires_at,
      used_at: null,
    });
    return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 7. extension_pairings UPDATE RETURNING uid (atomic ticket exchange)
  if (norm.includes('UPDATE extension_pairings SET used_at = NOW()')) {
    const [ticket_hash, device_id, challenge] = params;
    const item = memoryDb.extension_pairings.get(ticket_hash);
    if (
      item &&
      item.device_id === device_id &&
      item.challenge === challenge &&
      item.used_at === null &&
      new Date(item.expires_at).getTime() > Date.now()
    ) {
      item.used_at = new Date().toISOString();
      return { rows: [{ uid: item.uid } as any], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: 'UPDATE', oid: 0, fields: [] };
  }

  // 8. users INSERT ON CONFLICT
  if (norm.startsWith('INSERT INTO users')) {
    const [uid, zhihu_uid, name, avatar_url] = params;
    const existing = memoryDb.users.get(uid);
    const user: MemUser = {
      uid,
      zhihu_uid,
      name,
      avatar_url: avatar_url ?? null,
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryDb.users.set(uid, user);
    return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 9. users SELECT
  if (norm.startsWith('SELECT') && norm.includes('FROM users WHERE uid = $1')) {
    const [uid] = params;
    const item = memoryDb.users.get(uid);
    if (item) {
      return { rows: [item as any], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
  }

  return { rows: [], rowCount: 0, command: 'UNKNOWN', oid: 0, fields: [] };
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  if (process.env['USE_MEMORY_DB'] === 'true') {
    return handleMemoryQuery<T>(text, params);
  }

  // Live / production mode: ALWAYS query real PostgreSQL; NEVER silently fallback!
  const p = getPgPool();
  return p.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if (process.env['USE_MEMORY_DB'] === 'true') {
    const fakeClient = {
      query: (t: string, p?: any[]) => Promise.resolve(handleMemoryQuery(t, p)),
      release: () => {},
    } as unknown as pg.PoolClient;
    return callback(fakeClient);
  }

  const p = getPgPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
