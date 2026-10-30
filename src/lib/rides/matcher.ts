import type { RideRequest, Profile, PresenceWindow, RideAssignment } from '../../types/database.ts';

export interface DriverCandidate {
  driver: Profile;
  window: PresenceWindow;
  completedRidesCount: number; // Para rotación justa
}

export interface MatchResult {
  assigned: {
    requestId: string;
    passengerId: string;
    passengerName: string;
    driverId: string;
    driverName: string;
    direction: 'to_venue' | 'from_venue';
    scheduledPickupTime: string;
    pickupLocation: string;
  }[];
  unassigned: {
    requestId: string;
    passengerId: string;
    passengerName: string;
    direction: 'to_venue' | 'from_venue';
    targetTime: string;
    reason: 'no_drivers' | 'no_seats_available' | 'outside_time_tolerance';
  }[];
}

/**
 * Empareja pasajeros con conductores según proximidad horaria, cercanía de zona,
 * capacidad de asientos y rotación histórica para repartir la carga.
 */
export function matchRides(
  requests: (RideRequest & { profiles?: Profile })[],
  drivers: DriverCandidate[],
  toleranceMinutes: number = 30,
  excludedDriverIdsByRequest: Map<string, Set<string>> = new Map()
): MatchResult {
  const assigned: MatchResult['assigned'] = [];
  const unassigned: MatchResult['unassigned'] = [];

  // Mapear capacidad disponible de asientos por conductor para este día
  const driverRemainingSeats = new Map<string, number>();
  drivers.forEach((d) => {
    driverRemainingSeats.set(d.driver.id, d.driver.available_seats || 0);
  });

  // Agrupar solicitudes por dirección ('to_venue' o 'from_venue')
  const toVenueRequests = requests.filter((r) => r.direction === 'to_venue' && r.status !== 'cancelled');
  const fromVenueRequests = requests.filter((r) => r.direction === 'from_venue' && r.status !== 'cancelled');

  const processRequests = (list: typeof requests, isToVenue: boolean) => {
    for (const req of list) {
      const passengerName = req.profiles?.full_name || 'Pasajero';
      const targetTimeMs = new Date(req.target_time).getTime();
      const excludedDrivers = excludedDriverIdsByRequest.get(req.id) || new Set<string>();

      // Si no hay conductores disponibles en absoluto
      if (drivers.length === 0) {
        unassigned.push({
          requestId: req.id,
          passengerId: req.user_id,
          passengerName,
          direction: req.direction,
          targetTime: req.target_time,
          reason: 'no_drivers',
        });
        continue;
      }

      // Encontrar candidatos elegibles
      const eligible = drivers
        .filter((d) => {
          // El conductor no puede ser el mismo pasajero
          if (d.driver.id === req.user_id) return false;
          // No puede haber sido rechazado previamente por este conductor
          if (excludedDrivers.has(d.driver.id)) return false;
          // Debe tener asientos libres
          const seats = driverRemainingSeats.get(d.driver.id) || 0;
          if (seats <= 0) return false;

          // Verificar tolerancia horaria
          // Si es ida: comparar hora de llegada (start_time)
          // Si es regreso: comparar hora de salida (end_time)
          const driverTimeMs = isToVenue
            ? new Date(d.window.start_time).getTime()
            : new Date(d.window.end_time).getTime();

          const diffMinutes = Math.abs(driverTimeMs - targetTimeMs) / (60 * 1000);
          return diffMinutes <= toleranceMinutes;
        })
        .sort((a, b) => {
          // 1. Prioridad: Misma zona de salida / recogida
          const aZoneMatch = a.driver.pickup_zone && req.pickup_zone && a.driver.pickup_zone.toLowerCase() === req.pickup_zone.toLowerCase();
          const bZoneMatch = b.driver.pickup_zone && req.pickup_zone && b.driver.pickup_zone.toLowerCase() === req.pickup_zone.toLowerCase();
          if (aZoneMatch && !bZoneMatch) return -1;
          if (!aZoneMatch && bZoneMatch) return 1;

          // 2. Prioridad: Rotación equitativa (menos viajes históricos asignados)
          if (a.completedRidesCount !== b.completedRidesCount) {
            return a.completedRidesCount - b.completedRidesCount;
          }

          // 3. Proximidad de horario
          const aDriverTime = isToVenue ? new Date(a.window.start_time).getTime() : new Date(a.window.end_time).getTime();
          const bDriverTime = isToVenue ? new Date(b.window.start_time).getTime() : new Date(b.window.end_time).getTime();
          return Math.abs(aDriverTime - targetTimeMs) - Math.abs(bDriverTime - targetTimeMs);
        });

      if (eligible.length > 0) {
        const chosen = eligible[0];
        // Consumir 1 asiento
        const currentSeats = driverRemainingSeats.get(chosen.driver.id) || 0;
        driverRemainingSeats.set(chosen.driver.id, currentSeats - 1);

        // Calcular hora sugerida de recogida (15 min antes si es ida, o la hora de salida si es regreso)
        const pickupDate = isToVenue
          ? new Date(new Date(chosen.window.start_time).getTime() - 15 * 60 * 1000)
          : new Date(chosen.window.end_time);

        const location = req.pickup_address || req.pickup_zone || chosen.driver.default_pickup_point || 'Punto acordado';

        assigned.push({
          requestId: req.id,
          passengerId: req.user_id,
          passengerName,
          driverId: chosen.driver.id,
          driverName: chosen.driver.full_name,
          direction: req.direction,
          scheduledPickupTime: pickupDate.toISOString(),
          pickupLocation: location,
        });
      } else {
        // Determinar motivo exacto por el que no se pudo asignar
        const driversWithinTime = drivers.filter((d) => {
          if (d.driver.id === req.user_id || excludedDrivers.has(d.driver.id)) return false;
          const driverTimeMs = isToVenue
            ? new Date(d.window.start_time).getTime()
            : new Date(d.window.end_time).getTime();
          return Math.abs(driverTimeMs - targetTimeMs) / (60 * 1000) <= toleranceMinutes;
        });

        const reason = driversWithinTime.length === 0 ? 'outside_time_tolerance' : 'no_seats_available';

        unassigned.push({
          requestId: req.id,
          passengerId: req.user_id,
          passengerName,
          direction: req.direction,
          targetTime: req.target_time,
          reason,
        });
      }
    }
  };

  processRequests(toVenueRequests, true);
  processRequests(fromVenueRequests, false);

  return { assigned, unassigned };
}
