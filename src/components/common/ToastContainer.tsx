import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg transition-all duration-200 bg-white dark:bg-slate-900 ${
              isSuccess
                ? 'border-emerald-200 dark:border-emerald-800/60 text-slate-800 dark:text-slate-100'
                : isWarning
                ? 'border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-100'
                : isError
                ? 'border-red-200 dark:border-red-800/60 text-slate-800 dark:text-slate-100'
                : 'border-blue-200 dark:border-blue-800/60 text-slate-800 dark:text-slate-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
              {!isSuccess && !isWarning && !isError && <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {toast.title}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
