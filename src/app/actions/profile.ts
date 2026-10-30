'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { Profile } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function updateUserProfile(updates: Partial<Profile>) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('No autorizado');
  }

  const supabase = createAdminClient();

  // Prevenir que el usuario se asigne a sí mismo rol de admin directamente desde el cliente
  const safeUpdates = { ...updates };
  delete safeUpdates.role;
  delete safeUpdates.id;

  const { error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId);

  if (error) {
    throw new Error(`Error al actualizar perfil: ${error.message}`);
  }

  revalidatePath('/');
  return { success: true };
}

export async function inviteTeamMember(fullName: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('No autorizado');
  }

  const supabase = createAdminClient();

  // Verificar rol de admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (currentProfile?.role !== 'admin') {
    throw new Error('Solo el administrador puede pre-registrar miembros');
  }

  const name = fullName.trim();
  if (!name) throw new Error('Nombre inválido');

  // Insertar nuevo miembro en el sistema de confianza
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({
      id: crypto.randomUUID(),
      full_name: name,
      role: 'member',
      is_active: true,
      has_car: false,
      available_seats: 0,
    })
    .select('*')
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/');
  return { success: true, message: `¡Miembro ${name} registrado con éxito!` };
}
