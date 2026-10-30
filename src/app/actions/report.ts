'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { getLastSaturdayResetUtc } from './availability';

export interface MemberReportRow {
  id: string;
  full_name: string;
  role: string;
  totalSlots: number;       // cantidad de bloques marcados
  totalHours: number;       // horas totales de disponibilidad
  days: string[];           // días con disponibilidad (e.g. ["Lun", "Mié", "Vie"])
  earliestStart: string;    // hora más temprana marcada (e.g. "08:00")
  latestEnd: string;        // hora más tardía marcada (e.g. "20:00")
}

export interface WeeklyReportData {
  generatedBy: string;           // nombre del usuario que lo generó
  generatedById: string;
  generatedAt: string;           // ISO timestamp
  weekStart: string;             // ISO del último sábado reset
  members: MemberReportRow[];
  totalActiveMembers: number;    // miembros con al menos 1 slot
  teamTotalHours: number;
  mostActiveDay: string;
  coverageByDay: Record<string, number>; // día → nº de personas disponibles ese día
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export async function generateWeeklyReport(): Promise<WeeklyReportData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();

  // Quién generó el reporte
  const { data: me } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const lastResetUtc = await getLastSaturdayResetUtc();

  const [slotsRes, profilesRes] = await Promise.all([
    supabase
      .from('availability_slots')
      .select('*')
      .gte('created_at', lastResetUtc),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true),
  ]);

  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const slots = slotsRes.data || [];
  const profiles = profilesRes.data || [];

  // Agrupar slots por usuario
  const slotsByUser: Record<string, typeof slots> = {};
  for (const s of slots) {
    if (!slotsByUser[s.user_id]) slotsByUser[s.user_id] = [];
    slotsByUser[s.user_id].push(s);
  }

  // Contar cobertura por día (cuántos miembros distintos tienen al menos 1 slot ese día)
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
    members,
    totalActiveMembers: activeMembers.length,
    teamTotalHours: Math.round(teamTotalHours * 10) / 10,
    mostActiveDay,
    coverageByDay,
  };
}
