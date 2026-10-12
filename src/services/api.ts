const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const TOKEN_KEY = 'sclp_access_token';
const REFRESH_KEY = 'sclp_refresh_token';
const USER_KEY = 'sclp_user';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(tokens: { accessToken?: string; refreshToken?: string } | null) {
  if (!tokens?.accessToken) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function setStoredUser(user: unknown) {
  if (!user) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError((body as any).error || 'Request failed', response.status);
  return body as T;
}

export const api = {
  health: () => request<{ ok: boolean; mode: 'production' | 'development' }>('/api/health'),
  me: () => request<{ user: any }>('/api/auth/me'),
  login: async (email: string, password: string) => {
    const res = await request<{
      user?: any;
      tokens?: { accessToken: string; idToken?: string; refreshToken?: string };
      twoFactorRequired?: boolean;
      challengeToken?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.tokens?.accessToken) {
      setTokens(res.tokens);
      if (res.user) setStoredUser(res.user);
    }
    return res;
  },
  verifyLoginTwoFactor: (challengeToken: string, code: string) =>
    request<{ user: any; tokens?: any }>('/api/auth/login/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    }),
  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setTokens(null);
      setStoredUser(null);
    }
  },
  organizations: () => request<{ organizations: any[] }>('/api/organizations'),
  organization: (id: string) => request<{ organization: any }>(`/api/organizations/${id}`),
  users: () => request<{ users: any[] }>('/api/users'),
  datasets: () => request<{ files: any[] }>('/api/datasets'),
  createDataset: (payload: any) =>
    request<{ file: any }>('/api/datasets', { method: 'POST', body: JSON.stringify(payload) }),
  shares: () => request<{ sharedData: any[] }>('/api/shares'),
  auditLogs: () => request<{ auditLogs: any[] }>('/api/audit-logs'),
  notifications: () => request<{ notifications: any[] }>('/api/notifications'),
  experiments: () => request<{ experiments: any[] }>('/api/experiments'),
  createExperiment: (payload: any) =>
    request<{ experiment: any }>('/api/experiments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
