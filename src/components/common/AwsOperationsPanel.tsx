import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

const serviceLabels: Record<string, string> = {
  s3Data: 'S3 dataset storage', s3Models: 'S3 model artifacts', s3Backups: 'S3 backup storage',
  rds: 'RDS backup catalog', cognito: 'Cognito sign-in', sageMaker: 'SageMaker jobs', cloudWatch: 'CloudWatch metrics'
};

export const AwsOperationsPanel: React.FC = () => {
  const { files, currentUser, addToast } = useApp();
  const [services, setServices] = useState<Record<string, boolean | string>>({});
  const [backups, setBackups] = useState<any[]>([]);
  const [jobName, setJobName] = useState('healthcare-classifier');
  const [datasetId, setDatasetId] = useState('');
  const [latestJob, setLatestJob] = useState('');
  const [jobStatus, setJobStatus] = useState('');

  const refresh = async () => {
    try {
      const { configured } = await api.awsStatus();
      setServices(configured);
      if (currentUser.role === 'System Admin') {
        const { backups: items } = await api.awsBackups();
        setBackups(items);
      }
    } catch (error) {
      addToast({ type: 'error', title: 'AWS Status Unavailable', message: error instanceof Error ? error.message : 'Could not load AWS configuration.' });
    }
  };

  useEffect(() => { refresh(); }, []);

  const createBackup = async () => {
    try {
      const result = await api.createAwsBackup();
      addToast({ type: 'success', title: 'Cloud Backup Created', message: `${result.id} stored${result.storedInRds ? ' in RDS' : ''}${result.storedInS3 ? ' and S3' : ''}.` });
      await refresh();
    } catch (error) { addToast({ type: 'error', title: 'Backup Failed', message: error instanceof Error ? error.message : 'Could not create backup.' }); }
  };

  const restoreBackup = async (id: string) => {
    if (window.prompt(`Restore ${id}? Type RESTORE ${id} to replace current platform records.`) !== `RESTORE ${id}`) return;
    try {
      await api.restoreAwsBackup(id);
      addToast({ type: 'success', title: 'Backup Restored', message: `${id} restored. Sign in again to refresh the session.` });
    } catch (error) { addToast({ type: 'error', title: 'Restore Failed', message: error instanceof Error ? error.message : 'Could not restore backup.' }); }
  };

  const startJob = async () => {
    try {
      const result = await api.startSageMakerJob(datasetId, jobName);
      setLatestJob(result.trainingJobName);
      setJobStatus('Submitted');
      addToast({ type: 'success', title: 'SageMaker Job Started', message: result.trainingJobName });
    } catch (error) { addToast({ type: 'error', title: 'SageMaker Job Failed', message: error instanceof Error ? error.message : 'Could not start training job.' }); }
  };

  const checkJob = async () => {
    if (!latestJob) return;
    try { const result = await api.sageMakerJob(latestJob); setJobStatus(`${result.status}${result.failureReason ? `: ${result.failureReason}` : ''}`); }
    catch (error) { addToast({ type: 'error', title: 'Job Status Failed', message: error instanceof Error ? error.message : 'Could not load job status.' }); }
  };

  const csvFiles = files.filter((file) => file.fileExtension.toLowerCase() === 'csv');
  return <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">AWS services</h2><p className="text-xs text-slate-500">Region: {String(services.region || 'not configured')}. Resource state reflects environment settings; it does not verify AWS credentials.</p></div><button onClick={refresh} className="text-xs text-blue-600">Refresh</button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(serviceLabels).map(([key, label]) => <div key={key} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-xs flex justify-between gap-2"><span>{label}</span><strong className={services[key] ? 'text-emerald-600' : 'text-slate-400'}>{services[key] ? 'Configured' : 'Off'}</strong></div>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2"><h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">SageMaker training job</h3><p className="text-[11px] text-amber-700 dark:text-amber-300">This uploads the selected CSV in plaintext to the KMS encrypted S3 input prefix. It is a standard SageMaker job, not federated training.</p><div className="flex flex-wrap gap-2"><select value={datasetId} onChange={(event) => setDatasetId(event.target.value)} className="flex-1 min-w-40 px-2 py-1.5 rounded border dark:bg-slate-800 dark:border-slate-700 text-xs"><option value="">Choose CSV</option>{csvFiles.map((file) => <option value={file.id} key={file.id}>{file.fileName}</option>)}</select><input value={jobName} onChange={(event) => setJobName(event.target.value)} className="flex-1 min-w-36 px-2 py-1.5 rounded border dark:bg-slate-800 dark:border-slate-700 text-xs" /><button onClick={startJob} disabled={!datasetId} className="px-3 py-1.5 rounded bg-blue-600 disabled:opacity-50 text-white text-xs">Start job</button></div>{latestJob && <div className="flex items-center gap-2 text-xs"><code>{latestJob}</code><button onClick={checkJob} className="text-blue-600 underline">Check status</button><span>{jobStatus}</span></div>}</div>
      <div className="space-y-2"><h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Backup and recovery</h3><p className="text-[11px] text-slate-500">Encrypted S3 stores dataset files and backup payloads; RDS keeps a searchable snapshot catalog and payload copy.</p>{currentUser.role === 'System Admin' && <button onClick={createBackup} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs">Create backup</button>}{backups.map((backup) => <div key={backup.id} className="flex justify-between gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-800/60 rounded"><span><code>{backup.id}</code> · {backup.createdAt}</span>{currentUser.role === 'System Admin' && <button onClick={() => restoreBackup(backup.id)} className="text-rose-600 underline">Restore</button>}</div>)}</div>
    </div>
  </section>;
};
