"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./pool");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function resetDatabase() {
    console.log('⚠️ Starting full database reset...');
    try {
        // Drop all existing tables
        await (0, pool_1.query)(`
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
        const schemaPath = path_1.default.join(__dirname, 'schema.sql');
        const schemaSql = fs_1.default.readFileSync(schemaPath, 'utf8');
        await (0, pool_1.query)(schemaSql);
        console.log('✓ Schema and initial seed data re-created successfully.');
        console.log('🎉 Database reset complete!');
    }
    catch (err) {
        console.error('❌ Database reset failed:', err.message || err);
    }
    finally {
        await pool_1.pool.end();
    }
}
resetDatabase();
