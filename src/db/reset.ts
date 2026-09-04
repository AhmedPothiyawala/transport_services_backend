import { pool, query } from './pool';
import fs from 'fs';
import path from 'path';

async function resetDatabase() {
  console.log('⚠️ Starting full database reset...');

  try {
    // Drop all existing tables
    await query(`
      DROP TABLE IF EXISTS delivery_logs CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS ledgers CASCADE;
      DROP TABLE IF EXISTS builtys CASCADE;
      DROP TABLE IF EXISTS parties CASCADE;
      DROP TABLE IF EXISTS series_config CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS branches CASCADE;
    `);

    console.log('✓ All database tables dropped successfully.');

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await query(schemaSql);
    console.log('✓ Schema and initial seed data re-created successfully.');

    console.log('🎉 Database reset complete!');
  } catch (err: any) {
    console.error('❌ Database reset failed:', err.message || err);
  } finally {
    await pool.end();
  }
}

resetDatabase();
