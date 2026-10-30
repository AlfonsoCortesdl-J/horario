'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AvailabilitySlot } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function saveUserAvailabilitySlots(
  slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autorizado');
  }

  // 1. Borrar slots recurrentes previos del usuario
  const { error: deleteError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', user.id)
    .eq('is_recurring', true);

  if (deleteError) {
    throw new Error(`Error al limpiar disponibilidad anterior: ${deleteError.message}`);
  }

  // 2. Insertar nuevos slots si hay alguno
  if (slots.length > 0) {
    const slotsToInsert = slots.map((s) => ({
      user_id: user.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_recurring: s.is_recurring,
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

export async function getTeamAvailability() {
  const supabase = await createServerSupabaseClient();

  const [slotsRes, profilesRes] = await Promise.all([
    supabase.from('availability_slots').select('*'),
    supabase.from('profiles').select('*').eq('is_active', true),
  ]);

  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  return {
    slots: (slotsRes.data || []) as AvailabilitySlot[],
    profiles: profilesRes.data || [],
  };
}
