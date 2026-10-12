import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translateSql, postgresSchema } from '../postgres-compat.js';

test('SQLite compatibility covers legacy query forms used by the API', () => {
  assert.match(translateSql('PRAGMA table_info(users)'), /information_schema\.columns/);
  assert.match(translateSql('INSERT OR IGNORE INTO users (id) VALUES (?)'), /ON CONFLICT DO NOTHING/);
  assert.match(translateSql('INSERT OR REPLACE INTO two_factor_setups (user_id, expires_at) VALUES (?, ?)'), /ON CONFLICT \(user_id\)/);
  assert.match(translateSql('INSERT OR REPLACE INTO fl_rounds (id, experiment_id, round_number) VALUES (?, ?, ?)'), /ON CONFLICT \(experiment_id, round_number\)/);
  assert.equal(translateSql("SELECT a.id AS experimentId FROM audit_logs a ORDER BY a.rowid DESC LIMIT ?"),
    'SELECT a.id AS "experimentId" FROM audit_logs a ORDER BY a._rowid DESC LIMIT $1');
  assert.equal(translateSql('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE'), 'BEGIN');
  assert.match(postgresSchema('CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, expires_at INTEGER, score REAL);'), /_rowid BIGSERIAL/);
  assert.match(postgresSchema('CREATE TABLE x (id INTEGER, score REAL)'), /id BIGINT, score DOUBLE PRECISION/);
});
