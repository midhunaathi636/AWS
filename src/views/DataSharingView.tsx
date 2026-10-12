import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { api } from '../services/api';
import { SharedData, PermissionType } from '../types';
import {
  Share2,
  Lock,
  Key,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Database,
  ArrowRight,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  Plus,
  Layers,
  Sparkles
} from 'lucide-react';

export const DataSharingView: React.FC = () => {
  const {
    sharedData,
    files,
    organizations,
    currentUser,
    shareDataset,
    revokeShare,
    extendShare,
    refreshSharedData,
    addToast
  } = useApp();

  // Share form & modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '');
  const [destOrgId, setDestOrgId] = useState<string>(
    organizations.find((o) => o.id !== files[0]?.organizationId)?.id || organizations[1]?.id || ''
  );
  const [permissionType, setPermissionType] = useState<PermissionType>('Federated Train Only');
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [dpEpsilon, setDpEpsilon] = useState(1.2);

  // Modals
  const [viewingShare, setViewingShare] = useState<SharedData | null>(null);
  const [extendingShare, setExtendingShare] = useState<SharedData | null>(null);
  const [newExtendExpiry, setNewExtendExpiry] = useState(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
  const [copiedToken, setCopiedToken] = useState(false);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [requestFileId, setRequestFileId] = useState('');
  const [requestRationale, setRequestRationale] = useState('');

  const loadRequests = () => api.accessRequests().then(({ requests }) => setAccessRequests(requests)).catch(() => undefined);
  useEffect(() => { loadRequests(); }, []);
  useEffect(() => { if (!selectedFileId && files.length) setSelectedFileId(files[0].id); }, [files, selectedFileId]);
  useEffect(() => { if (!destOrgId && organizations.length) setDestOrgId(organizations.find((org) => org.id !== currentUser.organizationId)?.id || ''); }, [organizations, currentUser.organizationId, destOrgId]);

  const submitAccessRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.createAccessRequest({ fileId: requestFileId, permission: 'Federated Train Only', rationale: requestRationale });
      setRequestRationale('');
      loadRequests();
      addToast({ type: 'success', title: 'Access Requested', message: 'The dataset owner can now review your request.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Request Failed', message: error instanceof Error ? error.message : 'Unable to request access.' });
    }
  };

  const reviewRequest = async (requestId: string, decision: 'Approved' | 'Rejected') => {
    try {
      await api.reviewAccessRequest(requestId, decision);
      loadRequests();
      await refreshSharedData();
      addToast({ type: 'success', title: `Request ${decision}`, message: decision === 'Approved' ? 'A sharing grant was created.' : 'The request was declined.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Review Failed', message: error instanceof Error ? error.message : 'Unable to review request.' });
    }
  };

  const selectedFile = files.find((f) => f.id === selectedFileId);

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileId || !destOrgId) return;

    try {
      await shareDataset({ fileId: selectedFileId, sharedWithOrgId: destOrgId, permission: permissionType, expiryDate, dpEpsilon: Number(dpEpsilon) });
      setIsShareModalOpen(false);
    } catch (error) {
      addToast({ type: 'error', title: 'Share Failed', message: error instanceof Error ? error.message : 'Could not create sharing grant.' });
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    addToast({
      type: 'info',
      title: 'Fingerprint Copied',
      message: 'Sharing grant hash copied to clipboard.'
    });
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingShare) return;
    try {
      await extendShare(extendingShare.id, newExtendExpiry);
      setExtendingShare(null);
    } catch (error) {
      addToast({ type: 'error', title: 'Extension Failed', message: error instanceof Error ? error.message : 'Could not extend this share.' });
    }
  };

  const getPermissionBadge = (perm: PermissionType) => {
    switch (perm) {
      case 'Federated Train Only':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Restricted Compute':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Full Collaboration':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Read Only':
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Institutional Data Sharing Hub"
        subtitle="Manage dataset access grants, approvals, expiry dates, and partner collaboration."
        breadcrumbs={['Federation', 'Data Sharing']}
        actions={
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Share File</span>
          </button>
        }
      />

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Sharing Grants</span>
            <Share2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {sharedData.filter((s) => s.status === 'Active').length} Active
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Active Grants</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Compute Inferences</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {sharedData.reduce((sum, s) => sum + s.accessCount, 0)} Runs
          </p>
          <span className="text-[11px] text-slate-400">Homomorphic Queries</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Expiring Soon</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {sharedData.filter((s) => s.status === 'Expiring Soon').length} Grants
          </p>
          <span className="text-[11px] text-amber-600">Renewal Recommended</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Security Attestation</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            100% Enclave
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">ZKP Verified</span>
        </div>
      </div>

      <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Access requests</h2><p className="text-xs text-slate-500">Requests are reviewed by the organization that owns the dataset.</p></div>
        <form onSubmit={submitAccessRequest} className="flex flex-wrap gap-2">
          <select required value={requestFileId} onChange={(event) => setRequestFileId(event.target.value)} className="min-w-56 flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
            <option value="">Select another organization’s dataset</option>
            {files.filter((file) => file.organizationId !== currentUser.organizationId).map((file) => <option key={file.id} value={file.id}>{file.fileName} · {file.organizationName}</option>)}
          </select>
          <input value={requestRationale} onChange={(event) => setRequestRationale(event.target.value)} placeholder="Reason for access" className="min-w-48 flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
          <button type="submit" disabled={!requestFileId} className="px-3 py-2 rounded-lg bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold">Request federated training access</button>
        </form>
        {accessRequests.length > 0 && <div className="space-y-2">{accessRequests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
          <div><strong className="text-slate-900 dark:text-white">{request.fileName}</strong><span className="text-slate-500"> · {request.requesterOrgName} → {request.ownerOrgName} · {request.permission} · {request.status}</span>{request.rationale && <p className="text-slate-500 mt-1">{request.rationale}</p>}</div>
          {request.status === 'Pending' && request.ownerOrgId === currentUser.organizationId && (currentUser.role === 'System Admin' || currentUser.permissions.includes('share_data')) && <div className="flex gap-2"><button onClick={() => reviewRequest(request.id, 'Approved')} className="px-2.5 py-1 rounded bg-emerald-600 text-white">Approve</button><button onClick={() => reviewRequest(request.id, 'Rejected')} className="px-2.5 py-1 rounded bg-rose-600 text-white">Reject</button></div>}
        </div>)}</div>}
      </section>

      {/* Shared Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Inter-Institutional Shared Files
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dataset permissions and expiry dates recorded by the API
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {sharedData.length} Grants Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Shared By</th>
                <th className="py-3 px-4">Shared With</th>
                <th className="py-3 px-4">Permission Badge</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sharedData.map((share) => (
                <tr
                  key={share.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {share.fileName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {share.tokenHash}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {share.sharedByOrgName}
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {share.sharedWithOrgName}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getPermissionBadge(share.permission)}`}>
                      {share.permission}
                    </span>
                    {share.differentialPrivacyEpsilon && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Requested ε = {share.differentialPrivacyEpsilon} (not enforced)
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {share.expiryDate}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-1.5 text-xs">
                      {share.status === 'Active' && (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
                        </>
                      )}
                      {share.status === 'Expiring Soon' && (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-amber-700 dark:text-amber-400 font-medium">Expiring Soon</span>
                        </>
                      )}
                      {share.status === 'Revoked' && (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-red-700 dark:text-red-400 font-medium">Revoked</span>
                        </>
                      )}
                      {share.status === 'Expired' && <span className="text-red-700 dark:text-red-400 font-medium text-xs">Expired</span>}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewingShare(share)}
                        className="px-2 py-1 text-[11px] rounded font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Inspect Grant
                      </button>
                      {(share.sharedByOrgId === currentUser.organizationId || currentUser.role === 'System Admin') && <button
                        onClick={() => {
                          setExtendingShare(share);
                          setNewExtendExpiry(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
                        }}
                        className="px-2 py-1 text-[11px] rounded font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      >
                        Extend Access
                      </button>}
                      {share.status !== 'Revoked' && (share.sharedByOrgId === currentUser.organizationId || currentUser.role === 'System Admin') && (
                        <button
                          onClick={() => revokeShare(share.id).catch((error) => addToast({ type: 'error', title: 'Revoke Failed', message: error instanceof Error ? error.message : 'Could not revoke sharing grant.' }))}
                          className="px-2 py-1 text-[11px] rounded font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Share File Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Share Dataset Between Enclaves
                </h2>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleShareSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Source Dataset *
                </label>
                <select
                  value={selectedFileId}
                  onChange={(e) => {
                    setSelectedFileId(e.target.value);
                    const f = files.find((x) => x.id === e.target.value);
                    if (f) {
                      const otherOrg = organizations.find((o) => o.id !== f.organizationId);
                      if (otherOrg) setDestOrgId(otherOrg.id);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.fileName} ({file.organizationName})
                    </option>
                  ))}
                </select>
                {selectedFile && (
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Source: {selectedFile.organizationName} · {selectedFile.sizeFormatted}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Healthcare Enclave *
                </label>
                <select
                  value={destOrgId}
                  onChange={(e) => setDestOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {organizations
                    .filter((org) => org.id !== selectedFile?.organizationId)
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.location})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Permission Type
                  </label>
                  <select
                    value={permissionType}
                    onChange={(e) => setPermissionType(e.target.value as PermissionType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Federated Train Only">Federated Train Only</option>
                    <option value="Restricted Compute">Restricted Compute</option>
                    <option value="Full Collaboration">Full Collaboration</option>
                    <option value="Read Only">Read Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Differential Privacy Budget (ε Epsilon)</span>
                  <span className="font-mono text-blue-600 font-bold">{dpEpsilon}</span>
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={dpEpsilon}
                  onChange={(e) => setDpEpsilon(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Issue Share Grant</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Token Modal */}
      {viewingShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                <span>Dataset Sharing Grant</span>
              </h2>
              <button
                onClick={() => setViewingShare(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Grant hash fingerprint:
                  </span>
                  <button
                    onClick={() => handleCopyToken(viewingShare.tokenHash)}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="font-mono text-slate-900 dark:text-white font-bold select-all break-all">
                  {viewingShare.tokenHash}
                </p>
              </div>

              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Resource:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{viewingShare.fileName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Authorizing Node:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{viewingShare.sharedByOrgName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Authorized Recipient:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{viewingShare.sharedWithOrgName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Enclave Scope:</span>
                  <span className="font-semibold text-blue-600">{viewingShare.permission}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Valid Until:</span>
                  <span className="font-mono">{viewingShare.expiryDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Inferences Made:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{viewingShare.accessCount}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingShare(null)}
                className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Access Modal */}
      {extendingShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Extend Sharing Authorization
            </h2>
            <p className="text-xs text-slate-500">
              Set new expiration date for {extendingShare.fileName} with {extendingShare.sharedWithOrgName}.
            </p>

            <form onSubmit={handleExtendSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={newExtendExpiry}
                  onChange={(e) => setNewExtendExpiry(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingShare(null)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg"
                >
                  Update Expiration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
