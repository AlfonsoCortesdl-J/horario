import type { PresenceWindow, CoverageSlot, Profile } from '../../types/database.ts';

export interface CoverageCalculationOptions {
  slotIntervalMinutes?: number;
  minPresenceRequired?: number;
  adminCountsForCoverage?: boolean;
  operatingHoursStart?: string; // '07:00'
  operatingHoursEnd?: string;   // '23:00'
}

export interface WindowImpactAnalysis {
  hasSoloViolation: boolean;
  soloSlotsCount: number;
  affectedSlots: {
    start: Date;
    end: Date;
    remainingUsers: string[];
    remainingUserIds: string[];
    count: number;
  }[];
  affectedUserNames: string[];
  suggestedCompanions?: string[];
}

/**
 * Normaliza y compara traslapes de ventanas en bloques regulares de 30 minutos
 */
export function calculateCoverageSlots(
  windows: (PresenceWindow & { profiles?: Profile })[],
  rangeStart: Date,
  rangeEnd: Date,
  options: CoverageCalculationOptions = {}
): CoverageSlot[] {
  const intervalMin = options.slotIntervalMinutes ?? 30;
  const minRequired = options.minPresenceRequired ?? 2;
  const adminCounts = options.adminCountsForCoverage ?? true;

  // Filtrar ventanas no canceladas
  const activeWindows = windows.filter((w) => w.status !== 'cancelled');

  const slots: CoverageSlot[] = [];
  const stepMs = intervalMin * 60 * 1000;

  let currentSlotMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  while (currentSlotMs < endMs) {
    const slotStartDate = new Date(currentSlotMs);
    const slotEndDate = new Date(currentSlotMs + stepMs);

    // Buscar ventanas activas que se traslapen con [slotStartDate, slotEndDate)
    const overlapping = activeWindows.filter((w) => {
      const wStart = new Date(w.start_time).getTime();
      const wEnd = new Date(w.end_time).getTime();
      return wStart < slotEndDate.getTime() && wEnd > slotStartDate.getTime();
    });

    // Contar usuarios respetando si admin cuenta o no
    const uniqueUserMap = new Map<string, { id: string; name: string; role?: string }>();
    overlapping.forEach((w) => {
      const userId = w.user_id;
      const role = w.profiles?.role;
      const name = w.profiles?.full_name || 'Miembro';

      if (!adminCounts && role === 'admin') {
        // El admin no cuenta para el quorum si está deshabilitado en configuración
        return;
      }
      uniqueUserMap.set(userId, { id: userId, name, role });
    });

    const personCount = uniqueUserMap.size;
    const userIds = Array.from(uniqueUserMap.keys());
    const userNames = Array.from(uniqueUserMap.values()).map((u) => u.name);

    let status: 'empty' | 'solo' | 'covered' = 'empty';
    if (personCount === 0) {
      status = 'empty';
    } else if (personCount < minRequired) {
      status = 'solo'; // Violación regla de 2 (ROJO)
    } else {
      status = 'covered'; // 2 o más (VERDE)
    }

    slots.push({
      slot_start: slotStartDate.toISOString(),
      slot_end: slotEndDate.toISOString(),
      person_count: personCount,
      user_ids: userIds,
      user_names: userNames,
      status,
    });

    currentSlotMs += stepMs;
  }

  return slots;
}

/**
 * Evalúa el impacto de agregar, modificar o cancelar una ventana antes de ejecutar la acción
 */
export function analyzePresenceChangeImpact(
  currentWindows: (PresenceWindow & { profiles?: Profile })[],
  candidate: {
    id?: string;
    user_id: string;
    user_name?: string;
    start_time: string | Date;
    end_time: string | Date;
  },
  action: 'CREATE' | 'UPDATE' | 'CANCEL',
  options: CoverageCalculationOptions = {}
): WindowImpactAnalysis {
  const minRequired = options.minPresenceRequired ?? 2;
  const candStart = new Date(candidate.start_time);
  const candEnd = new Date(candidate.end_time);

  if (action === 'CANCEL') {
    // Al cancelar: calculamos qué pasa si quitamos esta ventana
    // ¿Queda alguien más solo en los bloques que cubría esta ventana?
    const remainingWindows = currentWindows.filter(
      (w) => w.id !== candidate.id && w.status !== 'cancelled'
    );

    const affectedSlotsCoverage = calculateCoverageSlots(
      remainingWindows,
      candStart,
      candEnd,
      options
    );

    const soloSlots = affectedSlotsCoverage.filter(
      (s) => s.person_count === 1 && !s.user_ids.includes(candidate.user_id)
    );

    const affectedNamesSet = new Set<string>();
    soloSlots.forEach((s) => s.user_names.forEach((name) => affectedNamesSet.add(name)));

    return {
      hasSoloViolation: soloSlots.length > 0,
      soloSlotsCount: soloSlots.length,
      affectedSlots: soloSlots.map((s) => ({
        start: new Date(s.slot_start),
        end: new Date(s.slot_end),
        remainingUsers: s.user_names,
        remainingUserIds: s.user_ids,
        count: s.person_count,
      })),
      affectedUserNames: Array.from(affectedNamesSet),
    };
  }

  // Al crear o actualizar: evaluamos si la nueva ventana tiene tramos solos
  // Creamos una lista simulada con la nueva ventana
  const simulatedWindows = currentWindows
    .filter((w) => (candidate.id ? w.id !== candidate.id : true))
    .concat([
      {
        id: candidate.id || 'candidate-temp',
        user_id: candidate.user_id,
        start_time: candStart.toISOString(),
        end_time: candEnd.toISOString(),
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: candidate.user_name
          ? ({ id: candidate.user_id, full_name: candidate.user_name } as Profile)
          : undefined,
      },
    ]);

  const simulatedSlots = calculateCoverageSlots(simulatedWindows, candStart, candEnd, options);
  const soloSlots = simulatedSlots.filter((s) => s.person_count < minRequired);

  return {
    hasSoloViolation: soloSlots.length > 0,
    soloSlotsCount: soloSlots.length,
    affectedSlots: soloSlots.map((s) => ({
      start: new Date(s.slot_start),
      end: new Date(s.slot_end),
      remainingUsers: s.user_names,
      remainingUserIds: s.user_ids,
      count: s.person_count,
    })),
    affectedUserNames: [candidate.user_name || 'Tú'],
  };
}
