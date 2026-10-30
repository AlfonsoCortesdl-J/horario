'use client';

import { useState } from 'react';
import { PresenceWindow, Profile } from '@/types/database';
import { analyzePresenceChangeImpact } from '@/lib/coverage/calculator';
import { AlertTriangle, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface CancelWindowModalProps {
  windowToCancel: PresenceWindow & { profiles?: Profile };
  allWindows: (PresenceWindow & { profiles?: Profile })[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (windowId: string, reason: string) => Promise<void>;
}

export default function CancelWindowModal({
  windowToCancel,
  allWindows,
  isOpen,
  onClose,
  onConfirmCancel,
}: CancelWindowModalProps) {
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Analizar impacto de la cancelación
  const impact = analyzePresenceChangeImpact(
    allWindows,
    {
      id: windowToCancel.id,
      user_id: windowToCancel.user_id,
      user_name: windowToCancel.profiles?.full_name,
      start_time: windowToCancel.start_time,
      end_time: windowToCancel.end_time,
    },
    'CANCEL'
  );

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Por favor escribe un motivo breve de la cancelación.');
      return;
    }

    setCancelling(true);
    setError(null);
    try {
      await onConfirmCancel(windowToCancel.id, reason.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cancelar ventana';
      setError(msg);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Cancelar Ventana</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ventana a cancelar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
          <div className="text-slate-500 font-medium">Horario programado:</div>
          <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
            {formatTime(windowToCancel.start_time)} - {formatTime(windowToCancel.end_time)}
          </div>
        </div>

        {/* ADVERTENCIA CRÍTICA: Si deja a alguien solo */}
        {impact.hasSoloViolation ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-red-700 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <span>⚠️ Violación de la Regla de 2</span>
            </div>
            <p>
              Si cancelas esta ventana, dejarás a <strong className="underline">{impact.affectedUserNames.join(', ')}</strong> solo(a) en el lugar en los siguientes tramos:
            </p>
            <div className="space-y-1 max-h-24 overflow-y-auto pl-2 font-mono font-semibold text-[11px] text-red-800 dark:text-red-300">
              {impact.affectedSlots.map((s, idx) => (
                <div key={idx}>
                  • {s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {s.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-red-700 dark:text-red-400 italic">
              Al confirmar, se enviará una notificación urgente a la persona afectada, al grupo y al administrador.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Esta cancelación no deja a ningún compañero solo en el lugar.
          </p>
        )}

        {/* Formulario de motivo de cancelación */}
        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Motivo de la cancelación (obligatorio)
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ej. Imprevisto de salud / Junta académica urgente..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-red-100 text-red-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 disabled:opacity-50"
            >
              {cancelling ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
