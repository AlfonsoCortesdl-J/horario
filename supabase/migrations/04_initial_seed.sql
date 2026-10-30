-- ====================================================================
-- MIGRACIÓN 04: DATOS SEMILLA INICIALES
-- Inserta la configuración inicial por defecto del sistema
-- ====================================================================

INSERT INTO public.app_settings (
    min_presence_required,
    admin_counts_for_coverage,
    slot_interval_minutes,
    overlap_tolerance_minutes,
    operating_hours_start,
    operating_hours_end,
    timezone,
    weekly_report_day
) 
SELECT 
    2,                          -- Mínimo 2 personas en todo momento
    true,                       -- El admin sí cuenta para la cobertura
    30,                         -- Bloques de 30 minutos
    30,                         -- Tolerancia de carpooling ±30 minutos
    '07:00:00'::TIME,           -- Inicio horario de operación
    '23:00:00'::TIME,           -- Fin horario de operación
    'America/Mexico_City',      -- Zona horaria de referencia
    0                           -- Reporte semanal los domingos
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);
