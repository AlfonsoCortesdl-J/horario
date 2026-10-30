'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AvailabilitySlot, Profile } from '@/types/database';
import { 
  Users, 
  Trash2, 
  Clock, 
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
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

  // Filtro de día en celular: 'all' (todos los días con scroll) o 1-6, 0 (día individual optimizado a pantalla completa)
  const [activeDayFilter, setActiveDayFilter] = useState<number | 'all'>('all');

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

  // Mostrar/ocultar inspector en celular
  const [showMobileInspector, setShowMobileInspector] = useState(false);

  // Arrastre con ratón en desktop
  const isMouseDownRef = useRef(false);
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

  // Color de celda
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

  // Click o Tap en un bloque
  const handleCellClick = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;
    setHoveredSlot({ dayIndex, time });

    if (viewMode === 'mine') {
      toggleSlot(key);
    } else {
      setShowMobileInspector(true);
    }
  };

  // Arrastre con ratón (Desktop)
  const handleMouseDown = (key: string, dayIndex: number, time: string) => {
    if (viewMode !== 'mine') return;
    isMouseDownRef.current = true;
    const action = mySlots.has(key) ? 'remove' : 'add';
    dragActionRef.current = action;
    toggleSlot(key, action);
    setHoveredSlot({ dayIndex, time });
  };

  const handleMouseEnter = (dayIndex: number, time: string) => {
    const key = `${dayIndex}_${time}`;
    setHoveredSlot({ dayIndex, time });

    if (viewMode === 'mine' && isMouseDownRef.current) {
      toggleSlot(key, dragActionRef.current);
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  // Presets para día específico
  const handleDayPreset = (dayIndex: number, type: 'all' | 'work' | 'afternoon' | 'clear') => {
    const next = new Set(mySlots);
    TIME_SLOTS.forEach((t) => {
      const [h] = t.split(':').map(Number);
      const key = `${dayIndex}_${t}`;
      if (type === 'clear') {
        next.delete(key);
      } else if (type === 'work' && h >= 8 && h < 14) {
        next.add(key);
      } else if (type === 'afternoon' && h >= 14 && h < 20) {
        next.add(key);
      } else if (type === 'all' && h >= 8 && h < 20) {
        next.add(key);
      }
    });
    setMySlots(next);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Accesos rápidos globales
  const handleGlobalPreset = (type: 'all' | 'work' | 'afternoon' | 'clear') => {
    const next = new Set(mySlots);
    if (type === 'clear') {
      next.clear();
    } else {
      DAYS.forEach((d) => {
        if (d.index === 0) return; // omitir domingo en plantillas rápidas
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

  // Datos del bloque inspeccionado para el panel lateral When2Meet
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

  // Días que se van a renderizar según el filtro
  const displayedDays = activeDayFilter === 'all'
    ? DAYS
    : DAYS.filter((d) => d.index === activeDayFilter);

  return (
    <div 
      className="flex flex-col h-full bg-[#09090b] text-zinc-100 select-none"
      onMouseUp={handleMouseUp}
    >
      {/* ── BARRA SUPERIOR DE CONTROL ─────────────────────────────────── */}
      <div className="p-3 bg-zinc-950/90 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Selector de modo: Mi Disponibilidad vs Mapa Grupal */}
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
            👥 Mapa Grupal
          </button>
        </div>

        {/* Acciones y Botón Guardar */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {viewMode === 'mine' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleGlobalPreset('work')}
                className="text-[11px] px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
                title="L-V 8:00 a 14:00"
              >
                Mañana
              </button>
              <button
                type="button"
                onClick={() => handleGlobalPreset('afternoon')}
                className="text-[11px] px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
                title="L-V 14:00 a 20:00"
              >
                Tarde
              </button>
              <button
                type="button"
                onClick={() => handleGlobalPreset('clear')}
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
              className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all flex-shrink-0 ${
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

      {/* ── SELECTOR DE DÍA PARA CELULAR (Soluciona que el horario se vea gigante) ── */}
      <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-zinc-500 mr-1 flex-shrink-0">
          Ver:
        </span>
        <button
          type="button"
          onClick={() => setActiveDayFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            activeDayFilter === 'all'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          Toda la semana
        </button>

        {DAYS.map((d) => (
          <button
            key={d.index}
            type="button"
            onClick={() => setActiveDayFilter(d.index)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              activeDayFilter === d.index
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {d.short}
          </button>
        ))}
      </div>

      {/* Sub-barra de acciones rápidas para el día individual seleccionado */}
      {typeof activeDayFilter === 'number' && viewMode === 'mine' && (
        <div className="px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <span className="text-zinc-300 font-medium text-[11px]">
            {DAYS.find((d) => d.index === activeDayFilter)?.name}:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleDayPreset(activeDayFilter, 'all')}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              Todo el día
            </button>
            <button
              type="button"
              onClick={() => handleDayPreset(activeDayFilter, 'work')}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              8-14
            </button>
            <button
              type="button"
              onClick={() => handleDayPreset(activeDayFilter, 'afternoon')}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              14-20
            </button>
            <button
              type="button"
              onClick={() => handleDayPreset(activeDayFilter, 'clear')}
              className="text-[10px] px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Explicación y leyenda de color */}
      <div className="px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800/60 text-[11px] text-zinc-400 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="truncate">
            {viewMode === 'mine'
              ? 'Toca cualquier bloque para marcar o desmarcar tu horario.'
              : 'Toca un bloque para inspeccionar quiénes pueden asistir.'}
          </span>
        </div>
        {viewMode === 'team' && (
          <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0">
            <span className="text-rose-400 font-semibold">1</span>
            <span className="w-2.5 h-2.5 rounded bg-rose-950 border border-rose-800" />
            <span className="text-emerald-400 font-semibold">2+</span>
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
          </div>
        )}
      </div>

      {/* ── ÁREA PRINCIPAL: CUADRÍCULA CON SCROLL LIBRE Y COLUMNAS STICKY ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* Contenedor con scroll táctil suave en ambas direcciones */}
        <div 
          className="flex-1 overflow-x-auto overflow-y-auto touch-paint-area p-2 sm:p-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Si se ve 1 solo día en celular, se adapta al 100% del ancho sin romper */}
          <div className={`border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950 ${
            activeDayFilter === 'all' ? 'min-w-[540px] sm:min-w-[620px]' : 'w-full max-w-md mx-auto'
          }`}>
            {/* Cabecera de días (Sticky en scroll vertical) */}
            <div className={`grid ${
              activeDayFilter === 'all' ? 'grid-cols-8' : 'grid-cols-4 sm:grid-cols-3'
            } bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30 text-center font-medium text-xs`}>
              {/* Esquina superior izquierda (Sticky horizontal y vertical) */}
              <div className="py-2 text-zinc-400 font-mono text-[11px] border-r border-zinc-800 sticky left-0 z-40 bg-zinc-900">
                Hora
              </div>

              {displayedDays.map((day) => (
                <div 
                  key={day.index}
                  className={`py-2 text-zinc-200 border-r border-zinc-800/80 last:border-r-0 font-semibold text-xs tracking-tight ${
                    activeDayFilter !== 'all' ? 'col-span-3 sm:col-span-2' : ''
                  }`}
                >
                  <span className="hidden sm:inline">{day.name}</span>
                  <span className="sm:hidden">{activeDayFilter !== 'all' ? day.name : day.short}</span>
                </div>
              ))}
            </div>

            {/* Filas de intervalos de 30 minutos */}
            <div className="divide-y divide-zinc-900">
              {TIME_SLOTS.map((time) => {
                const isHourStart = time.endsWith(':00');

                return (
                  <div 
                    key={time} 
                    className={`grid ${
                      activeDayFilter === 'all' ? 'grid-cols-8' : 'grid-cols-4 sm:grid-cols-3'
                    } items-stretch`}
                  >
                    {/* Eje de tiempo a la izquierda (Sticky horizontal) */}
                    <div 
                      className={`text-[10px] font-mono text-center flex items-center justify-center border-r border-zinc-800 sticky left-0 z-20 bg-zinc-950 ${
                        isHourStart ? 'text-zinc-200 font-semibold bg-zinc-900/60' : 'text-zinc-500'
                      }`}
                    >
                      {time}
                    </div>

                    {/* Bloques de los días visualizados */}
                    {displayedDays.map((day) => {
                      const slotKey = `${day.index}_${time}`;
                      const isHovered = hoveredSlot?.dayIndex === day.index && hoveredSlot?.time === time;
                      const visualClass = getCellVisual(day.index, time);

                      const count = viewMode === 'team' 
                        ? (teamAvailabilityMap.get(slotKey) || new Set()).size 
                        : 0;

                      const isMarked = mySlots.has(slotKey);

                      return (
                        <div
                          key={slotKey}
                          onClick={() => handleCellClick(day.index, time)}
                          onMouseDown={() => handleMouseDown(slotKey, day.index, time)}
                          onMouseEnter={() => handleMouseEnter(day.index, time)}
                          className={`h-7 sm:h-6 border-r border-zinc-900 last:border-r-0 flex items-center justify-center cursor-pointer transition-colors text-xs ${visualClass} ${
                            isHovered ? 'ring-2 ring-white/90 z-10' : ''
                          } ${activeDayFilter !== 'all' ? 'col-span-3 sm:col-span-2' : ''}`}
                        >
                          {viewMode === 'mine' ? (
                            isMarked && (
                              <span className="text-[10px] text-white/90">✓</span>
                            )
                          ) : (
                            count > 0 && (
                              <span className="text-[11px] leading-none font-bold">
                                {count}
                              </span>
                            )
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

        {/* ── PANEL LATERAL DE DETALLE WHEN2MEET (DESKTOP) ── */}
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

              {/* Lista de No Disponibles */}
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
            Toca o pasa el cursor para inspeccionar cualquier celda.
          </div>
        </div>

        {/* ── BARRA FLOTANTE COMPACTA EN CELULAR PARA INSPECCIONAR GRUPO ── */}
        {viewMode === 'team' && inspectedData && (
          <div className="lg:hidden absolute bottom-2 left-2 right-2 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3 shadow-xl backdrop-blur-md z-30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{inspectedData.dayName} {inspectedData.startTime} - {inspectedData.endTime}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
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
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
              >
                {showMobileInspector ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Desplegable detallado si se expande */}
            {showMobileInspector && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80 max-h-48 overflow-y-auto space-y-2">
                <div className="text-[11px] font-semibold text-emerald-400">
                  Disponibles ({inspectedData.count}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {inspectedData.available.map((p) => (
                    <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      {p.full_name}
                    </span>
                  ))}
                  {inspectedData.available.length === 0 && (
                    <span className="text-[10px] text-zinc-500 italic">Ningún integrante</span>
                  )}
                </div>

                <div className="text-[11px] font-semibold text-zinc-500 pt-1">
                  No disponibles ({inspectedData.unavailable.length}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {inspectedData.unavailable.map((p) => (
                    <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
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
