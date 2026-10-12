import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './postgres-compat.js';
import { awsServiceStatus, putEncryptedDataset, getEncryptedDataset, deleteDatasetObject, putModelArtifact, putReportArtifact, getReportArtifact, putBackupDatasetObject, getBackupDatasetObject, authenticateCognito, completeCognitoChallenge, recordTrainingMetrics, putSageMakerInput, startSageMakerJob, describeSageMakerJob, saveCloudBackup, loadCloudBackup, listCloudBackups } from './aws-services.js';
import { createExperimentPdf } from './report-pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const REPORT_DIR = path.join(DATA_DIR, 'reports');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'secure-platform.sqlite');
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-change-me';
const ENCRYPTION_KEY = crypto.createHash('sha256')
  .update(process.env.FILE_ENCRYPTION_KEY || 'development-file-key-change-me')
  .digest();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const db = createDatabase(DB_PATH, `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL,
    admin_name TEXT NOT NULL, admin_email TEXT NOT NULL, status TEXT NOT NULL,
    joined_date TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', contact_phone TEXT NOT NULL DEFAULT '',
    public_key_fingerprint TEXT NOT NULL DEFAULT '', max_storage_gb REAL NOT NULL DEFAULT 1000
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id), role TEXT NOT NULL, status TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT '', two_factor_enabled INTEGER NOT NULL DEFAULT 0,
    two_factor_secret TEXT, permissions_json TEXT NOT NULL DEFAULT '[]', last_login TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_challenges (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, provider_session TEXT
  );
  CREATE TABLE IF NOT EXISTS two_factor_setups (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, secret_ciphertext TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_extension TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id), category TEXT NOT NULL, classification TEXT NOT NULL,
    size_bytes INTEGER NOT NULL, size_formatted TEXT NOT NULL, upload_date TEXT NOT NULL, status TEXT NOT NULL,
    encryption_hash TEXT NOT NULL, records_count INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]', storage_name TEXT NOT NULL, nonce TEXT NOT NULL, auth_tag TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    shared_by_org_id TEXT NOT NULL, shared_with_org_id TEXT NOT NULL, permission TEXT NOT NULL,
    shared_date TEXT NOT NULL, expiry_date TEXT NOT NULL, status TEXT NOT NULL, token_hash TEXT NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0, dp_epsilon REAL
  );
  CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    requester_org_id TEXT NOT NULL REFERENCES organizations(id), owner_org_id TEXT NOT NULL REFERENCES organizations(id),
    requester_user_id TEXT NOT NULL REFERENCES users(id), permission TEXT NOT NULL, rationale TEXT NOT NULL,
    expiry_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', created_at TEXT NOT NULL,
    reviewed_at TEXT, reviewed_by TEXT REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS org_messages (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS partner_messages (
    id TEXT PRIMARY KEY, first_org_id TEXT NOT NULL REFERENCES organizations(id),
    second_org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL, link_tab TEXT,
    created_at TEXT NOT NULL, read_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, result TEXT NOT NULL,
    ip_address TEXT NOT NULL, details TEXT NOT NULL, resource_id TEXT, integrity_hash TEXT NOT NULL, previous_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS fl_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fl_experiments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, algorithm TEXT NOT NULL,
    target_column TEXT NOT NULL, rounds INTEGER NOT NULL, current_round INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, completed_at TEXT,
    config_json TEXT NOT NULL DEFAULT '{}', result_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS fl_rounds (
    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES fl_experiments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL, status TEXT NOT NULL, global_metrics_json TEXT NOT NULL DEFAULT '{}',
    client_metrics_json TEXT NOT NULL DEFAULT '[]', model_artifact TEXT, created_at TEXT NOT NULL,
    UNIQUE(experiment_id, round_number)
  );
  CREATE TABLE IF NOT EXISTS model_versions (
    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES fl_experiments(id),
    version TEXT NOT NULL, artifact_json TEXT NOT NULL, metrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS experiment_reports (
    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL UNIQUE REFERENCES fl_experiments(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL, created_at TEXT NOT NULL, sha256_hash TEXT NOT NULL, s3_key TEXT
  );
  CREATE TABLE IF NOT EXISTS aws_jobs (
    id TEXT PRIMARY KEY, training_job_name TEXT UNIQUE NOT NULL, organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL, dataset_id TEXT NOT NULL, created_at TEXT NOT NULL
  );
`);

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
if (!userColumns.has('two_factor_secret')) db.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
const challengeColumns = new Set(db.prepare('PRAGMA table_info(login_challenges)').all().map((column) => column.name));
if (!challengeColumns.has('provider_session')) db.exec('ALTER TABLE login_challenges ADD COLUMN provider_session TEXT');
const auditColumns = new Set(db.prepare('PRAGMA table_info(audit_logs)').all().map((column) => column.name));
if (!auditColumns.has('previous_hash')) db.exec('ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT');
// Old demo records only had a cosmetic 2FA flag; do not lock those users out.
db.exec('UPDATE users SET two_factor_enabled = 0 WHERE two_factor_enabled = 1 AND two_factor_secret IS NULL');

const passwordHash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return expected && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const encodeBase32 = (buffer) => {
  let bits = 0; let value = 0; let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};
const decodeBase32 = (encoded) => {
  let bits = 0; let value = 0; const output = [];
  for (const char of encoded.toUpperCase().replace(/=+$/, '')) {
    const digit = BASE32.indexOf(char);
    if (digit < 0) throw new Error('Invalid TOTP secret');
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
};
const totp = (secret, timestamp = Date.now()) => {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
};
const verifyTotp = (secret, code) => {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const supplied = Buffer.from(String(code));
  return [-1, 0, 1].some((step) => {
    const expected = Buffer.from(totp(secret, Date.now() + step * 30000));
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
};
const encryptSecret = (value) => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, nonce);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${nonce.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
};
const decryptSecret = (value) => {
  const [nonce, tag, data] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(nonce, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
};

const seedUser = (user) => {
  db.prepare(`INSERT OR IGNORE INTO users
    (id, name, email, password_hash, organization_id, role, status, phone, department, two_factor_enabled, permissions_json, last_login)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`)
    .run(user.id, user.name, user.email, passwordHash('Demo@123'), user.organizationId, user.role,
      user.phone, user.department, 0, JSON.stringify(user.permissions), user.lastLogin);
};

const seed = () => {
  const organizations = [
    ['org-apollo', 'Apollo Hospital Network', 'Hospital Network', 'Chennai & New Delhi, IN', 'Dr. Vikram Sharma', 'vikram.sharma@apollohospitals.demo', '2025-03-12', 'Premier tertiary healthcare provider.', '+91 (044) 2829-0200'],
    ['org-fortis', 'Fortis Healthcare', 'Healthcare Network', 'Gurgaon & Mumbai, IN', 'Dr. Rajesh Kulkarni', 'rajesh.kulkarni@fortishealthcare.demo', '2025-06-18', 'Integrated healthcare delivery provider.', '+91 (0124) 492-1021'],
    ['org-abc', 'ABC Research Labs', 'Biotech Research Lab', 'Bengaluru Tech Park, IN', 'Dr. Ananya Iyer', 'ananya.iyer@abcresearch.demo', '2025-09-04', 'Computational biology and biomedical research lab.', '+91 (080) 6780-3300']
  ];
  const insertOrg = db.prepare(`INSERT OR IGNORE INTO organizations
    (id, name, type, location, admin_name, admin_email, status, joined_date, description, contact_phone, public_key_fingerprint)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`);
  organizations.forEach((org) => insertOrg.run(...org, `SHA256:${crypto.randomBytes(20).toString('hex')}`));
  seedUser({ id: 'usr-1', name: 'Dr. Vikram Sharma', email: organizations[0][5], organizationId: 'org-apollo', role: 'System Admin', phone: '+91 98401 22910', department: 'Chief Medical Informatics & Security', twoFactorEnabled: true, permissions: ['all_access', 'manage_orgs', 'federated_orchestration', 'audit_export'], lastLogin: '' });
  seedUser({ id: 'usr-2', name: 'Dr. Rajesh Kulkarni', email: organizations[1][5], organizationId: 'org-fortis', role: 'Doctor', phone: '+91 99203 11842', department: 'Clinical Oncology & Diagnostics', twoFactorEnabled: true, permissions: ['view_data', 'share_data', 'view_reports', 'preview_records'], lastLogin: '' });
  seedUser({ id: 'usr-3', name: 'Dr. Ananya Iyer', email: organizations[2][5], organizationId: 'org-abc', role: 'Researcher', phone: '+91 99880 44022', department: 'Computational Biology', twoFactorEnabled: false, permissions: ['view_data', 'upload_datasets', 'train_models', 'view_analytics'], lastLogin: '' });
};
if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_SEED === 'true') seed();
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true' &&
    db.prepare("SELECT 1 FROM users WHERE email LIKE '%.demo' AND status = 'active' LIMIT 1").get()) {
  throw new Error('Production database contains demo users; remove or disable them before starting the API');
}
db.prepare('INSERT OR IGNORE INTO fl_state (id, payload_json) VALUES (1, ?)').run(JSON.stringify({ currentRound: 0, totalRounds: 5, isTraining: false, isPaused: false, status: 'Idle', globalAccuracy: 0, logs: [], clientNodes: [] }));

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
const upload = multer({ dest: path.join(DATA_DIR, 'tmp'), limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 500 * 1024 * 1024) } });

const nowIso = () => new Date().toISOString();
const dateOnly = () => nowIso().slice(0, 10);
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const formatSize = (bytes) => bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(2)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
const signSession = (token) => crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');

const publicUser = (row) => ({
  id: row.id, name: row.name, email: row.email, organizationId: row.organization_id,
  organizationName: row.organization_name, role: row.role, status: row.status, lastLogin: row.last_login || '',
  phone: row.phone, department: row.department, twoFactorEnabled: Boolean(row.two_factor_enabled), permissions: JSON.parse(row.permissions_json)
});

