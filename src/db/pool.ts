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
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'transport_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

export const query = async (text: string, params?: any[]) => {
  try {
    const res = await pool.query(text, params);
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
