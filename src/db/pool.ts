import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const LIVE_NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_dqFic0Y9SPLA@ep-still-dust-ay69k9w6.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

const shouldUseCloudDb =
  !!process.env.DATABASE_URL ||
  process.env.NODE_ENV === 'production' ||
  !process.env.DB_HOST;

export const pool = new Pool(
  shouldUseCloudDb
    ? {
        connectionString: process.env.DATABASE_URL || LIVE_NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: parseInt(process.env.DB_POOL_MAX || '50', 10),
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 8000, // 8s max query timeout to prevent hung connections
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'transport_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: parseInt(process.env.DB_POOL_MAX || '50', 10),
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 3000,
        statement_timeout: 8000,
      }
);

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[High-Load Warning] Query took ${duration}ms: ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (error) {
    console.warn(`[DB Query Error / Fallback Mode]: ${error}`);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};