const getUser = (userId) => db.prepare(`SELECT u.*, o.name AS organization_name FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = ?`).get(userId);
const getSessionUser = (req) => {
  const raw = req.headers.cookie?.match(/sc_session=([^;]+)/)?.[1];
  if (!raw) return null;
  const session = db.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(signSession(raw), Date.now());
  return session ? getUser(session.user_id) : null;
};
const requireAuth = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
};
const requirePermission = (...permissions) => (req, res, next) => {
  const current = JSON.parse(req.user.permissions_json);
  if (req.user.role === 'System Admin' || permissions.some((permission) => current.includes(permission))) return next();
  return res.status(403).json({ error: 'Insufficient permission' });
};
const notifyOrganization = (organizationId, title, message, type, linkTab) => {
  const insert = db.prepare('INSERT INTO notifications (id, user_id, title, message, type, link_tab, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const user of db.prepare("SELECT id FROM users WHERE organization_id = ? AND status = 'active'").all(organizationId))
    insert.run(id('not'), user.id, title, message, type, linkTab, nowIso());
};
const audit = (req, action, result, details, resourceId = null) => {
  const postgres = Boolean(process.env.PLATFORM_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN);
  try {
    if (postgres) {
      db.exec('BEGIN');
      db.prepare('SELECT pg_advisory_xact_lock(70104)').get();
    }
    const timestamp = nowIso();
    const previousHash = db.prepare('SELECT integrity_hash FROM audit_logs ORDER BY rowid DESC LIMIT 1').get()?.integrity_hash || '';
    const values = [timestamp, req.user?.id || null, action, result, req.ip, details, resourceId, previousHash];
    const integrityHash = hash(JSON.stringify(values));
    db.prepare(`INSERT INTO audit_logs (id, timestamp, user_id, action, result, ip_address, details, resource_id, integrity_hash, previous_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id('aud'), timestamp, req.user?.id || null, action, result, req.ip, details, resourceId, integrityHash, previousHash);
    if (postgres) db.exec('COMMIT');
  } catch (error) {
    if (postgres) db.exec('ROLLBACK');
    throw error;
  }
  if (req.user && (result === 'Failed' || result === 'Warning'))
    notifyOrganization(req.user.organization_id, action, details, 'security', 'audit-logs');
};
const safeFileName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
const countCsvRecords = (buffer) => {
  const content = buffer.toString('utf8');
  let quoted = false; let rows = 0; let hasContent = false;
  for (const character of content) {
    if (character === '"') quoted = !quoted;
    else if (character === '\n' && !quoted) { if (hasContent) rows++; hasContent = false; }
    else if (character !== '\r') hasContent = true;
  }
  if (hasContent) rows++;
  return Math.max(0, rows - 1);
};
const decryptDataset = async (file) => {
  const encrypted = await getEncryptedDataset(file.storage_name) || fs.readFileSync(path.join(UPLOAD_DIR, file.storage_name));
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(file.nonce, 'hex'));
  decipher.setAuthTag(Buffer.from(file.auth_tag, 'hex'));
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};
const canUseDatasetForTraining = (file, user) => {
  if (file.organization_id === user.organization_id || user.role === 'System Admin') return true;
  return Boolean(db.prepare(`SELECT 1 FROM shares WHERE file_id = ? AND shared_with_org_id = ? AND status = 'Active' AND expiry_date >= ? AND permission IN ('Federated Train Only', 'Restricted Compute', 'Full Collaboration') LIMIT 1`).get(file.id, user.organization_id, dateOnly()));
};
const runFederatedTrainer = (payload) => new Promise((resolve, reject) => {
  const child = spawn(process.env.PYTHON_BIN || 'python3', [path.join(__dirname, 'ml_service', 'federated_trainer.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; let error = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { error += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code !== 0) return reject(new Error(error || 'Federated trainer failed'));
    try {
      const result = JSON.parse(output);
      if (result.error) return reject(new Error(result.error));
      resolve(result);
    } catch { reject(new Error('Federated trainer returned invalid output')); }
  });
  child.stdin.end(JSON.stringify(payload));
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'secure-collaborative-learning-api', mode: process.env.NODE_ENV === 'production' ? 'production' : 'development' }));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

const findActiveUserByEmail = (email) =>
  db.prepare(
    `SELECT u.*, o.name AS organization_name
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE lower(u.email) = lower(?) AND u.status = 'active'`
  ).get(String(email || '').trim());

const findActiveUserById = (userId) =>
  db.prepare(
    `SELECT u.*, o.name AS organization_name
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = ? AND u.status = 'active'`
  ).get(userId);

const createLoginChallenge = (userId, providerSession = null) => {
  const challenge = crypto.randomBytes(32).toString('hex');
  db.prepare(
    `INSERT INTO login_challenges (token_hash, user_id, expires_at, attempts, provider_session)
     VALUES (?, ?, ?, 0, ?)`
  ).run(signSession(challenge), userId, Date.now() + CHALLENGE_TTL_MS, providerSession);
  return challenge;
};

const issueSession = (req, res, user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(signSession(rawToken), user.id, expiresAt);
  db.prepare(`UPDATE users SET last_login = ? WHERE id = ?`).run(nowIso(), user.id);
  req.user = user;
  audit(req, 'Login', 'Success', 'Authenticated user session created');
  res.cookie('sc_session', rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
  });
  res.json({ user: publicUser({ ...user, last_login: nowIso() }) });
};

const respondTwoFactorRequired = (res, challengeToken) =>
  res.json({ twoFactorRequired: true, challengeToken });

/**
 * Complete sign-in for a verified local or Cognito identity.
 * Issues a session immediately, or starts a local TOTP challenge when required.
 */
const completeAuthenticatedLogin = (req, res, user, { cognitoProviderSession = null } = {}) => {
  if (user.two_factor_enabled && user.two_factor_secret) {
    const providerSession = cognitoProviderSession
      ? JSON.stringify({ localTotp: true })
      : null;
    const challengeToken = createLoginChallenge(user.id, providerSession);
    return respondTwoFactorRequired(res, challengeToken);
  }
  return issueSession(req, res, user);
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Flow:
 * 1. Resolve active user by email (case-insensitive).
 * 2. If Cognito is configured, authenticate against Cognito; otherwise verify local password hash.
 * 3. Handle Cognito MFA challenges (SOFTWARE_TOKEN_MFA / SMS_MFA) by storing a short-lived challenge.
 * 4. If the local account has TOTP enabled, require a second factor.
 * 5. Otherwise create an HTTP-only session cookie and return the public user profile.
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      audit(req, 'Login', 'Failed', 'Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = findActiveUserByEmail(email);
    if (!user) {
      audit(req, 'Login', 'Failed', 'Invalid sign-in credentials');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const cognitoEnabled = Boolean(process.env.AWS_COGNITO_CLIENT_ID);

    if (cognitoEnabled) {
      let cognitoResult;
      try {
        cognitoResult = await authenticateCognito(user.email, password);
      } catch (error) {
        const code = error?.name || error?.code;
        if (code === 'NotAuthorizedException' || code === 'UserNotFoundException') {
          audit(req, 'Login', 'Failed', 'Invalid Cognito credentials');
          return res.status(401).json({ error: 'Invalid email or password' });
        }
        console.error('Cognito sign-in failed', code || error);
        return res.status(503).json({ error: 'Cognito authentication is temporarily unavailable' });
      }

      if (cognitoResult?.ChallengeName) {
        const allowed = new Set(['SOFTWARE_TOKEN_MFA', 'SMS_MFA']);
        if (!allowed.has(cognitoResult.ChallengeName)) {
          return res.status(401).json({
            error: `Cognito challenge ${cognitoResult.ChallengeName} must be completed by an administrator first`,
          });
        }
        const providerSession = JSON.stringify({
          challengeName: cognitoResult.ChallengeName,
          session: cognitoResult.Session,
        });
        const challengeToken = createLoginChallenge(user.id, providerSession);
        return respondTwoFactorRequired(res, challengeToken);
      }

      if (!cognitoResult?.AuthenticationResult) {
        return res.status(401).json({ error: 'Cognito returned an unsupported sign-in challenge' });
      }

      return completeAuthenticatedLogin(req, res, user, { cognitoProviderSession: true });
    }

    // Local password authentication
    if (!verifyPassword(password, user.password_hash)) {
      req.user = user;
      audit(req, 'Login', 'Failed', 'Invalid sign-in credentials');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return completeAuthenticatedLogin(req, res, user);
  } catch (error) {
    console.error('Login handler error', error);
    return res.status(500).json({ error: 'Unable to complete sign-in' });
  }
});

/**
 * POST /api/auth/login/verify
 * Body: { challengeToken, code }
 *
 * Completes a pending MFA / TOTP challenge and issues a session.
 */
app.post('/api/auth/login/verify', async (req, res) => {
  try {
    const challengeToken = String(req.body?.challengeToken || '');
    const code = String(req.body?.code || '').trim();

    if (!challengeToken || !code) {
      return res.status(400).json({ error: 'Challenge token and authenticator code are required' });
    }

    const challengeHash = signSession(challengeToken);
    const challenge = db
      .prepare(`SELECT * FROM login_challenges WHERE token_hash = ? AND expires_at > ?`)
      .get(challengeHash, Date.now());

    if (!challenge) {
      return res.status(401).json({ error: 'Two-factor challenge expired; sign in again' });
    }

    if ((challenge.attempts || 0) >= MAX_CHALLENGE_ATTEMPTS) {
      db.prepare(`DELETE FROM login_challenges WHERE token_hash = ?`).run(challengeHash);
      return res.status(401).json({ error: 'Too many invalid codes; sign in again' });
    }

    const user = findActiveUserById(challenge.user_id);
    if (!user) {
      db.prepare(`DELETE FROM login_challenges WHERE token_hash = ?`).run(challengeHash);
      return res.status(401).json({ error: 'Account is no longer active; sign in again' });
    }

    const incrementAttempts = () =>
      db.prepare(`UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?`).run(challengeHash);

    if (challenge.provider_session) {
      let provider;
      try {
        provider = JSON.parse(challenge.provider_session);
      } catch {
        db.prepare(`DELETE FROM login_challenges WHERE token_hash = ?`).run(challengeHash);
        return res.status(401).json({ error: 'Invalid challenge state; sign in again' });
      }

      if (provider.localTotp) {
        if (!user.two_factor_secret || !verifyTotp(decryptSecret(user.two_factor_secret), code)) {
          incrementAttempts();
          return res.status(401).json({ error: 'Invalid authenticator code' });
        }
      } else {
        try {
          const auth = await completeCognitoChallenge(
            provider.challengeName,
            {
              USERNAME: user.email,
              [`${provider.challengeName}_CODE`]: code,
            },
            provider.session
          );
          if (!auth?.AuthenticationResult) {
            throw new Error('Cognito did not complete the sign-in challenge');
          }
          // After Cognito MFA, still require local TOTP when enabled on the account
          if (user.two_factor_enabled && user.two_factor_secret) {
            db.prepare(`DELETE FROM login_challenges WHERE token_hash = ?`).run(challengeHash);
            const localChallenge = createLoginChallenge(user.id, JSON.stringify({ localTotp: true }));
            return respondTwoFactorRequired(res, localChallenge);
          }
        } catch (error) {
          incrementAttempts();
          if (error?.name === 'NotAuthorizedException' || error?.name === 'CodeMismatchException') {
            return res.status(401).json({ error: 'Invalid authenticator code' });
          }
          console.error('Cognito MFA challenge failed', error?.name || error);
          return res.status(503).json({ error: 'Cognito verification is temporarily unavailable' });
        }
      }
    } else {
      if (!user.two_factor_secret || !verifyTotp(decryptSecret(user.two_factor_secret), code)) {
        incrementAttempts();
        return res.status(401).json({ error: 'Invalid authenticator code' });
      }
    }

    db.prepare(`DELETE FROM login_challenges WHERE token_hash = ?`).run(challengeHash);
    return issueSession(req, res, user);
  } catch (error) {
    console.error('Login verify handler error', error);
    return res.status(500).json({ error: 'Unable to complete two-factor verification' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/totp/setup', requireAuth, (req, res) => {
  const user = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(req.user.id);
  if (user.two_factor_enabled) return res.status(409).json({ error: 'Two-factor authentication is already enabled' });
  const secret = encodeBase32(crypto.randomBytes(20));
  db.prepare('INSERT OR REPLACE INTO two_factor_setups (user_id, secret_ciphertext, expires_at) VALUES (?, ?, ?)').run(req.user.id, encryptSecret(secret), Date.now() + 10 * 60 * 1000);
  const account = encodeURIComponent(req.user.email);
  res.json({ secret, otpauthUrl: `otpauth://totp/${account}?secret=${secret}&issuer=Secure%20Collaborative%20Learning%20Platform&algorithm=SHA1&digits=6&period=30` });
});
app.post('/api/auth/totp/confirm', requireAuth, (req, res) => {
  const setup = db.prepare('SELECT * FROM two_factor_setups WHERE user_id = ? AND expires_at > ?').get(req.user.id, Date.now());
  if (!setup) return res.status(400).json({ error: 'Authenticator setup expired; start again' });
  const secret = decryptSecret(setup.secret_ciphertext);
  if (!verifyTotp(secret, req.body?.code)) return res.status(400).json({ error: 'Invalid authenticator code' });
  db.prepare('UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1 WHERE id = ?').run(encryptSecret(secret), req.user.id);
  db.prepare('DELETE FROM two_factor_setups WHERE user_id = ?').run(req.user.id);
  audit(req, 'Enable TOTP Two-Factor Authentication', 'Success', 'Authenticator app verified and enabled');
  res.json({ ok: true });
});
app.post('/api/auth/totp/disable', requireAuth, (req, res) => {
  const user = db.prepare('SELECT password_hash, two_factor_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user?.two_factor_secret || !verifyPassword(req.body?.password || '', user.password_hash) || !verifyTotp(decryptSecret(user.two_factor_secret), req.body?.code)) return res.status(401).json({ error: 'Password or authenticator code is invalid' });
  db.prepare('UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?').run(req.user.id);
  audit(req, 'Disable TOTP Two-Factor Authentication', 'Warning', 'Authenticator app disabled');
  res.json({ ok: true });
});
app.post('/api/auth/password', requireAuth, (req, res) => {
  if (process.env.AWS_COGNITO_CLIENT_ID) return res.status(501).json({ error: 'Password changes for Cognito accounts must use the Cognito account flow' });
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (!verifyPassword(current, req.user.password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });
  if (next.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash(next), req.user.id);
  const rawToken = req.headers.cookie?.match(/sc_session=([^;]+)/)?.[1];
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, signSession(rawToken));
  audit(req, 'Change Password', 'Success', 'Account password changed');
  res.json({ ok: true });
});
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const rawToken = req.headers.cookie?.match(/sc_session=([^;]+)/)?.[1];
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(signSession(rawToken));
  audit(req, 'Logout', 'Success', 'Authenticated user session closed');
  res.clearCookie('sc_session');
  res.json({ ok: true });
});

