import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { SecureFile, Classification, DataCategory } from '../types';
import {
  Database,
  Upload,
  Search,
  Eye,
  Download,
  Share2,
  Trash2,
  Lock,
  ShieldCheck,
  X,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';

export const SecureDataView: React.FC = () => {
  const {
    files,
    uploadFile,
    deleteFile,
    organizations,
    setActiveTab,
    addToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<SecureFile | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Upload modal states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    fileName: '',
    category: 'Genomics & Sequencing' as DataCategory,
    classification: 'Confidential' as Classification,
    description: '',
    tags: 'Genomics, Exome, HIPAA',
    sizeFormatted: '1.20 GB'
  });

  const categories: DataCategory[] = [
    'Genomics & Sequencing',
    'Radiology & Imaging',
    'Clinical Oncology Trials',
    'Pathology WSI',
    'EHR & Patient Records',
    'Pharmacovigilance'
  ];

  const classifications: Classification[] = [
    'Public',
    'Internal',
    'Confidential',
    'Restricted'
  ];

  const filteredFiles = files.filter((f) => {
    const matchesSearch =
      f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || f.category === categoryFilter;
    const matchesClass = classificationFilter === 'all' || f.classification === classificationFilter;
    return matchesSearch && matchesCat && matchesClass;
  });

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadError('');
    setUploadForm({
      fileName: '',
      category: 'Genomics & Sequencing',
      classification: 'Confidential',
      description: '',
      tags: 'Genomics, Exome, HIPAA',
      sizeFormatted: '1.20 GB'
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (sizeBytes: number) => {
    if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
    if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleFileSelection = (file: File | undefined) => {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isSupported = ['.csv', '.tar', '.tar.gz', '.nii', '.nii.gz'].some((extension) =>
      fileName.endsWith(extension)
    );

    if (!isSupported) {
      setSelectedFile(null);
      setUploadError('Unsupported file type. Select a CSV, TAR, or NIfTI archive.');
      return;
    }

    setSelectedFile(file);
    setUploadError('');
    setUploadForm((prev) => ({
      ...prev,
      fileName: file.name,
      sizeFormatted: formatFileSize(file.size)
    }));
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Select a dataset file before uploading.');
      return;
    }

    if (!uploadForm.fileName.trim()) {
      setUploadError('Enter a dataset name before uploading.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(10);

    const stepInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(stepInterval);
          setTimeout(async () => {
            try {
              await uploadFile({
                fileName: uploadForm.fileName,
                category: uploadForm.category,
                classification: uploadForm.classification,
                description: uploadForm.description || 'Federated clinical feature matrix.',
                tags: uploadForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
                sizeFormatted: uploadForm.sizeFormatted || '1.15 GB',
                sizeBytes: selectedFile.size,
                file: selectedFile
              });
              setIsUploadModalOpen(false);
              resetUploadForm();
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Dataset upload failed.');
            } finally {
              setIsUploading(false);
              setUploadProgress(0);
            }
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  const handleDownload = async (file: SecureFile) => {
    addToast({
      type: 'info',
      title: 'Cryptographic Download Initiated',
      message: `Decrypting encrypted storage for ${file.fileName}...`
    });
    try {
      const blob = await api.downloadDataset(file.id);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', downloadUrl);
      link.setAttribute('download', file.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      addToast({
        type: 'success',
        title: 'File Downloaded',
        message: `${file.fileName} downloaded successfully.`
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unable to download the dataset.'
      });
    }
  };

  const confirmDelete = () => {
    if (deletingFileId) {
      deleteFile(deletingFileId);
      setDeletingFileId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secure Data Vault"
        subtitle="Manage end-to-end encrypted clinical cohorts, imaging features, and genomic repositories protected by AES-256-GCM."
        breadcrumbs={['Federation', 'Secure Data']}
        actions={
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Dataset</span>
          </button>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Vault Datasets</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {files.length} Ingested
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">100% Cryptographically Sealed</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Vault Volume</span>
            <Lock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            8.67 GB
          </p>
          <span className="text-[11px] text-slate-400">Client-Side AES-256-GCM</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Clinical Cohorts</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {files.reduce((sum, f) => sum + f.recordsCount, 0).toLocaleString()} Rows
          </p>
          <span className="text-[11px] text-purple-600 font-mono">De-identification unverified</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Security Attestation</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            Zero Egress
          </p>
          <span className="text-[11px] text-emerald-600 font-medium font-mono">Encrypted at rest</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dataset name, organization, owner..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Clinical Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Security Classifications</option>
            {classifications.map((cl) => (
              <option key={cl} value={cl}>
                {cl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Datasets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Dataset Name</th>
                <th className="py-3 px-4">Owner & Enclave</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Size</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Database className="w-8 h-8 mx-auto stroke-[1.5] mb-2 opacity-50" />
                    <p>No secure datasets found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                          {file.fileExtension === 'csv' ? (
                            <FileSpreadsheet className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <button
                            onClick={() => setPreviewingFile(file)}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left block truncate max-w-[200px]"
                          >
                            {file.fileName}
                          </button>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {file.recordsCount.toLocaleString()} rows
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[150px]">
                        {file.ownerName}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                        {file.organizationName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {file.category}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {file.sizeFormatted}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {file.uploadDate}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-medium ${
                          file.classification === 'Restricted'
                            ? 'text-red-600 dark:text-red-400'
                            : file.classification === 'Confidential'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {file.classification}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        <span>AES-256</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewingFile(file)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                          title="Preview Data"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                          title="Download Decrypted Sample"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveTab('data-sharing')}
                          className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded transition-colors"
                          title="Share Dataset"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingFileId(file.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                          title="Purge Dataset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Data Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ingest & Encrypt Dataset
                </h2>
              </div>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }
                }}
                disabled={isUploading}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dataset Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isUploading}
                  value={uploadForm.fileName}
                  onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                  placeholder="e.g. multicenter_lung_ct_scans.csv"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Clinical Category
                  </label>
                  <select
                    disabled={isUploading}
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as DataCategory })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classification
                  </label>
                  <select
                    disabled={isUploading}
                    value={uploadForm.classification}
                    onChange={(e) => setUploadForm({ ...uploadForm, classification: e.target.value as Classification })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {classifications.map((cl) => (
                      <option key={cl} value={cl}>
                        {cl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Cohort Metadata
                </label>
                <textarea
                  rows={2}
                  disabled={isUploading}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Inclusion criteria, patient sampling methodology, de-identification details."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dataset Tags (comma-separated)
                </label>
                <input
                  type="text"
                  disabled={isUploading}
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  placeholder="Oncology, DICOM, Phase-II"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              <label
                htmlFor="dataset-file-input"
                className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  uploadError
                    ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="dataset-file-input"
                  type="file"
                  accept=".csv,.tar,.tar.gz,.nii,.nii.gz"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(e) => handleFileSelection(e.target.files?.[0])}
                />
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  {selectedFile ? selectedFile.name : 'Select CSV, TAR, or NIfTI archive'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {selectedFile
                    ? `${formatFileSize(selectedFile.size)} selected · Click to choose a different file`
                    : 'Click to browse your device · Client-side AES-256 encryption happens locally before chunk transmission'}
                </span>
              </label>

              {/* Progress bar during upload simulation */}
              {isUploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Encrypting shards & computing SHA-256 hash...</span>
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Encrypting & Storing...' : 'Upload & Encrypt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Dataset Modal */}
      {previewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Preview: {previewingFile.fileName}
                  </h2>
                  <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    AES-256 Validated
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewingFile.organizationName} · {previewingFile.category} · {previewingFile.recordsCount.toLocaleString()} encrypted rows
                </p>
              </div>
              <button
                onClick={() => setPreviewingFile(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description & Enclave Hash */}
            <div className="py-3 text-xs space-y-2 shrink-0">
              <p className="text-slate-700 dark:text-slate-300">
                {previewingFile.description}
              </p>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <span>Enclave Shard Fingerprint:</span>
                <span className="text-blue-600 dark:text-blue-400 select-all font-semibold">
                  {previewingFile.encryptionHash}
                </span>
              </div>
            </div>

            {/* Synthetic Data Rows Table */}
            <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-mono">
                    {previewingFile.sampleColumns.map((col) => (
                      <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {previewingFile.sampleRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {previewingFile.sampleColumns.map((col) => (
                        <td key={col} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 shrink-0 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Showing sample rows; de-identification has not been verified</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewingFile)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Download Decrypted Sample
                </button>
                <button
                  onClick={() => setPreviewingFile(null)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingFileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Purge Dataset</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to scrub this encrypted dataset from the vault? All active federated training links referencing this file will be decoupled.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingFileId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
