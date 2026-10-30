'use client';

import { useState, useMemo } from 'react';
import { PresenceWindow, Profile } from '@/types/database';
import { analyzePresenceChangeImpact } from '@/lib/coverage/calculator';
import { Clock, Calendar, Car, ShieldCheck, AlertCircle, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface PresenceWindowModalProps {
  currentUserId: string;
  currentUserName: string;
  existingWindows: (PresenceWindow & { profiles?: Profile })[];
  isOpen: boolean;
  onClose: () => void;
  onSaveWindow: (data: {
    start_time: string;
    end_time: string;
    note?: string;
    need_ride_to?: boolean;
    need_ride_from?: boolean;
  }) => Promise<void>;
}

export default function PresenceWindowModal({
  currentUserId,
  currentUserName,
  existingWindows,
  isOpen,
  onClose,
  onSaveWindow,
}: PresenceWindowModalProps) {
  // Inicializar fecha y horas (por defecto hoy, de 10:00 a 14:00)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');
  const [note, setNote] = useState('');
  const [needRideTo, setNeedRideTo] = useState(false);
  const [needRideFrom, setNeedRideFrom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulación en tiempo real del impacto de esta ventana
  const simulation = useMemo(() => {
    if (!selectedDate || !startTime || !endTime || startTime >= endTime) return null;

    const startIso = `${selectedDate}T${startTime}:00.000Z`;
    const endIso = `${selectedDate}T${endTime}:00.000Z`;

    return analyzePresenceChangeImpact(
      existingWindows,
      {
        user_id: currentUserId,
        user_name: currentUserName,
        start_time: startIso,
        end_time: endIso,
      },
      'CREATE'
    );
  }, [selectedDate, startTime, endTime, existingWindows, currentUserId, currentUserName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startTime >= endTime) {
      setError('La hora de salida debe ser posterior a la de llegada.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const startIso = `${selectedDate}T${startTime}:00.000Z`;
      const endIso = `${selectedDate}T${endTime}:00.000Z`;

      await onSaveWindow({
        start_time: startIso,
        end_time: endIso,
        note: note.trim() || undefined,
        need_ride_to: needRideTo,
        need_ride_from: needRideFrom,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar ventana';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-sky-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Declarar Ventana de Presencia
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Fecha */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Fecha de asistencia
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Horas de Llegada y Salida */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora de Llegada
              </label>
              <input
                type="time"
                step="1800"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora de Salida
              </label>
              <input
                type="time"
                step="1800"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          {/* BANNER DE SIMULACIÓN EN VIVO DE REGLA DE 2 */}
          {simulation && (
            <div>
              {simulation.hasSoloViolation ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Pendiente de compañero ({simulation.soloSlotsCount} bloque(s) solo)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Estarás solo en algunos tramos de este horario. La ventana se guardará como <strong>"Pendiente de compañero"</strong> y el sistema invitará automáticamente a miembros disponibles.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">¡Regla de 2 garantizada!</span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Coincides con compañeros en todo momento durante este horario.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Casillas de Transporte Independientes */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Coordinación de Transporte (Carpooling)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needRideTo}
                  onChange={(e) => setNeedRideTo(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Necesito transporte de IDA</span>
              </label>

              <label className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needRideFrom}
                  onChange={(e) => setNeedRideFrom(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Necesito transporte de REGRESO</span>
              </label>
            </div>
          </div>

          {/* Nota opcional */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nota o actividad (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Revisión de prototipo / Soldadura / Pruebas"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/30 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Confirmar Horario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
