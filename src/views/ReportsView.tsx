import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const ReportsView: React.FC = () => {
  const { organizations, addToast } = useApp();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    api.federatedExperiments().then(({ experiments: items }) => {
      const completed = items.filter((item) => item.status === 'Completed' && item.result?.test?.data_split === 'test');
      setExperiments(completed);
      setSelectedId(completed[0]?.id || '');
    }).catch(() => setExperiments([]));
    api.reports().then(({ reports: items }) => setReports(items)).catch(() => setReports([]));
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    api.federatedExperiment(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const rounds: any[] = detail?.rounds || [];
  const test = detail?.experiment?.result?.test;
  const report = reports.find((item) => item.experimentId === selectedId);
  const finalClients: any[] = (rounds.at(-1)?.clientMetrics || []).filter((client: any) => client.data_split === 'validation');
  const totalBytes = rounds.reduce((sum, item) => sum + Number(item.globalMetrics.communication_bytes || 0), 0);
  let communicated = 0;
  const costPoints = rounds.map((round) => {
    communicated += Number(round.globalMetrics.communication_bytes || 0);
    return { round: round.round, x: totalBytes ? 30 + communicated / totalBytes * 280 : 30, y: 145 - Number(round.globalMetrics.accuracy) * 120, accuracy: round.globalMetrics.accuracy, bytes: communicated };
  });

  const downloadPdf = async () => {
    if (!report) return;
    try {
      const blob = await api.downloadReport(report.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast({ type: 'error', title: 'Report unavailable', message: error instanceof Error ? error.message : 'Could not download report.' });
    }
  };

  const downloadCsv = () => {
    if (!detail) return;
    const rows = [['round', 'validation_accuracy', 'validation_loss', 'estimated_communication_bytes'], ...rounds.map((round) => [round.round, round.globalMetrics.accuracy, round.globalMetrics.loss, round.globalMetrics.communication_bytes])];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${selectedId}-rounds.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <div className="space-y-6">
    <PageHeader title="Experiment Analytics & Reports" subtitle="Persisted local experiment results and generated PDF reports" breadcrumbs={['Federation', 'Reports']} actions={<div className="flex gap-2"><button onClick={downloadCsv} disabled={!detail} className="px-3 py-2 rounded border text-xs disabled:opacity-50 dark:border-slate-700">Export CSV</button><button onClick={downloadPdf} disabled={!report} className="px-3 py-2 rounded bg-blue-600 text-white text-xs disabled:opacity-50">Download PDF</button></div>} />
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900">Results on this page come from local simulations. Communication bytes are estimates. Privacy versus accuracy is unavailable until a formal privacy accountant is deployed.</div>
    <select aria-label="Experiment" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="p-2 rounded border dark:bg-slate-900 dark:border-slate-700 text-sm"><option value="">Choose an experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {!detail ? <p className="text-sm text-slate-500">No completed experiments are available.</p> : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Test accuracy', test?.data_split === 'test' ? `${(test.accuracy * 100).toFixed(2)}%` : '—'],
          ['Test ROC-AUC', test?.data_split === 'test' && test.auc_roc != null ? Number(test.auc_roc).toFixed(3) : '—'],
          ['Rounds', String(rounds.length)], ['Estimated traffic', `${(totalBytes / 1024).toFixed(2)} KB`]
        ].map(([label, value]) => <div key={label} className="p-4 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><span className="text-xs text-slate-500">{label}</span><strong className="block text-xl dark:text-white">{value}</strong></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="text-sm font-bold dark:text-white mb-3">Validation accuracy and loss</h2>{rounds.map((round) => <div key={round.round} className="grid grid-cols-3 gap-2 text-xs py-1 border-b dark:border-slate-800"><span>Round {round.round}</span><span>{(round.globalMetrics.accuracy * 100).toFixed(2)}%</span><span>Loss {Number(round.globalMetrics.loss).toFixed(4)}</span></div>)}</section>
        <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="text-sm font-bold dark:text-white mb-3">Accuracy versus estimated communication</h2>{costPoints.length ? <svg viewBox="0 0 340 170" role="img" aria-label="Validation accuracy versus cumulative estimated communication" className="w-full h-40"><line x1="30" x2="315" y1="145" y2="145" stroke="currentColor"/><line x1="30" x2="30" y1="15" y2="145" stroke="currentColor"/><polyline points={costPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2"/>{costPoints.map((point) => <circle key={point.round} cx={point.x} cy={point.y} r="4" fill="#2563eb"><title>{`Round ${point.round}: ${(point.accuracy * 100).toFixed(2)}% at ${(point.bytes / 1024).toFixed(2)} KB`}</title></circle>)}<text x="130" y="165" className="fill-slate-500 text-[10px]">Cumulative estimated KB</text><text x="2" y="14" className="fill-slate-500 text-[10px]">100%</text></svg> : <p className="text-xs text-slate-500">No rounds recorded.</p>}</section>
      </div>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="text-sm font-bold dark:text-white mb-3">Organization validation comparison</h2>{finalClients.length ? finalClients.map((client) => <div key={client.client_id} className="flex justify-between gap-3 text-xs py-1 border-b dark:border-slate-800"><span>{organizations.find((org) => org.id === client.client_id)?.name || client.client_id}</span><span>{client.records} validation rows · {(client.accuracy * 100).toFixed(2)}% accuracy · {Number(client.loss).toFixed(4)} loss</span></div>) : <p className="text-xs text-slate-500">No client metrics recorded.</p>}</section>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><h2 className="text-sm font-bold dark:text-white mb-2">Archived PDF</h2>{report ? <p className="text-xs text-slate-500">Generated {new Date(report.createdAt).toLocaleString()} · SHA-256 {report.sha256Hash}</p> : <p className="text-xs text-slate-500">This older experiment has no generated report.</p>}</section>
    </>}
  </div>;
};