app.get('/api/organizations', requireAuth, (_req, res) => {
  const rows = db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS users_count, (SELECT COUNT(*) FROM datasets d WHERE d.organization_id = o.id) AS files_count, (SELECT COALESCE(SUM(size_bytes), 0) FROM datasets d WHERE d.organization_id = o.id) AS storage_bytes FROM organizations o`).all();
  const performance = new Map();
  for (const round of db.prepare("SELECT client_metrics_json FROM fl_rounds WHERE status = 'Completed'").all()) {
    for (const client of JSON.parse(round.client_metrics_json)) {
      if (client.data_split !== 'validation') continue;
      const aggregate = performance.get(client.client_id) || { rounds: 0, accuracy: 0 };
      aggregate.rounds++;
      aggregate.accuracy += Number(client.accuracy || 0);
      performance.set(client.client_id, aggregate);
    }
  }
  res.json({ organizations: rows.map((row) => { const measured = performance.get(row.id); return { id: row.id, name: row.name, type: row.type, location: row.location, adminName: row.admin_name, adminEmail: row.admin_email, usersCount: row.users_count, storageUsedGb: Number((row.storage_bytes / 1024 ** 3).toFixed(3)), maxStorageGb: row.max_storage_gb, status: row.status, joinedDate: row.joined_date, filesCount: row.files_count, trainingRoundsParticipated: measured?.rounds || 0, avgAccuracy: measured ? Number((measured.accuracy / measured.rounds * 100).toFixed(2)) : 0, description: row.description, contactPhone: row.contact_phone, publicKeyFingerprint: row.public_key_fingerprint }; }) });
});

app.get('/api/aws/status', requireAuth, (_req, res) => res.json({ configured: awsServiceStatus() }));
app.post('/api/aws/sagemaker-jobs', requireAuth, requirePermission('federated_orchestration'), async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(501).json({ error: 'Central CSV export is disabled in production; use organization-owned workers' });
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.body?.datasetId);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
  if (!canUseDatasetForTraining(dataset, req.user)) return res.status(403).json({ error: 'Dataset access denied' });
  if (dataset.file_extension !== 'csv') return res.status(400).json({ error: 'The configured SageMaker training image accepts CSV inputs only' });
  try {
    const jobName = `${String(req.body?.jobName || 'platform-training').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 42)}-${crypto.randomUUID().slice(0, 8)}`;
    const plaintext = await decryptDataset(dataset);
    const inputUri = await putSageMakerInput(`sagemaker-input/${req.user.organization_id}/${jobName}/data.csv`, plaintext);
    const result = await startSageMakerJob({ jobName, s3InputUri: inputUri, hyperParameters: req.body?.hyperParameters || {} });
    db.prepare('INSERT INTO aws_jobs (id, training_job_name, organization_id, user_id, dataset_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id('smjob'), result.trainingJobName, req.user.organization_id, req.user.id, dataset.id, nowIso());
    audit(req, 'Start SageMaker Training Job', 'Success', `Started SageMaker job ${result.trainingJobName}`, result.trainingJobName);
    res.status(202).json(result);
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Could not start SageMaker job' });
  }
});
app.get('/api/aws/sagemaker-jobs/:name', requireAuth, async (req, res) => {
  const job = db.prepare('SELECT * FROM aws_jobs WHERE training_job_name = ?').get(req.params.name);
  if (!job || (job.organization_id !== req.user.organization_id && req.user.role !== 'System Admin')) return res.status(404).json({ error: 'SageMaker job not found' });
  try { res.json({ jobName: job.training_job_name, ...(await describeSageMakerJob(job.training_job_name)) }); }
  catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Could not read SageMaker job status' }); }
});

const BACKUP_TABLES = ['organizations', 'users', 'sessions', 'login_challenges', 'two_factor_setups', 'datasets', 'shares', 'access_requests', 'org_messages', 'partner_messages', 'notifications', 'audit_logs', 'fl_state', 'fl_experiments', 'fl_rounds', 'model_versions', 'experiment_reports', 'aws_jobs'];
app.get('/api/aws/backups', requireAuth, requirePermission('manage_orgs'), async (_req, res) => {
  try { res.json({ backups: await listCloudBackups() }); }
  catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Could not list cloud backups' }); }
});
app.post('/api/aws/backups', requireAuth, requirePermission('manage_orgs'), async (req, res) => {
  try {
    const backupId = id('backup');
    const transientTables = new Set(['sessions', 'login_challenges']);
    const tables = Object.fromEntries(BACKUP_TABLES.map((table) => [table,
      transientTables.has(table) ? [] : table === 'audit_logs'
        ? db.prepare('SELECT * FROM audit_logs ORDER BY rowid').all().map(({ _rowid, ...row }) => row)
        : db.prepare(`SELECT * FROM ${table}`).all()]));
    const datasets = tables.datasets;
    for (const dataset of datasets) {
      const encrypted = await getEncryptedDataset(dataset.storage_name) || fs.readFileSync(path.join(UPLOAD_DIR, dataset.storage_name));
      await putBackupDatasetObject(backupId, dataset.storage_name, encrypted);
    }
    for (const report of tables.experiment_reports) await putBackupDatasetObject(backupId, `reports/${report.file_name}`, fs.readFileSync(path.join(REPORT_DIR, report.file_name)));
    const result = await saveCloudBackup(backupId, { version: 2, createdAt: nowIso(), tables });
    audit(req, 'Create Cloud Backup', 'Success', `Created cloud backup ${backupId}`, backupId);
    res.status(201).json({ ...result, createdAt: nowIso(), datasetObjects: datasets.length });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Cloud backup failed' });
  }
});
app.post('/api/aws/backups/:id/restore', requireAuth, requirePermission('manage_orgs'), async (req, res) => {
  if (req.user.role !== 'System Admin' || req.body?.confirmation !== `RESTORE ${req.params.id}`) return res.status(400).json({ error: 'System Admin must confirm with the exact RESTORE <backup-id> phrase' });
  try {
    const snapshot = await loadCloudBackup(req.params.id);
    const legacyTables = BACKUP_TABLES.filter((table) => !['partner_messages', 'notifications', 'experiment_reports'].includes(table));
    if (![1, 2].includes(snapshot?.version) || !snapshot.tables || (snapshot.version === 1 ? legacyTables : BACKUP_TABLES).some((table) => !Array.isArray(snapshot.tables[table]))) return res.status(422).json({ error: 'Backup payload is invalid or unsupported' });
    for (const table of BACKUP_TABLES) snapshot.tables[table] ||= [];
    for (const dataset of snapshot.tables.datasets) {
      const encrypted = await getBackupDatasetObject(req.params.id, dataset.storage_name);
      if (process.env.AWS_S3_DATA_BUCKET) await putEncryptedDataset(dataset.storage_name, encrypted);
      else fs.writeFileSync(path.join(UPLOAD_DIR, dataset.storage_name), encrypted);
    }
    for (const report of snapshot.tables.experiment_reports) fs.writeFileSync(path.join(REPORT_DIR, report.file_name), await getBackupDatasetObject(req.params.id, `reports/${report.file_name}`));
    const restoreTables = BACKUP_TABLES.filter((table) => !['sessions', 'login_challenges', 'two_factor_setups'].includes(table));
    db.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE');
    try {
      for (const table of [...restoreTables].reverse()) db.exec(`DELETE FROM ${table}`);
      for (const table of restoreTables) for (const row of snapshot.tables[table]) {
        const columns = Object.keys(row);
        const quoted = columns.map((column) => `"${column}"`).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`).run(...columns.map((column) => row[column]));
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally { db.exec('PRAGMA foreign_keys = ON'); }
    audit(req, 'Restore Cloud Backup', 'Warning', `Restored cloud backup ${req.params.id}`, req.params.id);
    res.json({ ok: true, restoredBackupId: req.params.id, restoredAt: nowIso() });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Cloud restore failed' });
  }
});

