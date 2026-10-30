'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { AvailabilitySlot } from '@/types/database';
import { revalidatePath } from 'next/cache';

/**
 * Calcula la marca de tiempo UTC del último reinicio de Sábado a medianoche (23:59:59)
 * en la zona horaria America/Mexico_City.
 */
export async function getLastSaturdayResetUtc(): Promise<string> {
  const now = new Date();
  const mxStr = now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
  const mxDate = new Date(mxStr);
  const day = mxDate.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb

  let daysToSubtract: number;
  if (day === 0) {
    // Si hoy es domingo, el reinicio ocurrió ayer sábado por la noche
    daysToSubtract = 1;
  } else if (day === 6) {
    // Si hoy es sábado antes de medianoche, el reinicio activo fue el sábado anterior
    daysToSubtract = (mxDate.getHours() === 23 && mxDate.getMinutes() >= 59) ? 0 : 7;
  } else {
    // Lunes a viernes
    daysToSubtract = day + 1;
  }

  const resetDate = new Date(mxDate);
  resetDate.setDate(resetDate.getDate() - daysToSubtract);
  resetDate.setHours(23, 59, 59, 0);

  const diffMs = now.getTime() - mxDate.getTime();
  const resetUtc = new Date(resetDate.getTime() + diffMs);
  return resetUtc.toISOString();
}

/**
 * Guarda los bloques de disponibilidad del usuario para la semana activa.
 */
export async function saveUserAvailabilitySlots(
  slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('No autorizado');
  }

  const supabase = createAdminClient();

  // 1. Borrar slots anteriores del usuario
  const { error: deleteError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Error al limpiar disponibilidad anterior: ${deleteError.message}`);
  }

  // 2. Insertar nuevos slots si hay alguno con la marca de tiempo actual
  if (slots.length > 0) {
    const nowIso = new Date().toISOString();
    const slotsToInsert = slots.map((s) => ({
      user_id: userId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_recurring: s.is_recurring,
      created_at: nowIso,
    }));

    const { error: insertError } = await supabase
      .from('availability_slots')
      .insert(slotsToInsert);

    if (insertError) {
      throw new Error(`Error al guardar disponibilidad: ${insertError.message}`);
    }
  }

  revalidatePath('/');
  return { success: true };
}

/**
 * Obtiene los slots de disponibilidad activos de la semana actual.
 * Limpia y filtra automáticamente cualquier slot anterior al último sábado a medianoche.
 */
export async function getActiveWeekAvailability() {
  const supabase = createAdminClient();
  const lastResetUtc = getLastSaturdayResetUtc();

  // Eliminar en segundo plano los slots expirados de semanas anteriores
  void (async () => {
    try {
      await supabase
        .from('availability_slots')
        .delete()
        .lt('created_at', lastResetUtc);
    } catch (err) {
      console.error('Error al depurar slots antiguos:', err);
    }
  })();

  const [slotsRes, profilesRes] = await Promise.all([
    supabase
      .from('availability_slots')
      .select('*')
      .gte('created_at', lastResetUtc),
    supabase.from('profiles').select('*').eq('is_active', true),
  ]);

  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  return {
    slots: (slotsRes.data || []) as AvailabilitySlot[],
    profiles: profilesRes.data || [],
  };
}

/**
 * Permite al administrador reiniciar manualmente la disponibilidad de toda la semana en cualquier momento.
 */
export async function resetAllAvailabilityNow() {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) throw new Error('No autorizado');

  const supabase = createAdminClient();
  const { data: user } = await supabase.from('profiles').select('role').eq('id', currentUserId).single();
  if (user?.role !== 'admin') throw new Error('Solo el administrador puede reiniciar los horarios');

  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return { success: true };
}
