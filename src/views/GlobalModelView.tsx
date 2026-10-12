import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

type ExperimentDetail = { experiment: any; rounds: any[]; models: any[] };

export const GlobalModelView: React.FC = () => {
  const { addToast, organizations } = useApp();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);

  useEffect(() => {
    api.federatedExperiments().then(({ experiments: items }) => {
      const completed = items.filter((item) => item.status === 'Completed' && item.result?.test?.data_split === 'test');
      setExperiments(completed);
      setSelectedId(completed[0]?.id || '');
    }).catch(() => setExperiments([]));
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    api.federatedExperiment(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const model = detail?.models.at(-1);
  const test = model?.metrics?.data_split === 'test' ? model.metrics : null;
  const matrix = test?.confusion_matrix;
  const rounds = detail?.rounds || [];
  const clients = rounds.at(-1)?.clientMetrics || [];
  const totalTrain = clients.reduce((sum: number, client: any) => sum + Number(client.train_records || 0), 0);
  const percent = (value: number | undefined) => value == null ? '—' : `${(value * 100).toFixed(2)}%`;

  const download = async () => {
    if (!model) return;
    try {
      const blob = await api.modelArtifact(model.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${model.version}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast({ type: 'error', title: 'Download failed', message: error instanceof Error ? error.message : 'Could not download the model.' });
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Global Model" subtitle="Measured results from completed local experiments" breadcrumbs={['Federation', 'Global Model']} actions={<button onClick={download} disabled={!model} className="px-3 py-2 rounded bg-blue-600 text-white text-xs disabled:opacity-50">Download JSON weights</button>} />
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900">These experiments run in one local process. Secure aggregation and a formal differential privacy guarantee are unavailable. Downloaded weights are JSON logistic regression parameters.</div>
    <select aria-label="Experiment" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="p-2 rounded border dark:bg-slate-900 dark:border-slate-700 text-sm"><option value="">Choose a completed experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {!detail || !test ? <p className="text-sm text-slate-500">Run a real experiment to see held-out model results.</p> : <>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
        <h2 className="text-base font-bold dark:text-white">{detail.experiment.name} · {model.version}</h2>
        <p className="text-xs text-slate-500">{detail.experiment.algorithm} · {rounds.length} rounds · {test.records} held-out test rows · {detail.experiment.completedAt}</p>
      </section>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Test accuracy', percent(test.accuracy)], ['Precision', percent(test.precision)],
          ['Recall', percent(test.recall)], ['F1', percent(test.f1)],
          ['ROC-AUC', test.auc_roc == null ? '—' : Number(test.auc_roc).toFixed(3)],
          ['Test loss', Number(test.loss).toFixed(4)]
        ].map(([label, value]) => <div key={label} className="p-4 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900"><span className="text-xs text-slate-500">{label}</span><strong className="block text-xl dark:text-white">{value}</strong></div>)}
      </section>
      <div className="grid md:grid-cols-2 gap-5">
        <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-sm font-bold dark:text-white mb-3">Validation loss by round</h3>
          {rounds.map((round) => <div key={round.round} className="flex items-center gap-3 text-xs mb-2"><span className="w-14">Round {round.round}</span><div className="h-2 rounded bg-amber-500" style={{ width: `${Math.max(2, Math.min(100, Number(round.globalMetrics.loss) * 100))}%` }} /><span>{Number(round.globalMetrics.loss).toFixed(4)}</span></div>)}
        </section>
        <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-sm font-bold dark:text-white mb-3">Held-out test confusion matrix</h3>
          {matrix ? <div className="grid grid-cols-2 gap-2 text-center text-xs">{[['True positive', matrix[0][0]], ['False negative', matrix[0][1]], ['False positive', matrix[1][0]], ['True negative', matrix[1][1]]].map(([label, value]) => <div key={label} className="p-3 rounded bg-slate-100 dark:bg-slate-800"><span className="block text-slate-500">{label}</span><strong className="text-lg dark:text-white">{value}</strong></div>)}</div> : <p className="text-xs text-slate-500">No confusion matrix recorded.</p>}
        </section>
      </div>
      <section className="p-5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900">
        <h3 className="text-sm font-bold dark:text-white mb-3">Participating organization validation results</h3>
        <div className="space-y-2">{clients.map((client: any) => <div key={client.client_id} className="flex justify-between gap-4 text-xs"><span>{organizations.find((org) => org.id === client.client_id)?.name || client.client_id}</span><span>{client.train_records} training rows · {percent(client.accuracy)} validation accuracy · {totalTrain ? ((client.train_records / totalTrain) * 100).toFixed(1) : 0}% aggregation weight</span></div>)}</div>
      </section>
    </>}
  </div>;
};
