import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200"
          style={{
            background: 'rgba(32, 44, 56, 0.92)',
            borderColor:
              toast.type === 'error'
                ? 'rgba(239, 68, 68, 0.4)'
                : toast.type === 'success'
                ? 'rgba(52, 211, 153, 0.4)'
                : 'rgba(147, 197, 253, 0.4)',
            color: '#f1f5f9',
          }}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span className="text-xs font-medium leading-snug">{toast.text}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
