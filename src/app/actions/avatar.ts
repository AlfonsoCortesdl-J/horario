'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';

/**
 * Sube una foto de perfil a Supabase Storage (bucket: avatars)
 * y guarda la URL pública en profiles.avatar_url.
 * Recibe un FormData con el campo "file".
 */
export async function uploadAvatar(formData: FormData): Promise<{ url: string }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const file = formData.get('file') as File | null;
  if (!file) throw new Error('No se proporcionó archivo');

  // Validar tipo y tamaño (máx 2 MB)
  if (!file.type.startsWith('image/')) throw new Error('Solo se permiten imágenes');
  if (file.size > 2 * 1024 * 1024) throw new Error('La imagen no debe pesar más de 2 MB');

  const supabase = createAdminClient();

  // Determinar extensión
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Subir (upsert = reemplaza si ya existe)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

  // Obtener URL pública
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // bust cache

  // Guardar URL en perfil
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', userId);

  if (updateError) throw new Error(`Error al guardar URL: ${updateError.message}`);

  revalidatePath('/');
  return { url: publicUrl };
}

/**
 * Elimina la foto de perfil del usuario actual.
 */
export async function deleteAvatar(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();

  // Intentar borrar todas las extensiones posibles
  await supabase.storage.from('avatars').remove([
    `${userId}.jpg`,
    `${userId}.png`,
    `${userId}.webp`,
  ]);

  await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  revalidatePath('/');
}
