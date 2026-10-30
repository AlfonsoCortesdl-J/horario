'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserId } from '@/lib/session';
import { RideRequest, RideAssignment, Profile, PresenceWindow } from '@/types/database';
import { matchRides, DriverCandidate } from '@/lib/rides/matcher';
import { revalidatePath } from 'next/cache';

export async function getRidesData(dateIso: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();

  const targetDate = new Date(dateIso);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Solicitudes como pasajero
  const { data: myPassengerRequests } = await supabase
    .from('ride_requests')
    .select('*, ride_assignments(*, driver:profiles!driver_id(*))')
    .eq('user_id', userId)
    .gte('target_time', startOfDay.toISOString())
    .lte('target_time', endOfDay.toISOString())
    .order('target_time', { ascending: true });

  // 2. Asignaciones como conductor
  const { data: myDriverAssignments } = await supabase
    .from('ride_assignments')
    .select('*, ride_requests(*, profiles(*))')
    .eq('driver_id', userId)
    .gte('scheduled_pickup_time', startOfDay.toISOString())
    .lte('scheduled_pickup_time', endOfDay.toISOString())
    .order('scheduled_pickup_time', { ascending: true });

  // 3. Conductores disponibles hoy (miembros con auto y ventana activa hoy)
  const { data: activeWindowsWithCars } = await supabase
    .from('presence_windows')
    .select('*, profiles!inner(*)')
    .eq('profiles.has_car', true)
    .neq('status', 'cancelled')
    .gte('end_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString());

  // 4. Todas las solicitudes del día (para visualización grupal / admin)
  const { data: allDayRequests } = await supabase
    .from('ride_requests')
    .select('*, profiles(*), ride_assignments(*, driver:profiles!driver_id(*))')
    .gte('target_time', startOfDay.toISOString())
    .lte('target_time', endOfDay.toISOString())
    .order('target_time', { ascending: true });

  return {
    myPassengerRequests: myPassengerRequests || [],
    myDriverAssignments: myDriverAssignments || [],
    availableDriversCount: (activeWindowsWithCars || []).length,
    allDayRequests: allDayRequests || [],
  };
}

export async function executeAutomaticRideMatching(dateIso: string) {
  const supabase = createAdminClient();

  const targetDate = new Date(dateIso);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Obtener solicitudes no asignadas
  const { data: unassignedRequests } = await supabase
    .from('ride_requests')
    .select('*, profiles(*)')
    .eq('status', 'unassigned')
    .gte('target_time', startOfDay.toISOString())
    .lte('target_time', endOfDay.toISOString());

  if (!unassignedRequests || unassignedRequests.length === 0) {
    return { assignedCount: 0, unassignedCount: 0 };
  }

  // Obtener conductores con auto y ventana ese día
  const { data: driverWindows } = await supabase
    .from('presence_windows')
    .select('*, profiles!inner(*)')
    .eq('profiles.has_car', true)
    .neq('status', 'cancelled')
    .gte('end_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString());

  // Obtener historial de viajes completados para rotación
  const { data: history } = await supabase
    .from('driver_history')
    .select('driver_id, passenger_count');

  const historyCountMap = new Map<string, number>();
  (history || []).forEach((h) => {
    historyCountMap.set(h.driver_id, (historyCountMap.get(h.driver_id) || 0) + 1);
  });

  const candidates: DriverCandidate[] = (driverWindows || []).map((dw: any) => ({
    driver: dw.profiles as Profile,
    window: dw as PresenceWindow,
    completedRidesCount: historyCountMap.get(dw.user_id) || 0,
  }));

  // Obtener rechazos previos para no reasignar a conductores que ya rechazaron
  const { data: previousRejections } = await supabase
    .from('ride_assignments')
    .select('request_id, driver_id')
    .eq('status', 'rejected');

  const excludedMap = new Map<string, Set<string>>();
  (previousRejections || []).forEach((r) => {
    if (!excludedMap.has(r.request_id)) excludedMap.set(r.request_id, new Set());
    excludedMap.get(r.request_id)!.add(r.driver_id);
  });

  const matchResult = matchRides(unassignedRequests as any, candidates, 30, excludedMap);

  // Registrar asignaciones en base de datos
  for (const asg of matchResult.assigned) {
    await supabase.from('ride_assignments').insert({
      request_id: asg.requestId,
      driver_id: asg.driverId,
      scheduled_pickup_time: asg.scheduledPickupTime,
      pickup_location: asg.pickupLocation,
      status: 'pending_driver_acceptance',
    });

    await supabase
      .from('ride_requests')
      .update({ status: 'assigned' })
      .eq('id', asg.requestId);
  }

  // Notificar al admin si quedaron pasajeros sin asignar
  if (matchResult.unassigned.length > 0) {
    const unassignedNames = matchResult.unassigned.map((u) => u.passengerName).join(', ');
    await supabase.from('notifications').insert({
      user_id: (await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single()).data?.id || unassignedRequests[0].user_id,
      channel: 'in_app',
      title: 'Pasajeros sin transporte asignado',
      message: `No se pudo asignar conductor para: ${unassignedNames}. Revisa si hay autos disponibles o si los horarios están desfasados.`,
    });
  }

  revalidatePath('/');
  return {
    assignedCount: matchResult.assigned.length,
    unassignedCount: matchResult.unassigned.length,
    matchResult,
  };
}

export async function respondToRideAssignment(payload: {
  assignmentId: string;
  accepted: boolean;
  rejectionReason?: string;
}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autorizado');

  const supabase = createAdminClient();

  const { data: assignment, error: fetchErr } = await supabase
    .from('ride_assignments')
    .select('*, ride_requests(*, profiles(*))')
    .eq('id', payload.assignmentId)
    .single();

  if (fetchErr || !assignment) throw new Error('Asignación no encontrada');

  if (assignment.driver_id !== userId) {
    throw new Error('Solo el conductor asignado puede responder a este viaje');
  }

  if (payload.accepted) {
    await supabase
      .from('ride_assignments')
      .update({
        status: 'accepted',
        driver_response_at: new Date().toISOString(),
      })
      .eq('id', payload.assignmentId);

    await supabase.from('notifications').insert({
      user_id: assignment.ride_requests.user_id,
      channel: 'in_app',
      title: '¡Conductor confirmado!',
      message: `Tu conductor ha confirmado el viaje para las ${new Date(assignment.scheduled_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} en ${assignment.pickup_location}.`,
    });

    revalidatePath('/');
    return { success: true, message: 'Viaje aceptado con éxito' };
  } else {
    await supabase
      .from('ride_assignments')
      .update({
        status: 'rejected',
        rejection_reason: payload.rejectionReason || 'No disponible',
        driver_response_at: new Date().toISOString(),
      })
      .eq('id', payload.assignmentId);

    await supabase
      .from('ride_requests')
      .update({ status: 'unassigned' })
      .eq('id', assignment.request_id);

    await executeAutomaticRideMatching(assignment.scheduled_pickup_time);

    revalidatePath('/');
    return { success: true, message: 'Viaje rechazado. Se está reasignando a otro conductor disponible.' };
  }
}
