import { readdir, readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const directory = new URL('./migrations/', import.meta.url);
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(728419)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())'
  );
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
      continue;
    if (
      name === '001_initial.sql' &&
      (await client.query("SELECT to_regclass('public.app_settings') AS existing")).rows[0]
        ?.existing
    ) {
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(await readFile(new URL(name, directory), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.info(`Applied ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(728419)');
  client.release();
  await pool.end();
}
