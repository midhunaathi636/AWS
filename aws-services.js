import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SageMakerClient, CreateTrainingJobCommand, DescribeTrainingJobCommand } from '@aws-sdk/client-sagemaker';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';

const region = process.env.AWS_REGION || 'ap-south-1';
const s3 = new S3Client({ region });
const cognito = new CognitoIdentityProviderClient({ region });
const sageMaker = new SageMakerClient({ region });
const cloudWatch = new CloudWatchClient({ region });
const secrets = new SecretsManagerClient({ region });
const { Pool } = pg;
let rdsPool;
let rdsSecret;

const getRdsPool = () => {
  if (!process.env.AWS_RDS_DATABASE_URL && !process.env.AWS_RDS_SECRET_ARN) throw new Error('AWS RDS connection settings are not configured');
  if (rdsPool) return rdsPool;
  if (process.env.AWS_RDS_DATABASE_URL) rdsPool = new Pool({ connectionString: process.env.AWS_RDS_DATABASE_URL, ssl: process.env.AWS_RDS_SSL === 'false' ? false : { rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 10000 });
  else if (rdsSecret) rdsPool = new Pool({ host: process.env.AWS_RDS_PROXY_ENDPOINT || rdsSecret.host, port: Number(rdsSecret.port || 5432), database: rdsSecret.dbname || process.env.AWS_RDS_DATABASE, user: rdsSecret.username, password: rdsSecret.password, ssl: { rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 10000 });
  else throw new Error('RDS secret has not been loaded yet');
  return rdsPool;
};

export const initializeAwsSecrets = async () => {
  if (!process.env.AWS_RDS_SECRET_ARN) return;
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.AWS_RDS_SECRET_ARN }));
  rdsSecret = JSON.parse(response.SecretString || '{}');
};
const ensureRdsPool = async () => {
  if (process.env.AWS_RDS_SECRET_ARN && !rdsSecret) await initializeAwsSecrets();
  return getRdsPool();
};

export const awsServiceStatus = () => ({
  region,
  s3Data: Boolean(process.env.AWS_S3_DATA_BUCKET),
  s3Models: Boolean(process.env.AWS_S3_MODEL_BUCKET),
  s3Backups: Boolean(process.env.AWS_S3_BACKUP_BUCKET),
  rds: Boolean(process.env.AWS_RDS_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN),
  cognito: Boolean(process.env.AWS_COGNITO_CLIENT_ID),
  sageMaker: Boolean(process.env.AWS_SAGEMAKER_ROLE_ARN && process.env.AWS_SAGEMAKER_TRAINING_IMAGE),
  cloudWatch: process.env.AWS_CLOUDWATCH_METRICS !== 'false'
});

export const putEncryptedDataset = async (key, encryptedBody) => {
  const bucket = process.env.AWS_S3_DATA_BUCKET;
  if (!bucket) return false;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: encryptedBody, ContentType: 'application/octet-stream', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
  return true;
};

export const getEncryptedDataset = async (key) => {
  const bucket = process.env.AWS_S3_DATA_BUCKET;
  if (!bucket) return null;
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
};

export const putSageMakerInput = async (key, body) => {
  const bucket = process.env.AWS_S3_DATA_BUCKET;
  if (!bucket) throw new Error('AWS_S3_DATA_BUCKET is not configured');
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/csv', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
  return `s3://${bucket}/${key}`;
};

export const putModelArtifact = async (key, body) => {
  const bucket = process.env.AWS_S3_MODEL_BUCKET;
  if (!bucket) return false;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
  return true;
};

export const putReportArtifact = async (key, body) => {
  const bucket = process.env.AWS_S3_MODEL_BUCKET;
  if (!bucket) return false;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/pdf', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
  return true;
};

export const getReportArtifact = async (key) => {
  const bucket = process.env.AWS_S3_MODEL_BUCKET;
  if (!bucket || !key) return null;
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await object.Body.transformToByteArray());
};

