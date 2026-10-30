'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { setSessionUserId, clearSessionUser, getCurrentUserId } from '@/lib/session';
import { Profile } from '@/types/database';
import { revalidatePath } from 'next/cache';

// Helper para extraer la contraseña sin encriptar (busca en password o phone)
function getPlainPassword(record: Record<string, unknown>): string {
  const pass = (record.password as string) || (record.phone as string) || '';
  return pass.trim();
}

export async function getTeamProfiles(): Promise<(Profile & { has_password: boolean })[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error al cargar perfiles del equipo:', error);
    return [];
  }

  return (data || []).map((p) => {
    const hasPass = Boolean(getPlainPassword(p));
    // No exponemos la contraseña en la lista pública de selección, solo si tiene una
    return {
      ...p,
      password: null,
      phone: null,
      has_password: hasPass,
    };
  });
}

/**
 * Valida la contraseña en texto plano para iniciar sesión como un usuario existente
 */
export async function verifyMemberPassword(userId: string, passwordInput: string) {
  const pass = passwordInput.trim();
  if (!pass) {
    throw new Error('Debes ingresar la contraseña');
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('Usuario no encontrado');
  }

  const storedPassword = getPlainPassword(user);

  // Si el usuario no tiene contraseña aún (caso de transición), se la asignamos
  if (!storedPassword) {
    await saveUserPassword(supabase, userId, pass);
    await setSessionUserId(userId);
    revalidatePath('/');
    return { success: true };
  }

  // Si tiene contraseña, comparamos directamente (texto plano, sin encriptar como pidió el usuario)
  if (storedPassword !== pass) {
    throw new Error('Contraseña incorrecta. Si la olvidaste, pídesela al Administrador.');
  }

  await setSessionUserId(userId);
  revalidatePath('/');
  return { success: true };
}

/**
 * Registra un nuevo integrante con su contraseña en texto plano
 */
export async function registerNewMember(fullName: string, passwordInput: string) {
  const name = fullName.trim();
  const pass = passwordInput.trim();

  if (!name) throw new Error('El nombre es obligatorio');
  if (!pass) throw new Error('Debes asignar una contraseña para tu usuario');

  const supabase = createAdminClient();

  // Verificar si ya existe alguien con este nombre
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', name)
    .maybeSingle();

  if (existing) {
    throw new Error(`Ya existe un integrante con el nombre "${existing.full_name}". Selecciona tu nombre de la lista para ingresar.`);
  }

  // Si es el primer usuario del sistema, otorgarle rol de admin
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const isFirst = (count || 0) === 0;

  const newId = crypto.randomUUID();

  // Insertar en la base de datos
  // Intentamos guardar en 'password' y en 'phone' como respaldo
  const insertPayload: Record<string, unknown> = {
    id: newId,
    full_name: name,
    phone: pass, // Respaldo compatible de texto plano
    role: isFirst ? 'admin' : 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    notify_by_telegram: true,
    notify_by_email: false,
  };

  const { data: created, error } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Error al registrar usuario: ${error.message}`);
  }

  // Si la columna password existe, actualizarla también
  try {
    await supabase.from('profiles').update({ password: pass }).eq('id', newId);
  } catch {
    // Columna aún no presente en schema cache, phone ya tiene el valor
  }

  await setSessionUserId(created.id);
  revalidatePath('/');
  return { success: true, userId: created.id };
}

export async function logoutMember() {
  await clearSessionUser();
  revalidatePath('/');
  return { success: true };
};

/**
 * Permite al Administrador consultar las contraseñas en texto plano de todos los usuarios
 */
export async function getAdminMembersList(): Promise<{ id: string; full_name: string; role: string; plain_password: string }[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) throw new Error('No autorizado');

  const supabase = createAdminClient();
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUserId)
    .single();

  if (currentUser?.role !== 'admin') {
    throw new Error('Solo el administrador puede ver las contraseñas del equipo');
  }

  const { data: members, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (members || []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    role: m.role,
    plain_password: getPlainPassword(m) || '(Sin contraseña)',
  }));
}

/**
 * Permite al Administrador restablecer la contraseña de cualquier integrante
 */
export async function adminUpdateMemberPassword(targetUserId: string, newPasswordInput: string) {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) throw new Error('No autorizado');

  const pass = newPasswordInput.trim();
  if (!pass) throw new Error('La contraseña no puede estar vacía');

  const supabase = createAdminClient();
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUserId)
    .single();

  if (currentUser?.role !== 'admin') {
    throw new Error('Solo el administrador puede modificar contraseñas');
  }

  await saveUserPassword(supabase, targetUserId, pass);
  revalidatePath('/');
  return { success: true };
}

async function saveUserPassword(supabase: ReturnType<typeof createAdminClient>, userId: string, pass: string) {
  // Guarda en phone (respaldo garantizado)
  await supabase.from('profiles').update({ phone: pass }).eq('id', userId);
  // Y si existe columna password, en password también
  try {
    await supabase.from('profiles').update({ password: pass }).eq('id', userId);
  } catch {
    // Ignorar si no existe columna
  }
}