app.get('/api/users', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT u.*, o.name AS organization_name FROM users u JOIN organizations o ON o.id = u.organization_id ORDER BY u.name').all();
  res.json({ users: rows.map(publicUser) });
});

const datasetView = (row) => ({ id: row.id, fileName: row.file_name, fileExtension: row.file_extension, ownerName: row.owner_name, ownerEmail: row.owner_email, organizationId: row.organization_id, organizationName: row.organization_name, category: row.category, sizeBytes: row.size_bytes, sizeFormatted: row.size_formatted, uploadDate: row.upload_date, classification: row.classification, status: row.status, encryptionHash: row.encryption_hash, recordsCount: row.records_count, description: row.description, tags: JSON.parse(row.tags_json), sampleColumns: [], sampleRows: [] });
const datasetQuery = `SELECT d.*, u.name AS owner_name, u.email AS owner_email, o.name AS organization_name FROM datasets d JOIN users u ON u.id = d.owner_id JOIN organizations o ON o.id = d.organization_id`;
app.get('/api/datasets', requireAuth, (_req, res) => res.json({ files: db.prepare(`${datasetQuery} ORDER BY d.upload_date DESC`).all().map(datasetView) }));

app.post('/api/datasets', requireAuth, requirePermission('upload_datasets'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dataset file is required' });
  const originalName = safeFileName(req.file.originalname);
  const lowerName = originalName.toLowerCase();
  const supported = ['.csv', '.tar', '.tar.gz', '.nii', '.nii.gz'].some((extension) => lowerName.endsWith(extension));
  if (!supported) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: 'Unsupported file type' });
  }
  const plaintext = fs.readFileSync(req.file.path);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const storageName = `${crypto.randomUUID()}.bin`;
  try {
    if (!await putEncryptedDataset(storageName, encrypted)) fs.writeFileSync(path.join(UPLOAD_DIR, storageName), encrypted);
    fs.rmSync(req.file.path, { force: true });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(502).json({ error: error instanceof Error ? `Encrypted upload failed: ${error.message}` : 'Encrypted upload failed' });
  }
  const datasetId = id('file');
  db.prepare(`INSERT INTO datasets (id, file_name, file_extension, owner_id, organization_id, category, classification, size_bytes, size_formatted, upload_date, status, encryption_hash, records_count, description, tags_json, storage_name, nonce, auth_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Encrypted AES-256', ?, ?, ?, ?, ?, ?, ?)`)
    .run(datasetId, req.body.fileName || originalName, path.extname(originalName).replace('.', '') || 'bin', req.user.id, req.user.organization_id, req.body.category || 'Genomics & Sequencing', req.body.classification || 'Confidential', plaintext.length, formatSize(plaintext.length), dateOnly(), hash(plaintext), lowerName.endsWith('.csv') ? countCsvRecords(plaintext) : 0, req.body.description || '', JSON.stringify(String(req.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)), storageName, nonce.toString('hex'), authTag.toString('hex'));
  audit(req, 'Upload Encrypted Dataset', 'Success', `Uploaded and encrypted ${originalName}`, datasetId);
  res.status(201).json({ file: datasetView(db.prepare(`${datasetQuery} WHERE d.id = ?`).get(datasetId)) });
});

app.delete('/api/datasets/:id', requireAuth, requirePermission('upload_datasets'), async (req, res) => {
  const file = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Dataset not found' });
  if (file.organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Dataset belongs to another organization' });
  try { await deleteDatasetObject(file.storage_name); }
  catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'S3 delete failed' }); }
  fs.rmSync(path.join(UPLOAD_DIR, file.storage_name), { force: true });
  db.prepare('DELETE FROM datasets WHERE id = ?').run(file.id);
  audit(req, 'Purge Encrypted File', 'Success', `Deleted ${file.file_name}`, file.id);
  res.json({ ok: true });
});

app.get('/api/datasets/:id/download', requireAuth, async (req, res) => {
  const file = db.prepare(`SELECT d.*, EXISTS(SELECT 1 FROM shares s WHERE s.file_id = d.id AND s.shared_with_org_id = ? AND s.status = 'Active' AND s.expiry_date >= ? AND s.permission IN ('Read Only', 'Full Collaboration')) AS shared_access FROM datasets d WHERE d.id = ?`).get(req.user.organization_id, dateOnly(), req.params.id);
  if (!file) return res.status(404).json({ error: 'Dataset not found' });
  if (file.organization_id !== req.user.organization_id && req.user.role !== 'System Admin' && !file.shared_access) return res.status(403).json({ error: 'Dataset access denied' });
  let encrypted;
  try { encrypted = await getEncryptedDataset(file.storage_name) || fs.readFileSync(path.join(UPLOAD_DIR, file.storage_name)); }
  catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'S3 download failed' }); }
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(file.nonce, 'hex'));
  decipher.setAuthTag(Buffer.from(file.auth_tag, 'hex'));
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  audit(req, 'Download Dataset', 'Success', `Downloaded ${file.file_name}`, file.id);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(file.file_name)}"`);
  res.type('application/octet-stream').send(plaintext);
});