export const deleteDatasetObject = async (key) => {
  const bucket = process.env.AWS_S3_DATA_BUCKET;
  if (bucket) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
export const putBackupDatasetObject = async (backupId, key, body) => {
  const bucket = process.env.AWS_S3_BACKUP_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BACKUP_BUCKET is required to back up dataset objects');
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `platform/${backupId}/datasets/${key}`, Body: body, ContentType: 'application/octet-stream', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
};
export const getBackupDatasetObject = async (backupId, key) => {
  const bucket = process.env.AWS_S3_BACKUP_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BACKUP_BUCKET is not configured');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `platform/${backupId}/datasets/${key}` }));
  return Buffer.from(await object.Body.transformToByteArray());
};

export const authenticateCognito = async (username, password) => {
  if (!process.env.AWS_COGNITO_CLIENT_ID) return null;
  return cognito.send(new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.AWS_COGNITO_CLIENT_ID,
    AuthParameters: { USERNAME: username, PASSWORD: password }
  }));
};

export const completeCognitoChallenge = async (challengeName, clientMetadata, session) => {
  if (!process.env.AWS_COGNITO_CLIENT_ID) throw new Error('Cognito is not configured');
  const name = challengeName === 'SOFTWARE_TOKEN_MFA' ? 'SOFTWARE_TOKEN_MFA' : challengeName;
  return cognito.send(new RespondToAuthChallengeCommand({
    ClientId: process.env.AWS_COGNITO_CLIENT_ID,
    ChallengeName: name,
    Session: session,
    ChallengeResponses: clientMetadata
  }));
};

export const startSageMakerJob = async ({ jobName, s3InputUri, hyperParameters = {} }) => {
  if (!process.env.AWS_SAGEMAKER_ROLE_ARN || !process.env.AWS_SAGEMAKER_TRAINING_IMAGE || !process.env.AWS_S3_MODEL_BUCKET) throw new Error('SageMaker role, training image, and model bucket must be configured');
  const safeJobName = jobName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 63) || `training-${Date.now()}`;
  const response = await sageMaker.send(new CreateTrainingJobCommand({
    TrainingJobName: safeJobName,
    RoleArn: process.env.AWS_SAGEMAKER_ROLE_ARN,
    AlgorithmSpecification: { TrainingImage: process.env.AWS_SAGEMAKER_TRAINING_IMAGE, TrainingInputMode: 'File' },
    InputDataConfig: [{ ChannelName: 'training', DataSource: { S3DataSource: { S3DataType: 'S3Prefix', S3Uri: s3InputUri, S3DataDistributionType: 'FullyReplicated' } } }],
    OutputDataConfig: { S3OutputPath: `s3://${process.env.AWS_S3_MODEL_BUCKET}/sagemaker-output` },
    ResourceConfig: { InstanceType: process.env.AWS_SAGEMAKER_INSTANCE_TYPE || 'ml.m5.large', InstanceCount: 1, VolumeSizeInGB: Number(process.env.AWS_SAGEMAKER_VOLUME_GB || 20) },
    StoppingCondition: { MaxRuntimeInSeconds: Number(process.env.AWS_SAGEMAKER_MAX_RUNTIME_SECONDS || 3600) },
    HyperParameters: Object.fromEntries(Object.entries(hyperParameters).map(([key, value]) => [key, String(value)]))
  }));
  return { trainingJobArn: response.TrainingJobArn, trainingJobName: safeJobName };
};

export const describeSageMakerJob = async (jobName) => {
  const response = await sageMaker.send(new DescribeTrainingJobCommand({ TrainingJobName: jobName }));
  return { status: response.TrainingJobStatus, failureReason: response.FailureReason, modelArtifactUri: response.ModelArtifacts?.S3ModelArtifacts };
};

