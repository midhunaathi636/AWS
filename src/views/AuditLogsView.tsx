import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { AuditLog } from '../types';
import { api } from '../services/api';
import {
  FileCheck,
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Clock,
  Building2,
  User,
  Key,
  Calendar
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, organizations, users, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'Success' | 'Failed' | 'Warning'>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [verification, setVerification] = useState('');
  const [security, setSecurity] = useState<{ summary: { total: number; failed: number; warnings: number }; events: any[] } | null>(null);

  useEffect(() => {
    const refresh = () => api.securityEvents().then(setSecurity).catch(() => setSecurity(null));
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const verifyLedger = async () => {
    try {
      const result = await api.verifyAuditLogs();
      setVerification(result.valid ? `Verified ${result.checked} records. No hash mismatches.` : `${result.invalidRecordIds.length} invalid records: ${result.invalidRecordIds.join(', ')}`);
    } catch (error) {
      setVerification(error instanceof Error ? error.message : 'Verification failed.');
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress.includes(searchQuery);
    const matchesResult = resultFilter === 'all' || log.result === resultFilter;
    const matchesOrg = orgFilter === 'all' || log.organizationName === orgFilter;
    return matchesSearch && matchesResult && matchesOrg;
  });

  const exportAuditCsv = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Organization', 'Action', 'Result', 'IP Address', 'SHA256 Hash', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.userRole}"`,
      `"${l.organizationName}"`,
      `"${l.action}"`,
      `"${l.result}"`,
      `"${l.ipAddress}"`,
      `"${l.sha256Hash}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `federation_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Audit Trail Exported',
      message: `${filteredLogs.length} audit records exported to CSV for regulatory compliance.`
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Audit Logs"
        subtitle="Verify record hashes and the chain for new events. External immutable storage is not configured."
        breadcrumbs={['Federation', 'Audit Logs']}
        actions={
          <div className="flex gap-2">
            <button onClick={verifyLedger} className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">Verify integrity</button>
            <button onClick={exportAuditCsv} className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /><span>Export Audit Trail (CSV)</span>
            </button>
          </div>
        }
      />
      {verification && <div role="status" className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">{verification}</div>}
      <section className="p-4 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <h2 className="text-sm font-bold dark:text-white">Security monitoring · last 24 hours</h2>
        {security ? <><div className="flex flex-wrap gap-5 text-xs"><span>Events: <strong>{security.summary.total || 0}</strong></span><span>Failed: <strong>{security.summary.failed || 0}</strong></span><span>Warnings: <strong>{security.summary.warnings || 0}</strong></span></div><div className="max-h-32 overflow-auto">{security.events.slice(0, 5).map((event) => <p key={event.id} className="py-1 text-xs text-slate-600 dark:text-slate-300">{new Date(event.timestamp).toLocaleString()} · {event.result} · {event.action}</p>)}</div></> : <p className="text-xs text-slate-500">Security events are unavailable for this account.</p>}
      </section>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, user, IP, or details..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as any)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Verification Outcomes</option>
            <option value="Success">Success (Green)</option>
            <option value="Warning">Warning (Yellow)</option>
            <option value="Failed">Failed / Blocked (Red)</option>
          </select>
        </div>

        <div>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Enclaves & Central Nodes</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.name}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Tamper-Evident SHA-256 Ledger
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredLogs.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Healthcare Enclave</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Cryptographic Hash</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                    <FileCheck className="w-8 h-8 mx-auto stroke-[1.5] mb-2 opacity-50" />
                    <p>No audit logs matching this search filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.result === 'Success';
                  const isWarning = log.result === 'Warning';
                  const isFailed = log.result === 'Failed';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      <td className="py-3 px-4 font-sans text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate max-w-[150px]">
                          {log.userName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {log.userRole}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans text-xs font-medium text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>

                      <td className="py-3 px-4 font-sans text-xs text-slate-600 dark:text-slate-300">
                        {log.organizationName}
                      </td>

                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5 font-sans font-medium text-xs">
                          {isSuccess && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-emerald-700 dark:text-emerald-400">Success</span>
                            </>
                          )}
                          {isWarning && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-amber-700 dark:text-amber-400">Warning</span>
                            </>
                          )}
                          {isFailed && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-700 dark:text-red-400">Failed</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {log.ipAddress}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[10px]">
                        {log.sha256Hash.substring(0, 12)}...
                      </td>

                      <td className="py-3 px-4 text-right font-sans text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Audit Record Verification #{selectedLog.id}</span>
              </h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-slate-400 block">Timestamp:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-medium">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Client IP:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-medium">{selectedLog.ipAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Operator:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedLog.userName} ({selectedLog.userRole})</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Enclave Node:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedLog.organizationName}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Action & Context:</span>
                <p className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  {selectedLog.details}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Tamper-Proof Merkle Leaf Signature:</span>
                <p className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all">
                  SHA256:{selectedLog.sha256Hash}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg text-xs"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