app.get('/api/shares', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT s.*, f.file_name, a.name AS shared_by_org_name, b.name AS shared_with_org_name FROM shares s JOIN datasets f ON f.id = s.file_id JOIN organizations a ON a.id = s.shared_by_org_id JOIN organizations b ON b.id = s.shared_with_org_id WHERE s.shared_by_org_id = ? OR s.shared_with_org_id = ? ORDER BY s.shared_date DESC`).all(req.user.organization_id, req.user.organization_id);
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  res.json({ sharedData: rows.map((row) => ({ id: row.id, fileId: row.file_id, fileName: row.file_name, sharedByOrgId: row.shared_by_org_id, sharedByOrgName: row.shared_by_org_name, sharedWithOrgId: row.shared_with_org_id, sharedWithOrgName: row.shared_with_org_name, permission: row.permission, sharedDate: row.shared_date, expiryDate: row.expiry_date, status: row.status === 'Revoked' ? 'Revoked' : row.expiry_date < dateOnly() ? 'Expired' : row.expiry_date <= soon ? 'Expiring Soon' : 'Active', tokenHash: row.token_hash, accessCount: row.access_count, differentialPrivacyEpsilon: row.dp_epsilon })) });
});

app.post('/api/shares', requireAuth, requirePermission('share_data'), (req, res) => {
  const { fileId, sharedWithOrgId, permission, expiryDate, dpEpsilon } = req.body || {};
  const file = db.prepare('SELECT * FROM datasets WHERE id = ?').get(fileId);
  const target = db.prepare('SELECT id FROM organizations WHERE id = ?').get(sharedWithOrgId);
  if (!file || !target) return res.status(404).json({ error: 'Dataset or destination organization not found' });
  if (file.organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only the owning organization can share this dataset' });
  if (!['Read Only', 'Federated Train Only', 'Restricted Compute', 'Full Collaboration'].includes(permission || 'Read Only')) return res.status(400).json({ error: 'Invalid share permission' });
  const expires = expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires <= dateOnly()) return res.status(400).json({ error: 'A future expiry date is required' });
  if (dpEpsilon != null && (!Number.isFinite(Number(dpEpsilon)) || Number(dpEpsilon) <= 0)) return res.status(400).json({ error: 'Requested epsilon must be positive' });
  const shareId = id('shr');
  db.prepare(`INSERT INTO shares (id, file_id, shared_by_org_id, shared_with_org_id, permission, shared_date, expiry_date, status, token_hash, dp_epsilon) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`)
    .run(shareId, fileId, file.organization_id, sharedWithOrgId, permission || 'Read Only', dateOnly(), expires, hash(crypto.randomBytes(32)), dpEpsilon == null ? null : Number(dpEpsilon));
  audit(req, 'Generate Secure Sharing Grant', 'Success', `Shared ${file.file_name}`, shareId);
  res.status(201).json({ ok: true, id: shareId });
});

app.patch('/api/shares/:id/revoke', requireAuth, requirePermission('share_data'), (req, res) => {
  const share = db.prepare('SELECT s.*, f.file_name FROM shares s JOIN datasets f ON f.id = s.file_id WHERE s.id = ?').get(req.params.id);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.shared_by_org_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only the owner can revoke this share' });
  db.prepare("UPDATE shares SET status = 'Revoked' WHERE id = ?").run(share.id);
  audit(req, 'Revoke Sharing Grant', 'Success', `Revoked ${share.file_name}`, share.id);
  res.json({ ok: true });
});
app.patch('/api/shares/:id/expiry', requireAuth, requirePermission('share_data'), (req, res) => {
  const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.shared_by_org_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only the owner can extend this share' });
  if (share.status === 'Revoked') return res.status(409).json({ error: 'A revoked share cannot be extended' });
  const expiryDate = req.body?.expiryDate;
  if (typeof expiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || expiryDate <= dateOnly()) return res.status(400).json({ error: 'A future expiry date is required' });
  db.prepare("UPDATE shares SET expiry_date = ?, status = 'Active' WHERE id = ?").run(expiryDate, share.id);
  audit(req, 'Extend Sharing Expiry', 'Success', `Extended share ${share.id} until ${expiryDate}`, share.id);
  notifyOrganization(share.shared_with_org_id, 'Dataset access extended', `Access is valid until ${expiryDate}.`, 'file', 'data-sharing');
  res.json({ ok: true, expiryDate });
});

const accessRequestQuery = `SELECT r.*, f.file_name, a.name AS requester_org_name, b.name AS owner_org_name, u.name AS requester_name FROM access_requests r JOIN datasets f ON f.id = r.file_id JOIN organizations a ON a.id = r.requester_org_id JOIN organizations b ON b.id = r.owner_org_id JOIN users u ON u.id = r.requester_user_id`;
app.get('/api/access-requests', requireAuth, (_req, res) => {
  const rows = db.prepare(`${accessRequestQuery} WHERE r.requester_org_id = ? OR r.owner_org_id = ? ORDER BY r.created_at DESC`).all(_req.user.organization_id, _req.user.organization_id);
  res.json({ requests: rows.map((row) => ({ id: row.id, fileId: row.file_id, fileName: row.file_name, requesterOrgId: row.requester_org_id, requesterOrgName: row.requester_org_name, ownerOrgId: row.owner_org_id, ownerOrgName: row.owner_org_name, requesterName: row.requester_name, permission: row.permission, rationale: row.rationale, expiryDate: row.expiry_date, status: row.status, createdAt: row.created_at })) });
});
app.post('/api/access-requests', requireAuth, (req, res) => {
  const { fileId, permission = 'Read Only', rationale = '', expiryDate } = req.body || {};
  const file = db.prepare('SELECT * FROM datasets WHERE id = ?').get(fileId);
  if (!file) return res.status(404).json({ error: 'Dataset not found' });
  if (file.organization_id === req.user.organization_id) return res.status(400).json({ error: 'Your organization owns this dataset already' });
  if (!['Read Only', 'Federated Train Only', 'Restricted Compute', 'Full Collaboration'].includes(permission)) return res.status(400).json({ error: 'Invalid permission' });
  const expires = expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires < dateOnly()) return res.status(400).json({ error: 'A future expiry date is required' });
  const duplicate = db.prepare("SELECT id FROM access_requests WHERE file_id = ? AND requester_org_id = ? AND status = 'Pending'").get(fileId, req.user.organization_id);
  if (duplicate) return res.status(409).json({ error: 'A pending request already exists for this dataset' });
  const requestId = id('req');
  db.prepare('INSERT INTO access_requests (id, file_id, requester_org_id, owner_org_id, requester_user_id, permission, rationale, expiry_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(requestId, fileId, req.user.organization_id, file.organization_id, req.user.id, permission, String(rationale).slice(0, 2000), expires, 'Pending', nowIso());
  audit(req, 'Request Dataset Access', 'Success', `Requested ${permission} access to ${file.file_name}`, requestId);
  notifyOrganization(file.organization_id, 'Dataset access requested', `${req.user.name} requested access to ${file.file_name}.`, 'file', 'data-sharing');
  res.status(201).json({ id: requestId, status: 'Pending' });
});
app.patch('/api/access-requests/:id', requireAuth, requirePermission('share_data'), (req, res) => {
  const accessRequest = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(req.params.id);
  if (!accessRequest) return res.status(404).json({ error: 'Access request not found' });
  if (accessRequest.owner_org_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only the dataset owner can review this request' });
  if (accessRequest.status !== 'Pending') return res.status(409).json({ error: 'Access request has already been reviewed' });
  const decision = req.body?.decision;
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be Approved or Rejected' });
  db.prepare('UPDATE access_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?').run(decision, nowIso(), req.user.id, accessRequest.id);
  if (decision === 'Approved') db.prepare(`INSERT INTO shares (id, file_id, shared_by_org_id, shared_with_org_id, permission, shared_date, expiry_date, status, token_hash, dp_epsilon) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, NULL)`)
    .run(id('shr'), accessRequest.file_id, accessRequest.owner_org_id, accessRequest.requester_org_id, accessRequest.permission, dateOnly(), accessRequest.expiry_date, hash(crypto.randomBytes(32)));
  audit(req, `${decision} Dataset Access Request`, 'Success', `${decision} access request ${accessRequest.id}`, accessRequest.id);
  notifyOrganization(accessRequest.requester_org_id, `Dataset request ${decision.toLowerCase()}`, `Your request for ${accessRequest.file_id} was ${decision.toLowerCase()}.`, 'file', 'data-sharing');
  res.json({ ok: true, status: decision });
});

app.get('/api/chat/messages', requireAuth, (req, res) => {
  const messages = db.prepare(`SELECT m.id, m.body, m.created_at AS createdAt, u.name AS userName FROM org_messages m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? ORDER BY m.created_at DESC LIMIT 100`).all(req.user.organization_id).reverse();
  res.json({ messages });
});
app.post('/api/chat/messages', requireAuth, (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) return res.status(400).json({ error: 'Message must contain 1 to 4000 characters' });
  const messageId = id('msg');
  const createdAt = nowIso();
  db.prepare('INSERT INTO org_messages (id, organization_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(messageId, req.user.organization_id, req.user.id, body, createdAt);
  audit(req, 'Post Organization Chat Message', 'Success', `Posted organization chat message ${messageId}`, messageId);
  res.status(201).json({ message: { id: messageId, body, createdAt, userName: req.user.name } });
});

const partnerGrant = (firstOrgId, secondOrgId) => db.prepare(`SELECT 1 FROM shares WHERE status = 'Active' AND expiry_date >= ? AND permission = 'Full Collaboration' AND ((shared_by_org_id = ? AND shared_with_org_id = ?) OR (shared_by_org_id = ? AND shared_with_org_id = ?)) LIMIT 1`).get(dateOnly(), firstOrgId, secondOrgId, secondOrgId, firstOrgId);
app.get('/api/partner-chats', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT o.id, o.name FROM organizations o WHERE o.id != ? AND EXISTS (SELECT 1 FROM shares s WHERE s.status = 'Active' AND s.expiry_date >= ? AND s.permission = 'Full Collaboration' AND ((s.shared_by_org_id = ? AND s.shared_with_org_id = o.id) OR (s.shared_with_org_id = ? AND s.shared_by_org_id = o.id))) ORDER BY o.name`).all(req.user.organization_id, dateOnly(), req.user.organization_id, req.user.organization_id);
  res.json({ partners: rows });
});
app.get('/api/partner-chats/:orgId/messages', requireAuth, (req, res) => {
  const peer = req.params.orgId;
  if (!partnerGrant(req.user.organization_id, peer)) return res.status(403).json({ error: 'An active full-collaboration grant is required' });
  const [first, second] = [req.user.organization_id, peer].sort();
  const messages = db.prepare(`SELECT m.id, m.body, m.created_at AS createdAt, u.name AS userName, o.name AS organizationName FROM partner_messages m JOIN users u ON u.id = m.user_id JOIN organizations o ON o.id = u.organization_id WHERE m.first_org_id = ? AND m.second_org_id = ? ORDER BY m.created_at DESC LIMIT 100`).all(first, second).reverse();
  res.json({ messages });
});
app.post('/api/partner-chats/:orgId/messages', requireAuth, (req, res) => {
  const peer = req.params.orgId;
  if (!partnerGrant(req.user.organization_id, peer)) return res.status(403).json({ error: 'An active full-collaboration grant is required' });
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) return res.status(400).json({ error: 'Message must contain 1 to 4000 characters' });
  const [first, second] = [req.user.organization_id, peer].sort();
  const messageId = id('pmsg');
  db.prepare('INSERT INTO partner_messages (id, first_org_id, second_org_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(messageId, first, second, req.user.id, body, nowIso());
  audit(req, 'Post Partner Chat Message', 'Success', `Posted partner message ${messageId}`, messageId);
  notifyOrganization(peer, 'New partner message', `${req.user.organization_name || req.user.name} sent a message.`, 'organization', 'organization-details');
  res.status(201).json({ id: messageId });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json({ notifications: rows.map((row) => ({ id: row.id, title: row.title, message: row.message, timestamp: row.created_at, type: row.type, linkTab: row.link_tab, read: Boolean(row.read_at) })) });
});
app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
  const result = db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').run(nowIso(), req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});
