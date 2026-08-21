'use client';

import React from 'react';
import { useApp } from '@/lib/context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full no-print">
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
          info: <Info className="w-5 h-5 text-maroon-700 flex-shrink-0" />,
        };

        const borderMap = {
          success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
          error: 'border-red-200 bg-red-50 text-red-950',
          warning: 'border-amber-200 bg-amber-50 text-amber-950',
          info: 'border-maroon-200 bg-maroon-50/70 text-maroon-950',
        };

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between p-3.5 rounded-xl border shadow-elevated transition-all duration-300 transform translate-y-0 backdrop-blur-md ${borderMap[toast.type]}`}
          >
            <div className="flex items-start space-x-3">
              {iconMap[toast.type]}
              <div>
                {toast.title && <h4 className="font-semibold text-sm">{toast.title}</h4>}
                <p className="text-xs leading-relaxed">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
