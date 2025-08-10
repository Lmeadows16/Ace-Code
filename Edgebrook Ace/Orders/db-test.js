/**
 * Minimal connectivity test to your new Postgres.
 * Usage: DATABASE_URL=... node db-test.js
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    const r = await pool.query('select now() as now');
    console.log('Connected. Server time:', r.rows[0].now);
    process.exit(0);
  } catch (e) {
    console.error('DB connection failed:', e.message);
    process.exit(1);
  }
}
main();