app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ?').run(nowIso(), req.user.id);
  res.json({ ok: true });
});
app.delete('/api/notifications', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

app.get('/api/audit-logs', requireAuth, requirePermission('audit_export'), (_req, res) => {
  const rows = db.prepare(`SELECT a.*, u.name AS user_name, u.email AS user_email, u.role AS user_role, o.name AS organization_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = u.organization_id ORDER BY a.timestamp DESC LIMIT 500`).all();
  res.json({ auditLogs: rows.map((row) => ({ id: row.id, timestamp: row.timestamp, userName: row.user_name || 'System', userEmail: row.user_email || '', userRole: row.user_role || 'System', action: row.action, organizationName: row.organization_name || '', result: row.result, ipAddress: row.ip_address, details: row.details, sha256Hash: row.integrity_hash })) });
});
app.get('/api/activity', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT a.id, a.timestamp, a.action, a.result, a.details, o.name AS organizationName FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = u.organization_id WHERE ? = 'System Admin' OR u.organization_id = ? ORDER BY a.rowid DESC LIMIT 50`).all(req.user.role, req.user.organization_id);
  res.json({ activities: rows });
});
app.get('/api/audit-logs/verify', requireAuth, requirePermission('audit_export'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY rowid').all();
  const invalid = [];
  let previous = '';
  let legacyCount = 0;
  for (const row of rows) {
    if (row.previous_hash === null) {
      legacyCount++;
      if (hash(`${row.timestamp}:${row.user_id || 'anonymous'}:${row.action}:${row.details}`) !== row.integrity_hash) invalid.push(row.id);
    } else {
      const expected = hash(JSON.stringify([row.timestamp, row.user_id, row.action, row.result, row.ip_address, row.details, row.resource_id, row.previous_hash]));
      if (row.previous_hash !== previous || expected !== row.integrity_hash) invalid.push(row.id);
    }
    previous = row.integrity_hash;
  }
  res.json({ valid: invalid.length === 0, checked: rows.length, legacyCount, invalidRecordIds: invalid });
});
app.get('/api/security/events', requireAuth, requirePermission('audit_export'), (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const summary = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN result = 'Failed' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN result = 'Warning' THEN 1 ELSE 0 END) AS warnings FROM audit_logs WHERE timestamp >= ? AND (result IN ('Failed', 'Warning') OR action LIKE '%Sharing%' OR action LIKE '%Authentication%')`).get(since);
  const events = db.prepare(`SELECT id, timestamp, action, result, details, resource_id AS resourceId FROM audit_logs WHERE result IN ('Failed', 'Warning') OR action LIKE '%Sharing%' OR action LIKE '%Authentication%' ORDER BY rowid DESC LIMIT 100`).all();
  res.json({ periodHours: 24, summary, events });
});

const getFlState = () => JSON.parse(db.prepare('SELECT payload_json FROM fl_state WHERE id = 1').get().payload_json);
const saveFlState = (state) => db.prepare('UPDATE fl_state SET payload_json = ? WHERE id = 1').run(JSON.stringify(state));
app.get('/api/federated-learning/state', requireAuth, (_req, res) => res.json({ state: getFlState() }));
app.post('/api/federated-learning/start', requireAuth, requirePermission('federated_orchestration'), (req, res) => {
  const state = getFlState();
  const nextRound = Math.min(state.currentRound + 1, state.totalRounds);
  const next = { ...state, isTraining: true, isPaused: false, status: 'Local Client Training', currentRound: nextRound, globalAccuracy: Math.min(91.4, 70.2 + nextRound * 4.24), logs: [{ timestamp: nowIso(), level: 'info', message: `Federated round ${nextRound} started.` }, ...state.logs] };
  saveFlState(next);
  audit(req, 'Federated Training Started', 'Success', `Started federated round ${nextRound}`);
  res.json({ state: next });
});
app.post('/api/federated-learning/pause', requireAuth, requirePermission('federated_orchestration'), (req, res) => {
  const state = getFlState();
  const next = { ...state, isTraining: false, isPaused: true, status: 'Idle', logs: [{ timestamp: nowIso(), level: 'warn', message: 'Federated training paused.' }, ...state.logs] };
  saveFlState(next);
  audit(req, 'Federated Training Paused', 'Warning', 'Paused federated training orchestration');
  res.json({ state: next });
});
app.post('/api/federated-learning/reset', requireAuth, requirePermission('federated_orchestration'), (req, res) => {
  const next = { currentRound: 0, totalRounds: 5, isTraining: false, isPaused: false, status: 'Idle', globalAccuracy: 0, logs: [], clientNodes: [] };
  saveFlState(next);
  audit(req, 'Federated Training Reset', 'Success', 'Reset federated training state');
  res.json({ state: next });
});

app.post('/api/federated-learning/experiments', requireAuth, requirePermission('federated_orchestration'), async (req, res) => {
  const { name, datasetIds, targetColumn, rounds = 5, algorithm = 'FedAvg', learningRate = 0.1, localEpochs = 3, clippingNorm = 1, noiseMultiplier = 0, proximalMu = 0.01, selectedClientIds = [], maliciousClientIds = [], splitSeed = 42 } = req.body || {};
  if (req.body?.deploymentMode === 'remote-secure') {
    if (req.user.role !== 'System Admin') return res.status(403).json({ error: 'Remote federation creation requires a System Admin' });
    const { remoteDatasets, publicSchema, privacyPolicy, normalizationCount = 10000 } = req.body;
    const count = Number(rounds);
    const epochs = Number(localEpochs);
    const rate = Number(learningRate);
    const clip = Number(clippingNorm);
    const cap = Number(normalizationCount);
    const epsilon = Number(privacyPolicy?.epsilon);
    const delta = Number(privacyPolicy?.delta);
    if (!name || typeof name !== 'string' || !targetColumn || algorithm !== 'FedAvg' ||
        !Number.isInteger(count) || count < 1 || count > 100 ||
        !Number.isInteger(epochs) || epochs < 1 || epochs > 100 ||
        !Number.isFinite(rate) || rate <= 0 || rate > 10 ||
        !Number.isFinite(clip) || clip <= 0 ||
        !Number.isInteger(cap) || cap < 1 || cap > 10000000 ||
        !Number.isFinite(epsilon) || epsilon <= 0 ||
        !Number.isFinite(delta) || delta <= 0 || delta >= 1 ||
        !Number.isSafeInteger(Number(splitSeed)) || Number(splitSeed) < 0) {
      return res.status(400).json({ error: 'Invalid remote training or privacy configuration' });
    }
    if (!Array.isArray(remoteDatasets) || remoteDatasets.length !== 3 ||
        remoteDatasets.some((item) => !item || typeof item !== 'object') ||
        new Set(remoteDatasets.map((item) => item.organizationId)).size !== remoteDatasets.length ||
        remoteDatasets.some((item) => !/^[a-zA-Z0-9_-]{1,100}$/.test(item.organizationId || '') ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(item.datasetId || ''))) {
      return res.status(400).json({ error: 'The production pilot requires exactly three distinct organization-owned datasets' });
    }
    let launchers;
    try { launchers = JSON.parse(process.env.FL_ORGANIZATION_LAUNCHERS_JSON || '{}'); }
    catch { return res.status(503).json({ error: 'Organization worker registry is invalid' }); }
    if (remoteDatasets.some((item) => typeof launchers[item.organizationId] !== 'string' ||
        !/^arn:aws[a-z-]*:lambda:[a-z0-9-]+:\d{12}:function:[a-zA-Z0-9_-]+$/.test(launchers[item.organizationId]))) {
      return res.status(503).json({ error: 'One or more organization workers are not registered' });
    }
    if (new Set(remoteDatasets.map((item) => launchers[item.organizationId].split(':')[4])).size !== 3)
      return res.status(503).json({ error: 'The pilot requires three separate organization AWS accounts' });
    if (process.env.AWS_REGION && remoteDatasets.some((item) => launchers[item.organizationId].split(':')[3] !== process.env.AWS_REGION))
      return res.status(503).json({ error: 'Organization launchers must use the coordinator AWS Region' });
    if (!publicSchema || typeof publicSchema !== 'object' || Array.isArray(publicSchema) ||
        publicSchema.target !== targetColumn || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(targetColumn) ||
        typeof publicSchema.patient_id !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_-]*$/.test(publicSchema.patient_id) || publicSchema.patient_id === targetColumn ||
        !Array.isArray(publicSchema.labels) || publicSchema.labels.length !== 2 ||
        publicSchema.labels.some((label) => typeof label !== 'string' || !label || label.length > 100) ||
        publicSchema.labels[0] === publicSchema.labels[1] ||
        !Array.isArray(publicSchema.features) || !publicSchema.features.length || publicSchema.features.length > 256) {
      return res.status(400).json({ error: 'A valid public patient-level feature schema is required' });
    }
    const names = new Set([publicSchema.patient_id, targetColumn]);
    for (const feature of publicSchema.features) {
      if (typeof feature?.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(feature.name) || names.has(feature.name) ||
          !['numeric', 'categorical'].includes(feature.type)) return res.status(400).json({ error: 'Invalid or duplicate public feature' });
      names.add(feature.name);
      if (feature.type === 'numeric' && (!Number.isFinite(Number(feature.min)) || !Number.isFinite(Number(feature.max)) || Number(feature.min) >= Number(feature.max)))
        return res.status(400).json({ error: 'Numeric features require public lower and upper bounds' });
      if (feature.type === 'categorical' && (!Array.isArray(feature.values) || !feature.values.length || feature.values.length > 1000 ||
          feature.values.some((value) => typeof value !== 'string' || !value || value.length > 100) || new Set(feature.values).size !== feature.values.length))
        return res.status(400).json({ error: 'Categorical features require unique public values' });
    }
    const rhoLimit = (Math.sqrt(Math.log(1 / delta) + epsilon) - Math.sqrt(Math.log(1 / delta))) ** 2;
    const sigma = Math.sqrt(remoteDatasets.length * count * (epochs / 2 + 2) / rhoLimit);
    if (!Number.isFinite(sigma) || sigma <= 0) return res.status(400).json({ error: 'Privacy budget cannot be represented' });
    const experimentId = id('exp');
    const canonicalSchema = JSON.stringify({ patient_id: publicSchema.patient_id, target: targetColumn,
      labels: publicSchema.labels, features: publicSchema.features });
    const schemaKey = `public-schemas/${experimentId}/schema.json`;
    let stored;
    try { stored = await putModelArtifact(schemaKey, canonicalSchema); }
    catch { return res.status(503).json({ error: 'Could not save the public feature schema' }); }
    if (!stored) return res.status(503).json({ error: 'Model S3 bucket is required for remote federation' });
    const config = { deploymentMode: 'remote-secure', remoteDatasets: remoteDatasets.map((item) => ({ organizationId: item.organizationId, datasetId: item.datasetId, launcherArn: launchers[item.organizationId] })),
      schemaS3Uri: `s3://${process.env.AWS_S3_MODEL_BUCKET}/${schemaKey}`, schemaSha256: hash(canonicalSchema), publicSchema: JSON.parse(canonicalSchema),
      targetColumn, rounds: count, algorithm: 'FedAvg', learningRate: rate, localEpochs: epochs,
      clippingNorm: clip, noiseMultiplier: sigma, metricNoiseMultiplier: sigma,
      normalizationCount: cap, splitSeed: Number(splitSeed), privacyPolicy: { epsilon, delta } };
    db.prepare('INSERT INTO fl_experiments (id, name, status, algorithm, target_column, rounds, created_by, created_at, config_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(experimentId, name.slice(0, 200), 'Awaiting Start', 'FedAvg', targetColumn, count, req.user.id, nowIso(), JSON.stringify(config));
    audit(req, 'Create Remote Federated Experiment', 'Success', `Created experiment ${name}`, experimentId);
    return res.status(201).json({ experiment: { id: experimentId, name, status: 'Awaiting Start', ...config } });
  }
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Local federated simulation is disabled in production' });
  if (req.body?.deploymentMode && req.body.deploymentMode !== 'local-simulation') return res.status(501).json({ error: 'Remote organization workers are not deployed' });
  if (req.body?.secureAggregation || req.body?.privacyPolicy) return res.status(501).json({ error: 'Secure aggregation and formal differential privacy accounting are not available' });
  if (!name || !targetColumn || !Array.isArray(datasetIds) || datasetIds.length === 0) return res.status(400).json({ error: 'name, targetColumn, and at least one datasetId are required' });
  if (!['FedAvg', 'FedProx'].includes(algorithm)) return res.status(400).json({ error: 'algorithm must be FedAvg or FedProx' });
  const numeric = [Number(rounds), Number(learningRate), Number(localEpochs), Number(clippingNorm), Number(noiseMultiplier), Number(proximalMu)];
  if (!numeric.every(Number.isFinite) || Number(rounds) < 1 || Number(localEpochs) < 1 || Number(localEpochs) > 100 || Number(learningRate) <= 0 || Number(learningRate) > 10 || Number(clippingNorm) <= 0 || Number(noiseMultiplier) < 0 || Number(proximalMu) < 0) return res.status(400).json({ error: 'Invalid numeric training configuration' });
  if (!Array.isArray(selectedClientIds) || !Array.isArray(maliciousClientIds) || [...selectedClientIds, ...maliciousClientIds].some((value) => typeof value !== 'string')) return res.status(400).json({ error: 'Client selections must be arrays of organization IDs' });
  if (!Number.isSafeInteger(Number(splitSeed)) || Number(splitSeed) < 0) return res.status(400).json({ error: 'splitSeed must be a non-negative integer' });
  const files = datasetIds.map((datasetId) => db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId)).filter(Boolean);
  if (files.length !== datasetIds.length) return res.status(404).json({ error: 'One or more datasets were not found' });
  if (files.some((file) => !canUseDatasetForTraining(file, req.user))) return res.status(403).json({ error: 'Dataset access denied' });
  if (files.some((file) => file.file_extension !== 'csv')) return res.status(400).json({ error: 'Federated experiments require CSV datasets' });
  const clientIds = new Set(files.map((file) => file.organization_id));
  if (clientIds.size !== files.length) return res.status(400).json({ error: 'Select one CSV dataset per organization' });
  if ([...selectedClientIds, ...maliciousClientIds].some((clientId) => !clientIds.has(clientId))) return res.status(400).json({ error: 'Selected clients must belong to the experiment datasets' });
  const experimentId = id('exp');
  const createdAt = nowIso();
  const config = { datasetIds, targetColumn, rounds: Math.max(1, Math.min(100, Number(rounds))), algorithm, learningRate: Number(learningRate), localEpochs: Math.max(1, Number(localEpochs)), clippingNorm: Number(clippingNorm), noiseMultiplier: Number(noiseMultiplier), proximalMu: Number(proximalMu), selectedClientIds, maliciousClientIds, splitSeed: Number(splitSeed), deploymentMode: 'local-simulation' };
  db.prepare('INSERT INTO fl_experiments (id, name, status, algorithm, target_column, rounds, created_by, created_at, config_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(experimentId, name, 'Queued', algorithm, targetColumn, config.rounds, req.user.id, createdAt, JSON.stringify(config));
  audit(req, 'Create Federated Experiment', 'Success', `Created experiment ${name}`, experimentId);
  res.status(201).json({ experiment: { id: experimentId, name, status: 'Queued', ...config, createdAt } });
});

