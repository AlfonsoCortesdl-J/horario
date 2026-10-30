'use client';

import { useState } from 'react';
import { Profile } from '@/types/database';
import { 
  Car, 
  MapPin, 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Phone, 
  Calendar,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface RidesHubProps {
  currentUserId: string;
  userProfile: Profile;
  initialData: {
    myPassengerRequests: any[];
    myDriverAssignments: any[];
    availableDriversCount: number;
    allDayRequests: any[];
  };
  onRunMatching: (dateStr: string) => Promise<{ assignedCount: number; unassignedCount: number }>;
  onRespondAssignment: (assignmentId: string, accepted: boolean, reason?: string) => Promise<{ success: boolean; message: string }>;
}

export default function RidesHub({
  currentUserId,
  userProfile,
  initialData,
  onRunMatching,
  onRespondAssignment,
}: RidesHubProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [ridesData, setRidesData] = useState(initialData);
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const changeDate = (offsetDays: number) => {
    const current = new Date(selectedDateStr + 'T12:00:00Z');
    current.setDate(current.getDate() + offsetDays);
    setSelectedDateStr(current.toISOString().split('T')[0]);
  };

  const formatHour = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleExecuteMatching = async () => {
    setMatchingRunning(true);
    try {
      const res = await onRunMatching(selectedDateStr);
      alert(`Asignación completada: ${res.assignedCount} viaje(s) asignado(s), ${res.unassignedCount} sin asignar.`);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar viajes';
      alert(msg);
    } finally {
      setMatchingRunning(false);
    }
  };

  const handleAccept = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      await onRespondAssignment(assignmentId, true);
      alert('¡Has aceptado el viaje con éxito!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error al aceptar viaje');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      await onRespondAssignment(assignmentId, false, rejectionReason || 'Imprevisto de conductor');
      setRejectingId(null);
      setRejectionReason('');
      alert('Viaje rechazado. El sistema ha reasignado a los pasajeros con otro conductor disponible.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error al rechazar viaje');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Barra de Filtro de Fecha y Botón de Optimización Automática */}
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
            onClick={handleExecuteMatching}
            disabled={matchingRunning}
            className="flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{matchingRunning ? 'Asignando...' : 'Asignar Carpools Automáticamente'}</span>
          </button>
        </div>

        {/* Resumen de recursos de transporte del día */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-400 block text-[10px]">Conductores hoy:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {ridesData.availableDriversCount} autos disponibles
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-400 block text-[10px]">Solicitudes de viaje:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {ridesData.allDayRequests.length} pasajeros
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span className="text-[11px] text-slate-600 dark:text-slate-300">
              Viajar juntos favorece la cobertura de la Regla de 2
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: MIS VIAJES COMO CONDUCTOR (si el usuario tiene auto) */}
      {userProfile.has_car && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Car className="w-5 h-5 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Mis Viajes Asignados como Conductor ({ridesData.myDriverAssignments.length})
            </h2>
          </div>

          {ridesData.myDriverAssignments.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No tienes viajes asignados para esta fecha.
            </p>
          ) : (
            <div className="space-y-3">
              {ridesData.myDriverAssignments.map((asg: any) => {
                const req = asg.ride_requests;
                const passenger = req?.profiles;
                const isPending = asg.status === 'pending_driver_acceptance';
                const isAccepted = asg.status === 'accepted';
                const isRejected = asg.status === 'rejected';

                return (
                  <div
                    key={asg.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                          {req?.direction === 'to_venue' ? 'Viaje de IDA' : 'Viaje de REGRESO'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          Pasajero: {passenger?.full_name || 'Miembro'}
                        </h4>
                        <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Recogida sugerida: <strong>{formatHour(asg.scheduled_pickup_time)}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {asg.pickup_location}
                          </span>
                        </div>
                      </div>

                      <div>
                        {isAccepted && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Aceptado
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> Rechazado
                          </span>
                        )}
                        {isPending && (
                          <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> Pendiente de confirmación
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción del conductor */}
                    {isPending && (
                      <div className="pt-2 flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={actionLoading === asg.id}
                          onClick={() => handleAccept(asg.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1 shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Acepto llevarlos</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading === asg.id}
                          onClick={() => setRejectingId(asg.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-red-100 dark:bg-red-950/40 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center justify-center space-x-1 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>No puedo (Reasignar)</span>
                        </button>
                      </div>
                    )}

                    {/* Cuadro de rechazo */}
                    {rejectingId === asg.id && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/60 rounded-xl border border-red-200 dark:border-red-900/40 space-y-2 text-xs">
                        <label className="block text-red-900 dark:text-red-200 font-semibold">
                          Motivo breve del rechazo (se reasignará automáticamente a otro auto):
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Salgo de otra zona hoy / Auto en taller"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 outline-none"
                        />
                        <div className="flex space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setRejectingId(null)}
                            className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(asg.id)}
                            className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold"
                          >
                            Confirmar y Reasignar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: MIS SOLICITUDES COMO PASAJERO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Users className="w-5 h-5 text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Mis Solicitudes como Pasajero ({ridesData.myPassengerRequests.length})
          </h2>
        </div>

        {ridesData.myPassengerRequests.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No has solicitado transporte para este día. Puedes marcar la casilla "Necesito transporte" al declarar tu presencia.
          </p>
        ) : (
          <div className="space-y-3">
            {ridesData.myPassengerRequests.map((req: any) => {
              const assignment = req.ride_assignments?.[0];
              const driver = assignment?.driver;
              const isAssigned = Boolean(driver);

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        {req.direction === 'to_venue' ? 'Transporte de IDA' : 'Transporte de REGRESO'}
                      </span>
                      <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Hora deseada: {formatHour(req.target_time)}
                      </div>
                    </div>

                    <div>
                      {isAssigned ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Asignado
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Buscando auto...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tarjeta de información del conductor asignado */}
                  {isAssigned ? (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5 mt-2">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                        <span>Te lleva: <strong>{driver?.full_name}</strong></span>
                        {driver?.phone && (
                          <a
                            href={`tel:${driver.phone}`}
                            className="text-sky-600 dark:text-sky-400 flex items-center gap-1 hover:underline text-[11px]"
                          >
                            <Phone className="w-3 h-3" /> {driver.phone}
                          </a>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        📍 Recogida en: <strong>{assignment.pickup_location}</strong> a las <strong>{formatHour(assignment.scheduled_pickup_time)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                      Se emparejará automáticamente en la siguiente corrida de asignación o 24h antes.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 3: MAPA GENERAL DE CARPOOLING DEL EQUIPO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Car className="w-4 h-4 text-slate-500" />
          Resumen de Carpooling Grupal del Día ({ridesData.allDayRequests.length})
        </h3>
        {ridesData.allDayRequests.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No hay solicitudes de viaje registradas hoy.</p>
        ) : (
          <div className="space-y-1.5">
            {ridesData.allDayRequests.map((r: any) => {
              const driver = r.ride_assignments?.[0]?.driver;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {r.profiles?.full_name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {r.direction === 'to_venue' ? 'Ida' : 'Regreso'}
                    </span>
                  </div>

                  <div>
                    {driver ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Con {driver.full_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        Sin asignar
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
