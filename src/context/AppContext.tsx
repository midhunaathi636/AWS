import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Organization,
  User,
  SecureFile,
  SharedData,
  FederatedLearningState,
  AuditLog,
  NotificationItem,
  SystemSettings,
  Role,
  Classification,
  DataCategory,
  PermissionType,
  ClientNode
} from '../types';
import { api, ApiError, isApiConfigured } from '../services/api';

/** Placeholder users used only until /api/auth/me succeeds. Production auth comes from the API/Cognito. */
const INITIAL_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Vikram Sharma',
    email: 'vikram.sharma@apollohospitals.demo',
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
    name: 'Rajesh Kulkarni',
    email: 'rajesh.kulkarni@fortishealthcare.demo',
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
    name: 'Ananya Iyer',
    email: 'ananya.iyer@abcresearch.demo',
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

const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-apollo',
    name: 'Apollo Hospitals',
    type: 'Hospital Network',
    location: 'Chennai & New Delhi, IN',
    adminName: 'Dr. Vikram Sharma',
    adminEmail: 'vikram.sharma@apollohospitals.demo',
    status: 'active',
    joinedDate: '2025-03-12',
    description: 'Premier tertiary healthcare provider.',
    contactPhone: '+91 (044) 2829-0200',
    usersCount: 1,
    storageUsedGb: 0,
    maxStorageGb: 1000,
    filesCount: 0,
    trainingRoundsParticipated: 0,
    avgAccuracy: 0,
    publicKeyFingerprint: 'SHA256:demo-apollo',
  },
  {
    id: 'org-fortis',
    name: 'Fortis Healthcare',
    type: 'Healthcare Network',
    location: 'Gurgaon & Mumbai, IN',
    adminName: 'Dr. Rajesh Kulkarni',
    adminEmail: 'rajesh.kulkarni@fortishealthcare.demo',
    status: 'active',
    joinedDate: '2025-06-18',
    description: 'Integrated healthcare delivery provider.',
    contactPhone: '+91 (0124) 492-1021',
    usersCount: 1,
    storageUsedGb: 0,
    maxStorageGb: 1000,
    filesCount: 0,
    trainingRoundsParticipated: 0,
    avgAccuracy: 0,
    publicKeyFingerprint: 'SHA256:demo-fortis',
  },
  {
    id: 'org-abc',
    name: 'ABC Research',
    type: 'Biotech Research Lab',
    location: 'Bengaluru Tech Park, IN',
    adminName: 'Dr. Ananya Iyer',
    adminEmail: 'ananya.iyer@abcresearch.demo',
    status: 'active',
    joinedDate: '2025-09-04',
    description: 'Computational biology and biomedical research lab.',
    contactPhone: '+91 (080) 6780-3300',
    usersCount: 1,
    storageUsedGb: 0,
    maxStorageGb: 1000,
    filesCount: 0,
    trainingRoundsParticipated: 0,
    avgAccuracy: 0,
    publicKeyFingerprint: 'SHA256:demo-abc',
  },
];

const defaultClientNodes: ClientNode[] = [
  {
    id: 'node-apollo',
    orgId: 'org-apollo',
    name: 'Apollo Hospitals Node',
    datasetSize: 12000,
    recordsCountLabel: '12k records',
    status: 'Idle',
    localAccuracy: 70.0,
    loss: 0.72,
    trainingTime: '0s',
    progress: 0,
    batchSize: 32,
    privacyBudgetEpsilon: 1.0,
  },
  {
    id: 'node-fortis',
    orgId: 'org-fortis',
    name: 'Fortis Healthcare Node',
    datasetSize: 8500,
    recordsCountLabel: '8.5k records',
    status: 'Idle',
    localAccuracy: 70.0,
    loss: 0.72,
    trainingTime: '0s',
    progress: 0,
    batchSize: 32,
    privacyBudgetEpsilon: 1.0,
  },
  {
    id: 'node-abc',
    orgId: 'org-abc',
    name: 'ABC Research Node',
    datasetSize: 6200,
    recordsCountLabel: '6.2k records',
    status: 'Idle',
    localAccuracy: 70.0,
    loss: 0.72,
    trainingTime: '0s',
    progress: 0,
    batchSize: 32,
    privacyBudgetEpsilon: 1.0,
  },
];

