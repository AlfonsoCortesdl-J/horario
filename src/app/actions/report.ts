'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { getLastSaturdayResetUtc } from './availability';

export interface MemberReportRow {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  totalSlots: number;
  totalHours: number;
  days: string[];
  earliestStart: string;
  latestEnd: string;
}

export interface WeeklyReportData {
  generatedBy: string;
  generatedById: string;
  generatedAt: string;
  weekStart: string;
  reportTitle: string;
  isPartial: boolean;
  activities: string;          // descripción de actividades realizadas
  engineerNotes: string;       // notas del ingeniero (pendientes, continuación)
  members: MemberReportRow[];
  totalActiveMembers: number;
  teamTotalHours: number;
  mostActiveDay: string;
  coverageByDay: Record<string, number>;
}

export interface TeamMemberOption {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Devuelve la lista completa de miembros activos del equipo (para el selector).
 */
export async function getTeamMemberOptions(): Promise<TeamMemberOption[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('is_active', true)
    .order('full_name');

  if (error) throw new Error(error.message);

  return (data || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
  }));
}

/**
 * Genera el reporte de disponibilidad semanal.
 *
 * @param selectedMemberIds  Si se pasa, el reporte solo incluye esos miembros.
 *                           Si es undefined o vacío, incluye a todos.
 * @param reportTitle        Título opcional para el reporte (ej. "Proyecto X").
 */
export async function generateWeeklyReport(
  selectedMemberIds?: string[],
  reportTitle?: string,
  activities?: string,
  engineerNotes?: string,
): Promise<WeeklyReportData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();

  // Quién genera el reporte
  const { data: me } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const lastResetUtc = await getLastSaturdayResetUtc();

  // Construir query de perfiles (todos o solo los seleccionados)
  const hasFilter = selectedMemberIds && selectedMemberIds.length > 0;

  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('is_active', true);

  if (hasFilter) {
    profilesQuery = profilesQuery.in('id', selectedMemberIds);
  }

  const [slotsRes, profilesRes] = await Promise.all([
    supabase
      .from('availability_slots')
      .select('*')
      .gte('created_at', lastResetUtc),
    profilesQuery,
  ]);

  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const allSlots = slotsRes.data || [];
  const profiles = profilesRes.data || [];

  // Solo slots de los miembros incluidos en el reporte
  const profileIds = new Set(profiles.map((p) => p.id));
  const slots = hasFilter
    ? allSlots.filter((s) => profileIds.has(s.user_id))
    : allSlots;

  // Agrupar slots por usuario
  const slotsByUser: Record<string, typeof slots> = {};
  for (const s of slots) {
    if (!slotsByUser[s.user_id]) slotsByUser[s.user_id] = [];
    slotsByUser[s.user_id].push(s);
  }

  // Cobertura por día (solo miembros del reporte)
  const coverageByDayCount: Record<number, Set<string>> = {};
  for (const s of slots) {
    if (!coverageByDayCount[s.day_of_week]) coverageByDayCount[s.day_of_week] = new Set();
    coverageByDayCount[s.day_of_week].add(s.user_id);
  }

  const coverageByDay: Record<string, number> = {};
  for (const [dayNum, users] of Object.entries(coverageByDayCount)) {
    coverageByDay[DAY_NAMES[Number(dayNum)]] = users.size;
  }

  // Día con más cobertura
  let mostActiveDay = '—';
  let maxCoverage = 0;
  for (const [day, count] of Object.entries(coverageByDay)) {
    if (count > maxCoverage) {
      maxCoverage = count;
      mostActiveDay = day;
    }
  }

  // Construir filas por miembro
  const members: MemberReportRow[] = profiles.map((p) => {
    const userSlots = slotsByUser[p.id] || [];
    let totalMinutes = 0;
    const daysSet = new Set<string>();
    let earliestMin = 24 * 60;
    let latestMin = 0;

    for (const s of userSlots) {
      const start = parseHHMM(s.start_time);
      const end = parseHHMM(s.end_time);
      totalMinutes += Math.max(0, end - start);
      daysSet.add(DAY_NAMES[s.day_of_week]);
      if (start < earliestMin) earliestMin = start;
      if (end > latestMin) latestMin = end;
    }

    const toHHMM = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    return {
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
      totalSlots: userSlots.length,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      days: [...daysSet],
      earliestStart: userSlots.length ? toHHMM(earliestMin) : '—',
      latestEnd: userSlots.length ? toHHMM(latestMin) : '—',
    };
  });

  // Ordenar: más horas primero
  members.sort((a, b) => b.totalHours - a.totalHours);

  const teamTotalHours = members.reduce((s, m) => s + m.totalHours, 0);
  const activeMembers = members.filter((m) => m.totalSlots > 0);

  return {
    generatedBy: me?.full_name || 'Desconocido',
    generatedById: userId,
    generatedAt: new Date().toISOString(),
    weekStart: lastResetUtc,
    reportTitle: reportTitle?.trim() || 'Reporte Semanal',
    isPartial: hasFilter ? true : false,
    activities: activities?.trim() || '',
    engineerNotes: engineerNotes?.trim() || '',
    members,
    totalActiveMembers: activeMembers.length,
    teamTotalHours: Math.round(teamTotalHours * 10) / 10,
    mostActiveDay,
    coverageByDay,
  };
}
