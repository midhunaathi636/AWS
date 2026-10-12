import React from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import {
  Users,
  Building2,
  Mail,
  Phone,
  Shield,
  Key,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Activity,
  FileCheck
} from 'lucide-react';

export const UserProfileView: React.FC = () => {
  const {
    selectedUserId,
    users,
    organizations,
    auditLogs,
    setActiveTab,
    setSelectedOrgId
  } = useApp();

  const user = users.find((u) => u.id === selectedUserId) || users[0];
  if (!user) return <p className="p-6 text-sm text-slate-500">User data is loading.</p>;
  const userOrg = organizations.find((o) => o.id === user.organizationId);
  const userLogs = auditLogs.filter((l) => l.userEmail === user.email);

  const permissionDescriptions: Record<string, string> = {
    all_access: 'Full Administrative Privilege (Federation Super-Admin)',
    manage_orgs: 'Enroll and Audit Healthcare Institutions',
    federated_orchestration: 'Create local federated learning experiments',
    audit_export: 'View and export audit logs',
    view_data: 'Query Encrypted Feature Previews & Summary Statistics',
    share_data: 'Create and manage dataset sharing grants',
    view_reports: 'Access Analytical Performance Dashboards',
    preview_records: 'Inspect De-Identified Synthetic Cohort Samples',
    train_models: 'Run local training experiments',
    upload_datasets: 'Upload encrypted datasets',
    export_weights: 'Download JSON model parameters',
    view_analytics: 'Monitor Gradient Convergence Trajectories',
    view_logs: 'Audit Access and Authorization Records',
    manage_org_users: 'Provision and De-provision Institution Personnel'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        subtitle={`${user.role} · ${user.organizationName}`}
        breadcrumbs={['Federation', 'Users', user.name]}
        actions={
          <button
            onClick={() => setActiveTab('users')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Users</span>
          </button>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Profile Card & Organization Assignment */}
        <div className="space-y-5">
          {/* Profile Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-center">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-md">
              {user.name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .substring(0, 2)}
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-3">
              {user.name}
            </h2>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block mt-0.5">
              {user.role}
            </span>

            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Identity Verified</span>
              </span>
              {user.twoFactorEnabled && (
                <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" />
                  <span>MFA Active</span>
                </span>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-left text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="text-slate-700 dark:text-slate-300">{user.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Department:</span>
                <span className="text-slate-700 dark:text-slate-300">{user.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Active:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{user.lastLogin}</span>
              </div>
            </div>
          </div>

          {/* Organization Assignment Card */}
          {userOrg && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Enclave Organization</span>
                </h3>
                <button
                  onClick={() => {
                    setSelectedOrgId(userOrg.id);
                    setActiveTab('organization-details');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  View Node →
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  {userOrg.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 block">
                  {userOrg.location} · {userOrg.type}
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono block pt-1">
                  Enclave ID: {userOrg.id}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Permissions Matrix & Recent Actions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card: Role & Permissions Matrix */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>Assigned Cryptographic Permissions</span>
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {user.permissions.length} Policies Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {user.permissions.map((perm) => (
                <div
                  key={perm}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start gap-2.5"
                >
                  <Key className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white block">
                      {perm}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                      {permissionDescriptions[perm] || 'Authorized operation under enterprise charter'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Recent Actions Audit Trail */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Recent Audit Trail</span>
              </h2>
              <button
                onClick={() => setActiveTab('audit-logs')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                All System Logs →
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {userLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <FileCheck className="w-6 h-6 mx-auto stroke-[1.5] mb-1 opacity-50" />
                  <p>No recent actions logged for this user.</p>
                </div>
              ) : (
                userLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono">
                          {log.result}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {log.details}
                      </p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        IP: {log.ipAddress} · Hash: {log.sha256Hash.substring(0, 16)}...
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
