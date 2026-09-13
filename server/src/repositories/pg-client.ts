// PostgreSQL client wrapper for Fastify server & migrations
// Connects using DATABASE_URL or standard PG environment variables

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

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
            connectionTimeoutMillis: 5000,
          },
    );

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  const p = getPgPool();
  return p.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
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
