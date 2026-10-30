'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AvailabilitySlot, Profile } from '@/types/database';
import { 
  Users, 
  Trash2, 
  Clock, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Paintbrush,
  Hand
} from 'lucide-react';

interface AvailabilityGridProps {
  currentUserId: string;
  userSlots: AvailabilitySlot[];
  allSlots: AvailabilitySlot[];
  profiles: Profile[];
  onSaveSlots: (slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]) => Promise<void>;
}

const DAYS = [
  { index: 1, name: 'Lunes', short: 'Lun', initial: 'L' },
  { index: 2, name: 'Martes', short: 'Mar', initial: 'M' },
  { index: 3, name: 'Miércoles', short: 'Mié', initial: 'M' },
  { index: 4, name: 'Jueves', short: 'Jue', initial: 'J' },
  { index: 5, name: 'Viernes', short: 'Vie', initial: 'V' },
  { index: 6, name: 'Sábado', short: 'Sáb', initial: 'S' },
  { index: 0, name: 'Domingo', short: 'Dom', initial: 'D' },
];

// Generar bloques de 30 minutos de 07:00 a 22:30
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
  // Modo de vista: 'mine' (marcar disponibilidad) o 'team' (mapa de calor grupal When2Meet)
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');

  // Modo táctil en celular: 'paint' (arrastrar para pintar continuo) vs 'scroll' (desplazar pantalla y tocar para marcar)
  const [touchMode, setTouchMode] = useState<'paint' | 'scroll'>('paint');

  // Claves de slots del usuario: "dayIndex_HH:mm"
  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Slot inspeccionado en el mapa de calor
  const [hoveredSlot, setHoveredSlot] = useState<{ dayIndex: number; time: string } | null>({
    dayIndex: 1,
    time: '09:00',
  });

  const [showMobileInspector, setShowMobileInspector] = useState(false);

  // Arrastre tipo When2Meet (tanto mouse como touch)
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef<'add' | 'remove'>('add');

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

  // Color de celda compacto
  const getCellVisual = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;

    if (viewMode === 'mine') {
      const isMarked = mySlots.has(key);
      if (isMarked) {
        return 'bg-emerald-500 border-emerald-400 text-white font-bold';
      }
      return 'bg-zinc-950 border-zinc-800/60 text-transparent hover:bg-zinc-800/50';
    }

    // Modo equipo (Heatmap grupal When2Meet)
    const userIds = teamAvailabilityMap.get(key) || new Set();
    const count = userIds.size;

    if (count === 0) {
      return 'bg-zinc-950 border-zinc-900 text-transparent';
    }
    if (count === 1) {
      return 'bg-rose-950/80 border-rose-800/80 text-rose-300 font-bold';
    }
    if (count === 2) {
      return 'bg-emerald-800/90 border-emerald-700 text-emerald-100 font-bold';
    }
    if (count <= 4) {
      return 'bg-emerald-600 border-emerald-500 text-white font-extrabold';
    }
    return 'bg-emerald-500 border-emerald-400 text-white font-extrabold';
  };

  // Alternar un bloque
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

  // ── MANEJADORES DE MOUSE (DESKTOP) ──────────────────────────────────────────
  const handleMouseDown = (key: string, dayIndex: number, time: string) => {
    if (viewMode !== 'mine') return;
    isDraggingRef.current = true;
    const action = mySlots.has(key) ? 'remove' : 'add';
    dragActionRef.current = action;
    toggleSlot(key, action);
    setHoveredSlot({ dayIndex, time });
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

  // ── MANEJADORES TÁCTILES (CELULAR / TABLET) ────────────────────────────────
  const handleTouchStart = (key: string, dayIndex: number, time: string) => {
    setHoveredSlot({ dayIndex, time });

    if (viewMode !== 'mine') {
      setShowMobileInspector(true);
      return;
    }

    if (touchMode === 'paint') {
      isDraggingRef.current = true;
      const action = mySlots.has(key) ? 'remove' : 'add';
      dragActionRef.current = action;
      toggleSlot(key, action);
    } else {
      // Modo mover: un tap directo marca o desmarca
      toggleSlot(key);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchMode !== 'paint' || viewMode !== 'mine' || !isDraggingRef.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const key = el?.getAttribute('data-slot-key');
    const dayStr = el?.getAttribute('data-day');
    const timeStr = el?.getAttribute('data-time');

    if (dayStr && timeStr) {
      setHoveredSlot({ dayIndex: parseInt(dayStr, 10), time: timeStr });
    }

    if (key) {
      toggleSlot(key, dragActionRef.current);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Accesos rápidos globales
  const handleGlobalPreset = (type: 'all' | 'work' | 'afternoon' | 'clear') => {
    const next = new Set(mySlots);
    if (type === 'clear') {
      next.clear();
    } else {
      DAYS.forEach((d) => {
        if (d.index === 0) return; // omitir domingo en plantillas de escuela
        TIME_SLOTS.forEach((t) => {
          const [h] = t.split(':').map(Number);
          const key = `${d.index}_${t}`;
          if (type === 'work' && h >= 8 && h < 14) next.add(key);
          if (type === 'afternoon' && h >= 14 && h < 20) next.add(key);
          if (type === 'all' && h >= 8 && h < 20) next.add(key);
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

      const slotsToSave: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[] = [];

      slotsByDay.forEach((minutesArray, day) => {
        minutesArray.sort((a, b) => a - b);

        let rangeStart = minutesArray[0];
        let prev = minutesArray[0];

        for (let i = 1; i <= minutesArray.length; i++) {
          const curr = minutesArray[i];
          if (curr !== prev + 30) {
            const rangeEnd = prev + 30;
            const startH = Math.floor(rangeStart / 60);
            const startM = rangeStart % 60;
            const endH = Math.floor(rangeEnd / 60);
            const endM = rangeEnd % 60;

            slotsToSave.push({
              day_of_week: day,
              start_time: `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}:00`,
              end_time: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`,
              is_recurring: true,
            });

            rangeStart = curr;
          }
          prev = curr;
        }
      });

      await onSaveSlots(slotsToSave);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar horario');
    } finally {
      setIsSaving(false);
    }
  };

  // Datos inspeccionados para el panel lateral / flotante
  const inspectedData = useMemo(() => {
    if (!hoveredSlot) return null;
    const key = `${hoveredSlot.dayIndex}_${hoveredSlot.time}`;
    const userIds = teamAvailabilityMap.get(key) || new Set();
    const dayObj = DAYS.find((d) => d.index === hoveredSlot.dayIndex);

    const available = profiles.filter((p) => userIds.has(p.id));
    const unavailable = profiles.filter((p) => !userIds.has(p.id));

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
      {/* ── BARRA DE CONTROL COMPACTA ─────────────────────────────────── */}
      <div className="p-2 sm:p-3 bg-zinc-950/90 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          {/* Selector Mi Horario vs Grupal */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'mine'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ✏️ Mi Horario
            </button>
            <button
              type="button"
              onClick={() => setViewMode('team')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'team'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              👥 Grupo
            </button>
          </div>

          {/* Selector táctil en celular: Pintar con arrastre vs Desplazar pantalla */}
          {viewMode === 'mine' && (
            <div className="flex sm:hidden items-center gap-1 p-0.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setTouchMode('paint')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  touchMode === 'paint'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400'
                }`}
                title="Desliza para pintar bloques continuos"
              >
                <Paintbrush className="w-3 h-3" />
                Pintar
              </button>
              <button
                type="button"
                onClick={() => setTouchMode('scroll')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  touchMode === 'scroll'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400'
                }`}
                title="Desliza para mover la pantalla y toca para marcar"
              >
                <Hand className="w-3 h-3" />
                Mover
              </button>
            </div>
          )}
        </div>

        {/* Acciones y Guardar */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
          {viewMode === 'mine' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleGlobalPreset('work')}
                className="text-[10px] sm:text-xs px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
              >
                8-14
              </button>
              <button
                type="button"
                onClick={() => handleGlobalPreset('afternoon')}
                className="text-[10px] sm:text-xs px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
              >
                14-20
              </button>
              <button
                type="button"
                onClick={() => handleGlobalPreset('clear')}
                className="text-[10px] sm:text-xs p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300"
                title="Limpiar horario"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {viewMode === 'mine' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all flex-shrink-0 ${
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
                  <span>¡Listo!</span>
                </>
              ) : (
                <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Indicador sutil de uso */}
      <div className="px-3 py-1 bg-zinc-950/80 border-b border-zinc-800/60 text-[10px] text-zinc-400 flex items-center justify-between">
        <span className="truncate">
          {viewMode === 'mine'
            ? touchMode === 'paint'
              ? '🖌️ Arrastra el dedo para pintar bloques. Toca "Mover" si necesitas desplazarte.'
              : '👆 Toca cualquier celda para marcar. Desliza libremente para moverte.'
            : '👥 Toca cualquier celda para ver quiénes están disponibles.'}
        </span>
        {viewMode === 'team' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-rose-400 font-bold">1</span>
            <span className="w-2 h-2 rounded bg-rose-950 border border-rose-800" />
            <span className="text-emerald-400 font-bold">2+</span>
            <span className="w-2 h-2 rounded bg-emerald-500" />
          </div>
        )}
      </div>

      {/* ── CUADRÍCULA COMPACTA ESTILO EXACTO WHEN2MEET ──────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        <div 
          onTouchMove={handleTouchMove}
          className="flex-1 overflow-x-auto overflow-y-auto p-1 sm:p-3 flex justify-center"
          style={{
            touchAction: touchMode === 'paint' && viewMode === 'mine' ? 'none' : 'pan-x pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Tamaño compacto: cabe completo en la pantalla del celular */}
          <div className="w-full max-w-[420px] sm:max-w-xl border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950 shadow-sm self-start">
            {/* Cabecera de días compacta */}
            <div className="grid grid-cols-8 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30 text-center font-medium">
              <div className="py-1.5 text-zinc-500 font-mono text-[10px] border-r border-zinc-800 sticky left-0 z-40 bg-zinc-900">
                Hora
              </div>
              {DAYS.map((day) => (
                <div 
                  key={day.index}
                  className="py-1.5 text-zinc-200 border-r border-zinc-800/60 last:border-r-0 font-bold text-[11px] sm:text-xs"
                >
                  <span className="hidden sm:inline">{day.short}</span>
                  <span className="sm:hidden">{day.initial}</span>
                </div>
              ))}
            </div>

            {/* Filas de 30 minutos ultra compactas */}
            <div className="divide-y divide-zinc-900">
              {TIME_SLOTS.map((time) => {
                const isHourStart = time.endsWith(':00');

                return (
                  <div key={time} className="grid grid-cols-8 items-stretch">
                    {/* Eje de tiempo a la izquierda */}
                    <div 
                      className={`text-[9px] font-mono text-center flex items-center justify-center border-r border-zinc-800 sticky left-0 z-20 bg-zinc-950 ${
                        isHourStart ? 'text-zinc-200 font-bold bg-zinc-900/60' : 'text-zinc-600'
                      }`}
                    >
                      {isHourStart ? time.replace(':00', 'h') : ''}
                    </div>

                    {/* Celdas de los 7 días */}
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
                          onMouseDown={() => handleMouseDown(slotKey, day.index, time)}
                          onMouseEnter={() => handleMouseEnter(day.index, time)}
                          onTouchStart={() => handleTouchStart(slotKey, day.index, time)}
                          className={`h-4 sm:h-5 border-r border-zinc-900 last:border-r-0 flex items-center justify-center cursor-pointer transition-colors text-[9px] sm:text-[10px] ${visualClass} ${
                            isHovered ? 'ring-1 ring-white z-10' : ''
                          }`}
                        >
                          {viewMode === 'team' && count > 0 && (
                            <span className="leading-none">{count}</span>
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

        {/* ── PANEL LATERAL (DESKTOP) ── */}
        <div className="hidden lg:flex w-72 bg-zinc-950 border-l border-zinc-800/80 p-4 flex-col justify-between overflow-y-auto">
          <div>
            <div className="pb-3 border-b border-zinc-800/80 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Horario inspeccionado</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {inspectedData?.dayName} {inspectedData?.startTime} - {inspectedData?.endTime}
              </div>
            </div>

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

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-4">
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

              <div className="text-xs font-semibold text-zinc-400 mb-1.5">
                No disponibles ({inspectedData?.unavailable.length || 0})
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
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
            Toca o arrastra para marcar tus horarios.
          </div>
        </div>

        {/* ── BARRA FLOTANTE COMPACTA EN CELULAR (MAPA GRUPAL) ── */}
        {viewMode === 'team' && inspectedData && (
          <div className="lg:hidden absolute bottom-2 left-2 right-2 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-2.5 shadow-xl backdrop-blur-md z-30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{inspectedData.dayName} {inspectedData.startTime} - {inspectedData.endTime}</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {inspectedData.count} disponibles: {
                    inspectedData.available.length > 0 
                      ? inspectedData.available.map((p) => p.full_name.split(' ')[0]).join(', ')
                      : 'Nadie'
                  }
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMobileInspector(!showMobileInspector)}
                className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
              >
                {showMobileInspector ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showMobileInspector && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 max-h-44 overflow-y-auto space-y-2">
                <div className="text-[10px] font-semibold text-emerald-400">
                  Disponibles ({inspectedData.count}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {inspectedData.available.map((p) => (
                    <span key={p.id} className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      {p.full_name}
                    </span>
                  ))}
                  {inspectedData.available.length === 0 && (
                    <span className="text-[9px] text-zinc-500 italic">Ninguno</span>
                  )}
                </div>

                <div className="text-[10px] font-semibold text-zinc-500 pt-1">
                  No disponibles ({inspectedData.unavailable.length}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {inspectedData.unavailable.map((p) => (
                    <span key={p.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {p.full_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
