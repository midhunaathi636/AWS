import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const temporaryData = mkdtempSync(path.join(tmpdir(), 'secure-platform-test-'));
process.env.DATA_DIR = temporaryData;
process.env.DB_PATH = path.join(temporaryData, 'test.sqlite');
process.env.AWS_LAMBDA_FUNCTION_NAME = 'integration-test';
process.env.FL_LOCAL_WORKER_AVAILABLE = 'true';
process.env.ALLOW_DEMO_SEED = 'true';
process.env.AWS_CLOUDWATCH_METRICS = 'false';
process.env.SESSION_SECRET = 'integration-test-session-secret';
process.env.FILE_ENCRYPTION_KEY = 'integration-test-encryption-key';

const { app } = await import('../server.js');

async function call(url, { method = 'GET', body, cookie } = {}) {
  let payload;
  const headers = { host: 'localhost', ...(cookie ? { cookie } : {}) };
  if (body instanceof FormData) {
    const request = new Request('http://localhost/', { method, body });
    payload = Buffer.from(await request.arrayBuffer());
    headers['content-type'] = request.headers.get('content-type');
  } else if (body) {
    payload = Buffer.from(JSON.stringify(body));
    headers['content-type'] = 'application/json';
  }
  if (payload) headers['content-length'] = String(payload.length);
  const socket = new PassThrough();
  socket.remoteAddress = '127.0.0.1';
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.complete = true;
  if (payload) req.push(payload);
  req.push(null);
  return new Promise((resolve, reject) => {
    const res = new ServerResponse(req);
    const chunks = [];
    res.write = (chunk) => { chunks.push(Buffer.from(chunk)); return true; };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      const contentType = res.getHeader('content-type') || '';
      try {
        const setCookie = res.getHeader('set-cookie');
        resolve({ status: res.statusCode, data: contentType.includes('application/json') ? JSON.parse(raw.toString()) : raw, cookie: (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0] });
      } catch (error) { reject(error); }
    };
    app(req, res);
  });
}