export const recordTrainingMetrics = async ({ accuracy, loss, communicationBytes, experimentId }) => {
  if (process.env.AWS_CLOUDWATCH_METRICS === 'false') return;
  await cloudWatch.send(new PutMetricDataCommand({
    Namespace: process.env.AWS_CLOUDWATCH_NAMESPACE || 'SecureCollaborativeLearning/Training',
    MetricData: [
      { MetricName: 'Accuracy', Value: accuracy, Unit: 'Percent', Dimensions: [{ Name: 'ExperimentId', Value: experimentId }] },
      { MetricName: 'Loss', Value: loss, Unit: 'None', Dimensions: [{ Name: 'ExperimentId', Value: experimentId }] },
      { MetricName: 'CommunicationBytes', Value: communicationBytes, Unit: 'Bytes', Dimensions: [{ Name: 'ExperimentId', Value: experimentId }] }
    ]
  }));
};

export const saveCloudBackup = async (backupId, payload) => {
  const json = JSON.stringify(payload);
  if (process.env.AWS_RDS_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN) {
    const pool = await ensureRdsPool();
    await pool.query('CREATE TABLE IF NOT EXISTS platform_backups (id text PRIMARY KEY, created_at timestamptz NOT NULL, payload jsonb NOT NULL)');
    await pool.query('INSERT INTO platform_backups (id, created_at, payload) VALUES ($1, now(), $2::jsonb)', [backupId, json]);
  }
  if (process.env.AWS_S3_BACKUP_BUCKET) {
    await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BACKUP_BUCKET, Key: `platform/${backupId}.json`, Body: json, ContentType: 'application/json', ServerSideEncryption: 'aws:kms', ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}) }));
  }
  if (!process.env.AWS_RDS_DATABASE_URL && !process.env.AWS_RDS_SECRET_ARN && !process.env.AWS_S3_BACKUP_BUCKET) throw new Error('Configure an RDS URL or S3 backup bucket');
  return { id: backupId, storedInRds: Boolean(process.env.AWS_RDS_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN), storedInS3: Boolean(process.env.AWS_S3_BACKUP_BUCKET) };
};

export const loadCloudBackup = async (backupId) => {
  if (process.env.AWS_RDS_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN) {
    try {
      const result = await (await ensureRdsPool()).query('SELECT payload FROM platform_backups WHERE id = $1', [backupId]);
      if (result.rowCount) return result.rows[0].payload;
    } catch (error) { if (error?.code !== '42P01') throw error; }
  }
  if (process.env.AWS_S3_BACKUP_BUCKET) {
    const object = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BACKUP_BUCKET, Key: `platform/${backupId}.json` }));
    return JSON.parse(Buffer.from(await object.Body.transformToByteArray()).toString('utf8'));
  }
  throw new Error('Backup not found in configured RDS or S3 storage');
};

export const listCloudBackups = async () => {
  const backups = new Map();
  if (process.env.AWS_RDS_DATABASE_URL || process.env.AWS_RDS_SECRET_ARN) {
    try {
      const result = await (await ensureRdsPool()).query('SELECT id, created_at AS "createdAt" FROM platform_backups ORDER BY created_at DESC LIMIT 50');
      result.rows.forEach((row) => backups.set(row.id, { id: row.id, createdAt: row.createdAt, storedInRds: true }));
    } catch (error) { if (error?.code !== '42P01') throw error; }
  }
  if (process.env.AWS_S3_BACKUP_BUCKET) {
    const result = await s3.send(new ListObjectsV2Command({ Bucket: process.env.AWS_S3_BACKUP_BUCKET, Prefix: 'platform/', MaxKeys: 1000 }));
    for (const object of result.Contents || []) {
      const match = object.Key?.match(/^platform\/(backup-[^/]+)\.json$/);
      if (match) backups.set(match[1], { ...(backups.get(match[1]) || {}), id: match[1], createdAt: object.LastModified?.toISOString(), storedInS3: true });
    }
  }
  return [...backups.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
};