app.post('/api/federated-learning/experiments/:id/run', requireAuth, requirePermission('federated_orchestration'), async (req, res) => {
  const experiment = db.prepare('SELECT * FROM fl_experiments WHERE id = ?').get(req.params.id);
  if (!experiment) return res.status(404).json({ error: 'Experiment not found' });
  if (getUser(experiment.created_by).organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(404).json({ error: 'Experiment not found' });
  const config = JSON.parse(experiment.config_json);
  if (config.deploymentMode === 'remote-secure') {
    if (req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only a System Admin can queue a remote federation' });
    if (experiment.status !== 'Awaiting Start') return res.status(409).json({ error: 'Remote experiment has already been queued or run' });
    if (!db.prepare("UPDATE fl_experiments SET status = 'Queued' WHERE id = ? AND status = 'Awaiting Start'").run(experiment.id).changes)
      return res.status(409).json({ error: 'Remote experiment has already been queued' });
    audit(req, 'Queue Remote Federated Experiment', 'Success', `Queued ${experiment.name}`, experiment.id);
    return res.status(202).json({ experimentId: experiment.id, status: 'Queued' });
  }
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Local federated simulation is disabled in production' });
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.FL_LOCAL_WORKER_AVAILABLE !== 'true') return res.status(501).json({ error: 'The local Python trainer is not bundled into Lambda; deploy remote organization workers before running cloud experiments' });
  if (experiment.status === 'Running' || experiment.status === 'Completed') return res.status(409).json({ error: 'Create a new experiment to run this configuration again' });
  const files = config.datasetIds.map((datasetId) => db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId)).filter(Boolean);
  if (!files.length) return res.status(400).json({ error: 'Experiment has no available datasets' });
  if (files.some((file) => !canUseDatasetForTraining(file, req.user))) return res.status(403).json({ error: 'Dataset training access denied' });
  db.prepare("UPDATE fl_experiments SET status = 'Running' WHERE id = ?").run(experiment.id);
  try {
    const result = await runFederatedTrainer({
      clients: await Promise.all(files.map(async (file) => ({ id: file.organization_id, csv: (await decryptDataset(file)).toString('utf8') }))),
      target_column: config.targetColumn, rounds: config.rounds, learning_rate: config.learningRate,
      local_epochs: config.localEpochs, clipping_norm: config.clippingNorm, noise_multiplier: config.noiseMultiplier,
      algorithm: config.algorithm, proximal_mu: config.proximalMu, selected_client_ids: config.selectedClientIds,
      malicious_client_ids: config.maliciousClientIds, split_seed: config.splitSeed ?? 42
    });
    for (const round of result.rounds) {
      round.global_metrics.communication_bytes = round.communication_bytes;
      round.global_metrics.selected_clients = round.selected_clients.length;
      round.global_metrics.training_metrics = round.training_metrics;
      db.prepare('INSERT OR REPLACE INTO fl_rounds (id, experiment_id, round_number, status, global_metrics_json, client_metrics_json, model_artifact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id('round'), experiment.id, round.round, 'Completed', JSON.stringify(round.global_metrics), JSON.stringify(round.clients), JSON.stringify({ weights: round.weights, featureNames: result.feature_names, labels: result.labels }), nowIso());
      delete round.weights;
    }
    const version = `v1.${result.rounds.length}.${db.prepare('SELECT COUNT(*) AS count FROM model_versions WHERE experiment_id = ?').get(experiment.id).count}`;
    const artifact = { weights: result.weights, featureNames: result.feature_names, labels: result.labels };
    const artifactJson = JSON.stringify(artifact);
    await putModelArtifact(`models/${experiment.id}/${version}.json`, artifactJson);
    db.prepare('INSERT INTO model_versions (id, experiment_id, version, artifact_json, metrics_json, created_at, approved) VALUES (?, ?, ?, ?, ?, ?, 0)')
      .run(id('model'), experiment.id, version, artifactJson, JSON.stringify(result.test_metrics), nowIso());
    db.prepare("UPDATE fl_experiments SET status = 'Completed', current_round = ?, completed_at = ?, result_json = ? WHERE id = ?")
      .run(result.rounds.length, nowIso(), JSON.stringify({ validation: result.rounds.at(-1)?.global_metrics || {}, test: result.test_metrics, splitCounts: result.split_counts, splitSeed: result.split_seed, deploymentMode: 'local-simulation' }), experiment.id);
    const reportId = id('rpt');
    const fileName = `${reportId}.pdf`;
    const report = createExperimentPdf({ name: experiment.name, algorithm: config.algorithm, completedAt: nowIso(), rounds: result.rounds, testMetrics: result.test_metrics, splitCounts: result.split_counts });
    fs.writeFileSync(path.join(REPORT_DIR, fileName), report);
    const reportKey = `reports/${experiment.id}/${fileName}`;
    let storedInS3 = false;
    try { storedInS3 = await putReportArtifact(reportKey, report); }
    catch (error) { console.warn('S3 report archival failed', error?.name || error); }
    db.prepare('INSERT INTO experiment_reports (id, experiment_id, file_name, created_at, sha256_hash, s3_key) VALUES (?, ?, ?, ?, ?, ?)')
      .run(reportId, experiment.id, fileName, nowIso(), hash(report), storedInS3 ? reportKey : null);
    audit(req, 'Run Federated Experiment', 'Success', `Completed ${experiment.name}`, experiment.id);
    notifyOrganization(req.user.organization_id, 'Experiment completed', `${experiment.name} completed with ${(result.test_metrics.accuracy * 100).toFixed(2)}% held-out test accuracy.`, 'training', 'reports');
    const finalMetrics = result.test_metrics;
    try { await recordTrainingMetrics({ accuracy: finalMetrics.accuracy * 100, loss: finalMetrics.loss, communicationBytes: result.rounds.reduce((sum, item) => sum + item.communication_bytes, 0), experimentId: experiment.id }); }
    catch (error) { console.warn('CloudWatch metric publishing failed', error?.name || error); }
    res.json({ experimentId: experiment.id, status: 'Completed', rounds: result.rounds, testMetrics: result.test_metrics, splitCounts: result.split_counts, reportId, model: { id: db.prepare('SELECT id FROM model_versions WHERE experiment_id = ? ORDER BY created_at DESC LIMIT 1').get(experiment.id).id, version, featureNames: result.feature_names, labels: result.labels }, notices: config.noiseMultiplier > 0 ? ['Simulation noise is enabled; no formal privacy guarantee is implemented.'] : ['Differential privacy is unavailable in local simulation.'] });
  } catch (error) {
    db.prepare("UPDATE fl_experiments SET status = 'Failed', result_json = ? WHERE id = ?").run(JSON.stringify({ error: error.message }), experiment.id);
    audit(req, 'Run Federated Experiment', 'Failed', error.message, experiment.id);
    res.status(422).json({ error: error.message });
  }
});

app.get('/api/federated-learning/experiments', requireAuth, (req, res) => {
  const rows = req.user.role === 'System Admin'
    ? db.prepare('SELECT * FROM fl_experiments ORDER BY created_at DESC').all()
    : db.prepare('SELECT e.* FROM fl_experiments e JOIN users u ON u.id = e.created_by WHERE u.organization_id = ? ORDER BY e.created_at DESC').all(req.user.organization_id);
  const experiments = rows.map((row) => ({ id: row.id, name: row.name, status: row.status, algorithm: row.algorithm, targetColumn: row.target_column, rounds: row.rounds, currentRound: row.current_round, createdAt: row.created_at, completedAt: row.completed_at, config: JSON.parse(row.config_json), result: JSON.parse(row.result_json) }));
  res.json({ experiments });
});

app.get('/api/federated-learning/experiments/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM fl_experiments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Experiment not found' });
  const owner = getUser(row.created_by);
  if (req.user.role !== 'System Admin' && owner.organization_id !== req.user.organization_id) return res.status(404).json({ error: 'Experiment not found' });
  const rounds = db.prepare('SELECT * FROM fl_rounds WHERE experiment_id = ? ORDER BY round_number').all(row.id).map((round) => ({ round: round.round_number, status: round.status, globalMetrics: JSON.parse(round.global_metrics_json), clientMetrics: JSON.parse(round.client_metrics_json), createdAt: round.created_at }));
  const models = db.prepare('SELECT id, version, metrics_json, created_at, approved FROM model_versions WHERE experiment_id = ? ORDER BY created_at').all(row.id).map((model) => ({ id: model.id, version: model.version, metrics: JSON.parse(model.metrics_json), createdAt: model.created_at, approved: Boolean(model.approved) }));
  res.json({ experiment: { id: row.id, name: row.name, status: row.status, algorithm: row.algorithm, targetColumn: row.target_column, rounds: row.rounds, currentRound: row.current_round, config: JSON.parse(row.config_json), result: JSON.parse(row.result_json), createdAt: row.created_at, completedAt: row.completed_at }, rounds, models });
});

