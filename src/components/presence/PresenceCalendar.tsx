'use client';

import { useState, useMemo } from 'react';
import { PresenceWindow, CoverageSlot, Profile } from '@/types/database';
import PresenceWindowModal from './PresenceWindowModal';
import CancelWindowModal from './CancelWindowModal';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  LogOut, 
  LogIn, 
  Trash2, 
  Car, 
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  UserPlus
} from 'lucide-react';

interface PresenceCalendarProps {
  currentUserId: string;
  currentUserName: string;
  initialWindows: (PresenceWindow & { profiles?: Profile })[];
  initialCoverageSlots: CoverageSlot[];
  onCreateWindow: (data: {
    start_time: string;
    end_time: string;
    note?: string;
    need_ride_to?: boolean;
    need_ride_from?: boolean;
  }) => Promise<void>;
  onCancelWindow: (windowId: string, reason: string) => Promise<void>;
  onCheckIn: (windowId: string) => Promise<void>;
  onCheckOut: (windowId: string) => Promise<{ leavesSomeoneAlone?: boolean; remainingUserName?: string | null }>;
}

export default function PresenceCalendar({
  currentUserId,
  currentUserName,
  initialWindows,
  initialCoverageSlots,
  onCreateWindow,
  onCancelWindow,
  onCheckIn,
  onCheckOut,
}: PresenceCalendarProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [windows, setWindows] = useState(initialWindows);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancellingWindow, setCancellingWindow] = useState<(PresenceWindow & { profiles?: Profile }) | null>(null);
  const [inspectedSlot, setInspectedSlot] = useState<CoverageSlot | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtrar ventanas del día seleccionado
  const dayWindows = useMemo(() => {
    return windows.filter((w) => {
      const wDate = w.start_time.split('T')[0];
      return wDate === selectedDateStr && w.status !== 'cancelled';
    });
  }, [windows, selectedDateStr]);

  // Navegación de fechas
  const changeDate = (offsetDays: number) => {
    const current = new Date(selectedDateStr + 'T12:00:00Z');
    current.setDate(current.getDate() + offsetDays);
    setSelectedDateStr(current.toISOString().split('T')[0]);
  };

  const formatHourMin = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Check-in handler
  const handleCheckIn = async (windowId: string) => {
    setActionLoading(windowId);
    try {
      await onCheckIn(windowId);
      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, checked_in_at: new Date().toISOString() } : w
        )
      );
    } catch (err) {
      console.error(err);
      alert('Error al registrar check-in');
    } finally {
      setActionLoading(null);
    }
  };

  // Check-out handler con advertencia si deja solo a otro
  const handleCheckOut = async (windowId: string) => {
    setActionLoading(windowId);
    try {
      const res = await onCheckOut(windowId);
      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, checked_out_at: new Date().toISOString() } : w
        )
      );
      if (res.leavesSomeoneAlone) {
        alert(
          `⚠️ Atención: Al retirarte has dejado solo(a) a ${
            res.remainingUserName || 'un compañero'
          } en el lugar. Se ha registrado una alerta para el administrador.`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Error al registrar check-out');
    } finally {
      setActionLoading(null);
    }
  };

  // Sumarse con un toque para acompañar a alguien
  const handleQuickJoin = async (targetWindow: PresenceWindow) => {
    try {
      await onCreateWindow({
        start_time: targetWindow.start_time,
        end_time: targetWindow.end_time,
        note: 'Sumado para acompañar (Regla de 2)',
      });
      alert('¡Listo! Te has sumado como compañero en este horario.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sumarse';
      alert(msg);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Barra de Controles y Selector de Fecha */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
            />
            <button
              type="button"
              onClick={() => changeDate(1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateStr(new Date().toISOString().split('T')[0])}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200"
            >
              Hoy
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Declarar Presencia</span>
          </button>
        </div>
      </div>

      {/* MAPA DE COBERTURA EN TIEMPO REAL (MÓDULO 2 CORE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-500" />
              Mapa de Cobertura en Vivo (Regla de 2)
            </h2>
            <p className="text-xs text-slate-500">
              Gris = 0 personas · Rojo = 1 persona (Violación) · Verde = 2 o más (Protegido)
            </p>
          </div>

          {/* Leyenda de Colores */}
          <div className="flex items-center space-x-3 text-[11px] font-medium">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span className="text-slate-500">0</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-red-600 dark:text-red-400 font-bold">1 (Solo)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">2+</span>
            </div>
          </div>
        </div>

        {/* Barra Visual de Bloques de Cobertura de 30 minutos */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[680px] grid grid-cols-32 gap-1">
            {initialCoverageSlots.map((slot, idx) => {
              const startH = new Date(slot.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
              const isSolo = slot.status === 'solo';
              const isCovered = slot.status === 'covered';

              return (
                <div
                  key={idx}
                  onClick={() => setInspectedSlot(slot)}
                  className={`h-14 rounded-lg flex flex-col items-center justify-between p-1 cursor-pointer transition-all border ${
                    isSolo
                      ? 'bg-red-500 text-white border-red-600 shadow-sm shadow-red-500/20 hover:bg-red-600 scale-[1.02]'
                      : isCovered
                      ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200'
                  }`}
                  title={`${startH}: ${slot.person_count} persona(s)`}
                >
                  <span className="text-[9px] font-mono leading-none opacity-80">{startH.split(':')[0]}h</span>
                  <span className="text-xs font-bold leading-none">{slot.person_count > 0 ? slot.person_count : ''}</span>
                  <span className="text-[8px] leading-none">{isSolo ? '⚠️' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle del Bloque Tocado */}
        {inspectedSlot && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Tramo {formatHourMin(inspectedSlot.slot_start)} - {formatHourMin(inspectedSlot.slot_end)}:
              </span>{' '}
              {inspectedSlot.person_count === 0 ? (
                <span className="text-slate-500 italic">Nadie programado en este momento.</span>
              ) : inspectedSlot.person_count === 1 ? (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  ⚠️ Solo 1 persona presente: {inspectedSlot.user_names.join(', ')}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✅ Cubierto ({inspectedSlot.person_count}): {inspectedSlot.user_names.join(', ')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInspectedSlot(null)}
              className="text-xs text-slate-400 hover:text-slate-600 ml-2"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* LISTADO DE VENTANAS DECLARADAS DEL DÍA */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 px-1">
          <Clock className="w-4 h-4 text-sky-500" />
          Ventanas Declaradas para este Día ({dayWindows.length})
        </h3>

        {dayWindows.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs space-y-2">
            <p>No hay ventanas registradas para esta fecha.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-sky-600 dark:text-sky-400 font-semibold underline underline-offset-4"
            >
              Sé el primero en programar asistencia
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dayWindows.map((win) => {
              const isMine = win.user_id === currentUserId;
              const isPending = win.status === 'pending_partner';
              const isCheckedIn = Boolean(win.checked_in_at);
              const isCheckedOut = Boolean(win.checked_out_at);

              return (
                <div
                  key={win.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm space-y-3 transition-all ${
                    isPending
                      ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {win.profiles?.full_name || 'Miembro'}
                        </span>
                        {isMine && (
                          <span className="text-[10px] font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                        {formatHourMin(win.start_time)} - {formatHourMin(win.end_time)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      {isPending ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Pendiente de compañero
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Regla de 2 ✅
                        </span>
                      )}
                    </div>
                  </div>

                  {win.note && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                      "{win.note}"
                    </p>
                  )}

                  {/* Etiquetas de transporte */}
                  {(win.need_ride_to || win.need_ride_from) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {win.need_ride_to && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                          <Car className="w-3 h-3" /> Pide transporte de IDA
                        </span>
                      )}
                      {win.need_ride_from && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                          <Car className="w-3 h-3" /> Pide transporte de REGRESO
                        </span>
                      )}
                    </div>
                  )}

                  {/* Botones de Acción (Check-in, Check-out, Sumarse o Cancelar) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    {/* Botón de Sumarse para acompañar si está pendiente y no es mi ventana */}
                    {!isMine && isPending && (
                      <button
                        type="button"
                        onClick={() => handleQuickJoin(win)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Acompañar en este horario</span>
                      </button>
                    )}

                    {/* Acciones del propietario de la ventana */}
                    {isMine && (
                      <div className="flex items-center space-x-2 w-full justify-between">
                        <div className="flex items-center space-x-2">
                          {!isCheckedIn ? (
                            <button
                              type="button"
                              disabled={actionLoading === win.id}
                              onClick={() => handleCheckIn(win.id)}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Ya llegué</span>
                            </button>
                          ) : !isCheckedOut ? (
                            <button
                              type="button"
                              disabled={actionLoading === win.id}
                              onClick={() => handleCheckOut(win.id)}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Ya me fui</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Sesión finalizada</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setCancellingWindow(win)}
                          className="flex items-center space-x-1 text-red-600 dark:text-red-400 hover:underline p-1 text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para declarar ventana */}
      <PresenceWindowModal
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        existingWindows={windows}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveWindow={onCreateWindow}
      />

      {/* Modal de confirmación de cancelación */}
      {cancellingWindow && (
        <CancelWindowModal
          windowToCancel={cancellingWindow}
          allWindows={windows}
          isOpen={Boolean(cancellingWindow)}
          onClose={() => setCancellingWindow(null)}
          onConfirmCancel={onCancelWindow}
        />
      )}
    </div>
  );
}
