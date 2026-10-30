'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export interface SessionMemberReport {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  hours: number;
  time_range: string;
  slots_count: number;
}

export interface SessionReport {
  id: string;
  title: string;
  session_date: string;          // YYYY-MM-DD
  activities: string;
  engineer_notes: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  members: SessionMemberReport[];
  total_hours: number;
  created_at: string;
  updated_at: string;
  is_editable: boolean;
}

export interface TeamMemberAvailabilityForDate {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  hours: number;
  time_range: string;
  slots_count: number;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Obtiene la fecha actual en la zona horaria de México (America/Mexico_City) en formato YYYY-MM-DD.
 */
export async function getMexicoCityToday(): Promise<string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function toHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Obtiene la disponibilidad calculada de todos los miembros del equipo para una fecha específica (YYYY-MM-DD).
 * Se calcula según su horario en `availability_slots` para el día de la semana correspondiente.
 */
export async function getTeamAvailabilityForDate(dateStr: string): Promise<TeamMemberAvailabilityForDate[]> {
  const supabase = createAdminClient();

  // Parsear día de la semana de la fecha dada (YYYY-MM-DD)
  const parts = dateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  const dayOfWeek = dateObj.getDay(); // 0 = Domingo, ..., 6 = Sábado

  const [profilesRes, slotsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('availability_slots')
      .select('*')
      .eq('day_of_week', dayOfWeek),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);

  const profiles = profilesRes.data || [];
  const slots = slotsRes.data || [];

  const slotsByUser: Record<string, typeof slots> = {};
  for (const s of slots) {
    if (!slotsByUser[s.user_id]) slotsByUser[s.user_id] = [];
    slotsByUser[s.user_id].push(s);
  }

  return profiles.map((p) => {
    const userSlots = slotsByUser[p.id] || [];
    let totalMinutes = 0;
    let earliestMin = 24 * 60;
    let latestMin = 0;

    for (const s of userSlots) {
      const start = parseHHMM(s.start_time);
      const end = parseHHMM(s.end_time);
      totalMinutes += Math.max(0, end - start);
      if (start < earliestMin) earliestMin = start;
      if (end > latestMin) latestMin = end;
    }

    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    const timeRange = userSlots.length > 0
      ? `${toHHMM(earliestMin)} - ${toHHMM(latestMin)}`
      : 'Sin horario registrado este día';

    return {
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
      hours,
      time_range: timeRange,
      slots_count: userSlots.length,
    };
  });
}

/**
 * Obtiene todos los reportes de sesión guardados, ordenados del más reciente al más antiguo.
 */
export async function getSessionReports(): Promise<SessionReport[]> {
  const supabase = createAdminClient();
  const todayStr = await getMexicoCityToday();

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', 'session_reports')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener reportes de sesión:', error);
    return [];
  }

  const reports: SessionReport[] = [];

  for (const row of data || []) {
    const d = row.new_data as Record<string, any>;
    if (!d || !d.title) continue;

    const sessionDate = d.session_date || row.created_at?.slice(0, 10) || todayStr;
    const isEditable = sessionDate === todayStr;

    reports.push({
      id: row.id,
      title: d.title || row.note || 'Sesión de trabajo',
      session_date: sessionDate,
      activities: d.activities || '',
      engineer_notes: d.engineer_notes || '',
      author_id: d.author_id || row.performed_by || '',
      author_name: d.author_name || 'Desconocido',
      author_avatar_url: d.author_avatar_url || null,
      members: d.members || [],
      total_hours: d.total_hours || 0,
      created_at: row.created_at,
      updated_at: d.updated_at || row.created_at,
      is_editable: isEditable,
    });
  }

  return reports;
}

/**
 * Guarda o actualiza un reporte de sesión.
 * Si el reporte ya existía, valida que la sesión sea del mismo día (hoy en MX).
 * Si es de un día anterior, bloquea la edición arrojando error.
 */
export async function saveSessionReport(input: {
  id?: string;
  title: string;
  session_date: string;
  activities: string;
  engineer_notes: string;
  selected_member_ids: string[];
}): Promise<{ success: boolean; reportId: string }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado. Inicia sesión para guardar reportes.');

  const supabase = createAdminClient();
  const todayStr = await getMexicoCityToday();

  // Validar si es una edición de un reporte existente
  if (input.id) {
    const { data: existing, error: findErr } = await supabase
      .from('audit_log')
      .select('*')
      .eq('id', input.id)
      .eq('table_name', 'session_reports')
      .single();

    if (findErr || !existing) {
      throw new Error('Reporte no encontrado.');
    }

    const existingData = existing.new_data as Record<string, any>;
    const existingDate = existingData?.session_date || existing.created_at?.slice(0, 10);

    // REGLA FUNDAMENTAL: Solo se puede editar el mismo día de la sesión
    if (existingDate !== todayStr) {
      throw new Error('Este reporte corresponde a una fecha anterior y ya no se puede editar. Solo está disponible para visualización.');
    }
  }

  // Obtener datos del autor
  const { data: author } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .single();

  const authorName = author?.full_name || 'Integrante';
  const authorAvatar = (author as { avatar_url?: string | null })?.avatar_url || null;

  // Calcular horas de los integrantes seleccionados para la fecha indicada
  const allAvailability = await getTeamAvailabilityForDate(input.session_date);
  const selectedSet = new Set(input.selected_member_ids);

  const sessionMembers: SessionMemberReport[] = allAvailability
    .filter((m) => selectedSet.has(m.id))
    .map((m) => ({
      id: m.id,
      full_name: m.full_name,
      role: m.role,
      avatar_url: m.avatar_url,
      hours: m.hours,
      time_range: m.time_range,
      slots_count: m.slots_count,
    }));

  const totalHours = Math.round(sessionMembers.reduce((sum, m) => sum + m.hours, 0) * 10) / 10;
  const nowIso = new Date().toISOString();

  const reportPayload = {
    title: input.title.trim() || 'Sesión de trabajo',
    session_date: input.session_date,
    activities: input.activities.trim(),
    engineer_notes: input.engineer_notes.trim(),
    author_id: userId,
    author_name: authorName,
    author_avatar_url: authorAvatar,
    selected_member_ids: input.selected_member_ids,
    members: sessionMembers,
    total_hours: totalHours,
    updated_at: nowIso,
  };

  if (input.id) {
    // Actualizar registro existente
    const { error: updErr } = await supabase
      .from('audit_log')
      .update({
        note: input.title.trim(),
        new_data: reportPayload,
        action: 'UPDATE',
      })
      .eq('id', input.id);

    if (updErr) throw new Error(`Error al actualizar reporte: ${updErr.message}`);

    revalidatePath('/');
    return { success: true, reportId: input.id };
  } else {
    // Insertar nuevo reporte
    const { data: newRow, error: insErr } = await supabase
      .from('audit_log')
      .insert({
        table_name: 'session_reports',
        action: 'INSERT',
        performed_by: userId,
        note: input.title.trim(),
        new_data: {
          ...reportPayload,
          created_at: nowIso,
        },
      })
      .select('id')
      .single();

    if (insErr) throw new Error(`Error al crear reporte: ${insErr.message}`);

    revalidatePath('/');
    return { success: true, reportId: newRow.id };
  }
}