const INITIAL_FEDERATED_STATE: FederatedLearningState = {
  currentRound: 1,
  totalRounds: 10,
  isTraining: false,
  isPaused: false,
  status: 'Idle',
  globalAccuracy: 70.2,
  roundHistory: [
    {
      round: 1,
      accuracy: 70.2,
      loss: 0.724,
      timestamp: new Date().toLocaleTimeString(),
      clientsParticipating: 3,
    },
  ],
  clientNodes: defaultClientNodes,
  logs: [
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: '[System] Federated learning session initialized.',
    },
  ],
  aggregationAlgorithm: 'FedAvg',
  differentialPrivacyEpsilon: 1.0,
  clippingThreshold: 1.0,
};

const INITIAL_SETTINGS: SystemSettings = {
  general: {
    platformName: 'Secure Collaborative Learning Platform',
    contactSupportEmail: 'support@example.com',
    timezone: 'Asia/Kolkata',
    sessionTimeoutMins: 60,
  },
  security: {
    enforceMfa: false,
    requireZeroKnowledgeProofs: false,
    ipAllowlistOnly: false,
    encryptionStandard: 'AES-256-GCM',
    logRetentionDays: 90,
  },
  federatedLearning: {
    defaultAlgorithm: 'FedAvg',
    dpEpsilon: 1.0,
    dpDelta: 1e-5,
    clippingNorm: 1.0,
    minClientsRequired: 2,
    maxRounds: 50,
  },
};


export type TabId = 
  | 'dashboard'
  | 'organizations'
  | 'organization-details'
  | 'users'
  | 'user-profile'
  | 'secure-data'
  | 'data-sharing'
  | 'federated-learning'
  | 'global-model'
  | 'audit-logs'
  | 'reports'
  | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

interface AppContextType {
  // Navigation & View
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  
  // Auth & Persona
  isAuthenticated: boolean;
  currentUser: User;
  switchUser: (user: User) => void;
  login: (email: string, password: string, challengeToken?: string, code?: string) => Promise<{ twoFactorRequired?: boolean; challengeToken?: string }>;
  logout: () => Promise<void>;
  
  // Theme & Layout
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isNotificationDrawerOpen: boolean;
  setIsNotificationDrawerOpen: (open: boolean) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  
  // Current Filter Context
  activeOrgFilter: string; // 'all' or orgId
  setActiveOrgFilter: (filter: string) => void;

