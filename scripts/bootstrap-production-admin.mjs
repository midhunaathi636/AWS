import crypto from 'node:crypto';
import { Client } from 'pg';

const required = ['PLATFORM_DATABASE_URL', 'BOOTSTRAP_ORG_ID', 'BOOTSTRAP_ORG_NAME',
  'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_NAME'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
const password = crypto.randomBytes(48).toString('hex');
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const pg = new Client({ connectionString: process.env.PLATFORM_DATABASE_URL,
  ssl: process.env.AWS_RDS_SSL === 'false' ? false : { rejectUnauthorized: true } });
try {
  await pg.connect();
  await pg.query('BEGIN');
  const organizations = await pg.query(`INSERT INTO organizations
    (id, name, type, location, admin_name, admin_email, status, joined_date, description)
    VALUES ($1, $2, 'Production Organization', 'Configured by owner', $3, $4, 'active', $5, '')
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    [process.env.BOOTSTRAP_ORG_ID, process.env.BOOTSTRAP_ORG_NAME,
      process.env.BOOTSTRAP_ADMIN_NAME, process.env.BOOTSTRAP_ADMIN_EMAIL,
      new Date().toISOString().slice(0, 10)]);
  if (!organizations.rowCount) throw new Error('organization already exists; refusing to overwrite it');
  const users = await pg.query(`INSERT INTO users
    (id, name, email, password_hash, organization_id, role, status, permissions_json)
    VALUES ($1, $2, $3, $4, $5, 'System Admin', 'active', $6)
    ON CONFLICT DO NOTHING RETURNING id`,
    [`usr-${crypto.randomUUID()}`, process.env.BOOTSTRAP_ADMIN_NAME,
      process.env.BOOTSTRAP_ADMIN_EMAIL, passwordHash,
      process.env.BOOTSTRAP_ORG_ID, JSON.stringify(['all_access'])]);
  if (!users.rowCount) throw new Error('admin already exists; refusing to overwrite it');
  await pg.query('COMMIT');
  console.log(JSON.stringify({ organizationId: process.env.BOOTSTRAP_ORG_ID,
    adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL, cognitoProfileRequired: true }));
} catch (error) {
  await pg.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await pg.end();
}
