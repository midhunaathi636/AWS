export type Role = 
  | 'System Admin'
  | 'Organization Admin'
  | 'Researcher'
  | 'Doctor'
  | 'Data Analyst'
  | 'Viewer';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type OrgType = 'Hospital Network' | 'Healthcare Network' | 'Academic Medical Center' | 'Biotech Research Lab' | 'Diagnostic Center';

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  location: string;
  adminName: string;
  adminEmail: string;
  usersCount: number;
  storageUsedGb: number;
  maxStorageGb: number;
  status: 'active' | 'pending' | 'suspended';
  joinedDate: string;
  filesCount: number;
  trainingRoundsParticipated: number;
  avgAccuracy: number;
  description: string;
  contactPhone: string;
  publicKeyFingerprint: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  status: UserStatus;
  lastLogin: string;
  phone: string;
  department: string;
  twoFactorEnabled: boolean;
  permissions: string[];
}

export type DataCategory = 
  | 'Genomics & Sequencing'
  | 'Radiology & Imaging'
  | 'Clinical Oncology Trials'
  | 'Pathology WSI'
  | 'EHR & Patient Records'
  | 'Pharmacovigilance';

export type Classification = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

export interface SecureFile {
  id: string;
  fileName: string;
  fileExtension: string;
  ownerName: string;
  ownerEmail: string;
  organizationId: string;
  organizationName: string;
  category: DataCategory;
  sizeBytes: number;
  sizeFormatted: string;
  uploadDate: string;
  classification: Classification;
  status: 'Encrypted AES-256' | 'Processing' | 'Archived';
  encryptionHash: string;
  recordsCount: number;
  description: string;
  tags: string[];
  sampleColumns: string[];
  sampleRows: Record<string, string | number>[];
}

export type PermissionType = 
  | 'Read Only'
  | 'Federated Train Only'
  | 'Restricted Compute'
  | 'Full Collaboration';

export interface SharedData {
  id: string;
  fileId: string;
  fileName: string;
  sharedByOrgId: string;
  sharedByOrgName: string;
  sharedWithOrgId: string;
  sharedWithOrgName: string;
  permission: PermissionType;
  sharedDate: string;
  expiryDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Revoked';
  tokenHash: string;
  accessCount: number;
  differentialPrivacyEpsilon?: number;
}

export interface ClientNode {
  id: string;
  orgId: string;
  name: string;
  datasetSize: number;
  recordsCountLabel?: string;
  status: 'Idle' | 'Computing Gradients' | 'Simulation Noise Added' | 'Weights Uploaded' | 'Completed';
  localAccuracy: number;
  loss: number;
  trainingTime: string;
  progress: number;
  batchSize: number;
  privacyBudgetEpsilon: number;
}

export interface TrainingLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'secure';
  message: string;
}

export interface FederatedRoundHistory {
  round: number;
  accuracy: number;
  loss: number;
  timestamp: string;
  clientsParticipating: number;
}

export interface FederatedLearningState {
  currentRound: number;
  totalRounds: number;
  isTraining: boolean;
  isPaused: boolean;
  status: 'Idle' | 'Distributing Weights' | 'Local Client Training' | 'Aggregation Simulation' | 'Completed';
  globalAccuracy: number;
  roundHistory: FederatedRoundHistory[];
  clientNodes: ClientNode[];
  logs: TrainingLog[];
  aggregationAlgorithm: 'FedAvg' | 'FedProx' | 'FedAdam';
  differentialPrivacyEpsilon: number;
  clippingThreshold: number;
}

export interface GlobalModel {
  name: string;
  version: string;
  architecture: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  loss: number;
  rounds: number;
  algorithm: string;
  lastUpdated: string;
  modelSizeMb: number;
  parametersCount: string;
  confusionMatrix: {
    classes: [string, string];
    matrix: [
      [number, number], // Actual Positive: [True Positive, False Negative]
      [number, number]  // Actual Negative: [False Positive, True Negative]
    ];
  };
  contributions: {
    orgName: string;
    orgId: string;
    percentage: number;
    sampleCount: number;
    gradientWeight: number;
  }[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  action: string;
  organizationName: string;
  result: 'Success' | 'Failed' | 'Warning';
  ipAddress: string;
  details: string;
  sha256Hash: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'file' | 'training' | 'user' | 'organization' | 'security';
  read: boolean;
  linkTab?: string;
}

export interface SystemSettings {
  general: {
    platformName: string;
    contactSupportEmail: string;
    timezone: string;
    sessionTimeoutMins: number;
  };
  security: {
    enforceMfa: boolean;
    requireZeroKnowledgeProofs: boolean;
    ipAllowlistOnly: boolean;
    encryptionStandard: string;
    logRetentionDays: number;
  };
  federatedLearning: {
    defaultAlgorithm: 'FedAvg' | 'FedProx' | 'FedAdam';
    dpEpsilon: number;
    dpDelta: number;
    clippingNorm: number;
    minClientsRequired: number;
    maxRounds: number;
  };
}