  // Data Collections
  organizations: Organization[];
  users: User[];
  files: SecureFile[];
  sharedData: SharedData[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  settings: SystemSettings;
  
  // CRUD Actions
  addOrganization: (org: Omit<Organization, 'id' | 'usersCount' | 'storageUsedGb' | 'filesCount' | 'trainingRoundsParticipated' | 'avgAccuracy' | 'joinedDate' | 'publicKeyFingerprint'>) => void;
  updateOrganization: (id: string, updates: Partial<Organization>) => void;
  deleteOrganization: (id: string) => void;
  
  addUser: (user: Omit<User, 'id' | 'lastLogin' | 'permissions'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  toggleUserStatus: (id: string) => void;
  deleteUser: (id: string) => void;
  
  uploadFile: (fileData: { fileName: string; category: DataCategory; classification: Classification; description: string; tags: string[]; sizeFormatted: string; sizeBytes: number; file?: File }) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  
  shareDataset: (sharePayload: { fileId: string; sharedWithOrgId: string; permission: PermissionType; expiryDate: string; dpEpsilon?: number }) => Promise<void>;
  revokeShare: (id: string) => Promise<void>;
  extendShare: (id: string, newExpiry: string) => Promise<void>;
  refreshSharedData: () => Promise<void>;
  
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  
  // Toast
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // Settings
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  
  // Federated Learning Simulation
  flState: FederatedLearningState;
  startTrainingSimulation: () => void;
  pauseTrainingSimulation: () => void;
  resetTrainingSimulation: () => void;
  stepRoundSimulation: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>('org-apollo');
  const [selectedUserId, setSelectedUserId] = useState<string | null>('usr-1');
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  
  // Theme & Layout
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  
  // Active Filter: 'all' or org ID
  const [activeOrgFilter, setActiveOrgFilter] = useState<string>('all');
  
  // Data Collections
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [sharedData, setSharedData] = useState<SharedData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  
  // Federated Learning Simulation State
  const [flState, setFlState] = useState<FederatedLearningState>(INITIAL_FEDERATED_STATE);
  
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Self-contained mode: seed demo data so Amplify works with no VITE_API_URL.
    setOrganizations(INITIAL_ORGANIZATIONS);
    setUsers(INITIAL_USERS);

    if (!isApiConfigured()) {
      setIsAuthenticated(false);
      return;
    }
    api.me()
      .then(({ user }) => {
        setCurrentUser(user);
        setIsAuthenticated(true);
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isApiConfigured()) {
      // Demo mode: keep in-memory seed data only
      return;
    }
    Promise.all([api.organizations(), api.users(), api.datasets(), api.shares()])
      .then(([orgResponse, userResponse, datasetResponse, shareResponse]) => {
        setOrganizations(orgResponse.organizations);
        setUsers(userResponse.users);
        setFiles(datasetResponse.files);
        setSharedData(shareResponse.sharedData);
      })
      .catch(() => addToast({ type: 'warning', title: 'Backend Unavailable', message: 'Some workspace data could not be loaded.' }));
    api.auditLogs().then(({ auditLogs: logs }) => setAuditLogs(logs)).catch(() => undefined);
    const refreshNotifications = () => api.notifications().then(({ notifications: items }) => setNotifications(items)).catch(() => undefined);
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 15000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const switchUser = (user: User) => {
    setCurrentUser(user);
    addToast({
      type: 'info',
      title: 'Persona Switched',
      message: `Active persona changed to ${user.name} (${user.role} at ${user.organizationName})`
    });
  };

  const login = async (email: string, password: string, _challengeToken?: string, _code?: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    // Demo / offline mode: when VITE_API_URL is not set (common on Amplify-only deploys),
    // authenticate against built-in demo personas so the UI is usable without a backend.
    if (!isApiConfigured()) {
      if (password !== 'Demo@123') {
        throw new ApiError('Invalid email or password', 401);
      }
      const demoUser = INITIAL_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!demoUser) {
        throw new ApiError('Invalid email or password', 401);
      }
      const user = { ...demoUser, lastLogin: new Date().toISOString() };
      setUsers(INITIAL_USERS);
      setOrganizations(INITIAL_ORGANIZATIONS);
      setCurrentUser(user);
      setIsAuthenticated(true);
      addToast({
        type: 'success',
        title: 'Signed in (demo mode)',
        message: `Welcome, ${user.name}. Running without API — set VITE_API_URL for full backend.`,
      });
      return {};
    }

    const result = await api.login(normalizedEmail, password);
    if (!result.user) {
      throw new Error('Sign-in did not return a user account');
    }
    const user = result.user;
    setCurrentUser(user);
    setIsAuthenticated(true);
    addToast({
      type: 'success',
      title: 'Signed in',
      message: `Welcome back, ${user.name}.`,
    });
    return {};
  };

  const logout = async () => {
    if (isApiConfigured()) {
      await api.logout().catch(() => undefined);
    }
    setIsAuthenticated(false);
    setCurrentUser(INITIAL_USERS[0]);
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Session closed.',
    });
  };

  // Helper to record audit log
  const recordAudit = (action: string, result: 'Success' | 'Failed' | 'Warning', details: string) => {
    void action; void result; void details;
    api.auditLogs().then(({ auditLogs: logs }) => setAuditLogs(logs)).catch(() => undefined);
  };

