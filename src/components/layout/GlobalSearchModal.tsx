import React, { useState, useEffect, useRef } from 'react';
import { useApp, TabId } from '../../context/AppContext';
import { Search, X, Building2, Database, BrainCircuit, Users, FileCheck, ArrowRight } from 'lucide-react';

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    files,
    organizations,
    users,
    setActiveTab,
    setSelectedOrgId,
    setSelectedUserId
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const matchedFiles = normalizedQuery
    ? files.filter(
        (f) =>
          f.fileName.toLowerCase().includes(normalizedQuery) ||
          f.category.toLowerCase().includes(normalizedQuery) ||
          f.organizationName.toLowerCase().includes(normalizedQuery)
      )
    : files.slice(0, 3);

  const matchedOrgs = normalizedQuery
    ? organizations.filter(
        (o) =>
          o.name.toLowerCase().includes(normalizedQuery) ||
          o.location.toLowerCase().includes(normalizedQuery) ||
          o.type.toLowerCase().includes(normalizedQuery)
      )
    : organizations.slice(0, 2);

  const matchedUsers = normalizedQuery
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(normalizedQuery) ||
          u.email.toLowerCase().includes(normalizedQuery) ||
          u.role.toLowerCase().includes(normalizedQuery)
      )
    : users.slice(0, 2);

  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    setIsSearchModalOpen(false);
  };

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setActiveTab('organization-details');
    setIsSearchModalOpen(false);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('user-profile');
    setIsSearchModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-100"
      onClick={() => setIsSearchModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search datasets, organizations, research models, team members..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {/* Quick Actions Navigation */}
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Navigation
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
              <button
                onClick={() => handleSelectTab('federated-learning')}
                className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors text-left border border-slate-100 dark:border-slate-800"
              >
                <BrainCircuit className="w-3.5 h-3.5 text-blue-600" />
                <span>Federated Lab</span>
              </button>
              <button
                onClick={() => handleSelectTab('secure-data')}
                className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors text-left border border-slate-100 dark:border-slate-800"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Datasets Vault</span>
              </button>
              <button
                onClick={() => handleSelectTab('audit-logs')}
                className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors text-left border border-slate-100 dark:border-slate-800"
              >
                <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Audit Logs</span>
              </button>
              <button
                onClick={() => handleSelectTab('global-model')}
                className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors text-left border border-slate-100 dark:border-slate-800"
              >
                <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                <span>Global Model</span>
              </button>
            </div>
          </div>

          {/* Secure Datasets */}
          {matchedFiles.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Secure Datasets</span>
                <span className="font-normal font-mono">{matchedFiles.length} matches</span>
              </div>
              <div className="space-y-1 mt-1">
                {matchedFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleSelectTab('secure-data')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Database className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {file.fileName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {file.category} · {file.organizationName} · {file.sizeFormatted}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      Open →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Organizations */}
          {matchedOrgs.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Participating Healthcare Organizations</span>
                <span className="font-normal font-mono">{matchedOrgs.length}</span>
              </div>
              <div className="space-y-1 mt-1">
                {matchedOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {org.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {org.type} · {org.location} · {org.filesCount} Datasets
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      View details →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {matchedUsers.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Verified Personnel</span>
                <span className="font-normal font-mono">{matchedUsers.length}</span>
              </div>
              <div className="space-y-1 mt-1">
                {matchedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Users className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {user.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {user.role} · {user.organizationName}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      Profile →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">↓</kbd> to navigate</span>
            <span><kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">Enter</kbd> to select</span>
          </div>
          <span>Confidential Search Enclave</span>
        </div>
      </div>
    </div>
  );
};
