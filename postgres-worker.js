import { workerData } from 'node:worker_threads';
import { Client, types } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

types.setTypeParser(20, (value) => Number(value));

const { port, ready, schema } = workerData;
const signal = (flag, payload) => {
  port.postMessage(payload);
  const view = new Int32Array(flag);
  Atomics.store(view, 0, 1);
  Atomics.notify(view, 0, 1);
};

async function connect() {
  if (workerData.databaseUrl) return new Client({ connectionString: workerData.databaseUrl,
    ssl: process.env.AWS_RDS_SSL === 'false' ? false : { rejectUnauthorized: true } });
  const response = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: workerData.secretArn }));
  const secret = JSON.parse(response.SecretString || '{}');
  return new Client({ host: workerData.proxyEndpoint || secret.host,
    port: Number(secret.port || 5432), user: secret.username, password: secret.password,
    database: workerData.databaseName || secret.dbname,
    ssl: { rejectUnauthorized: true } });
}

try {
  const client = await connect();
  await client.connect();
  await client.query(schema);
  signal(ready, { rows: [], rowCount: 0 });
  port.on('message', async ({ sql, params, flag }) => {
    try {
      const result = await client.query(sql, params);
      signal(flag, { rows: result.rows || [], rowCount: result.rowCount || 0 });
    } catch (error) {
      signal(flag, { error: error instanceof Error ? error.message : String(error) });
    }
  });
} catch (error) {
  signal(ready, { error: error instanceof Error ? error.message : String(error) });
}
