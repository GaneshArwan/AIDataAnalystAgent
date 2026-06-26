import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Prevent connection leaks in development by using a global pool cache
const globalForPools = globalThis as unknown as {
  poolCache: Map<string, Pool>;
};

const poolCache = globalForPools.poolCache || new Map<string, Pool>();

if (process.env.NODE_ENV !== 'production') {
  globalForPools.poolCache = poolCache;
}

export function getPool(dbUrl?: string): Pool {
  const url = dbUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Database URL is required.');
  }
  
  if (!poolCache.has(url)) {
    // Prevent connection leaks and resource exhaustion by evicting the oldest pool (FIFO)
    // VERCEL HOBBY TIER FIX: Reduced from 20 to 5 to prevent memory bloating (1024MB limit)
    if (poolCache.size >= 5) {
      const oldestUrl = poolCache.keys().next().value;
      if (oldestUrl) {
        const poolToEvict = poolCache.get(oldestUrl);
        poolCache.delete(oldestUrl);
        if (poolToEvict) {
          poolToEvict.end().catch(err => {
            console.error('Error ending evicted pool:', err);
          });
        }
      }
    }

    const pool = new Pool({ 
      connectionString: url,
      max: 2, // VERCEL HOBBY TIER FIX: Hard limit connections. Serverless functions scale out, not up.
      idleTimeoutMillis: 3000, // VERCEL HOBBY TIER FIX: Drop idle connections rapidly (3s instead of 30s) so they don't hang users' DBs when Vercel freezes the container.
      connectionTimeoutMillis: 2000,
    });
    poolCache.set(url, pool);
  }
  
  return poolCache.get(url)!;
}

export function getDb(dbUrl?: string) {
  return drizzle(getPool(dbUrl), { schema });
}

/**
 * Executes a callback within a read-only PostgreSQL transaction.
 * This ensures that even if a generated SQL query contains write operations,
 * the database will reject them.
 */
export async function runReadOnly<T>(callback: (tx: any) => Promise<T>, dbUrl?: string): Promise<T> {
  const pool = getPool(dbUrl);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    
    // We use the client directly here to ensure the session state (READ ONLY) 
    // is maintained correctly for the duration of the transaction.
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
