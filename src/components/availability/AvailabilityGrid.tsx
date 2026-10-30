'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AvailabilitySlot, Profile } from '@/types/database';
import { 
  Users, 
  UserCheck, 
  Sparkles, 
  Trash2, 
  Info, 
  Calendar, 
  Clock, 
  X,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface AvailabilityGridProps {
  currentUserId: string;
  userSlots: AvailabilitySlot[];
  allSlots: AvailabilitySlot[];
  profiles: Profile[];
  onSaveSlots: (slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]) => Promise<void>;
}

const DAYS = [
  { index: 1, name: 'Lunes', short: 'Lun' },
  { index: 2, name: 'Martes', short: 'Mar' },
  { index: 3, name: 'Miércoles', short: 'Mié' },
  { index: 4, name: 'Jueves', short: 'Jue' },
  { index: 5, name: 'Viernes', short: 'Vie' },
  { index: 6, name: 'Sábado', short: 'Sáb' },
  { index: 0, name: 'Domingo', short: 'Dom' },
];

// Generar bloques de 30 minutos de 07:00 a 23:00
const TIME_SLOTS: string[] = [];
for (let hour = 7; hour <= 22; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

export default function AvailabilityGrid({
  currentUserId,
  userSlots,
  allSlots,
  profiles,
  onSaveSlots,
}: AvailabilityGridProps) {
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1); // Para vista móvil compacta
  
  // Set de claves de slots del usuario actual: "dayIndex_HH:mm"
  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado para el modal de detalle de bloque tocado en el mapa de calor
  const [inspectedSlot, setInspectedSlot] = useState<{
    dayIndex: number;
    time: string;
    availableProfiles: Profile[];
    unavailableProfiles: Profile[];
  } | null>(null);

  // Estados de arrastre (drag-to-paint)
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef<'add' | 'remove'>('add');
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Convertir slots recibidos a Set de bloques
  useEffect(() => {
    const slotSet = new Set<string>();
    userSlots.forEach((slot) => {
      if (slot.day_of_week === null || slot.day_of_week === undefined) return;
      const startH = parseInt(slot.start_time.split(':')[0], 10);
      const startM = parseInt(slot.start_time.split(':')[1], 10);
      const endH = parseInt(slot.end_time.split(':')[0], 10);
      const endM = parseInt(slot.end_time.split(':')[1], 10);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m < endMinutes; m += 30) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slotSet.add(`${slot.day_of_week}_${timeStr}`);
      }
    });
    setMySlots(slotSet);
    setHasChanges(false);
  }, [userSlots]);

  // Mapa de disponibilidad del equipo: slotKey -> array de user_ids
  const teamAvailabilityMap = useCallback(() => {
    const map = new Map<string, Set<string>>();
    allSlots.forEach((slot) => {
      if (slot.day_of_week === null || slot.day_of_week === undefined) return;
      const startH = parseInt(slot.start_time.split(':')[0], 10);
      const startM = parseInt(slot.start_time.split(':')[1], 10);
      const endH = parseInt(slot.end_time.split(':')[0], 10);
      const endM = parseInt(slot.end_time.split(':')[1], 10);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m < endMinutes; m += 30) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const key = `${slot.day_of_week}_${timeStr}`;

        if (!map.has(key)) {
          map.set(key, new Set());
        }
        map.get(key)!.add(slot.user_id);
      }
    });
    return map;
  }, [allSlots])();

  // Color de calor según disponibilidad
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800';
    if (count === 1) return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    if (count === 2) return 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 border-emerald-400 dark:border-emerald-700 font-semibold';
    if (count <= 4) return 'bg-emerald-400 dark:bg-emerald-700 text-emerald-950 dark:text-white border-emerald-500 font-bold';
    return 'bg-emerald-600 text-white border-emerald-700 font-extrabold';
  };

  // Alternar un bloque
  const applyCellChange = (slotKey: string, forceAction?: 'add' | 'remove') => {
    setMySlots((prev) => {
      const next = new Set(prev);
      const action = forceAction ?? (next.has(slotKey) ? 'remove' : 'add');
      if (action === 'add') {
        next.add(slotKey);
      } else {
        next.delete(slotKey);
      }
      return next;
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Handlers de Mouse para escritorio
  const handleMouseDown = (slotKey: string) => {
    if (viewMode !== 'mine') return;
    isDraggingRef.current = true;
    const action = mySlots.has(slotKey) ? 'remove' : 'add';
    dragActionRef.current = action;
    applyCellChange(slotKey, action);
  };

  const handleMouseEnter = (slotKey: string) => {
    if (viewMode !== 'mine' || !isDraggingRef.current) return;
    applyCellChange(slotKey, dragActionRef.current);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Handlers Táctiles para celular
  const handleTouchStart = (slotKey: string) => {
    if (viewMode !== 'mine') return;
    isDraggingRef.current = true;
    const action = mySlots.has(slotKey) ? 'remove' : 'add';
    dragActionRef.current = action;
    applyCellChange(slotKey, action);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (viewMode !== 'mine' || !isDraggingRef.current) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const slotKey = element?.getAttribute('data-slot-key');
    if (slotKey) {
      applyCellChange(slotKey, dragActionRef.current);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Inspeccionar detalle en modo equipo
  const handleInspectTeamSlot = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;
    const userIdsWithSlot = teamAvailabilityMap.get(key) || new Set<string>();

    const availableProfiles = profiles.filter((p) => userIdsWithSlot.has(p.id));
    const unavailableProfiles = profiles.filter((p) => !userIdsWithSlot.has(p.id));

    setInspectedSlot({
      dayIndex,
      time,
      availableProfiles,
      unavailableProfiles,
    });
  };

  // Guardar disponibilidad en base de datos
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Agrupar bloques contiguos de 30 min en rangos [start_time, end_time]
      const slotsByDay = new Map<number, number[]>();
      mySlots.forEach((slotKey) => {
        const [dayStr, time] = slotKey.split('_');
        const day = parseInt(dayStr, 10);
        const [h, m] = time.split(':').map(Number);
        const minutes = h * 60 + m;

        if (!slotsByDay.has(day)) slotsByDay.set(day, []);
        slotsByDay.get(day)!.push(minutes);
      });

      const payload: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[] = [];

      slotsByDay.forEach((minutesArr, day) => {
        minutesArr.sort((a, b) => a - b);
        let currentStart = minutesArr[0];
        let currentEnd = minutesArr[0] + 30;

        for (let i = 1; i < minutesArr.length; i++) {
          if (minutesArr[i] === currentEnd) {
            currentEnd += 30;
          } else {
            // Termina tramo contiguo
            const sH = Math.floor(currentStart / 60).toString().padStart(2, '0');
            const sM = (currentStart % 60).toString().padStart(2, '0');
            const eH = Math.floor(currentEnd / 60).toString().padStart(2, '0');
            const eM = (currentEnd % 60).toString().padStart(2, '0');
            payload.push({
              day_of_week: day,
              start_time: `${sH}:${sM}:00`,
              end_time: `${eH}:${eM}:00`,
              is_recurring: true,
            });
            currentStart = minutesArr[i];
            currentEnd = currentStart + 30;
          }
        }
        if (minutesArr.length > 0) {
          const sH = Math.floor(currentStart / 60).toString().padStart(2, '0');
          const sM = (currentStart % 60).toString().padStart(2, '0');
          const eH = Math.floor(currentEnd / 60).toString().padStart(2, '0');
          const eM = (currentEnd % 60).toString().padStart(2, '0');
          payload.push({
            day_of_week: day,
            start_time: `${sH}:${sM}:00`,
            end_time: `${eH}:${eM}:00`,
            is_recurring: true,
          });
        }
      });

      await onSaveSlots(payload);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar tu disponibilidad');
    } finally {
      setIsSaving(false);
    }
  };

  // Acciones rápidas
  const handleQuickPreset = (type: 'morning' | 'afternoon' | 'clear') => {
    setMySlots((prev) => {
      const next = new Set(prev);
      DAYS.forEach((day) => {
        TIME_SLOTS.forEach((time) => {
          const key = `${day.index}_${time}`;
          const [h] = time.split(':').map(Number);
          if (type === 'clear') {
            next.delete(key);
          } else if (type === 'morning' && h >= 8 && h < 14) {
            next.add(key);
          } else if (type === 'afternoon' && h >= 14 && h < 20) {
            next.add(key);
          }
        });
      });
      return next;
    });
    setHasChanges(true);
  };

  return (
    <div 
      className="flex flex-col h-full select-none"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      {/* Selector superior: Mi Disponibilidad vs Mapa del Equipo */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'mine'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Mi Horario</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('team')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'team'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Mapa de Calor</span>
            </button>
          </div>

          {/* Botones de acción rápida para "Mi horario" */}
          {viewMode === 'mine' && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('morning')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Mañanas
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('afternoon')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Tardes
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('clear')}
                className="text-xs px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Limpiar toda la semana"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className={`ml-auto sm:ml-2 flex items-center space-x-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-all ${
                  hasChanges
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30'
                    : saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <>
                    <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Barra explicativa */}
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            {viewMode === 'mine'
              ? 'Toca o arrastra para marcar en qué bloques podrías asistir.'
              : 'Toca cualquier bloque para ver quién puede asistir y sugerir acompañante.'}
          </span>
          {viewMode === 'team' && (
            <div className="flex items-center space-x-1 text-[11px]">
              <span>Menos</span>
              <span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700"></span>
              <span className="w-3 h-3 rounded-sm bg-emerald-300"></span>
              <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
              <span>Más</span>
            </div>
          )}
        </div>
      </div>

      {/* Selector de día para pantallas móviles pequeñas */}
      <div className="md:hidden flex overflow-x-auto bg-slate-50 dark:bg-slate-900/60 p-2 border-b border-slate-200 dark:border-slate-800 space-x-1 scrollbar-none">
        {DAYS.map((day) => {
          const isSelected = selectedDayTab === day.index;
          return (
            <button
              key={day.index}
              type="button"
              onClick={() => setSelectedDayTab(day.index)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {day.short}
            </button>
          );
        })}
      </div>

      {/* Contenedor de la Cuadrícula */}
      <div 
        ref={gridContainerRef}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-auto p-2 sm:p-4 touch-paint-area"
      >
        <div className="min-w-full inline-block align-middle">
          {/* Header de columnas (días) en Desktop */}
          <div className="hidden md:grid grid-cols-8 gap-1 mb-2 sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 pb-1">
            <div className="text-xs font-semibold text-slate-400 p-2 text-center">Hora</div>
            {DAYS.map((day) => (
              <div
                key={day.index}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 p-2 text-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
              >
                {day.name}
              </div>
            ))}
          </div>

          {/* Filas de bloques de tiempo */}
          <div className="space-y-1">
            {TIME_SLOTS.map((time) => {
              return (
                <div key={time} className="grid grid-cols-2 md:grid-cols-8 gap-1 items-center">
                  {/* Etiqueta de hora */}
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono text-center py-1">
                    {time}
                  </div>

                  {/* Vista móvil: Renderiza solo el día seleccionado en la pestaña */}
                  <div className="md:hidden">
                    {(() => {
                      const day = DAYS.find((d) => d.index === selectedDayTab)!;
                      const slotKey = `${day.index}_${time}`;
                      const isMarked = mySlots.has(slotKey);
                      const teamCount = (teamAvailabilityMap.get(slotKey) || new Set()).size;

                      if (viewMode === 'mine') {
                        return (
                          <div
                            data-slot-key={slotKey}
                            onMouseDown={() => handleMouseDown(slotKey)}
                            onMouseEnter={() => handleMouseEnter(slotKey)}
                            onTouchStart={() => handleTouchStart(slotKey)}
                            className={`h-9 rounded-lg border text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                              isMarked
                                ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                            }`}
                          >
                            {isMarked ? 'Disponible' : '-'}
                          </div>
                        );
                      }

                      return (
                        <div
                          onClick={() => handleInspectTeamSlot(day.index, time)}
                          className={`h-9 rounded-lg border text-xs flex items-center justify-between px-3 transition-all cursor-pointer ${getHeatmapColor(
                            teamCount
                          )}`}
                        >
                          <span>{teamCount > 0 ? `${teamCount} personas` : 'Nadie'}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Vista desktop: Renderiza los 7 días simultáneamente */}
                  {DAYS.map((day) => {
                    const slotKey = `${day.index}_${time}`;
                    const isMarked = mySlots.has(slotKey);
                    const teamCount = (teamAvailabilityMap.get(slotKey) || new Set()).size;

                    if (viewMode === 'mine') {
                      return (
                        <div
                          key={slotKey}
                          data-slot-key={slotKey}
                          onMouseDown={() => handleMouseDown(slotKey)}
                          onMouseEnter={() => handleMouseEnter(slotKey)}
                          onTouchStart={() => handleTouchStart(slotKey)}
                          className={`hidden md:flex h-8 rounded-md border text-xs font-medium items-center justify-center transition-all cursor-pointer select-none ${
                            isMarked
                              ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/20'
                          }`}
                        >
                          {isMarked ? '✓' : ''}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={slotKey}
                        onClick={() => handleInspectTeamSlot(day.index, time)}
                        className={`hidden md:flex h-8 rounded-md border text-xs items-center justify-center transition-all cursor-pointer select-none ${getHeatmapColor(
                          teamCount
                        )}`}
                        title={`Tocar para ver quién puede: ${teamCount} personas`}
                      >
                        {teamCount > 0 ? teamCount : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal / Bottom Sheet de Inspección de bloque tocado en el Mapa de Calor */}
      {inspectedSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-sky-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {DAYS.find((d) => d.index === inspectedSlot.dayIndex)?.name} · {inspectedSlot.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSlot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4">
              <div className={`p-3 rounded-xl border flex items-center space-x-3 ${
                inspectedSlot.availableProfiles.length >= 2 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : inspectedSlot.availableProfiles.length === 1
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}>
                <ShieldCheck className="w-6 h-6 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-sm">
                    {inspectedSlot.availableProfiles.length} disponible(s) en este bloque
                  </span>
                  {inspectedSlot.availableProfiles.length >= 2 ? (
                    'Cumpliría la Regla de 2 si se programa una sesión aquí.'
                  ) : inspectedSlot.availableProfiles.length === 1 ? (
                    'Riesgo: solo 1 persona disponible (requiere al menos un compañero más).'
                  ) : (
                    'Nadie disponible en este momento.'
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Quién sí puede */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  Disponibles ({inspectedSlot.availableProfiles.length})
                </h4>
                {inspectedSlot.availableProfiles.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Ningún miembro disponible.</p>
                ) : (
                  <div className="space-y-1.5">
                    {inspectedSlot.availableProfiles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">{p.full_name}</span>
                        {p.has_car && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-medium">
                            Tiene carro ({p.available_seats} asientos)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quién no puede */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  No Disponibles ({inspectedSlot.unavailableProfiles.length})
                </h4>
                <div className="space-y-1">
                  {inspectedSlot.unavailableProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="p-1.5 rounded-md text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                      <span>{p.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectedSlot(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
