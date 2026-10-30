import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchRides, type DriverCandidate } from '../matcher.ts';
import type { RideRequest, Profile, PresenceWindow } from '../../../types/database.ts';

describe('Algoritmo de Asignación de Transporte / Carpooling (Pruebas Unitarias)', () => {

  const conductorCarlos: Profile = {
    id: 'driver-carlos-1',
    full_name: 'Carlos Ruiz (Conductor)',
    email: 'carlos@test.com',
    role: 'member',
    is_active: true,
    has_car: true,
    available_seats: 2, // 2 asientos
    phone: '55 1111 2222',
    pickup_zone: 'Valle Oriente',
    default_pickup_point: 'Oxxo Los Soles',
    telegram_chat_id: 111,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const conductorLucia: Profile = {
    id: 'driver-lucia-2',
    full_name: 'Lucía Morales (Conductora)',
    email: 'lucia@test.com',
    role: 'member',
    is_active: true,
    has_car: true,
    available_seats: 3,
    phone: '55 3333 4444',
    pickup_zone: 'Garza Sada',
    default_pickup_point: 'Soriana Garza Sada',
    telegram_chat_id: 222,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const pasajeroAna: Profile = {
    id: 'passenger-ana-1',
    full_name: 'Ana Beltrán',
    email: 'ana@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: '55 5555 6666',
    pickup_zone: 'Valle Oriente',
    default_pickup_point: null,
    telegram_chat_id: 333,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const pasajeroBeto: Profile = {
    id: 'passenger-beto-2',
    full_name: 'Beto Juárez',
    email: 'beto@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: '55 7777 8888',
    pickup_zone: 'Valle Oriente',
    default_pickup_point: null,
    telegram_chat_id: 444,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const pasajeroClara: Profile = {
    id: 'passenger-clara-3',
    full_name: 'Clara Santos',
    email: 'clara@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: '55 9999 0000',
    pickup_zone: 'Valle Oriente',
    default_pickup_point: null,
    telegram_chat_id: 555,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // -------------------------------------------------------------
  // CASO 1: Pocos asientos (Capacidad limitada, sin asignar a la fuerza)
  // -------------------------------------------------------------
  test('Caso 1: Pocos asientos disponibles asigna hasta el tope y reporta al resto', () => {
    // Carlos tiene 2 asientos libres y llega a las 09:00
    const drivers: DriverCandidate[] = [
      {
        driver: conductorCarlos,
        window: {
          id: 'win-carlos',
          user_id: conductorCarlos.id,
          start_time: '2026-11-05T09:00:00.000Z',
          end_time: '2026-11-05T13:00:00.000Z',
          status: 'confirmed',
        } as PresenceWindow,
        completedRidesCount: 0,
      },
    ];

    // 3 pasajeros (Ana, Beto, Clara) piden transporte de ida para las 09:00
    const requests: (RideRequest & { profiles: Profile })[] = [
      {
        id: 'req-1',
        user_id: pasajeroAna.id,
        presence_window_id: 'win-ana',
        direction: 'to_venue',
        target_time: '2026-11-05T09:00:00.000Z',
        pickup_zone: 'Valle Oriente',
        pickup_address: null,
        status: 'unassigned',
        created_at: '',
        updated_at: '',
        profiles: pasajeroAna,
      },
      {
        id: 'req-2',
        user_id: pasajeroBeto.id,
        presence_window_id: 'win-beto',
        direction: 'to_venue',
        target_time: '2026-11-05T09:00:00.000Z',
        pickup_zone: 'Valle Oriente',
        pickup_address: null,
        status: 'unassigned',
        created_at: '',
        updated_at: '',
        profiles: pasajeroBeto,
      },
      {
        id: 'req-3',
        user_id: pasajeroClara.id,
        presence_window_id: 'win-clara',
        direction: 'to_venue',
        target_time: '2026-11-05T09:00:00.000Z',
        pickup_zone: 'Valle Oriente',
        pickup_address: null,
        status: 'unassigned',
        created_at: '',
        updated_at: '',
        profiles: pasajeroClara,
      },
    ];

    const result = matchRides(requests, drivers, 30);

    // Debe asignar exactamente 2 pasajeros (la capacidad máxima del auto de Carlos)
    assert.equal(result.assigned.length, 2);
    result.assigned.forEach((a) => {
      assert.equal(a.driverId, conductorCarlos.id);
    });

    // El 3er pasajero NO debe ser asignado a la fuerza; debe quedar como no asignado
    assert.equal(result.unassigned.length, 1);
    assert.equal(result.unassigned[0].passengerId, pasajeroClara.id);
    assert.equal(result.unassigned[0].reason, 'no_seats_available');
  });

  // -------------------------------------------------------------
  // CASO 2: Rechazo de conductor (Reasignación automática con rotación)
  // -------------------------------------------------------------
  test('Caso 2: Si el conductor rechaza el viaje, se reasigna al siguiente conductor elegible', () => {
    // 2 conductores: Carlos y Lucía
    const drivers: DriverCandidate[] = [
      {
        driver: conductorCarlos,
        window: {
          id: 'win-carlos',
          user_id: conductorCarlos.id,
          start_time: '2026-11-05T09:00:00.000Z',
          end_time: '2026-11-05T13:00:00.000Z',
          status: 'confirmed',
        } as PresenceWindow,
        completedRidesCount: 1,
      },
      {
        driver: conductorLucia,
        window: {
          id: 'win-lucia',
          user_id: conductorLucia.id,
          start_time: '2026-11-05T09:15:00.000Z', // Dentro de tolerancia de 30 min
          end_time: '2026-11-05T13:00:00.000Z',
          status: 'confirmed',
        } as PresenceWindow,
        completedRidesCount: 2,
      },
    ];

    const requestAna: (RideRequest & { profiles: Profile }) = {
      id: 'req-ana',
      user_id: pasajeroAna.id,
      presence_window_id: 'win-ana',
      direction: 'to_venue',
      target_time: '2026-11-05T09:00:00.000Z',
      pickup_zone: 'Valle Oriente',
      pickup_address: null,
      status: 'unassigned',
      created_at: '',
      updated_at: '',
      profiles: pasajeroAna,
    };

    // Simulamos que Carlos rechazó previamente el viaje para esta solicitud
    const excludedMap = new Map<string, Set<string>>();
    excludedMap.set(requestAna.id, new Set([conductorCarlos.id]));

    const result = matchRides([requestAna], drivers, 30, excludedMap);

    // Debe haber sido reasignada exitosamente con Lucía
    assert.equal(result.assigned.length, 1);
    assert.equal(result.assigned[0].driverId, conductorLucia.id);
    assert.equal(result.assigned[0].passengerId, pasajeroAna.id);
    assert.equal(result.unassigned.length, 0);
  });

  // -------------------------------------------------------------
  // CASO 3: Cero conductores disponibles
  // -------------------------------------------------------------
  test('Caso 3: Cero conductores disponibles reporta a todos como no asignados sin romper', () => {
    const drivers: DriverCandidate[] = []; // Nadie tiene auto o ventana ese día

    const requests: (RideRequest & { profiles: Profile })[] = [
      {
        id: 'req-ana',
        user_id: pasajeroAna.id,
        presence_window_id: 'win-ana',
        direction: 'to_venue',
        target_time: '2026-11-05T09:00:00.000Z',
        pickup_zone: 'Valle',
        pickup_address: null,
        status: 'unassigned',
        created_at: '',
        updated_at: '',
        profiles: pasajeroAna,
      },
      {
        id: 'req-beto',
        user_id: pasajeroBeto.id,
        presence_window_id: 'win-beto',
        direction: 'from_venue',
        target_time: '2026-11-05T14:00:00.000Z',
        pickup_zone: 'Valle',
        pickup_address: null,
        status: 'unassigned',
        created_at: '',
        updated_at: '',
        profiles: pasajeroBeto,
      },
    ];

    const result = matchRides(requests, drivers, 30);

    assert.equal(result.assigned.length, 0);
    assert.equal(result.unassigned.length, 2);
    assert.equal(result.unassigned[0].reason, 'no_drivers');
    assert.equal(result.unassigned[1].reason, 'no_drivers');
  });

  // -------------------------------------------------------------
  // CASO 4: Horarios que no coinciden (Fuera de tolerancia)
  // -------------------------------------------------------------
  test('Caso 4: Horarios que no coinciden (desfase > tolerancia) no asigna a la fuerza', () => {
    // Carlos llega a las 08:00
    const drivers: DriverCandidate[] = [
      {
        driver: conductorCarlos,
        window: {
          id: 'win-carlos',
          user_id: conductorCarlos.id,
          start_time: '2026-11-05T08:00:00.000Z',
          end_time: '2026-11-05T12:00:00.000Z',
          status: 'confirmed',
        } as PresenceWindow,
        completedRidesCount: 0,
      },
    ];

    // Ana necesita llegar a las 11:00 (diferencia de 3 horas, tolerancia default 30 min)
    const requestAna: (RideRequest & { profiles: Profile }) = {
      id: 'req-ana',
      user_id: pasajeroAna.id,
      presence_window_id: 'win-ana',
      direction: 'to_venue',
      target_time: '2026-11-05T11:00:00.000Z',
      pickup_zone: 'Valle Oriente',
      pickup_address: null,
      status: 'unassigned',
      created_at: '',
      updated_at: '',
      profiles: pasajeroAna,
    };

    const result = matchRides([requestAna], drivers, 30);

    assert.equal(result.assigned.length, 0);
    assert.equal(result.unassigned.length, 1);
    assert.equal(result.unassigned[0].reason, 'outside_time_tolerance');
  });
});