test('held-out evaluation, automatic PDF, partner access, notifications, and expiry', async () => {
  try {
    const adminLogin = await call('/api/auth/login', { method: 'POST', body: { email: 'vikram.sharma@apollohospitals.demo', password: 'Demo@123' } });
    assert.equal(adminLogin.status, 200);
    const admin = adminLogin.cookie;
    const csv = ['age,site,label', ...Array.from({ length: 40 }, (_, index) => `${20 + index},${index % 2 ? 'A' : 'B'},${index % 2 ? 'yes' : 'no'}`)].join('\n');
    const form = new FormData();
    form.set('file', new Blob([csv], { type: 'text/csv' }), 'sample.csv');
    form.set('category', 'Clinical Oncology Trials');
    const upload = await call('/api/datasets', { method: 'POST', body: form, cookie: admin });
    assert.equal(upload.status, 201);
    assert.equal(upload.data.file.recordsCount, 40);
    const fileId = upload.data.file.id;
    const created = await call('/api/federated-learning/experiments', { method: 'POST', cookie: admin, body: { name: 'Integration test', datasetIds: [fileId], targetColumn: 'label', rounds: 2, splitSeed: 31 } });
    assert.equal(created.status, 201);
    const experimentId = created.data.experiment.id;
    const run = await call(`/api/federated-learning/experiments/${experimentId}/run`, { method: 'POST', cookie: admin });
    assert.equal(run.status, 200);
    assert.equal(run.data.testMetrics.data_split, 'test');
    assert.equal(run.data.rounds[0].global_metrics.data_split, 'validation');
    assert.equal(run.data.splitCounts['org-apollo'].train + run.data.splitCounts['org-apollo'].validation + run.data.splitCounts['org-apollo'].test, 40);
    assert.ok(run.data.testMetrics.auc_roc >= 0 && run.data.testMetrics.auc_roc <= 1);
    const detail = await call(`/api/federated-learning/experiments/${experimentId}`, { cookie: admin });
    assert.equal(detail.data.models.at(-1).metrics.data_split, 'test');
    const comparison = await call(`/api/federated-learning/experiments/${experimentId}/compare`, { method: 'POST', cookie: admin });
    assert.equal(comparison.status, 200);
    assert.equal(comparison.data.comparison.testMetrics.FedAvg.data_split, 'test');
    assert.equal(comparison.data.comparison.testMetrics.FedProx.data_split, 'test');
    const reports = await call('/api/reports', { cookie: admin });
    assert.equal(reports.data.reports[0].experimentId, experimentId);
    const pdf = await call(`/api/reports/${reports.data.reports[0].id}/download`, { cookie: admin });
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(pdf.data).subarray(0, 8).toString(), '%PDF-1.4');

    const share = await call('/api/shares', { method: 'POST', cookie: admin, body: { fileId, sharedWithOrgId: 'org-fortis', permission: 'Full Collaboration', expiryDate: '2099-12-31' } });
    assert.equal(share.status, 201);
    const partnerMessage = await call('/api/partner-chats/org-fortis/messages', { method: 'POST', cookie: admin, body: { body: 'Ready to collaborate' } });
    assert.equal(partnerMessage.status, 201);
    const fortisLogin = await call('/api/auth/login', { method: 'POST', body: { email: 'rajesh.kulkarni@fortishealthcare.demo', password: 'Demo@123' } });
    const fortis = fortisLogin.cookie;
    const inbox = await call('/api/partner-chats/org-apollo/messages', { cookie: fortis });
    assert.equal(inbox.data.messages[0].body, 'Ready to collaborate');
    const notices = await call('/api/notifications', { cookie: fortis });
    assert.ok(notices.data.notifications.some((item) => item.title === 'New partner message'));
    const extended = await call(`/api/shares/${share.data.id}/expiry`, { method: 'PATCH', cookie: admin, body: { expiryDate: '2099-11-30' } });
    assert.equal(extended.status, 200);
    const unauthorizedRevoke = await call(`/api/shares/${share.data.id}/revoke`, { method: 'PATCH', cookie: fortis });
    assert.equal(unauthorizedRevoke.status, 403);
    const forbidden = await call('/api/partner-chats/org-abc/messages', { cookie: fortis });
    assert.equal(forbidden.status, 403);
    const reportDenied = await call(`/api/reports/${reports.data.reports[0].id}/download`, { cookie: fortis });
    assert.equal(reportDenied.status, 403);
    const servingDb = new DatabaseSync(process.env.DB_PATH);
    servingDb.prepare('INSERT INTO model_versions (id, experiment_id, version, artifact_json, metrics_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('model-remote-normalized', experimentId, 'v1.remote.test', JSON.stringify({
        weights: [-2, 4], featureNames: ['__bias__', 'age'], labels: ['no', 'yes'],
        publicSchema: { patient_id: 'patient_id', target: 'label', labels: ['no', 'yes'],
          features: [{ name: 'age', type: 'numeric', min: 0, max: 120 }] }
      }), '{}', new Date().toISOString());
    servingDb.close();
    const normalizedPrediction = await call('/api/models/model-remote-normalized/predict', {
      method: 'POST', cookie: admin, body: { features: { age: 60 } }
    });
    assert.equal(normalizedPrediction.status, 200);
    assert.equal(normalizedPrediction.data.score, 0.5);
    const verify = await call('/api/audit-logs/verify', { cookie: admin });
    assert.equal(verify.data.valid, true);
    const changedPassword = await call('/api/auth/password', { method: 'POST', cookie: admin, body: { currentPassword: 'Demo@123', newPassword: 'AnotherSecurePassword123' } });
    assert.equal(changedPassword.status, 200);
    const oldPasswordLogin = await call('/api/auth/login', { method: 'POST', body: { email: 'vikram.sharma@apollohospitals.demo', password: 'Demo@123' } });
    assert.equal(oldPasswordLogin.status, 401);
    const newPasswordLogin = await call('/api/auth/login', { method: 'POST', body: { email: 'vikram.sharma@apollohospitals.demo', password: 'AnotherSecurePassword123' } });
    assert.equal(newPasswordLogin.status, 200);
    const tamper = new DatabaseSync(process.env.DB_PATH);
    tamper.prepare("UPDATE audit_logs SET details = 'changed' WHERE id = (SELECT id FROM audit_logs ORDER BY rowid DESC LIMIT 1)").run();
    tamper.close();
    const invalid = await call('/api/audit-logs/verify', { cookie: admin });
    assert.equal(invalid.data.valid, false);
    assert.equal(invalid.data.invalidRecordIds.length, 1);
  } finally {
    rmSync(temporaryData, { recursive: true, force: true });
  }
});
