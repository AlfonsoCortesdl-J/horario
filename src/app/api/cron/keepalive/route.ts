import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  // Validar cabecera de autorización de Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    // Consulta simple a app_settings para registrar actividad y evitar pausa tras 7 días
    const { data, error } = await supabase.from('app_settings').select('id').limit(1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Ping de actividad a Supabase completado con éxito',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en ping de actividad';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
