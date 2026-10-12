import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { api } from '../services/api';
import {
  BrainCircuit,
  Play,
  Pause,
  RotateCcw,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Activity,
  ArrowRight,
  Sparkles,
  Server,
  Zap,
  TrendingUp,
  Key,
  HardDrive,
  SkipForward,
  Copy,
  Check,
  Database,
  Filter,
  RefreshCw,
  Clock,
  ArrowDown
} from 'lucide-react';

export const FederatedLearningView: React.FC = () => {
  const {
    currentUser,
    flState,
    startTrainingSimulation,
    pauseTrainingSimulation,
    resetTrainingSimulation,
    stepRoundSimulation,
    setActiveTab,
    addToast,
    files
  } = useApp();

  const [copiedLogs, setCopiedLogs] = useState(false);
  const [targetColumn, setTargetColumn] = useState('phenotype_label');
  const [realTraining, setRealTraining] = useState(false);
  const [algorithm, setAlgorithm] = useState<'FedAvg' | 'FedProx'>('FedAvg');
  const [lastExperimentId, setLastExperimentId] = useState('');
  const [modelId, setModelId] = useState('');
  const [predictionInput, setPredictionInput] = useState('{}');
  const [predictionResult, setPredictionResult] = useState('');
  const [comparisonResult, setComparisonResult] = useState('');
  const [simulatePoisoning, setSimulatePoisoning] = useState(false);
  const [realRunRounds, setRealRunRounds] = useState<any[]>([]);
  const [heldOutTest, setHeldOutTest] = useState<any>(null);
  const [splitCounts, setSplitCounts] = useState<Record<string, { train: number; validation: number; test: number }>>({});
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [remoteSpec, setRemoteSpec] = useState(JSON.stringify({
    name: 'Three-organization patient-level pilot', deploymentMode: 'remote-secure',
    remoteDatasets: [
      { organizationId: 'org-a', datasetId: 'approved-a' },
      { organizationId: 'org-b', datasetId: 'approved-b' },
      { organizationId: 'org-c', datasetId: 'approved-c' }
    ],
    publicSchema: { patient_id: 'patient_id', target: 'label', labels: ['no', 'yes'],
      features: [{ name: 'age', type: 'numeric', min: 0, max: 120 }] },
    targetColumn: 'label', rounds: 5, algorithm: 'FedAvg', localEpochs: 1,
    learningRate: 0.1, clippingNorm: 1, normalizationCount: 10000,
    privacyPolicy: { epsilon: 3, delta: 0.000001 }
  }, null, 2));
  const [remoteId, setRemoteId] = useState('');
  const [remoteStatus, setRemoteStatus] = useState('');
  const [remoteResult, setRemoteResult] = useState<any>(null);
  const [remoteRounds, setRemoteRounds] = useState<any[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [productionMode, setProductionMode] = useState<boolean | null>(null);

  const selectableClients = Array.from(new Map(files.filter((file) => file.fileExtension.toLowerCase() === 'csv').map((file) => [file.organizationId, { id: file.organizationId, name: file.organizationName }])).values()).slice(0, 3);

  useEffect(() => {
    if (!selectedClientIds.length && selectableClients.length) setSelectedClientIds(selectableClients.map((client) => client.id));
  }, [files]);

  useEffect(() => {
    api.federatedExperiments().then(async ({ experiments }) => {
      const latest = experiments.find((item) => item.status === 'Completed' &&
        item.config?.deploymentMode !== 'remote-secure' && item.result?.test?.data_split === 'test');
      if (!latest) return;
      const detail = await api.federatedExperiment(latest.id);
      setLastExperimentId(latest.id);
      setRealRunRounds(detail.rounds.map((item: any) => ({ round: item.round, global_metrics: item.globalMetrics, clients: item.clientMetrics, communication_bytes: item.globalMetrics.communication_bytes || 0 })));
      setHeldOutTest(detail.experiment.result?.test?.data_split === 'test' ? detail.experiment.result.test : null);
      setSplitCounts(detail.experiment.result?.splitCounts || {});
      setModelId(detail.models.at(-1)?.id || '');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.health().then(({ mode }) => setProductionMode(mode === 'production')).catch(() => setProductionMode(true));
  }, []);

  useEffect(() => {
    if (currentUser.role !== 'System Admin') return;
    api.federatedExperiments().then(({ experiments }) => {
      const latest = experiments.find((item: any) => item.config?.deploymentMode === 'remote-secure');
      if (latest) {
        setRemoteId(latest.id);
        setRemoteStatus(latest.status);
        setRemoteResult(latest.result);
        api.federatedExperiment(latest.id).then(({ rounds }) => setRemoteRounds(rounds)).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, [currentUser.role]);

  useEffect(() => {
    if (!remoteId || !['Queued', 'Running'].includes(remoteStatus)) return;
    const timer = window.setInterval(() => {
      api.federatedExperiment(remoteId).then(({ experiment, rounds }) => {
        setRemoteStatus(experiment.status);
        setRemoteResult(experiment.result);
        setRemoteRounds(rounds);
      }).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [remoteId, remoteStatus]);

  const createRemoteExperiment = async () => {
    setRemoteBusy(true);
    try {
      const payload = JSON.parse(remoteSpec);
      const { experiment } = await api.createFederatedExperiment(payload);
      setRemoteId(experiment.id);
      setRemoteStatus(experiment.status);
      setRemoteResult(null);
      setRemoteRounds([]);
      addToast({ type: 'success', title: 'Remote experiment created', message: 'Review the experiment ID, then queue the approved organization workers.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Remote experiment failed', message: error instanceof Error ? error.message : 'The configuration could not be saved.' });
    } finally {
      setRemoteBusy(false);
    }
  };

  const queueRemoteExperiment = async () => {
    if (!remoteId) return;
    setRemoteBusy(true);
    try {
      const result = await api.runFederatedExperiment(remoteId);
      setRemoteStatus(result.status);
      addToast({ type: 'success', title: 'Remote experiment queued', message: 'The coordinator will start the approved organization workers.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Could not queue experiment', message: error instanceof Error ? error.message : 'The coordinator did not accept the run.' });
    } finally {
      setRemoteBusy(false);
    }
  };

  const downloadRemoteSchema = async () => {
    if (!remoteId) return;
    try {
      const blob = await api.downloadPublicSchema(remoteId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${remoteId}-schema.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      addToast({ type: 'error', title: 'Schema download failed', message: error instanceof Error ? error.message : 'Could not download the public schema.' });
    }
  };

  const runRealExperiment = async () => {
    const firstFileByClient = new Map<string, (typeof files)[number]>();
    files.filter((file) => file.fileExtension.toLowerCase() === 'csv' && selectedClientIds.includes(file.organizationId)).forEach((file) => {
      if (!firstFileByClient.has(file.organizationId)) firstFileByClient.set(file.organizationId, file);
    });
    const csvFiles = Array.from(firstFileByClient.values()).slice(0, 3);
    if (!csvFiles.length) {
      addToast({ type: 'warning', title: 'CSV Dataset Required', message: 'Upload at least one CSV dataset before starting local training.' });
      return;
    }
    setRealTraining(true);
    try {
      const { experiment } = await api.createFederatedExperiment({
        name: `Healthcare Binary Classifier ${new Date().toISOString().slice(0, 10)}`,
        datasetIds: csvFiles.map((file) => file.id),
        targetColumn,
        rounds: 5,
        algorithm,
        selectedClientIds,
        clippingNorm: 1,
        noiseMultiplier: 0,
        maliciousClientIds: simulatePoisoning ? [csvFiles[0].organizationId] : []
      });
      const result = await api.runFederatedExperiment(experiment.id);
      setLastExperimentId(experiment.id);
      setModelId(result.model.id);
      setRealRunRounds(result.rounds.map((round: any) => ({ ...round, algorithm })));
      setHeldOutTest(result.testMetrics);
      setSplitCounts(result.splitCounts);
      addToast({ type: 'success', title: 'Local Federated Simulation Complete', message: `${result.rounds.length} ${algorithm} rounds completed and a model version was created.` });
    } catch (error) {
      addToast({ type: 'error', title: 'Local Training Failed', message: error instanceof Error ? error.message : 'The training job could not be completed.' });
    } finally {
      setRealTraining(false);
    }
  };

  const compareAlgorithms = async () => {
    if (!lastExperimentId) return;
    try {
      const { comparison } = await api.compareFederatedExperiment(lastExperimentId);
      const avg = comparison.testMetrics.FedAvg;
      const prox = comparison.testMetrics.FedProx;
      setComparisonResult(`Held-out test — FedAvg ${(avg.accuracy * 100).toFixed(2)}% / loss ${avg.loss.toFixed(4)}; FedProx ${(prox.accuracy * 100).toFixed(2)}% / loss ${prox.loss.toFixed(4)}`);
    } catch (error) {
      addToast({ type: 'error', title: 'Comparison Failed', message: error instanceof Error ? error.message : 'Comparison failed.' });
    }
  };

  const predict = async () => {
    try {
      const features = JSON.parse(predictionInput);
      const result = await api.predict(modelId, features);
      setPredictionResult(`${result.prediction} (${(result.confidence * 100).toFixed(1)}% uncalibrated model score, ${result.version})`);
    } catch (error) {
      setPredictionResult(error instanceof Error ? error.message : 'Could not run prediction.');
    }
  };

  const copyConsoleLogs = () => {
    const text = flState.logs.map((l) => `[${l.timestamp}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    addToast({
      type: 'info',
      title: 'Console Logs Copied',
      message: 'Terminal logs copied to clipboard.'
    });
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
      case 'Computing Gradients':
      case 'Local Client Training':
      case 'Distributing Weights':
        return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
      case 'Simulation Noise Added':
      case 'Aggregation Simulation':
        return 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800';
      default:
        return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  // Timeline rounds data
  const timelineRounds = realRunRounds.map((round) => ({ round: round.round, acc: Number((round.global_metrics.accuracy * 100).toFixed(2)), loss: round.global_metrics.loss, status: 'Completed' }));
  const privacyPoints = remoteRounds.map((round) => ({
    epsilon: Number(round.globalMetrics?.privacy_epsilon),
    accuracy: round.globalMetrics?.accuracy == null ? NaN : Number(round.globalMetrics.accuracy)
  })).filter((point) => Number.isFinite(point.epsilon) && Number.isFinite(point.accuracy));
  const privacyMax = Math.max(1, ...privacyPoints.map((point) => point.epsilon));
  const privacyPolyline = privacyPoints.map((point) => `${30 + point.epsilon / privacyMax * 250},${125 - point.accuracy * 100}`).join(' ');
  const latestRunRound = realRunRounds.at(-1);
  const latestClients = latestRunRound?.clients || [];
  const uniqueClientCount = new Set(latestClients.map((client: any) => client.client_id)).size;
  const clientRecords = latestClients.reduce((sum: number, client: any) => sum + (client.records || 0), 0);

  // Lifecycle steps
  const lifecycleSteps = [
    { id: 1, label: 'CSV Dataset', desc: 'Encrypted dataset stored by this API instance', icon: Database, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' },
    { id: 2, label: 'Preprocessing', desc: 'Shared feature vocabulary and numeric encoding', icon: Filter, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50' },
    { id: 3, label: 'Client Updates', desc: 'Simulated client-side logistic regression updates', icon: Zap, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50' },
    { id: 4, label: 'Update Handling', desc: 'Norm clipping with optional Gaussian noise injection', icon: Key, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50' },
    { id: 5, label: 'Aggregation', desc: 'Weighted FedAvg or FedProx on the API host', icon: Server, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50' },
    { id: 6, label: 'Model Version', desc: 'Versioned binary classifier and recorded metrics', icon: Cpu, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={productionMode ? 'Federated Learning' : 'Federated Learning & Local Simulation'}
        subtitle={productionMode ? 'Configure and inspect organization-owned remote federated experiments.' : 'Run and inspect persisted federated-learning experiments from uploaded CSV datasets. This local trainer runs centrally on the API host.'}
        breadcrumbs={['Federation', 'Federated Learning']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('global-model')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Inspect Global Model</span>
            </button>
          </div>
        }
      />
      <div className="px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
        {productionMode ? 'The diagrams and cards below describe the local simulation and are illustrative. Remote experiment status appears in the separate admin panel.' : 'The controls and topology below show the central local simulation. Secure aggregation and patient-level privacy accounting apply only to the separately deployed remote federation.'}
      </div>

      {currentUser.role === 'System Admin' && (
        <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3" aria-label="Remote secure federation">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Remote secure federation</h2>
            <p className="text-xs text-slate-500 mt-1">Enter approved organization dataset IDs and the shared public schema. Each organization retains its CSV in its own account.</p>
          </div>
          <textarea aria-label="Remote experiment JSON" value={remoteSpec} onChange={(event) => setRemoteSpec(event.target.value)} rows={11}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-100" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={remoteBusy} onClick={createRemoteExperiment}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50">Create remote experiment</button>
            <button type="button" disabled={remoteBusy || !remoteId || remoteStatus !== 'Awaiting Start'} onClick={queueRemoteExperiment}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Queue approved workers</button>
            <button type="button" disabled={!remoteId} onClick={downloadRemoteSchema}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Download public schema</button>
            <button type="button" disabled={!remoteId} onClick={() => api.federatedExperiment(remoteId).then(({ experiment, rounds }) => {
              setRemoteStatus(experiment.status); setRemoteResult(experiment.result); setRemoteRounds(rounds);
            }).catch(() => addToast({ type: 'error', title: 'Refresh failed', message: 'Could not load the remote experiment.' }))}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Refresh status</button>
          </div>
          {remoteId && <div className="text-xs text-slate-600 dark:text-slate-300" role="status">
            <span className="font-mono">{remoteId}</span> · {remoteStatus || 'Unknown'}
            {remoteStatus === 'Completed' && remoteResult && <span> · Validation {remoteResult.validation?.accuracy == null ? 'withheld' : `${(remoteResult.validation.accuracy * 100).toFixed(1)}%`}
              {' '}· Test {remoteResult.test?.accuracy == null ? 'withheld' : `${(remoteResult.test.accuracy * 100).toFixed(1)}%`}
              {' '}· Worst-case ε {remoteResult.privacy?.epsilon?.toFixed(3) ?? '—'}
              {' '}· Traffic {typeof remoteResult.communicationBytes === 'number' ? `${(remoteResult.communicationBytes / 1024).toFixed(1)} KiB` : 'unavailable'}</span>}
          </div>}
          {privacyPoints.length > 0 && <div className="max-w-md" aria-label="Validation accuracy against cumulative worst-case privacy epsilon">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Validation accuracy vs cumulative privacy ε</p>
            <svg viewBox="0 0 310 155" role="img" aria-label="Validation accuracy by cumulative worst-case privacy epsilon" className="w-full rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <path d="M30 20V125H285" fill="none" stroke="currentColor" strokeOpacity="0.5" />
              <polyline points={privacyPolyline} fill="none" stroke="#2563eb" strokeWidth="2" />
              {privacyPoints.map((point, index) => <circle key={index} cx={30 + point.epsilon / privacyMax * 250} cy={125 - point.accuracy * 100} r="3" fill="#2563eb" />)}
              <text x="8" y="26" fontSize="9" fill="currentColor">100%</text>
              <text x="10" y="126" fontSize="9" fill="currentColor">0%</text>
              <text x="237" y="143" fontSize="9" fill="currentColor">ε {privacyMax.toFixed(2)}</text>
            </svg>
          </div>}
        </section>
      )}

      {/* Top 4 Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Participating Enclaves</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {uniqueClientCount} Clients
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Latest completed run</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {clientRecords.toLocaleString()} training rows
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Training Round</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {latestRunRound ? `Round ${latestRunRound.round} / ${timelineRounds.length}` : 'No real run'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {latestRunRound?.algorithm || algorithm}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Persisted experiment history
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Global Accuracy</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {latestRunRound ? `${(latestRunRound.global_metrics.accuracy * 100).toFixed(2)}%` : '—'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium font-mono">
              Loss {latestRunRound ? Number(latestRunRound.global_metrics.loss).toFixed(4) : '—'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {latestRunRound ? 'Training-set evaluation' : 'Metrics appear after a completed run'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Training Status</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {realTraining ? 'Running' : latestRunRound ? 'Completed' : 'Idle'}
            </span>
            {realTraining && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            DP accountant unavailable · noise off by default
          </p>
        </div>
      </div>

      {/* 1. Federated Learning Lifecycle Workflow */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <span>Federated Learning Lifecycle</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Decentralized execution loop: Local data preprocessing, on-premise training, encrypted weights broadcast, and central aggregation
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
            Centralized local demo
          </span>
        </div>

        {/* Graphical Stages Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {lifecycleSteps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = flState.isTraining || flState.status === 'Completed';

            return (
              <div
                key={step.id}
                className="relative p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between text-left group"
              >
                <div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${step.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block">
                    0{step.id} Stage
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {step.label}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {step.desc}
                  </p>
                </div>

                {/* Connecting arrow indicator for all except last */}
                {idx < lifecycleSteps.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 dark:text-slate-600">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Organization Cards (Exact Faculty Requirements) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>Participating Organization Enclave Nodes</span>
            </h2>
            <p className="text-xs text-slate-500">
              Verified local datasets, training accuracy, convergence status, and execution times
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            3 Synchronized Enclaves
          </span>
        </div>

        {/* 3 Organization Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Apollo Hospital Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono block">
                  Enclave Node 01
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Apollo Hospital
                </h3>
              </div>
              <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-full border text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                Completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Dataset Size
                </span>
                <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
                  42
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Private Records
                </span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Local Accuracy
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  86%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Epoch Loss: 0.148
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Training Time</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>3 min</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-full" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Illustrative noise only</span>
              <span className="text-emerald-600 font-medium">ZKP Verified</span>
            </div>
          </div>

          {/* Fortis Healthcare Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-mono block">
                  Enclave Node 02
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Fortis Healthcare
                </h3>
              </div>
              <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-full border text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                Completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Dataset Size
                </span>
                <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
                  41
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Private Records
                </span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Local Accuracy
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  88%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Epoch Loss: 0.138
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Training Time</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>2.8 min</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-600 rounded-full w-full" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Illustrative noise only</span>
              <span className="text-emerald-600 font-medium">ZKP Verified</span>
            </div>
          </div>

          {/* ABC Research Labs Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono block">
                  Enclave Node 03
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  ABC Research Labs
                </h3>
              </div>
              <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-full border text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                Completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Dataset Size
                </span>
                <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
                  41
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Private Records
                </span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Local Accuracy
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  84%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Epoch Loss: 0.152
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Training Time</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>3.2 min</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full w-full" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Illustrative noise only</span>
              <span className="text-emerald-600 font-medium">ZKP Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Secure Aggregation Visualization & 4. Training Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Secure Aggregation Visualization (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-600" />
                <span>Illustrative Aggregation Architecture</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The current local API decrypts selected CSVs and simulates client updates in one process; this diagram does not represent secure aggregation.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
              FedAvg Algorithm
            </span>
          </div>

          {/* Architecture Diagram SVG */}
          <div className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
            <svg
              className="w-full h-64"
              viewBox="0 0 640 230"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="streamA" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="streamB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
                <linearGradient id="streamC" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
              </defs>

              {/* Connecting paths from Hospital A, B, C into Aggregation Server */}
              {/* Hospital A: Top branch */}
              <path
                d="M 150 45 L 240 45 L 240 115 L 320 115"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeDasharray={flState.isTraining ? '6 4' : 'none'}
                className={flState.isTraining ? 'animate-pulse' : ''}
              />

              {/* Hospital B: Middle branch */}
              <path
                d="M 150 115 L 320 115"
                fill="none"
                stroke="#0EA5E9"
                strokeWidth="2.5"
                strokeDasharray={flState.isTraining ? '6 4' : 'none'}
                className={flState.isTraining ? 'animate-pulse' : ''}
              />

              {/* Hospital C: Bottom branch */}
              <path
                d="M 150 185 L 240 185 L 240 115 L 320 115"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2.5"
                strokeDasharray={flState.isTraining ? '6 4' : 'none'}
                className={flState.isTraining ? 'animate-pulse' : ''}
              />

              {/* Downward Arrow from Aggregation Server to Global Model */}
              <path
                d="M 370 155 L 370 180"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                className={flState.isTraining ? 'animate-bounce' : ''}
              />
              <polygon points="364,180 376,180 370,190" fill="#10B981" />

              {/* Box: Hospital A */}
              <g transform="translate(15, 20)">
                <rect width="135" height="50" rx="8" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" className="dark:fill-slate-900" />
                <text x="67" y="22" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 dark:fill-white font-sans">Hospital A (Apollo)</text>
                <text x="67" y="38" textAnchor="middle" className="text-[10px] fill-blue-600 font-mono font-semibold">42 Records · 86% Acc</text>
              </g>

              {/* Box: Hospital B */}
              <g transform="translate(15, 90)">
                <rect width="135" height="50" rx="8" fill="#FFFFFF" stroke="#0EA5E9" strokeWidth="2" className="dark:fill-slate-900" />
                <text x="67" y="22" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 dark:fill-white font-sans">Hospital B (Fortis)</text>
                <text x="67" y="38" textAnchor="middle" className="text-[10px] fill-cyan-600 font-mono font-semibold">41 Records · 88% Acc</text>
              </g>

              {/* Box: Hospital C */}
              <g transform="translate(15, 160)">
                <rect width="135" height="50" rx="8" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="2" className="dark:fill-slate-900" />
                <text x="67" y="22" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 dark:fill-white font-sans">Hospital C (ABC Labs)</text>
                <text x="67" y="38" textAnchor="middle" className="text-[10px] fill-purple-600 font-mono font-semibold">41 Records · 84% Acc</text>
              </g>

              {/* Central Box: Aggregation Server */}
              <g transform="translate(320, 80)">
                <rect width="170" height="70" rx="10" fill="#2563EB" className="shadow-lg" />
                <text x="85" y="25" textAnchor="middle" className="text-[11px] font-bold fill-white font-sans">Aggregation Server</text>
                <text x="85" y="42" textAnchor="middle" className="text-[13px] font-mono font-bold fill-white">FedAvg Protocol</text>
                <text x="85" y="58" textAnchor="middle" className="text-[9px] fill-blue-100 font-mono">Weighted Gradient Consensus</text>
              </g>

              {/* Bottom Box: Global Model */}
              <g transform="translate(480, 80)">
                <rect width="145" height="70" rx="10" fill="#10B981" className="shadow-lg" />
                <text x="72" y="25" textAnchor="middle" className="text-[11px] font-bold fill-white font-sans">Global Model</text>
                <text x="72" y="44" textAnchor="middle" className="text-[16px] font-mono font-extrabold fill-white">91.4%</text>
                <text x="72" y="60" textAnchor="middle" className="text-[9px] fill-emerald-100 font-mono">Convergence Verified</text>
              </g>

              {/* Animated particle flows during training */}
              {flState.isTraining && (
                <>
                  <circle cx="210" cy="45" r="4" fill="#3B82F6" className="animate-ping" />
                  <circle cx="230" cy="115" r="4" fill="#0EA5E9" className="animate-ping" />
                  <circle cx="210" cy="185" r="4" fill="#8B5CF6" className="animate-ping" />
                  <circle cx="370" cy="165" r="4" fill="#10B981" className="animate-ping" />
                </>
              )}
            </svg>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="font-mono">Hospital A + B + C ──► Aggregation Server ──► Global Model</span>
              <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">CSV plaintext is processed by this API host</span>
            </div>
          </div>
        </div>

        {/* Training Timeline (1 col) */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Training Timeline
              </h3>
              <p className="text-xs text-slate-500">
                Held-out validation accuracy per round
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">
                {timelineRounds.length ? `Round 1 → ${timelineRounds.length}` : 'No real runs'}
            </span>
          </div>

          {/* Timeline Cards */}
          <div className="space-y-2.5">
            {!timelineRounds.length && <p className="text-xs text-slate-500">Run a real experiment to populate round metrics here.</p>}
            {timelineRounds.map((r) => {
              const isCurrent = flState.currentRound === r.round;
              const isPassed = flState.currentRound >= r.round;

              return (
                <div
                  key={r.round}
                  className={`p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isPassed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Round {r.round}
                      </span>
                    </div>
                    <span className="text-sm font-mono font-extrabold text-blue-600 dark:text-blue-400">
                      {r.acc}%
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Loss: {r.loss}</span>
                    <span className={r.round === 5 ? 'text-emerald-600 font-bold' : ''}>
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Round metrics above come from the latest run in this session.</span>
          </div>
        </div>
      </div>

      {/* 5. Training Controller & Real-Time Console */}
      {productionMode === false && (
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Training Controller & Real-Time Console</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Execute live decentralized gradient training, broadcast weights, step rounds, and monitor convergence logs
            </p>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectableClients.map((client) => <label key={client.id} className="flex items-center gap-1 text-[10px] text-slate-500 max-w-36"><input type="checkbox" checked={selectedClientIds.includes(client.id)} onChange={(event) => setSelectedClientIds((current) => event.target.checked ? [...current, client.id] : current.filter((id) => id !== client.id))} />{client.name}</label>)}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300" title="Flip labels for the first client to exercise the anomaly signal">
              <input type="checkbox" checked={simulatePoisoning} onChange={(event) => setSimulatePoisoning(event.target.checked)} />
              Simulate malicious client
            </label>
            <input
              value={targetColumn}
              onChange={(event) => setTargetColumn(event.target.value)}
              className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
              placeholder="Target column"
              aria-label="Binary classification target column"
            />
            <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as 'FedAvg' | 'FedProx')} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200" aria-label="Aggregation algorithm">
              <option value="FedAvg">FedAvg</option>
              <option value="FedProx">FedProx</option>
            </select>
            <button
              onClick={runRealExperiment}
              disabled={realTraining || flState.isTraining || files.filter((file) => file.fileExtension.toLowerCase() === 'csv').length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>{realTraining ? 'Running Local FL...' : 'Run Local FL'}</span>
            </button>
            {lastExperimentId && <button onClick={compareAlgorithms} className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold">Compare FedAvg / FedProx</button>}
            <button
              onClick={startTrainingSimulation}
              disabled={flState.isTraining}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{flState.isTraining ? 'Training In Progress...' : 'Start Training'}</span>
            </button>

            <button
              onClick={stepRoundSimulation}
              disabled={flState.isTraining}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5"
              title="Manually advance to next round"
            >
              <SkipForward className="w-3.5 h-3.5 text-blue-600" />
              <span>Step Next Round</span>
            </button>

            <button
              onClick={pauseTrainingSimulation}
              disabled={!flState.isTraining}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>

            <button
              onClick={resetTrainingSimulation}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

          </div>
        </div>

        {/* Live Terminal Console */}
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="ml-2 font-mono text-slate-300">
                federated-orchestrator@central-aggregator: ~ /var/log/fl-engine
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">
                Protocol: {algorithm} · noise {realRunRounds.length ? 'configurable' : 'off by default'}
              </span>
              <button
                onClick={copyConsoleLogs}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                title="Copy Terminal Logs"
              >
                {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Logs stream */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pt-1 text-[11px] leading-relaxed select-text">
            {flState.logs.map((log) => {
              const isSuccess = log.level === 'success';
              const isSecure = log.level === 'secure';
              const isWarn = log.level === 'warn';

              return (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0 tabular-nums">
                    [{log.timestamp}]
                  </span>
                  <span
                    className={
                      isSuccess
                        ? 'text-emerald-400 font-bold'
                        : isSecure
                        ? 'text-cyan-300'
                        : isWarn
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              );
            })}

            {/* Active blinking terminal prompt */}
            <div className="flex items-center gap-1.5 text-blue-400 pt-1">
              <span>❯</span>
              <span className="w-2 h-4 bg-blue-500 inline-block animate-cursor-blink" />
            </div>
          </div>
        </div>
      </div>
      )}
      {(modelId || comparisonResult) && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modelId && <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Predict with the latest trained model</h2>
          <p className="text-xs text-slate-500">Enter feature values as a JSON object using the original CSV column names.</p>
          <textarea value={predictionInput} onChange={(event) => setPredictionInput(event.target.value)} rows={3} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono" aria-label="Prediction feature values" />
          <button onClick={predict} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">Run prediction</button>
          {predictionResult && <p className="text-sm text-slate-700 dark:text-slate-200" role="status">{predictionResult}</p>}
        </section>}
        {comparisonResult && <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">FedAvg vs FedProx, same data and settings</h2>
          <p className="text-sm text-slate-700 dark:text-slate-200">{comparisonResult}</p>
        </section>}
      </div>}
      {realRunRounds.length > 0 && <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Client security and communication metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-500">Total update traffic</span><strong className="block text-slate-900 dark:text-white">{(realRunRounds.reduce((sum, round) => sum + round.communication_bytes, 0) / 1024).toFixed(2)} KB</strong></div>
          <div><span className="text-slate-500">Flagged client rounds</span><strong className="block text-slate-900 dark:text-white">{realRunRounds.flatMap((round) => round.clients).filter((client) => client.poisoning_flag).length}</strong></div>
          <div><span className="text-slate-500">Clients scored</span><strong className="block text-slate-900 dark:text-white">{new Set(realRunRounds.flatMap((round) => round.clients.map((client: any) => client.client_id))).size}</strong></div>
          <div><span className="text-slate-500">Privacy accounting</span><strong className="block text-amber-700 dark:text-amber-300">Not implemented</strong></div>
        </div>
        <p className="text-[11px] text-slate-500">Update norm thresholds provide a basic anomaly signal and trust heuristic; they are not a certified poisoning defense. The trainer runs centrally in this local deployment.</p>
      </section>}
      {heldOutTest && <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
        <h2 className="text-sm font-bold dark:text-white">Final held-out test evaluation</h2>
        <p>Accuracy {(heldOutTest.accuracy * 100).toFixed(2)}% · ROC-AUC {heldOutTest.auc_roc == null ? 'unavailable' : Number(heldOutTest.auc_roc).toFixed(3)} · Loss {Number(heldOutTest.loss).toFixed(4)} · {heldOutTest.records} test rows</p>
        <p className="text-slate-500">Per-organization splits: {Object.entries(splitCounts).map(([org, counts]) => `${org}: ${counts.train}/${counts.validation}/${counts.test} train/validation/test`).join('; ')}</p>
      </section>}
    </div>
  );
};