  // CRUD for Organizations
  const addOrganization = (orgData: Omit<Organization, 'id' | 'usersCount' | 'storageUsedGb' | 'filesCount' | 'trainingRoundsParticipated' | 'avgAccuracy' | 'joinedDate' | 'publicKeyFingerprint'>) => {
    const id = 'org-' + Math.random().toString(36).substring(2, 8);
    const newOrg: Organization = {
      ...orgData,
      id,
      usersCount: 1,
      storageUsedGb: 0,
      maxStorageGb: 1000,
      filesCount: 0,
      trainingRoundsParticipated: 0,
      avgAccuracy: 0,
      joinedDate: new Date().toISOString().split('T')[0],
      publicKeyFingerprint: 'SHA256:' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    };
    setOrganizations((prev) => [...prev, newOrg]);
    recordAudit('Register New Organization', 'Success', `Organization '${newOrg.name}' registered with ID ${id}`);
    addToast({
      type: 'success',
      title: 'Organization Added',
      message: `${newOrg.name} has been enrolled in the federated network.`
    });
  };

  const updateOrganization = (id: string, updates: Partial<Organization>) => {
    setOrganizations((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    recordAudit('Update Organization', 'Success', `Updated parameters for organization ${id}`);
    addToast({
      type: 'info',
      title: 'Organization Updated',
      message: 'Organization details successfully persisted.'
    });
  };

  const deleteOrganization = (id: string) => {
    const org = organizations.find((o) => o.id === id);
    setOrganizations((prev) => prev.filter((o) => o.id !== id));
    recordAudit('Remove Organization', 'Warning', `Revoked participation for organization '${org?.name || id}'`);
    addToast({
      type: 'warning',
      title: 'Organization Removed',
      message: `${org?.name || 'Organization'} has been unlinked from federation.`
    });
  };

  // CRUD for Users
  const addUser = (userData: Omit<User, 'id' | 'lastLogin' | 'permissions'>) => {
    const id = 'usr-' + Date.now();
    const newUser: User = {
      ...userData,
      id,
      lastLogin: 'Never',
      permissions: ['view_data', 'view_reports']
    };
    setUsers((prev) => [...prev, newUser]);
    // update user count in org
    setOrganizations((prev) => prev.map((o) => (o.id === newUser.organizationId ? { ...o, usersCount: o.usersCount + 1 } : o)));
    recordAudit('Provision New User', 'Success', `Created user account for ${newUser.name} (${newUser.role})`);
    addToast({
      type: 'success',
      title: 'User Added',
      message: `User ${newUser.name} created for ${newUser.organizationName}.`
    });
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    recordAudit('Update User Profile', 'Success', `Modified permissions or attributes for user ID ${id}`);
    addToast({
      type: 'info',
      title: 'User Profile Updated',
      message: 'Account profile changes applied.'
    });
  };

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === 'active' ? 'suspended' : 'active';
          recordAudit('Toggle User Status', 'Warning', `Status for ${u.name} set to ${nextStatus}`);
          addToast({
            type: nextStatus === 'active' ? 'success' : 'warning',
            title: `User ${nextStatus === 'active' ? 'Activated' : 'Suspended'}`,
            message: `${u.name} access state updated.`
          });
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    recordAudit('Delete User Account', 'Warning', `Deleted user account ${target?.email}`);
    addToast({
      type: 'warning',
      title: 'User Removed',
      message: `Account for ${target?.name} deleted.`
    });
  };

  // Files
  const uploadFile = async (fileData: { fileName: string; category: DataCategory; classification: Classification; description: string; tags: string[]; sizeFormatted: string; sizeBytes: number; file?: File }) => {
    if (!fileData.file) throw new Error('Choose a file to upload.');

    if (isApiConfigured()) {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('fileName', fileData.fileName);
      formData.append('category', fileData.category);
      formData.append('classification', fileData.classification);
      formData.append('description', fileData.description);
      formData.append('tags', fileData.tags.join(','));
      const response = await api.uploadDataset(formData);
      setFiles((prev) => [response.file, ...prev]);
      addToast({ type: 'success', title: 'Dataset Encrypted & Uploaded', message: `${response.file.fileName} was stored securely.` });
      return;
    }

    const ext = (fileData.fileName.split('.').pop() || 'dat').toLowerCase();
    const localFile = {
      id: 'file-' + Date.now(),
      fileName: fileData.fileName,
      fileExtension: ext,
      ownerName: currentUser.name,
      ownerEmail: currentUser.email,
      organizationId: currentUser.organizationId,
      organizationName: currentUser.organizationName,
      category: fileData.category,
      sizeBytes: fileData.sizeBytes,
      sizeFormatted: fileData.sizeFormatted,
      uploadDate: new Date().toISOString().slice(0, 10),
      classification: fileData.classification,
      status: 'Encrypted AES-256' as const,
      encryptionHash: 'demo-' + Math.random().toString(16).slice(2, 10),
      recordsCount: 0,
      description: fileData.description,
      tags: fileData.tags,
      sampleColumns: [] as string[],
      sampleRows: [] as Record<string, string | number>[],
    };
    setFiles((prev) => [localFile, ...prev]);
    setOrganizations((prev) =>
      prev.map((o) =>
        o.id === currentUser.organizationId
          ? { ...o, filesCount: o.filesCount + 1, storageUsedGb: o.storageUsedGb + fileData.sizeBytes / (1024 ** 3) }
          : o
      )
    );
    recordAudit('Upload Dataset', 'Success', `Local demo upload: ${fileData.fileName}`);
    addToast({ type: 'success', title: 'Dataset added (demo)', message: `${fileData.fileName} stored in local session.` });
  };


  const deleteFile = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (isApiConfigured()) await api.deleteDataset(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    recordAudit('Purge Encrypted File', 'Warning', `Purged dataset ${file?.fileName} from secure storage`);
    addToast({
      type: 'info',
      title: 'File Deleted',
      message: `${file?.fileName} has been securely scrubbed.`
    });
  };

  // Data Sharing
  const shareDataset = async (sharePayload: { fileId: string; sharedWithOrgId: string; permission: PermissionType; expiryDate: string; dpEpsilon?: number }) => {
    const file = files.find((f) => f.id === sharePayload.fileId);
    const destOrg = organizations.find((o) => o.id === sharePayload.sharedWithOrgId);
    if (!file || !destOrg) throw new Error('Choose a valid dataset and destination organization.');

    if (isApiConfigured()) {
      await api.createShare(sharePayload);
      const { sharedData: updated } = await api.shares();
      setSharedData(updated);
    } else {
      const localShare = {
        id: 'share-' + Date.now(),
        ...sharePayload,
        status: 'Active',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setSharedData((prev) => [localShare as any, ...prev]);
    }
    recordAudit('Generate Sharing Grant', 'Success', `Shared ${file.fileName} with ${destOrg.name} under '${sharePayload.permission}' scope`);
    addToast({
      type: 'success',
      title: 'Dataset Access Granted',
      message: `Shared ${file.fileName} with ${destOrg.name}.`
    });
  };

  const revokeShare = async (id: string) => {
    if (isApiConfigured()) await api.revokeShare(id);
    setSharedData((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          recordAudit('Revoke Sharing Grant', 'Warning', `Revoked token access for ${s.fileName} shared with ${s.sharedWithOrgName}`);
          addToast({
            type: 'warning',
            title: 'Share Revoked',
            message: `Access token invalidated for ${s.sharedWithOrgName}.`
          });
          return { ...s, status: 'Revoked' };
        }
        return s;
      })
    );
  };

