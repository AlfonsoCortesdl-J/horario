'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PresenceWindow, Profile } from '@/types/database';
import { calculateCoverageSlots, analyzePresenceChangeImpact } from '@/lib/coverage/calculator';
import { revalidatePath } from 'next/cache';

export async function getPresenceWindowsAndCoverage(dateIso: string) {
  const supabase = await createServerSupabaseClient();

  // Rango del día completo en UTC
  const targetDate = new Date(dateIso);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Obtener ventanas del día con el perfil del usuario incluido
  const { data: windowsData, error: windowsError } = await supabase
    .from('presence_windows')
    .select('*, profiles(*)')
    .neq('status', 'cancelled')
    .gte('end_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .order('start_time', { ascending: true });

  if (windowsError) {
    throw new Error(`Error al obtener ventanas de presencia: ${windowsError.message}`);
  }

  const windows = (windowsData || []) as (PresenceWindow & { profiles?: Profile })[];

  // Rango para bloques de 30 min (07:00 a 23:00)
  const rangeStart = new Date(targetDate);
  rangeStart.setHours(7, 0, 0, 0);

  const rangeEnd = new Date(targetDate);
  rangeEnd.setHours(23, 0, 0, 0);

  const coverageSlots = calculateCoverageSlots(windows, rangeStart, rangeEnd);

  return {
    windows,
    coverageSlots,
  };
}

export async function createPresenceWindow(payload: {
  start_time: string;
  end_time: string;
  note?: string;
  need_ride_to?: boolean;
  need_ride_from?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('No autorizado');

  // Obtener ventanas existentes para evaluar traslape
  const { data: existingWindows } = await supabase
    .from('presence_windows')
    .select('*, profiles(*)')
    .neq('status', 'cancelled')
    .gte('end_time', payload.start_time)
    .lte('start_time', payload.end_time);

  const impact = analyzePresenceChangeImpact(
    (existingWindows || []) as (PresenceWindow & { profiles?: Profile })[],
    {
      user_id: user.id,
      start_time: payload.start_time,
      end_time: payload.end_time,
    },
    'CREATE'
  );

  // Si tiene tramos solos, queda como 'pending_partner', si no 'confirmed'
  const status = impact.hasSoloViolation ? 'pending_partner' : 'confirmed';

  const { data: newWindow, error: insertError } = await supabase
    .from('presence_windows')
    .insert({
      user_id: user.id,
      start_time: payload.start_time,
      end_time: payload.end_time,
      note: payload.note || null,
      status: status,
      need_ride_to: payload.need_ride_to || false,
      need_ride_from: payload.need_ride_from || false,
    })
    .select('*')
    .single();

  if (insertError) throw new Error(`Error al registrar ventana: ${insertError.message}`);

  // Si solicitó transporte, crear solicitudes de viaje correspondientes
  if (payload.need_ride_to) {
    await supabase.from('ride_requests').insert({
      user_id: user.id,
      presence_window_id: newWindow.id,
      direction: 'to_venue',
      target_time: payload.start_time,
      status: 'unassigned',
    });
  }

  if (payload.need_ride_from) {
    await supabase.from('ride_requests').insert({
      user_id: user.id,
      presence_window_id: newWindow.id,
      direction: 'from_venue',
      target_time: payload.end_time,
      status: 'unassigned',
    });
  }

  revalidatePath('/');
  return { 
    success: true, 
    window: newWindow,
    hasSoloViolation: impact.hasSoloViolation,
    soloSlotsCount: impact.soloSlotsCount,
  };
}

export async function cancelPresenceWindow(payload: {
  windowId: string;
  reason: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('No autorizado');

  // Obtener ventana a cancelar
  const { data: windowToCancel, error: fetchError } = await supabase
    .from('presence_windows')
    .select('*, profiles(*)')
    .eq('id', payload.windowId)
    .single();

  if (fetchError || !windowToCancel) throw new Error('Ventana no encontrada');

  // Obtener ventanas de otros miembros para calcular si alguien queda solo
  const { data: activeWindows } = await supabase
    .from('presence_windows')
    .select('*, profiles(*)')
    .neq('status', 'cancelled')
    .gte('end_time', windowToCancel.start_time)
    .lte('start_time', windowToCancel.end_time);

  const impact = analyzePresenceChangeImpact(
    (activeWindows || []) as (PresenceWindow & { profiles?: Profile })[],
    {
      id: windowToCancel.id,
      user_id: windowToCancel.user_id,
      start_time: windowToCancel.start_time,
      end_time: windowToCancel.end_time,
    },
    'CANCEL'
  );

  // Marcar como cancelada
  const { error: cancelError } = await supabase
    .from('presence_windows')
    .update({
      status: 'cancelled',
      cancellation_reason: payload.reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', payload.windowId);

  if (cancelError) throw new Error(`Error al cancelar: ${cancelError.message}`);

  // Si dejó a alguien solo, registrar alerta de cobertura
  if (impact.hasSoloViolation) {
    const adminClient = createAdminClient();
    await adminClient.from('coverage_alerts').insert({
      presence_window_id: payload.windowId,
      alert_type: 'cancellation_risk',
      window_start: windowToCancel.start_time,
      window_end: windowToCancel.end_time,
      affected_user_ids: impact.affectedSlots.flatMap((s) => s.remainingUserIds),
      message: `${windowToCancel.profiles?.full_name || 'Un miembro'} canceló su ventana por: "${payload.reason}". Quedan solos: ${impact.affectedUserNames.join(', ')}.`,
      is_resolved: false,
    });
  }

  revalidatePath('/');
  return { 
    success: true, 
    impact 
  };
}

export async function checkInPresence(windowId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('No autorizado');

  const { error } = await supabase
    .from('presence_windows')
    .update({ checked_in_at: new Date().toISOString() })
    .eq('id', windowId)
    .eq('user_id', user.id);

  if (error) throw new Error(`Error en check-in: ${error.message}`);
  revalidatePath('/');
  return { success: true };
}

export async function checkOutPresence(windowId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('No autorizado');

  // Verificar si hay otros usuarios actualmente checked-in en el lugar
  const { data: currentlyPresent } = await supabase
    .from('presence_windows')
    .select('user_id, profiles(full_name)')
    .neq('status', 'cancelled')
    .not('checked_in_at', 'is', null)
    .is('checked_out_at', null);

  const otherPresent = (currentlyPresent || []).filter((p) => p.user_id !== user.id);
  const leavesSomeoneAlone = otherPresent.length === 1;

  const { error } = await supabase
    .from('presence_windows')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', windowId)
    .eq('user_id', user.id);

  if (error) throw new Error(`Error en check-out: ${error.message}`);

  revalidatePath('/');
  return { 
    success: true,
    leavesSomeoneAlone,
    remainingUserName: leavesSomeoneAlone ? (otherPresent[0] as any).profiles?.full_name : null,
  };
}
