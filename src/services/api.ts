/**
 * API base URL resolution
 * - Local dev: defaults to http://localhost:4000 when VITE_API_URL is unset
 * - Amplify / production: VITE_API_URL must be set at build time (see amplify.yml)
 *   Empty production builds previously baked in localhost and caused ERR_CONNECTION_REFUSED.
 */
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
const isProdBuild = import.meta.env.PROD === true;
const API_BASE = (configuredApiUrl || (isProdBuild ? '' : 'http://localhost:4000')).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getApiBase(): string {
  return API_BASE;
}

export function isApiConfigured(): boolean {
  return Boolean(API_BASE);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(
      'API is not configured. Set Amplify environment variable VITE_API_URL to your API Gateway URL (stack output ApiUrl), then redeploy the frontend.',
      0
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const hint =
      API_BASE.includes('localhost')
        ? `Cannot reach ${API_BASE}. The production site cannot call localhost — set VITE_API_URL to your deployed API and rebuild.`
        : `Cannot reach API at ${API_BASE}. Check that the backend is deployed, CORS allows this origin, and the URL is correct.`;
    throw new ApiError(hint, 0);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || 'Request failed', response.status);
  return body as T;
}

export const api = {
  health: () => request<{ ok: boolean; mode: 'production' | 'development' }>('/api/health'),
  me: () => request<{ user: any }>('/api/auth/me'),
  login: (email: string, password: string) => request<{ user: any }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyLoginTwoFactor: (challengeToken: string, code: string) => request<{ user: any }>('/api/auth/login/verify', { method: 'POST', body: JSON.stringify({ challengeToken, code }) }),
  startTotpSetup: () => request<{ secret: string; otpauthUrl: string }>('/api/auth/totp/setup', { method: 'POST' }),
  confirmTotpSetup: (code: string) => request<{ ok: boolean }>('/api/auth/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTotp: (password: string, code: string) => request<{ ok: boolean }>('/api/auth/totp/disable', { method: 'POST', body: JSON.stringify({ password, code }) }),
  changePassword: (currentPassword: string, newPassword: string) => request<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  organizations: () => request<{ organizations: any[] }>('/api/organizations'),
  users: () => request<{ users: any[] }>('/api/users'),
  datasets: () => request<{ files: any[] }>('/api/datasets'),
  uploadDataset: (formData: FormData) => request<{ file: any }>('/api/datasets', { method: 'POST', body: formData }),
  downloadDataset: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/datasets/${id}/download`, { credentials: 'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(body.error || 'Download failed', response.status);
    }
    return response.blob();
  },
  deleteDataset: (id: string) => request<{ ok: boolean }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  shares: () => request<{ sharedData: any[] }>('/api/shares'),
  createShare: (payload: object) => request<{ ok: boolean; id: string }>('/api/shares', { method: 'POST', body: JSON.stringify(payload) }),
  revokeShare: (id: string) => request<{ ok: boolean }>(`/api/shares/${id}/revoke`, { method: 'PATCH' }),
  extendShare: (id: string, expiryDate: string) => request<{ ok: boolean; expiryDate: string }>(`/api/shares/${id}/expiry`, { method: 'PATCH', body: JSON.stringify({ expiryDate }) }),
  accessRequests: () => request<{ requests: any[] }>('/api/access-requests'),
  createAccessRequest: (payload: object) => request<{ id: string; status: string }>('/api/access-requests', { method: 'POST', body: JSON.stringify(payload) }),
  reviewAccessRequest: (id: string, decision: 'Approved' | 'Rejected') => request<{ ok: boolean; status: string }>(`/api/access-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ decision }) }),
  chatMessages: () => request<{ messages: any[] }>('/api/chat/messages'),
  postChatMessage: (body: string) => request<{ message: any }>('/api/chat/messages', { method: 'POST', body: JSON.stringify({ body }) }),
  partnerChats: () => request<{ partners: { id: string; name: string }[] }>('/api/partner-chats'),
  partnerMessages: (orgId: string) => request<{ messages: any[] }>(`/api/partner-chats/${encodeURIComponent(orgId)}/messages`),
  postPartnerMessage: (orgId: string, body: string) => request<{ id: string }>(`/api/partner-chats/${encodeURIComponent(orgId)}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  notifications: () => request<{ notifications: any[] }>('/api/notifications'),
  readNotification: (id: string) => request<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),
  clearNotifications: () => request<{ ok: boolean }>('/api/notifications', { method: 'DELETE' }),
  auditLogs: () => request<{ auditLogs: any[] }>('/api/audit-logs'),
  activity: () => request<{ activities: any[] }>('/api/activity'),
  verifyAuditLogs: () => request<{ valid: boolean; checked: number; invalidRecordIds: string[] }>('/api/audit-logs/verify'),
  securityEvents: () => request<{ periodHours: number; summary: { total: number; failed: number; warnings: number }; events: any[] }>('/api/security/events'),
  federatedLearningState: () => request<{ state: any }>('/api/federated-learning/state'),
  startFederatedLearning: () => request<{ state: any }>('/api/federated-learning/start', { method: 'POST' }),
  pauseFederatedLearning: () => request<{ state: any }>('/api/federated-learning/pause', { method: 'POST' }),
  resetFederatedLearning: () => request<{ state: any }>('/api/federated-learning/reset', { method: 'POST' }),
  createFederatedExperiment: (payload: object) => request<{ experiment: any }>('/api/federated-learning/experiments', { method: 'POST', body: JSON.stringify(payload) }),
  runFederatedExperiment: (id: string) => request<{ experimentId: string; status: string; rounds: any[]; testMetrics: any; splitCounts: any; model: any }>(`/api/federated-learning/experiments/${id}/run`, { method: 'POST' }),
  federatedExperiments: () => request<{ experiments: any[] }>('/api/federated-learning/experiments'),
  federatedExperiment: (id: string) => request<{ experiment: any; rounds: any[]; models: any[] }>(`/api/federated-learning/experiments/${id}`),
  downloadPublicSchema: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/federated-learning/experiments/${encodeURIComponent(id)}/public-schema`, { credentials: 'include' });
    if (!response.ok) throw new ApiError('Could not download public schema', response.status);
    return response.blob();
  },
  reports: () => request<{ reports: any[] }>('/api/reports'),
  downloadReport: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(id)}/download`, { credentials: 'include' });
    if (!response.ok) throw new ApiError('Could not download report', response.status);
    return response.blob();
  },
  compareFederatedExperiment: (id: string) => request<{ comparison: any }>(`/api/federated-learning/experiments/${id}/compare`, { method: 'POST' }),
  predict: (modelId: string, features: Record<string, string | number>) => request<{ modelId: string; version: string; prediction: string; confidence: number; score: number }>(`/api/models/${modelId}/predict`, { method: 'POST', body: JSON.stringify({ features }) }),
  modelArtifact: async (modelId: string) => {
    const response = await fetch(`${API_BASE}/api/models/${encodeURIComponent(modelId)}/artifact`, { credentials: 'include' });
    if (!response.ok) throw new ApiError('Could not download model artifact', response.status);
    return response.blob();
  },
  awsStatus: () => request<{ configured: Record<string, boolean | string> }>('/api/aws/status'),
  awsBackups: () => request<{ backups: any[] }>('/api/aws/backups'),
  createAwsBackup: () => request<{ id: string; storedInRds: boolean; storedInS3: boolean }>('/api/aws/backups', { method: 'POST' }),
  restoreAwsBackup: (id: string) => request<{ ok: boolean }>(`/api/aws/backups/${id}/restore`, { method: 'POST', body: JSON.stringify({ confirmation: `RESTORE ${id}` }) }),
  startSageMakerJob: (datasetId: string, jobName: string) => request<{ trainingJobArn: string; trainingJobName: string }>('/api/aws/sagemaker-jobs', { method: 'POST', body: JSON.stringify({ datasetId, jobName }) }),
  sageMakerJob: (name: string) => request<{ jobName: string; status: string; failureReason?: string; modelArtifactUri?: string }>(`/api/aws/sagemaker-jobs/${encodeURIComponent(name)}`)
};
