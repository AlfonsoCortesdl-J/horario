import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCoverageSlots, analyzePresenceChangeImpact } from '../calculator.ts';
import type { PresenceWindow, Profile } from '../../../types/database.ts';

describe('Cálculo de Cobertura y Regla de 2 (Pruebas Unitarias)', () => {

  const profileJuan: Profile = {
    id: 'user-juan-1',
    full_name: 'Juan Pérez',
    email: 'juan@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: null,
    pickup_zone: null,
    default_pickup_point: null,
    telegram_chat_id: null,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const profileMaria: Profile = {
    id: 'user-maria-2',
    full_name: 'María Gómez',
    email: 'maria@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: null,
    pickup_zone: null,
    default_pickup_point: null,
    telegram_chat_id: null,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const profilePedro: Profile = {
    id: 'user-pedro-3',
    full_name: 'Pedro Soto',
    email: 'pedro@test.com',
    role: 'member',
    is_active: true,
    has_car: false,
    available_seats: 0,
    phone: null,
    pickup_zone: null,
    default_pickup_point: null,
    telegram_chat_id: null,
    telegram_verification_code: null,
    telegram_verified_at: null,
    notify_by_telegram: true,
    notify_by_email: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // -------------------------------------------------------------
  // CASO 1: Ventanas sin traslape (Ambos quedan solos en ROJO)
  // -------------------------------------------------------------
  test('Caso 1: Ventanas sin traslape resultan en violación (status = solo / rojo)', () => {
    // Juan de 09:00 a 11:00
    // María de 13:00 a 15:00
    const windows: (PresenceWindow & { profiles: Profile })[] = [
      {
        id: 'w-1',
        user_id: profileJuan.id,
        start_time: '2026-11-02T09:00:00.000Z',
        end_time: '2026-11-02T11:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileJuan,
      },
      {
        id: 'w-2',
        user_id: profileMaria.id,
        start_time: '2026-11-02T13:00:00.000Z',
        end_time: '2026-11-02T15:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileMaria,
      },
    ];

    const slots = calculateCoverageSlots(
      windows,
      new Date('2026-11-02T08:00:00.000Z'),
      new Date('2026-11-02T16:00:00.000Z')
    );

    // Los bloques de 09:00 a 11:00 deben tener person_count = 1 y status = 'solo'
    const juanSlots = slots.filter(
      (s) => new Date(s.slot_start) >= new Date('2026-11-02T09:00:00.000Z') &&
             new Date(s.slot_end) <= new Date('2026-11-02T11:00:00.000Z')
    );
    assert.equal(juanSlots.length, 4);
    juanSlots.forEach((s) => {
      assert.equal(s.person_count, 1);
      assert.equal(s.status, 'solo');
      assert.deepEqual(s.user_names, ['Juan Pérez']);
    });

    // Los bloques entre 11:00 y 13:00 deben estar 'empty' (0 personas)
    const emptySlots = slots.filter(
      (s) => new Date(s.slot_start) >= new Date('2026-11-02T11:00:00.000Z') &&
             new Date(s.slot_end) <= new Date('2026-11-02T13:00:00.000Z')
    );
    emptySlots.forEach((s) => {
      assert.equal(s.person_count, 0);
      assert.equal(s.status, 'empty');
    });
  });

  // -------------------------------------------------------------
  // CASO 2: Traslape parcial (Tramo en común verde, bordes rojos)
  // -------------------------------------------------------------
  test('Caso 2: Traslape parcial genera tramos verdes y tramos solos en rojo', () => {
    // Juan de 09:00 a 12:00 (4 horas)
    // María de 11:00 a 14:00 (se cruzan de 11:00 a 12:00)
    const windows: (PresenceWindow & { profiles: Profile })[] = [
      {
        id: 'w-1',
        user_id: profileJuan.id,
        start_time: '2026-11-02T09:00:00.000Z',
        end_time: '2026-11-02T12:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileJuan,
      },
      {
        id: 'w-2',
        user_id: profileMaria.id,
        start_time: '2026-11-02T11:00:00.000Z',
        end_time: '2026-11-02T14:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileMaria,
      },
    ];

    const slots = calculateCoverageSlots(
      windows,
      new Date('2026-11-02T09:00:00.000Z'),
      new Date('2026-11-02T14:00:00.000Z')
    );

    // 09:00 a 11:00: Juan solo (status 'solo')
    const soloJuan = slots.filter((s) => new Date(s.slot_end) <= new Date('2026-11-02T11:00:00.000Z'));
    assert.equal(soloJuan.length, 4);
    soloJuan.forEach((s) => assert.equal(s.status, 'solo'));

    // 11:00 a 12:00: Ambos juntos (status 'covered' / VERDE con 2 personas)
    const coveredOverlap = slots.filter(
      (s) => new Date(s.slot_start) >= new Date('2026-11-02T11:00:00.000Z') &&
             new Date(s.slot_end) <= new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(coveredOverlap.length, 2);
    coveredOverlap.forEach((s) => {
      assert.equal(s.person_count, 2);
      assert.equal(s.status, 'covered');
      assert.ok(s.user_names.includes('Juan Pérez') && s.user_names.includes('María Gómez'));
    });

    // 12:00 a 14:00: María sola (status 'solo')
    const soloMaria = slots.filter((s) => new Date(s.slot_start) >= new Date('2026-11-02T12:00:00.000Z'));
    assert.equal(soloMaria.length, 4);
    soloMaria.forEach((s) => {
      assert.equal(s.status, 'solo');
      assert.deepEqual(s.user_names, ['María Gómez']);
    });
  });

  // -------------------------------------------------------------
  // CASO 3: Cancelación que deja a uno solo (Advertencia exacta)
  // -------------------------------------------------------------
  test('Caso 3: Cancelar una ventana detecta que deja a otra persona sola con nombre y horas', () => {
    // Ambos estaban juntos de 10:00 a 13:00 (Regla cumplida)
    const windows: (PresenceWindow & { profiles: Profile })[] = [
      {
        id: 'w-juan',
        user_id: profileJuan.id,
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T13:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileJuan,
      },
      {
        id: 'w-maria',
        user_id: profileMaria.id,
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T13:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileMaria,
      },
    ];

    // Simular que Juan cancela su ventana
    const impact = analyzePresenceChangeImpact(
      windows,
      {
        id: 'w-juan',
        user_id: profileJuan.id,
        user_name: profileJuan.full_name,
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T13:00:00.000Z',
      },
      'CANCEL'
    );

    assert.equal(impact.hasSoloViolation, true);
    assert.equal(impact.soloSlotsCount, 6); // 3 horas en bloques de 30 min = 6 bloques
    assert.deepEqual(impact.affectedUserNames, ['María Gómez']);
    assert.equal(impact.affectedSlots[0].remainingUsers[0], 'María Gómez');
  });

  // -------------------------------------------------------------
  // CASO 4: Tres personas con salidas escalonadas
  // -------------------------------------------------------------
  test('Caso 4: Tres personas escalonadas mantienen cobertura continua (siempre >= 2)', () => {
    // Juan: 09:00 - 12:00
    // María: 10:00 - 13:00
    // Pedro: 11:00 - 14:00
    const windows: (PresenceWindow & { profiles: Profile })[] = [
      {
        id: 'w-1',
        user_id: profileJuan.id,
        start_time: '2026-11-02T09:00:00.000Z',
        end_time: '2026-11-02T12:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileJuan,
      },
      {
        id: 'w-2',
        user_id: profileMaria.id,
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T13:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileMaria,
      },
      {
        id: 'w-3',
        user_id: profilePedro.id,
        start_time: '2026-11-02T11:00:00.000Z',
        end_time: '2026-11-02T14:00:00.000Z',
        note: null,
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profilePedro,
      },
    ];

    const slots = calculateCoverageSlots(
      windows,
      new Date('2026-11-02T10:00:00.000Z'),
      new Date('2026-11-02T13:00:00.000Z')
    );

    // En todo el intervalo central 10:00 - 13:00 siempre hay al menos 2 personas
    assert.equal(slots.length, 6);
    slots.forEach((s) => {
      assert.ok(s.person_count >= 2, `Bloque ${s.slot_start} debe tener >= 2 personas`);
      assert.equal(s.status, 'covered');
    });

    // En el intervalo 11:00 - 12:00 coinciden los 3
    const threePeopleSlots = slots.filter(
      (s) => new Date(s.slot_start) >= new Date('2026-11-02T11:00:00.000Z') &&
             new Date(s.slot_end) <= new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(threePeopleSlots.length, 2);
    threePeopleSlots.forEach((s) => {
      assert.equal(s.person_count, 3);
    });
  });

  // -------------------------------------------------------------
  // CASO 5: Ventana que cruza medianoche
  // -------------------------------------------------------------
  test('Caso 5: Ventana que cruza medianoche se evalúa correctamente en el cambio de día', () => {
    // Sesión nocturna: Juan y María de 22:00 (día 2) a 02:00 (día 3)
    const windows: (PresenceWindow & { profiles: Profile })[] = [
      {
        id: 'w-noche-juan',
        user_id: profileJuan.id,
        start_time: '2026-11-02T22:00:00.000Z',
        end_time: '2026-11-03T02:00:00.000Z',
        note: 'Hackathon nocturno',
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileJuan,
      },
      {
        id: 'w-noche-maria',
        user_id: profileMaria.id,
        start_time: '2026-11-02T22:00:00.000Z',
        end_time: '2026-11-03T02:00:00.000Z',
        note: 'Hackathon nocturno',
        status: 'confirmed',
        checked_in_at: null,
        checked_out_at: null,
        need_ride_to: false,
        need_ride_from: false,
        cancellation_reason: null,
        cancelled_at: null,
        created_at: '',
        updated_at: '',
        profiles: profileMaria,
      },
    ];

    const slots = calculateCoverageSlots(
      windows,
      new Date('2026-11-02T22:00:00.000Z'),
      new Date('2026-11-03T02:00:00.000Z')
    );

    // 4 horas = 8 bloques de 30 min (4 antes de medianoche y 4 después)
    assert.equal(slots.length, 8);
    slots.forEach((s) => {
      assert.equal(s.person_count, 2);
      assert.equal(s.status, 'covered');
    });

    // Comprobar que el bloque que cruza 00:00 a 00:30 pertenece al día 3
    const midnightSlot = slots.find(
      (s) => new Date(s.slot_start).toISOString() === '2026-11-03T00:00:00.000Z'
    );
    assert.ok(midnightSlot);
    assert.equal(midnightSlot.status, 'covered');
    assert.equal(midnightSlot.person_count, 2);
  });
});