app.get('/api/federated-learning/experiments/:id/public-schema', requireAuth, (req, res) => {
  if (req.user.role !== 'System Admin') return res.status(403).json({ error: 'Only a System Admin can distribute the public schema' });
  const row = db.prepare('SELECT config_json FROM fl_experiments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Experiment not found' });
  const config = JSON.parse(row.config_json);
  if (config.deploymentMode !== 'remote-secure' || !config.publicSchema) return res.status(404).json({ error: 'Public schema not available' });
  const body = JSON.stringify(config.publicSchema);
  if (hash(body) !== config.schemaSha256) return res.status(500).json({ error: 'Public schema integrity check failed' });
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-schema.json"`);
  res.type('application/json').send(body);
});

app.get('/api/reports', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT r.id, r.experiment_id AS experimentId, e.name AS experimentName, r.created_at AS createdAt, r.sha256_hash AS sha256Hash, e.algorithm FROM experiment_reports r JOIN fl_experiments e ON e.id = r.experiment_id JOIN users u ON u.id = e.created_by WHERE u.organization_id = ? OR ? = 'System Admin' ORDER BY r.created_at DESC`).all(req.user.organization_id, req.user.role);
  res.json({ reports: rows });
});
app.get('/api/reports/:id/download', requireAuth, async (req, res) => {
  const report = db.prepare(`SELECT r.*, u.organization_id AS owner_organization_id FROM experiment_reports r JOIN fl_experiments e ON e.id = r.experiment_id JOIN users u ON u.id = e.created_by WHERE r.id = ?`).get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.owner_organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Report access denied' });
  const reportPath = path.join(REPORT_DIR, report.file_name);
  if (fs.existsSync(reportPath)) return res.download(reportPath, report.file_name);
  try {
    const remote = await getReportArtifact(report.s3_key);
    if (!remote || hash(remote) !== report.sha256_hash) return res.status(503).json({ error: 'Report artifact unavailable or failed integrity verification' });
    res.setHeader('Content-Disposition', `attachment; filename="${report.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    res.type('application/pdf').send(remote);
  } catch { res.status(503).json({ error: 'Report artifact unavailable' }); }
});

app.post('/api/federated-learning/experiments/:id/compare', requireAuth, requirePermission('federated_orchestration'), async (req, res) => {
  const experiment = db.prepare('SELECT * FROM fl_experiments WHERE id = ?').get(req.params.id);
  if (!experiment) return res.status(404).json({ error: 'Experiment not found' });
  if (getUser(experiment.created_by).organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(404).json({ error: 'Experiment not found' });
  const config = JSON.parse(experiment.config_json);
  if (config.deploymentMode === 'remote-secure') return res.status(422).json({ error: 'Remote FedProx comparison requires a separately approved privacy budget and federation' });
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Local federated comparison is disabled in production' });
  const files = config.datasetIds.map((datasetId) => db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId)).filter(Boolean);
  if (!files.length || files.some((file) => !canUseDatasetForTraining(file, req.user))) return res.status(403).json({ error: 'Experiment dataset access denied' });
  try {
    const clients = await Promise.all(files.map(async (file) => ({ id: file.organization_id, csv: (await decryptDataset(file)).toString('utf8') })));
    const common = { clients, target_column: config.targetColumn, rounds: config.rounds, learning_rate: config.learningRate, local_epochs: config.localEpochs, clipping_norm: config.clippingNorm, noise_multiplier: config.noiseMultiplier, selected_client_ids: config.selectedClientIds, malicious_client_ids: config.maliciousClientIds, split_seed: config.splitSeed ?? 42 };
    const [fedavg, fedprox] = await Promise.all([
      runFederatedTrainer({ ...common, algorithm: 'FedAvg' }),
      runFederatedTrainer({ ...common, algorithm: 'FedProx', proximal_mu: config.proximalMu })
    ]);
    const withoutWeights = (runs) => runs.map(({ weights, ...round }) => round);
    const comparison = { FedAvg: withoutWeights(fedavg.rounds), FedProx: withoutWeights(fedprox.rounds), testMetrics: { FedAvg: fedavg.test_metrics, FedProx: fedprox.test_metrics }, config, comparedAt: nowIso() };
    const previous = JSON.parse(experiment.result_json || '{}');
    db.prepare('UPDATE fl_experiments SET result_json = ? WHERE id = ?').run(JSON.stringify({ ...previous, comparison }), experiment.id);
    audit(req, 'Compare FedAvg and FedProx', 'Success', `Compared algorithms for ${experiment.name}`, experiment.id);
    res.json({ comparison });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

app.post('/api/models/:id/predict', requireAuth, (req, res) => {
  const model = db.prepare(`SELECT m.*, e.created_by, u.organization_id AS owner_organization_id FROM model_versions m JOIN fl_experiments e ON e.id = m.experiment_id JOIN users u ON u.id = e.created_by WHERE m.id = ?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model version not found' });
  if (model.owner_organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Model access denied' });
  const artifact = JSON.parse(model.artifact_json);
  const input = req.body?.features;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return res.status(400).json({ error: 'features object is required' });
  const vector = [1];
  const remoteNumeric = new Map((artifact.publicSchema?.features || [])
    .filter((feature) => feature.type === 'numeric').map((feature) => [feature.name, feature]));
  for (const feature of artifact.featureNames.slice(1)) {
    if (feature.includes('=')) {
      const [name, ...category] = feature.split('=');
      vector.push(String(input[name] ?? '') === category.join('=') ? 1 : 0);
    } else {
      const value = Number(input[feature]);
      if (!Number.isFinite(value)) return res.status(400).json({ error: `Numeric feature '${feature}' is required` });
      const bounds = remoteNumeric.get(feature);
      vector.push(bounds ? (Math.max(bounds.min, Math.min(bounds.max, value)) - bounds.min) / (bounds.max - bounds.min) : value);
    }
  }
  const score = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, artifact.weights.reduce((sum, weight, index) => sum + weight * vector[index], 0)))));
  res.json({ modelId: model.id, version: model.version, prediction: artifact.labels[score >= 0.5 ? 1 : 0], confidence: score >= 0.5 ? score : 1 - score, score });
});

app.get('/api/models/:id/artifact', requireAuth, (req, res) => {
  const model = db.prepare(`SELECT m.*, u.organization_id AS owner_organization_id FROM model_versions m JOIN fl_experiments e ON e.id = m.experiment_id JOIN users u ON u.id = e.created_by WHERE m.id = ?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model version not found' });
  if (model.owner_organization_id !== req.user.organization_id && req.user.role !== 'System Admin') return res.status(403).json({ error: 'Model access denied' });
  res.setHeader('Content-Disposition', `attachment; filename="${model.version.replace(/[^a-zA-Z0-9._-]/g, '_')}.json"`);
  res.type('application/json').send(model.artifact_json);
});

app.use((error, _req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Uploaded file exceeds the configured size limit' });
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) app.listen(PORT, () => console.log(`Secure collaboration API listening on http://localhost:${PORT}`));
