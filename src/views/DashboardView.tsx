import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const DashboardView: React.FC = () => {
  const { organizations, users, files, sharedData, setActiveTab } = useApp();
  const [experiment, setExperiment] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    api.activity().then(({ activities }) => setActivity(activities)).catch(() => setActivity([]));
    api.federatedExperiments().then(async ({ experiments }) => {
      const latest = experiments.find((item) => item.status === 'Completed' && item.result?.test?.data_split === 'test');
      if (!latest) return;
      const detail = await api.federatedExperiment(latest.id);
      setExperiment(detail.experiment);
      setRounds(detail.rounds);
    }).catch(() => undefined);
  }, []);

  const test = experiment?.result?.test;
  const activeShares = sharedData.filter((share) => share.status === 'Active' && share.expiryDate >= new Date().toISOString().slice(0, 10));
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  const securityEvents = activity.filter((log) => log.result === 'Failed' || log.result === 'Warning');
  const lastRound = rounds.at(-1);
  const clients = (lastRound?.clientMetrics || []).filter((client: any) => client.data_split === 'validation');
  const month = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth() - (5 - index), 1);
    const key = date.toISOString().slice(0, 7);
    return { key, name: date.toLocaleString(undefined, { month: 'short' }), count: sharedData.filter((share) => share.sharedDate.startsWith(key)).length };
  });

  const cards = [
    ['Organizations', organizations.length, 'organizations'],
    ['Registered users', users.length, 'users'],
    ['Encrypted datasets', files.length, 'secure-data'],
    ['Active sharing grants', activeShares.length, 'data-sharing'],
    ['Latest test accuracy', test?.data_split === 'test' ? `${(test.accuracy * 100).toFixed(2)}%` : '—', 'global-model'],
    ['Latest test ROC-AUC', test?.data_split === 'test' && test.auc_roc != null ? Number(test.auc_roc).toFixed(3) : '—', 'global-model'],
    ['Stored dataset bytes', totalBytes.toLocaleString(), 'secure-data'],
    ['Security events', securityEvents.length, 'audit-logs']
  ] as const;

  return <div className="space-y-6">
    <PageHeader title="Federated Consortium Dashboard" subtitle="Live records and persisted experiment results" breadcrumbs={['Federation', 'Dashboard']} actions={<button onClick={() => setActiveTab('federated-learning')} className="px-3 py-2 rounded bg-blue-600 text-white text-xs">Open training</button>} />
    <p className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900">The current trainer is a local simulation. No secure aggregation or formal differential privacy guarantee is active.</p>
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(([label, value, tab]) => <button key={label} onClick={() => setActiveTab(tab)} className="text-left p-4 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><span className="block text-xs text-slate-500">{label}</span><strong className="block mt-1 text-2xl dark:text-white">{value}</strong></button>)}</section>
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="font-semibold text-sm dark:text-white">Validation accuracy and loss by round</h2><p className="text-xs text-slate-500 mt-1 mb-3">{experiment?.name || 'No completed experiment'}</p>{rounds.length ? rounds.map((round) => <div key={round.round} className="flex justify-between gap-3 py-2 border-b dark:border-slate-800 text-xs"><span>Round {round.round}</span><span>{(round.globalMetrics.accuracy * 100).toFixed(2)}% accuracy</span><span>{Number(round.globalMetrics.loss).toFixed(4)} loss</span></div>) : <p className="text-xs text-slate-500">Run an experiment to see measured training history.</p>}</section>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="font-semibold text-sm dark:text-white">Organization validation comparison</h2><p className="text-xs text-slate-500 mt-1 mb-3">Latest round; only participating clients</p>{clients.length ? clients.map((client: any) => <div key={client.client_id} className="flex justify-between gap-3 py-2 border-b dark:border-slate-800 text-xs"><span>{organizations.find((org) => org.id === client.client_id)?.name || client.client_id}</span><span>{(client.accuracy * 100).toFixed(2)}%</span></div>) : <p className="text-xs text-slate-500">No client metrics recorded.</p>}</section>
    </div>
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="font-semibold text-sm dark:text-white mb-3">Sharing grants by month</h2><div className="flex items-end gap-3 h-32">{months.map((item) => <div key={item.key} className="flex-1 text-center text-xs text-slate-500"><div className="bg-blue-600 rounded-t" style={{ height: `${Math.max(2, item.count * 16)}px` }} title={`${item.count} grants`} /><span>{item.name}</span><span className="block">{item.count}</span></div>)}</div></section>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="font-semibold text-sm dark:text-white mb-3">Recent audited activity</h2>{activity.length ? activity.slice(0, 6).map((log) => <div key={log.id} className="py-2 border-b dark:border-slate-800 text-xs"><strong className="dark:text-white">{log.action}</strong><span className="ml-2 text-slate-500">{log.organizationName} · {new Date(log.timestamp).toLocaleString()}</span><p className="text-slate-500">{log.details}</p></div>) : <p className="text-xs text-slate-500">No audited activity available for this account.</p>}</section>
    </div>
  </div>;
};
