import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener ventanas de la última semana
    const { data: windows } = await supabase
      .from('presence_windows')
      .select('*, profiles(full_name, email)')
      .gte('start_time', sevenDaysAgo.toISOString())
      .lte('start_time', now.toISOString());

    // Obtener alertas de la última semana
    const { data: alerts } = await supabase
      .from('coverage_alerts')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString());

    // Calcular estadísticas
    const confirmedCount = (windows || []).filter((w) => w.status === 'confirmed').length;
    const cancelledCount = (windows || []).filter((w) => w.status === 'cancelled').length;
    const alertCount = (alerts || []).length;

    return NextResponse.json({
      success: true,
      reportPeriod: {
        from: sevenDaysAgo.toISOString(),
        to: now.toISOString(),
      },
      summary: {
        totalWindows: (windows || []).length,
        confirmedWindows: confirmedCount,
        cancelledWindows: cancelledCount,
        coverageAlertsGenerated: alertCount,
      },
      message: 'Reporte semanal generado exitosamente',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al generar reporte semanal';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
