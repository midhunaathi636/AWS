/* Synchronous compatibility bridge for the existing SQLite-shaped API.
 * Each Lambda environment processes one query at a time through a worker thread.
 * The worker owns the PostgreSQL connection.
 */

import { DatabaseSync } from 'node:sqlite';
import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads';

const WAIT_MS = 30000;

export function translateSql(sql) {
  let translated = sql.replace(/\bPRAGMA\s+foreign_keys\s*=\s*(ON|OFF)\s*;?/gi, '')
    .replace(/\bBEGIN\s+IMMEDIATE\b/gi, 'BEGIN')
    .replace(/\b(?:[a-z_]+\.)?rowid\b/gi, (match) => match.replace(/rowid/i, '_rowid'));
  const pragma = translated.trim().match(/^PRAGMA\s+table_info\((\w+)\)$/i);
  if (pragma) return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${pragma[1]}'`;
  const replace = translated.match(/^\s*INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$/is);
  if (replace) {
    const [, table, columns, values] = replace;
    const names = columns.split(',').map((column) => column.trim());
    const conflicts = { two_factor_setups: 'user_id', fl_rounds: 'experiment_id, round_number' };
    if (!conflicts[table]) throw new Error(`Unsupported SQLite replacement table: ${table}`);
    translated = `INSERT INTO ${table} (${columns}) VALUES (${values}) ON CONFLICT (${conflicts[table]}) DO UPDATE SET ${names.map((name) => `${name} = EXCLUDED.${name}`).join(', ')}`;
  } else if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO').trim().replace(/;$/, '') + ' ON CONFLICT DO NOTHING';
  }
  translated = translated.replace(/\bAS\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, 'AS "$1"');
  let parameter = 0;
  return translated.replace(/\?/g, () => `$${++parameter}`).trim();
}

export function postgresSchema(sqliteSchema) {
  const translated = translateSql(sqliteSchema)
    .replace(/\bINTEGER\b/gi, 'BIGINT')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION');
  return /CREATE TABLE (?:IF NOT EXISTS )?audit_logs\s*\(/i.test(translated)
    ? `${translated}; ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS _rowid BIGSERIAL;`
    : translated;
}

export function createDatabase(path, schema) {
  if (!process.env.PLATFORM_DATABASE_URL && !process.env.AWS_RDS_SECRET_ARN) {
    const sqlite = new DatabaseSync(path);
    sqlite.exec(schema);
    return sqlite;
  }
  const { port1, port2 } = new MessageChannel();
  const ready = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(new URL('./postgres-worker.js', import.meta.url), {
    workerData: { port: port2, ready: ready.buffer, schema: postgresSchema(schema),
      databaseUrl: process.env.PLATFORM_DATABASE_URL || '',
      secretArn: process.env.AWS_RDS_SECRET_ARN || '',
      proxyEndpoint: process.env.AWS_RDS_PROXY_ENDPOINT || '',
      databaseName: process.env.AWS_RDS_DATABASE || '' },
    transferList: [port2],
  });
  worker.unref();
  const wait = (flag) => {
    const status = Atomics.wait(flag, 0, 0, WAIT_MS);
    if (status === 'timed-out') throw new Error('PostgreSQL query timed out');
    const message = receiveMessageOnPort(port1)?.message;
    if (!message) throw new Error('PostgreSQL worker returned no result');
    if (message.error) throw new Error(message.error);
    return message;
  };
  wait(ready);
  const query = (sql, params = []) => {
    const translated = translateSql(sql);
    if (!translated) return { rows: [], rowCount: 0 };
    const flag = new Int32Array(new SharedArrayBuffer(4));
    port1.postMessage({ sql: translated, params, flag: flag.buffer });
    return wait(flag);
  };
  return {
    exec: (sql) => query(sql),
    prepare: (sql) => ({
      get: (...params) => query(sql, params).rows[0],
      all: (...params) => query(sql, params).rows,
      run: (...params) => ({ changes: query(sql, params).rowCount }),
    }),
  };
}
