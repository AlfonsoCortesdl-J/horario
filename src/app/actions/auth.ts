'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { setSessionUserId, clearSessionUser } from '@/lib/session';
import { Profile } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getTeamProfiles(): Promise<Profile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error al cargar perfiles del equipo:', error);
    return [];
  }
  return data || [];
}

export async function selectExistingMember(userId: string) {
  await setSessionUserId(userId);
  revalidatePath('/');
  return { success: true };
}

export async function registerNewMember(fullName: string) {
  const name = fullName.trim();
  if (!name) throw new Error('El nombre es obligatorio');

  const supabase = createAdminClient();

  // Verificar si ya existe alguien con este nombre
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .ilike('full_name', name)
    .maybeSingle();

  if (existing) {
    // Si ya existe, simplemente inicia sesión como esa persona
    await setSessionUserId(existing.id);
    revalidatePath('/');
    return { success: true, userId: existing.id };
  }

  // Si es el primer usuario del sistema, otorgarle rol de admin
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const isFirst = (count || 0) === 0;

  const newId = crypto.randomUUID();

  const { data: created, error } = await supabase
    .from('profiles')
    .insert({
      id: newId,
      full_name: name,
      role: isFirst ? 'admin' : 'member',
      is_active: true,
      has_car: false,
      available_seats: 0,
      notify_by_telegram: true,
      notify_by_email: false,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Error al registrar nombre: ${error.message}`);
  }

  await setSessionUserId(created.id);
  revalidatePath('/');
  return { success: true, userId: created.id };
}

export async function logoutMember() {
  await clearSessionUser();
  revalidatePath('/');
  return { success: true };
}
