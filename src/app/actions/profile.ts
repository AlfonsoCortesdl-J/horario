'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Profile } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function updateUserProfile(updates: Partial<Profile>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autorizado');
  }

  // Prevenir que el usuario se asigne a sí mismo rol de admin directamente desde el cliente
  const safeUpdates = { ...updates };
  delete safeUpdates.role;
  delete safeUpdates.id;

  const { error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', user.id);

  if (error) {
    throw new Error(`Error al actualizar perfil: ${error.message}`);
  }

  revalidatePath('/');
  return { success: true };
}

export async function inviteTeamMember(email: string, fullName: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('No autorizado');
  }

  // Verificar que quien invita sea admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    throw new Error('Solo el administrador puede invitar miembros');
  }

  const adminClient = createAdminClient();

  // Enviar invitación oficial por correo vía Supabase Auth
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`,
  });

  if (inviteError) {
    return { success: false, message: inviteError.message };
  }

  // Asegurar que el perfil se cree con el nombre indicado
  if (inviteData?.user) {
    await adminClient.from('profiles').upsert({
      id: inviteData.user.id,
      email: email,
      full_name: fullName,
      role: 'member',
      is_active: true,
    });
  }

  revalidatePath('/');
  return { success: true, message: `Invitación enviada con éxito a ${email}` };
}
