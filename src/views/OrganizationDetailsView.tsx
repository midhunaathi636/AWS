import React from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { OrganizationChat } from '../components/common/OrganizationChat';
import {
  Building2,
  Users,
  Database,
  Share2,
  BrainCircuit,
  MapPin,
  Mail,
  Phone,
  Shield,
  Key,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export const OrganizationDetailsView: React.FC = () => {
  const {
    selectedOrgId,
    currentUser,
    organizations,
    users,
    files,
    sharedData,
    auditLogs,
    setActiveTab,
    setSelectedUserId
  } = useApp();

  const org = organizations.find((o) => o.id === selectedOrgId) || organizations[0];
  if (!org) return <p className="p-6 text-sm text-slate-500">Organization data is loading.</p>;
  const orgUsers = users.filter((u) => u.organizationId === org.id);
  const orgFiles = files.filter((f) => f.organizationId === org.id);
  const orgShares = sharedData.filter(
    (s) => s.sharedByOrgId === org.id || s.sharedWithOrgId === org.id
  );
  const orgLogs = auditLogs.filter((l) => l.organizationName === org.name).slice(0, 5);

  const storagePct = Math.round((org.storageUsedGb / org.maxStorageGb) * 100);

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('user-profile');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        subtitle={`Enclave ID: ${org.id} · Certified federated healthcare participant`}
        breadcrumbs={['Federation', 'Organizations', org.name]}
        actions={
          <button
            onClick={() => setActiveTab('organizations')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Organizations</span>
          </button>
        }
      />
      {org.id === currentUser.organizationId ? <OrganizationChat /> : <OrganizationChat key={org.id} peerOrgId={org.id} peerOrgName={org.name} />}

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Files Uploaded</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {org.filesCount}
          </p>
          <span className="text-[11px] text-slate-400">Genomics & Imaging</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Storage Usage</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {org.storageUsedGb} GB
            </p>
            <span className="text-[11px] font-mono text-slate-500">{storagePct}% of cap</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${storagePct}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Training Rounds</span>
            <BrainCircuit className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {org.trainingRoundsParticipated}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">100% Convergence</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Average Accuracy</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {org.avgAccuracy}%
          </p>
          <span className="text-[11px] text-blue-600 font-medium font-mono">Local gradient score</span>
        </div>
      </div>

      {/* Main 2-Column Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Organization Information & Cryptographic Credentials */}
        <div className="space-y-5">
          {/* Card: Org Info */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Institution Profile</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">Overview & Mission</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {org.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Institution Type:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{org.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Geographic Node:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {org.location}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Enrolled Date:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {org.joinedDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Admin Contact:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{org.adminName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 truncate max-w-[170px]">
                    {org.adminEmail}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hotline:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{org.contactPhone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Cryptographic Enclave Fingerprint */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Cryptographic Identity</span>
            </h2>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Public Key Fingerprint (Federation Root)
              </span>
              <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all select-all">
                {org.publicKeyFingerprint}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hardware Enclave Attestation Verified</span>
            </div>
          </div>
        </div>

        {/* Right Column: Members, Datasets & Activity Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card: Members */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Authorized Members ({orgUsers.length})</span>
              </h2>
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage All Users →
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {orgUsers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => handleUserClick(member.id)}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center">
                      {member.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors block">
                        {member.name}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {member.department} · {member.email}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                      {member.role}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Last login: {member.lastLogin}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Datasets */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Uploaded Datasets ({orgFiles.length})</span>
              </h2>
              <button
                onClick={() => setActiveTab('secure-data')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Datasets Vault →
              </button>
            </div>

            <div className="space-y-2">
              {orgFiles.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No datasets uploaded yet.
                </p>
              ) : (
                orgFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {file.fileName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {file.category} · {file.sizeFormatted} · {file.recordsCount.toLocaleString()} rows
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      {file.classification}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card: Active Inter-institutional Shares */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-600" />
                <span>Inter-Institutional Data Shares ({orgShares.length})</span>
              </h2>
              <button
                onClick={() => setActiveTab('data-sharing')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Data Sharing Hub →
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {orgShares.length === 0 ? (
                <p className="text-slate-400 py-3 text-center">No active sharing grants found.</p>
              ) : (
                orgShares.map((shr) => (
                  <div
                    key={shr.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white block">
                        {shr.fileName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {shr.sharedByOrgId === org.id
                          ? `Shared with ${shr.sharedWithOrgName}`
                          : `Received from ${shr.sharedByOrgName}`}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                      {shr.permission}
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
