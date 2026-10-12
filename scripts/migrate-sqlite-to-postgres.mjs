import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { Client, types } from 'pg';
import { postgresSchema } from '../postgres-compat.js';

const sqlitePath = process.argv[2];
const url = process.env.PLATFORM_DATABASE_URL;
if (!sqlitePath || !url) {
  console.error('Usage: PLATFORM_DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-postgres.mjs path/to/database.sqlite');
  process.exit(2);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
types.setTypeParser(20, (value) => Number(value));
const tables = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
const byName = new Map(tables.map((table) => [table.name, table]));
const ordered = [];
const visited = new Set();
const visiting = new Set();
function visit(name) {
  if (visited.has(name)) return;
  if (visiting.has(name)) throw new Error(`cyclic SQLite table reference at ${name}`);
  visiting.add(name);
  for (const key of sqlite.prepare(`PRAGMA foreign_key_list("${name}")`).all()) {
    if (byName.has(key.table)) visit(key.table);
  }
  visiting.delete(name);
  visited.add(name);
  ordered.push(byName.get(name));
}
for (const table of tables) visit(table.name);

const pg = new Client({ connectionString: url,
  ssl: process.env.AWS_RDS_SSL === 'false' ? false : { rejectUnauthorized: true } });
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const digest = (rows) => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
try {
  await pg.connect();
  await pg.query('BEGIN');
  for (const table of ordered) await pg.query(postgresSchema(table.sql));
  const summary = [];
  for (const table of ordered) {
    const name = quote(table.name);
    const columns = sqlite.prepare(`PRAGMA table_info(${name})`).all().map((column) => column.name);
    const targetCount = Number((await pg.query(`SELECT COUNT(*) AS count FROM ${name}`)).rows[0].count);
    if (targetCount !== 0) throw new Error(`target ${table.name} contains data; import requires an empty PostgreSQL database`);
    const orderColumn = quote(columns.find((column) => column === 'id') || columns[0]);
    const sourceRows = sqlite.prepare(`SELECT ${columns.map(quote).join(', ')} FROM ${name} ORDER BY ${orderColumn}`).all();
    const insertionRows = table.name === 'audit_logs'
      ? sqlite.prepare(`SELECT ${columns.map(quote).join(', ')} FROM ${name} ORDER BY rowid`).all()
      : sourceRows;
    for (const row of insertionRows) {
      await pg.query(`INSERT INTO ${name} (${columns.map(quote).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
        columns.map((column) => row[column]));
    }
    const targetRows = (await pg.query(`SELECT ${columns.map(quote).join(', ')} FROM ${name} ORDER BY ${orderColumn}`)).rows;
    if (targetRows.length !== sourceRows.length || digest(targetRows) !== digest(sourceRows)) {
      throw new Error(`row verification failed for ${table.name}`);
    }
    summary.push({ table: table.name, rows: sourceRows.length, sha256: digest(sourceRows) });
  }
  await pg.query('COMMIT');
  console.log(JSON.stringify({ migrated: summary }, null, 2));
} catch (error) {
  await pg.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pg.end();
  sqlite.close();
}
