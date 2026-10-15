import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 glass-modal rounded-2xl border border-white/20 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`p-2.5 rounded-xl ${
              isDestructive ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
            <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              isDestructive
                ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-sky-500/80 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
