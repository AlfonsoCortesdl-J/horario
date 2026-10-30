'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AvailabilitySlot, Profile } from '@/types/database';
import { 
  Users, 
  UserCheck, 
  Trash2, 
  Clock, 
  Calendar,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Info
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

// Generar bloques de 30 minutos de 07:00 a 23:00 (estilo exacto When2Meet)
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
  // Modo de vista: 'mine' (pintar mi disponibilidad) o 'team' (mapa de calor grupal When2Meet)
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');
  
  // Claves de slots del usuario: "dayIndex_HH:mm"
  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Slot inspeccionado en el mapa de calor (hover en desktop o tap en mobile)
  const [hoveredSlot, setHoveredSlot] = useState<{ dayIndex: number; time: string } | null>({
    dayIndex: 1,
    time: '09:00',
  });

  // Arrastre tipo When2Meet
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef<'add' | 'remove'>('add');
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Cargar slots existentes
  useEffect(() => {
    const slotSet = new Set<string>();
    userSlots.forEach((slot) => {
      if (slot.day_of_week === null || slot.day_of_week === undefined) return;
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);

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

  // Mapa de disponibilidad de todo el equipo
  const teamAvailabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allSlots.forEach((slot) => {
      if (slot.day_of_week === null || slot.day_of_week === undefined) return;
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m < endMinutes; m += 30) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const key = `${slot.day_of_week}_${timeStr}`;

        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(slot.user_id);
      }
    });
    return map;
  }, [allSlots]);

  // Color de calor del grupo estilo When2Meet con lógica de Regla de 2
  const getCellVisual = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;

    if (viewMode === 'mine') {
      const isMarked = mySlots.has(key);
      if (isMarked) {
        return 'bg-emerald-500 border-emerald-400 text-white font-bold shadow-sm';
      }
      return 'bg-zinc-950/70 border-zinc-800/80 text-transparent hover:bg-zinc-800/40 hover:border-zinc-700';
    }

    // Modo equipo (Heatmap grupal When2Meet)
    const userIds = teamAvailabilityMap.get(key) || new Set();
    const count = userIds.size;

    if (count === 0) {
      return 'bg-zinc-950/50 border-zinc-900 text-zinc-700';
    }
    if (count === 1) {
      // 1 persona: Violación de Regla de 2 (alerta visible)
      return 'bg-rose-950/70 border-rose-800/70 text-rose-300 font-semibold';
    }
    if (count === 2) {
      return 'bg-emerald-800/80 border-emerald-700 text-emerald-100 font-semibold';
    }
    if (count <= 4) {
      return 'bg-emerald-600 border-emerald-500 text-white font-bold';
    }
    return 'bg-emerald-500 border-emerald-400 text-white font-extrabold';
  };

  // Alternar un bloque al arrastrar o hacer clic
  const toggleSlot = (key: string, forceAction?: 'add' | 'remove') => {
    if (viewMode !== 'mine') return;
    setMySlots((prev) => {
      const next = new Set(prev);
      const action = forceAction ?? (next.has(key) ? 'remove' : 'add');
      if (action === 'add') next.add(key);
      else next.delete(key);
      return next;
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Drag & Paint con ratón
  const handleMouseDown = (key: string) => {
    if (viewMode !== 'mine') return;
    isDraggingRef.current = true;
    const action = mySlots.has(key) ? 'remove' : 'add';
    dragActionRef.current = action;
    toggleSlot(key, action);
  };

  const handleMouseEnter = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;
    setHoveredSlot({ dayIndex, time });

    if (viewMode === 'mine' && isDraggingRef.current) {
      toggleSlot(key, dragActionRef.current);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Drag para celular
  const handleTouchStart = (key: string, dayIndex: number, time: string) => {
    setHoveredSlot({ dayIndex, time });
    if (viewMode !== 'mine') return;
    isDraggingRef.current = true;
    const action = mySlots.has(key) ? 'remove' : 'add';
    dragActionRef.current = action;
    toggleSlot(key, action);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const key = el?.getAttribute('data-slot-key');
    const dayStr = el?.getAttribute('data-day');
    const timeStr = el?.getAttribute('data-time');

    if (dayStr && timeStr) {
      setHoveredSlot({ dayIndex: parseInt(dayStr, 10), time: timeStr });
    }

    if (viewMode === 'mine' && isDraggingRef.current && key) {
      toggleSlot(key, dragActionRef.current);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Accesos rápidos de plantilla
  const handlePreset = (type: 'all' | 'work' | 'afternoon' | 'clear') => {
    const next = new Set(mySlots);
    if (type === 'clear') {
      next.clear();
    } else {
      DAYS.forEach((d) => {
        if (d.index === 0) return; // Omitir domingo por defecto en plantilla escolar
        TIME_SLOTS.forEach((t) => {
          const [h] = t.split(':').map(Number);
          const key = `${d.index}_${t}`;
          if (type === 'work' && h >= 8 && h < 14) next.add(key);
          if (type === 'afternoon' && h >= 14 && h < 20) next.add(key);
          if (type === 'all') next.add(key);
        });
      });
    }
    setMySlots(next);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Guardar en la base de datos
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const slotsByDay = new Map<number, number[]>();
      mySlots.forEach((key) => {
        const [dayStr, time] = key.split('_');
        const day = parseInt(dayStr, 10);
        const [h, m] = time.split(':').map(Number);
        const minutes = h * 60 + m;

        if (!slotsByDay.has(day)) slotsByDay.set(day, []);
        slotsByDay.get(day)!.push(minutes);
      });

      const payload: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[] = [];

      slotsByDay.forEach((minutesArr, day) => {
        minutesArr.sort((a, b) => a - b);
        let start = minutesArr[0];
        let end = minutesArr[0] + 30;

        for (let i = 1; i < minutesArr.length; i++) {
          if (minutesArr[i] === end) {
            end += 30;
          } else {
            const sH = Math.floor(start / 60).toString().padStart(2, '0');
            const sM = (start % 60).toString().padStart(2, '0');
            const eH = Math.floor(end / 60).toString().padStart(2, '0');
            const eM = (end % 60).toString().padStart(2, '0');
            payload.push({
              day_of_week: day,
              start_time: `${sH}:${sM}:00`,
              end_time: `${eH}:${eM}:00`,
              is_recurring: true,
            });
            start = minutesArr[i];
            end = start + 30;
          }
        }
        if (minutesArr.length > 0) {
          const sH = Math.floor(start / 60).toString().padStart(2, '0');
          const sM = (start % 60).toString().padStart(2, '0');
          const eH = Math.floor(end / 60).toString().padStart(2, '0');
          const eM = (end % 60).toString().padStart(2, '0');
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
      alert('Error al guardar horarios');
    } finally {
      setIsSaving(false);
    }
  };

  // Datos del bloque inspeccionado para el panel lateral When2Meet
  const inspectedData = useMemo(() => {
    if (!hoveredSlot) return null;
    const key = `${hoveredSlot.dayIndex}_${hoveredSlot.time}`;
    const userIds = teamAvailabilityMap.get(key) || new Set();
    const dayObj = DAYS.find((d) => d.index === hoveredSlot.dayIndex);

    const available = profiles.filter((p) => userIds.has(p.id));
    const unavailable = profiles.filter((p) => !userIds.has(p.id));

    // Calcular fin de bloque (30 min después)
    const [h, m] = hoveredSlot.time.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    return {
      dayName: dayObj?.name || '',
      startTime: hoveredSlot.time,
      endTime,
      available,
      unavailable,
      count: available.length,
      total: profiles.length,
    };
  }, [hoveredSlot, teamAvailabilityMap, profiles]);

  return (
    <div 
      className="flex flex-col h-full bg-[#09090b] text-zinc-100 select-none"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      {/* BARRA SUPERIOR DE CONTROL ESTILO WHEN2MEET */}
      <div className="p-3 sm:p-4 bg-zinc-950/80 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Selector de modo estilo When2Meet: Tu horario vs Mapa Grupal */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-start">
          <button
            type="button"
            onClick={() => setViewMode('mine')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'mine'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ✏️ Mi Disponibilidad
          </button>
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'team'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            👥 Disponibilidad Grupal
          </button>
        </div>

        {/* Acciones y Botón de Guardar */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {viewMode === 'mine' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset('work')}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
                title="Marcar L-V 8:00 a 14:00"
              >
                L-V Mañana
              </button>
              <button
                type="button"
                onClick={() => handlePreset('afternoon')}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
                title="Marcar L-V 14:00 a 20:00"
              >
                L-V Tarde
              </button>
              <button
                type="button"
                onClick={() => handlePreset('clear')}
                className="text-[11px] p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300 transition-colors"
                title="Limpiar toda la semana"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {viewMode === 'mine' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
                hasChanges
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20'
                  : saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <span>{isSaving ? 'Guardando...' : 'Guardar Horario'}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Explicación rápida */}
      <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800/60 text-[11px] text-zinc-400 flex items-center justify-between">
        <span>
          {viewMode === 'mine'
            ? 'Arrastra o toca sobre los cuadros verdes para indicar tus horas disponibles.'
            : 'Pasa el cursor o toca cualquier cuadro para ver quiénes pueden asistir en ese horario.'}
        </span>
        {viewMode === 'team' && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-zinc-500">0</span>
            <span className="w-3 h-3 rounded bg-zinc-900 border border-zinc-800" />
            <span className="text-rose-400">1 (Alerta)</span>
            <span className="w-3 h-3 rounded bg-rose-950 border border-rose-800" />
            <span className="text-emerald-400">2+ (Cubierto)</span>
            <span className="w-3 h-3 rounded bg-emerald-500" />
          </div>
        )}
      </div>

      {/* ÁREA PRINCIPAL: CUADRÍCULA WHEN2MEET + PANEL LATERAL */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* TABLA PRINCIPAL DE CUADRÍCULA (WHEN2MEET GRID) */}
        <div 
          ref={gridContainerRef}
          onTouchMove={handleTouchMove}
          className="flex-1 overflow-auto touch-paint-area p-2 sm:p-4"
        >
          {/* Contenedor con scroll horizontal garantizado en móvil */}
          <div className="inline-block min-w-[620px] w-full border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950">
            {/* Cabecera de días (Columnas When2Meet) */}
            <div className="grid grid-cols-8 bg-zinc-900/90 border-b border-zinc-800 sticky top-0 z-10 text-center font-medium text-xs">
              <div className="py-2.5 text-zinc-500 font-mono text-[11px] border-r border-zinc-800/80">
                Hora
              </div>
              {DAYS.map((day) => (
                <div 
                  key={day.index}
                  className="py-2.5 text-zinc-200 border-r border-zinc-800/80 last:border-r-0 font-semibold text-xs tracking-tight"
                >
                  {day.name}
                </div>
              ))}
            </div>

            {/* Filas de intervalos de 30 minutos */}
            <div className="divide-y divide-zinc-900">
              {TIME_SLOTS.map((time) => {
                const isHourStart = time.endsWith(':00');

                return (
                  <div key={time} className="grid grid-cols-8 items-stretch">
                    {/* Eje de tiempo a la izquierda */}
                    <div 
                      className={`text-[10px] font-mono text-center flex items-center justify-center border-r border-zinc-800/80 ${
                        isHourStart ? 'text-zinc-300 font-semibold bg-zinc-900/30' : 'text-zinc-600'
                      }`}
                    >
                      {time}
                    </div>

                    {/* Bloques de cada día */}
                    {DAYS.map((day) => {
                      const slotKey = `${day.index}_${time}`;
                      const isHovered = hoveredSlot?.dayIndex === day.index && hoveredSlot?.time === time;
                      const visualClass = getCellVisual(day.index, time);

                      const count = viewMode === 'team' 
                        ? (teamAvailabilityMap.get(slotKey) || new Set()).size 
                        : 0;

                      return (
                        <div
                          key={slotKey}
                          data-slot-key={slotKey}
                          data-day={day.index}
                          data-time={time}
                          onMouseDown={() => handleMouseDown(slotKey)}
                          onMouseEnter={() => handleMouseEnter(day.index, time)}
                          onTouchStart={() => handleTouchStart(slotKey, day.index, time)}
                          className={`h-7 border-r border-zinc-900 last:border-r-0 flex items-center justify-center cursor-pointer transition-colors text-xs ${visualClass} ${
                            isHovered ? 'ring-2 ring-white/80 z-20' : ''
                          }`}
                        >
                          {viewMode === 'team' && count > 0 && (
                            <span className="text-[11px] leading-none">
                              {count === 1 ? '1' : count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PANEL LATERAL DE DETALLE WHEN2MEET (INSPECTOR DE PARTICIPANTES) */}
        <div className="w-full lg:w-72 bg-zinc-950 border-t lg:border-t-0 lg:border-l border-zinc-800/80 p-4 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-zinc-800/80 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Horario seleccionado</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {inspectedData?.dayName} {inspectedData?.startTime} - {inspectedData?.endTime}
              </div>
            </div>

            {/* Resumen de Disponibilidad */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-zinc-200">
                  Disponibles ({inspectedData?.count || 0}/{inspectedData?.total || 0})
                </span>
                {inspectedData && inspectedData.count === 1 && (
                  <span className="text-[10px] text-rose-400 font-semibold bg-rose-950/60 border border-rose-800 px-1.5 py-0.5 rounded">
                    ⚠️ 1 persona sola
                  </span>
                )}
                {inspectedData && inspectedData.count >= 2 && (
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                    ✓ Regla de 2 OK
                  </span>
                )}
              </div>

              {/* Lista de Personas Disponibles */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mb-4">
                {inspectedData?.available.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic py-1">
                    Nadie disponible en este horario.
                  </div>
                ) : (
                  inspectedData?.available.map((p) => (
                    <div 
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-medium text-zinc-200">{p.full_name}</span>
                      </div>
                      {p.id === currentUserId && (
                        <span className="text-[10px] text-zinc-500">(Tú)</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Lista de No Disponibles */}
              <div className="text-xs font-semibold text-zinc-400 mb-1.5">
                No disponibles ({inspectedData?.unavailable.length || 0})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {inspectedData?.unavailable.map((p) => (
                  <div 
                    key={p.id}
                    className="flex items-center gap-2 py-1 px-2 rounded text-[11px] text-zinc-500"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                    <span>{p.full_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500">
            Los horarios se actualizan en vivo para todo el equipo.
          </div>
        </div>
      </div>
    </div>
  );
}
