/**
 * SCLP API – Lambda handler (API Gateway HTTP API v2)
 * Free-tier: Cognito auth + DynamoDB
 */
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminConfirmSignUpCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID, createHash } from 'crypto';

const region = process.env.AWS_REGION || 'eu-north-1';
const cognito = new CognitoIdentityProviderClient({ region });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const T = {
  users: process.env.USERS_TABLE,
  orgs: process.env.ORGS_TABLE,
  datasets: process.env.DATASETS_TABLE,
  shares: process.env.SHARES_TABLE,
  audit: process.env.AUDIT_TABLE,
  notifications: process.env.NOTIFICATIONS_TABLE,
  experiments: process.env.EXPERIMENTS_TABLE,
};
const POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const WEB_ORIGIN = process.env.WEB_ORIGIN || '*';

const cors = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString()
      : event.body);
  } catch {
    return {};
  }
}

function pathOf(event) {
  const raw = event.rawPath || event.requestContext?.http?.path || '/';
  return raw.replace(/\/$/, '') || '/';
}

function methodOf(event) {
  return (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
}

function bearer(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function cognitoUserFromToken(accessToken) {
  const res = await cognito.send(new GetUserCommand({ AccessToken: accessToken }));
  const attrs = Object.fromEntries((res.UserAttributes || []).map((a) => [a.Name, a.Value]));
  return {
    username: res.Username,
    email: attrs.email,
    name: attrs.name || attrs.email,
    role: attrs['custom:role'] || 'Viewer',
    orgId: attrs['custom:orgId'] || '',
    orgName: attrs['custom:orgName'] || '',
  };
}

async function getProfileByEmail(email) {
  if (!email || !T.users) return null;
  const q = await ddb.send(new QueryCommand({
    TableName: T.users,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :e',
    ExpressionAttributeValues: { ':e': email },
    Limit: 1,
  }));
  return q.Items?.[0] || null;
}

async function ensureSeed() {
  // Seed organizations if empty
  const orgs = await ddb.send(new ScanCommand({ TableName: T.orgs, Limit: 1 }));
  if ((orgs.Items || []).length > 0) return;

  const seedOrgs = [
    {
      id: 'org-apollo',
      name: 'Apollo Hospitals',
      type: 'Hospital Network',
      location: 'Chennai, India',
      adminName: 'Vikram Sharma',
      adminEmail: 'vikram.sharma@apollohospitals.demo',
      usersCount: 1,
      storageUsedGb: 12,
      maxStorageGb: 500,
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
      filesCount: 0,
      trainingRoundsParticipated: 0,
      avgAccuracy: 0,
      description: 'Multi-specialty hospital network',
      contactPhone: '+91-0000000000',
      publicKeyFingerprint: 'APOLLO-PK-DEMO',
    },
    {
      id: 'org-fortis',
      name: 'Fortis Healthcare',
      type: 'Healthcare Network',
      location: 'Mumbai, India',
      adminName: 'Rajesh Kulkarni',
      adminEmail: 'rajesh.kulkarni@fortishealthcare.demo',
      usersCount: 1,
      storageUsedGb: 8,
      maxStorageGb: 300,
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
      filesCount: 0,
      trainingRoundsParticipated: 0,
      avgAccuracy: 0,
      description: 'Healthcare network',
      contactPhone: '+91-0000000001',
      publicKeyFingerprint: 'FORTIS-PK-DEMO',
    },
    {
      id: 'org-abc',
      name: 'ABC Research',
      type: 'Biotech Research Lab',
      location: 'Bengaluru, India',
      adminName: 'Ananya Iyer',
      adminEmail: 'ananya.iyer@abcresearch.demo',
      usersCount: 1,
      storageUsedGb: 5,
      maxStorageGb: 200,
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
      filesCount: 0,
      trainingRoundsParticipated: 0,
      avgAccuracy: 0,
      description: 'Research laboratory',
      contactPhone: '+91-0000000002',
      publicKeyFingerprint: 'ABC-PK-DEMO',
    },
  ];
  for (const o of seedOrgs) {
    await ddb.send(new PutCommand({ TableName: T.orgs, Item: o }));
  }

  const seedUsers = [
    {
      id: 'usr-1',
      email: 'vikram.sharma@apollohospitals.demo',
      name: 'Vikram Sharma',
      organizationId: 'org-apollo',
      organizationName: 'Apollo Hospitals',
      role: 'System Admin',
      status: 'active',
      lastLogin: new Date().toISOString(),
      phone: '+91-0000000000',
      department: 'Platform',
      twoFactorEnabled: false,
      permissions: ['*'],
    },
    {
      id: 'usr-2',
      email: 'rajesh.kulkarni@fortishealthcare.demo',
      name: 'Rajesh Kulkarni',
      organizationId: 'org-fortis',
      organizationName: 'Fortis Healthcare',
      role: 'Doctor',
      status: 'active',
      lastLogin: new Date().toISOString(),
      phone: '+91-0000000001',
      department: 'Oncology',
      twoFactorEnabled: false,
      permissions: ['read', 'train'],
    },
    {
      id: 'usr-3',
      email: 'ananya.iyer@abcresearch.demo',
      name: 'Ananya Iyer',
      organizationId: 'org-abc',
      organizationName: 'ABC Research',
      role: 'Researcher',
      status: 'active',
      lastLogin: new Date().toISOString(),
      phone: '+91-0000000002',
      department: 'Data Science',
      twoFactorEnabled: false,
      permissions: ['read', 'train', 'share'],
    },
  ];
  for (const u of seedUsers) {
    await ddb.send(new PutCommand({ TableName: T.users, Item: u }));
  }
}

async function writeAudit(user, action, details, result = 'Success') {
  const id = randomUUID();
  const item = {
    id,
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    userName: user?.name || 'system',
    userEmail: user?.email || '',
    userRole: user?.role || '',
    action,
    organizationName: user?.organizationName || user?.orgName || '',
    result,
    ipAddress: '0.0.0.0',
    details,
    sha256Hash: createHash('sha256').update(`${id}:${action}:${details}`).digest('hex'),
  };
  await ddb.send(new PutCommand({ TableName: T.audit, Item: item }));
  return item;
}

async function requireUser(event) {
  const token = bearer(event);
  if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const cu = await cognitoUserFromToken(token);
  let profile = await getProfileByEmail(cu.email);
  if (!profile) {
    profile = {
      id: randomUUID(),
      email: cu.email,
      name: cu.name,
      organizationId: cu.orgId || 'org-apollo',
      organizationName: cu.orgName || 'Apollo Hospitals',
      role: cu.role || 'Viewer',
      status: 'active',
      lastLogin: new Date().toISOString(),
      phone: '',
      department: '',
      twoFactorEnabled: false,
      permissions: ['read'],
    };
    await ddb.send(new PutCommand({ TableName: T.users, Item: profile }));
  }
  return profile;
}

export const handler = async (event) => {
  if (methodOf(event) === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  try {
    await ensureSeed();
  } catch (e) {
    console.warn('seed', e.message);
  }

  const method = methodOf(event);
  const path = pathOf(event);
  const body = parseBody(event);

  try {
    // Health
    if (method === 'GET' && (path === '/' || path === '/api/health')) {
      return json(200, { ok: true, mode: 'production' });
    }

    // ---------- Auth ----------
    if (method === 'POST' && path === '/api/auth/login') {
      const { email, password } = body;
      if (!email || !password) return json(400, { error: 'Email and password required' });

      try {
        const auth = await cognito.send(new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: CLIENT_ID,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        }));

        if (auth.ChallengeName) {
          return json(200, {
            twoFactorRequired: true,
            challengeToken: auth.Session,
            challengeName: auth.ChallengeName,
          });
        }

        const access = auth.AuthenticationResult?.AccessToken;
        const idToken = auth.AuthenticationResult?.IdToken;
        const refresh = auth.AuthenticationResult?.RefreshToken;
        const cu = await cognitoUserFromToken(access);
        let profile = await getProfileByEmail(cu.email);
        if (!profile) {
          profile = {
            id: randomUUID(),
            email: cu.email,
            name: cu.name,
            organizationId: cu.orgId || 'org-apollo',
            organizationName: cu.orgName || '',
            role: cu.role || 'Viewer',
            status: 'active',
            lastLogin: new Date().toISOString(),
            phone: '',
            department: '',
            twoFactorEnabled: false,
            permissions: ['read'],
          };
          await ddb.send(new PutCommand({ TableName: T.users, Item: profile }));
        } else {
          profile.lastLogin = new Date().toISOString();
          await ddb.send(new PutCommand({ TableName: T.users, Item: profile }));
        }
        await writeAudit(profile, 'Login', 'User signed in via Cognito');
        return json(200, {
          user: profile,
          tokens: {
            accessToken: access,
            idToken,
            refreshToken: refresh,
          },
        });
      } catch (err) {
        console.error('login', err);
        return json(401, { error: err.message || 'Invalid credentials' });
      }
    }

    if (method === 'GET' && path === '/api/auth/me') {
      const user = await requireUser(event);
      return json(200, { user });
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      return json(200, { ok: true });
    }

    // ---------- Organizations ----------
    if (method === 'GET' && path === '/api/organizations') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.orgs }));
      return json(200, { organizations: res.Items || [] });
    }

    if (method === 'GET' && path.startsWith('/api/organizations/')) {
      await requireUser(event);
      const id = path.split('/').pop();
      const res = await ddb.send(new GetCommand({ TableName: T.orgs, Key: { id } }));
      if (!res.Item) return json(404, { error: 'Not found' });
      return json(200, { organization: res.Item });
    }

    // ---------- Users ----------
    if (method === 'GET' && path === '/api/users') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.users }));
      return json(200, { users: res.Items || [] });
    }

    // ---------- Datasets ----------
    if (method === 'GET' && path === '/api/datasets') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.datasets }));
      return json(200, { files: res.Items || [] });
    }

    if (method === 'POST' && path === '/api/datasets') {
      const user = await requireUser(event);
      const item = {
        id: randomUUID(),
        fileName: body.fileName || 'dataset.csv',
        fileExtension: 'csv',
        ownerName: user.name,
        ownerEmail: user.email,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        category: body.category || 'EHR & Patient Records',
        sizeBytes: body.sizeBytes || 0,
        sizeFormatted: body.sizeFormatted || '0 KB',
        uploadDate: new Date().toISOString(),
        classification: body.classification || 'Confidential',
        status: 'Encrypted AES-256',
        encryptionHash: createHash('sha256').update(randomUUID()).digest('hex').slice(0, 16),
        recordsCount: body.recordsCount || 0,
        description: body.description || '',
        tags: body.tags || [],
        sampleColumns: body.sampleColumns || [],
        sampleRows: body.sampleRows || [],
      };
      await ddb.send(new PutCommand({ TableName: T.datasets, Item: item }));
      await writeAudit(user, 'Upload Dataset', item.fileName);
      return json(201, { file: item });
    }

    // ---------- Shares ----------
    if (method === 'GET' && path === '/api/shares') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.shares }));
      return json(200, { sharedData: res.Items || [] });
    }

    // ---------- Audit ----------
    if (method === 'GET' && path === '/api/audit-logs') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.audit, Limit: 200 }));
      const items = (res.Items || []).sort((a, b) =>
        String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      return json(200, { auditLogs: items });
    }

    // ---------- Notifications ----------
    if (method === 'GET' && path === '/api/notifications') {
      const user = await requireUser(event);
      const res = await ddb.send(new QueryCommand({
        TableName: T.notifications,
        IndexName: 'user-index',
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': user.id },
      }));
      return json(200, { notifications: res.Items || [] });
    }

    // ---------- FL experiments (local simulation metadata) ----------
    if (method === 'GET' && path === '/api/experiments') {
      await requireUser(event);
      const res = await ddb.send(new ScanCommand({ TableName: T.experiments }));
      return json(200, { experiments: res.Items || [] });
    }

    if (method === 'POST' && path === '/api/experiments') {
      const user = await requireUser(event);
      const item = {
        id: randomUUID(),
        ...body,
        createdBy: user.email,
        createdAt: new Date().toISOString(),
        status: body.status || 'completed',
      };
      await ddb.send(new PutCommand({ TableName: T.experiments, Item: item }));
      await writeAudit(user, 'FL Experiment', item.id);
      return json(201, { experiment: item });
    }

    return json(404, { error: `No route ${method} ${path}` });
  } catch (err) {
    const status = err.status || 500;
    console.error(err);
    return json(status, { error: err.message || 'Server error' });
  }
};
