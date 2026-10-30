import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Cron semanal que corre cada Sábado por la noche (06:00 UTC Domingo = medianoche en México)
 * Limpia los horarios de la semana anterior para que el equipo pueda ingresar sus nuevos horarios el domingo.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Limpiar todos los bloques de disponibilidad para la nueva semana
  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error en el reinicio semanal de horarios:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Registrar en el log de auditoría
  try {
    await supabase.from('audit_log').insert({
      table_name: 'availability_slots',
      action: 'DELETE',
      note: 'Reinicio automático semanal de disponibilidad (Sábado noche / Domingo madrugada)',
    });
  } catch {
    // Continuar si la tabla audit_log tiene alguna restricción
  }

  return NextResponse.json({
    success: true,
    message: 'Horarios de disponibilidad reiniciados con éxito para la nueva semana (Domingo en adelante).',
    timestamp: new Date().toISOString(),
  });
}