  const extendShare = async (id: string, newExpiry: string) => {
    if (isApiConfigured()) await api.extendShare(id, newExpiry);
    setSharedData((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          recordAudit('Extend Sharing Expiry', 'Success', `Extended token for ${s.fileName} until ${newExpiry}`);
          addToast({
            type: 'info',
            title: 'Access Extended',
            message: `Validity extended to ${newExpiry}.`
          });
          return { ...s, expiryDate: newExpiry, status: 'Active' };
        }
        return s;
      })
    );
  };
  const refreshSharedData = async () => {
    if (isApiConfigured()) {
      const response = await api.shares();
      setSharedData(response.sharedData);
    }
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    if (isApiConfigured()) api.readNotification(id).catch(() => undefined);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    if (isApiConfigured()) api.readAllNotifications().catch(() => undefined);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      type: 'info',
      title: 'Notifications Cleared',
      message: 'All notifications marked as read.'
    });
  };

  const clearNotifications = () => {
    if (isApiConfigured()) api.clearNotifications().catch(() => undefined);
    setNotifications([]);
  };

  // Settings
  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
      general: { ...prev.general, ...newSettings.general },
      security: { ...prev.security, ...newSettings.security },
      federatedLearning: { ...prev.federatedLearning, ...newSettings.federatedLearning }
    }));
    recordAudit('Update System Security Settings', 'Success', 'Updated global federated learning and cryptographic policies');
    addToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'System and algorithm configuration applied.'
    });
  };

  // Federated Learning Training Simulation
  const startTrainingSimulation = () => {
    if (flState.isTraining) return;

    setFlState((prev) => ({
      ...prev,
      isTraining: true,
      isPaused: false,
      status: 'Distributing Weights',
      logs: [
        {
          id: 'log-' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message: `[Simulation] Starting illustrative ${prev.aggregationAlgorithm} training cycle. No privacy budget is calculated.`
        },
        ...prev.logs
      ]
    }));

    addToast({
      type: 'info',
      title: 'Federated Training Started',
      message: 'Broadcasting base model weights to Apollo, Fortis, and ABC Research Labs...'
    });

    // Simulated multi-stage progression
    setTimeout(() => {
      setFlState((prev) => ({
        ...prev,
        status: 'Local Client Training',
        clientNodes: prev.clientNodes.map((node) => ({
          ...node,
          status: 'Computing Gradients',
          progress: 35
        })),
        logs: [
          {
            id: 'log-' + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level: 'secure',
            message: `[Client Nodes] Local SGD underway on private on-premise enclaves. Zero raw patient records transferred.`
          },
          ...prev.logs
        ]
      }));
    }, 1500);

    setTimeout(() => {
      setFlState((prev) => ({
        ...prev,
        clientNodes: prev.clientNodes.map((node) => ({
          ...node,
          status: 'Simulation Noise Added',
          progress: 75
        })),
        logs: [
          {
            id: 'log-' + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level: 'secure',
            message: `[Differential Privacy] Gradient vectors clipped (L2-norm = ${prev.clippingThreshold}) and calibrated Gaussian noise added.`
          },
          ...prev.logs
        ]
      }));
    }, 3200);

    setTimeout(() => {
      setFlState((prev) => ({
        ...prev,
        status: 'Aggregation Simulation',
        clientNodes: prev.clientNodes.map((node) => ({
          ...node,
          status: 'Weights Uploaded',
          progress: 95
        })),
        logs: [
          {
            id: 'log-' + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level: 'info',
            message: `[Aggregation Simulation] Averaging local model parameters for the illustrative animation.`
          },
          ...prev.logs
        ]
      }));
    }, 4800);

    setTimeout(() => {
      setFlState((prev) => {
        const nextRound = Math.min(prev.currentRound < 5 ? prev.currentRound + 1 : 5, 5);
        const newAccuracy = 91.4; // target accuracy
        const newLoss = 0.142;
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        return {
          ...prev,
          currentRound: 5,
          isTraining: false,
          status: 'Completed',
          globalAccuracy: newAccuracy,
          clientNodes: prev.clientNodes.map((node) => ({
            ...node,
            status: 'Completed',
            progress: 100,
            localAccuracy: node.orgId === 'org-apollo' ? 85.0 : node.orgId === 'org-fortis' ? 87.0 : 83.0,
            loss: node.orgId === 'org-apollo' ? 0.148 : node.orgId === 'org-fortis' ? 0.142 : 0.155
          })),
          logs: [
            {
              id: 'log-' + Date.now(),
              timestamp: new Date().toLocaleTimeString(),
              level: 'success',
              message: `[Orchestrator] Training Convergence achieved! Global Model test accuracy reached 91.4% across Org A (85%), Org B (87%), and Org C (83%).`
            },
            ...prev.logs
          ]
        };
      });

      recordAudit('Federated Training Completed', 'Success', 'Successfully aggregated 5 rounds with 91.4% global accuracy');
      addToast({
        type: 'success',
        title: 'Training Convergence Reached',
        message: 'Global model updated to 91.4% accuracy across Organization A (85%), B (87%), and C (83%).'
      });
    }, 6500);
  };

  const stepRoundSimulation = () => {
    setFlState((prev) => {
      const nextRound = prev.currentRound >= 5 ? 1 : prev.currentRound + 1;
      const roundAccuracies: Record<number, { global: number; a: number; b: number; c: number; loss: number }> = {
        1: { global: 70.2, a: 71.0, b: 73.0, c: 69.0, loss: 0.724 },
        2: { global: 78.4, a: 77.0, b: 79.0, c: 75.0, loss: 0.512 },
        3: { global: 84.1, a: 81.0, b: 83.0, c: 80.0, loss: 0.380 },
        4: { global: 88.0, a: 84.0, b: 85.0, c: 82.0, loss: 0.228 },
        5: { global: 91.4, a: 85.0, b: 87.0, c: 83.0, loss: 0.142 }
      };
      const cur = roundAccuracies[nextRound];

      return {
        ...prev,
        currentRound: nextRound,
        globalAccuracy: cur.global,
        status: nextRound === 5 ? 'Completed' : 'Local Client Training',
        clientNodes: prev.clientNodes.map((node) => ({
          ...node,
          progress: 100,
          localAccuracy: node.orgId === 'org-apollo' ? cur.a : node.orgId === 'org-fortis' ? cur.b : cur.c,
          loss: cur.loss
        })),
        logs: [
          {
            id: 'log-' + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level: nextRound === 5 ? 'success' : 'info',
            message: `[Orchestrator] Round ${nextRound} synced. Global accuracy: ${cur.global}%. Org A: ${cur.a}%, Org B: ${cur.b}%, Org C: ${cur.c}%.`
          },
          ...prev.logs
        ]
      };
    });

    addToast({
      type: 'info',
      title: 'Round Advanced',
      message: 'Advanced federated learning round step.'
    });
  };

  const pauseTrainingSimulation = () => {
    setFlState((prev) => ({
      ...prev,
      isTraining: false,
      isPaused: true,
      logs: [
        {
          id: 'log-' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          level: 'warn',
          message: '[Orchestrator] Federated training paused by administrator. Current weights preserved in memory.'
        },
        ...prev.logs
      ]
    }));
    addToast({
      type: 'warning',
      title: 'Training Paused',
      message: 'Worker nodes held in wait state.'
    });
  };

  const resetTrainingSimulation = () => {
    setFlState({
      ...INITIAL_FEDERATED_STATE,
      currentRound: 1,
      globalAccuracy: 70.2,
      status: 'Idle',
      isTraining: false,
      isPaused: false,
      roundHistory: [
        { round: 1, accuracy: 70.2, loss: 0.724, timestamp: new Date().toLocaleTimeString(), clientsParticipating: 3 }
      ],
      clientNodes: INITIAL_FEDERATED_STATE.clientNodes.map((node) => ({
        ...node,
        status: 'Idle',
        progress: 0,
        localAccuracy: 70.0,
        loss: 0.72
      })),
      logs: [
        {
          id: 'log-' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message: '[System] Federated learning session reset to Round 1 baseline.'
        }
      ]
    });
    addToast({
      type: 'info',
      title: 'State Reset',
      message: 'Federated learning state reset to Round 1 baseline.'
    });
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedOrgId,
        setSelectedOrgId,
        selectedUserId,
        setSelectedUserId,
        isAuthenticated,
        currentUser,
        switchUser,
        login,
        logout,
        isDarkMode,
        toggleDarkMode,
        isSidebarCollapsed,
        toggleSidebar,
        isNotificationDrawerOpen,
        setIsNotificationDrawerOpen,
        isSearchModalOpen,
        setIsSearchModalOpen,
        activeOrgFilter,
        setActiveOrgFilter,
        organizations,
        users,
        files,
        sharedData,
        auditLogs,
        notifications,
        settings,
        addOrganization,
        updateOrganization,
        deleteOrganization,
        addUser,
        updateUser,
        toggleUserStatus,
        deleteUser,
        uploadFile,
        deleteFile,
        shareDataset,
        revokeShare,
        extendShare,
        refreshSharedData,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        toasts,
        addToast,
        removeToast,
        updateSettings,
        flState,
        startTrainingSimulation,
        pauseTrainingSimulation,
        resetTrainingSimulation,
        stepRoundSimulation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
