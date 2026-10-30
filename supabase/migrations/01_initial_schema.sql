-- ====================================================================
-- MIGRACIÓN 01: ESQUEMA BASE, TIPOS, TABLAS E ÍNDICES
-- App de Coordinación de Presencia (Regla de 2 & Carpooling)
-- ====================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TIPOS PERSONALIZADOS (ENUMS)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE presence_status AS ENUM ('confirmed', 'pending_partner', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE alert_type AS ENUM ('solo_window', 'cancellation_risk', 'checkout_risk', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ride_direction AS ENUM ('to_venue', 'from_venue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ride_request_status AS ENUM ('unassigned', 'assigned', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ride_assignment_status AS ENUM ('pending_driver_acceptance', 'accepted', 'rejected', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'CHECK_IN', 'CHECK_OUT', 'CANCEL', 'OVERRIDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('telegram', 'email', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. TABLA: app_settings (Configuración global del sistema)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_presence_required INTEGER NOT NULL DEFAULT 2,
    admin_counts_for_coverage BOOLEAN NOT NULL DEFAULT true,
    slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
    overlap_tolerance_minutes INTEGER NOT NULL DEFAULT 30,
    operating_hours_start TIME NOT NULL DEFAULT '07:00:00',
    operating_hours_end TIME NOT NULL DEFAULT '23:00:00',
    timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
    weekly_report_day INTEGER NOT NULL DEFAULT 0, -- 0 = Domingo
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLA: profiles (Perfiles vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Datos de conductor y transporte
    has_car BOOLEAN NOT NULL DEFAULT false,
    available_seats INTEGER NOT NULL DEFAULT 0 CHECK (available_seats >= 0),
    pickup_zone TEXT,
    default_pickup_point TEXT,
    -- Notificaciones y vinculación Telegram
    telegram_chat_id BIGINT UNIQUE,
    telegram_verification_code TEXT,
    telegram_verified_at TIMESTAMPTZ,
    notify_by_telegram BOOLEAN NOT NULL DEFAULT true,
    notify_by_email BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLA: availability_slots (Disponibilidad tipo when2meet)
CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Lun, ..., 6=Sáb
    specific_date DATE, -- Para fechas puntuales concretas
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_slot_time CHECK (end_time > start_time),
    CONSTRAINT chk_slot_type CHECK (
        (is_recurring = true AND day_of_week IS NOT NULL) OR 
        (is_recurring = false AND specific_date IS NOT NULL)
    )
);

-- 6. TABLA: presence_windows (Ventanas declaradas de presencia en el lugar)
CREATE TABLE IF NOT EXISTS public.presence_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    note TEXT,
    status presence_status NOT NULL DEFAULT 'confirmed',
    -- Check-in / Check-out opcional
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    -- Requerimiento de transporte
    need_ride_to BOOLEAN NOT NULL DEFAULT false,
    need_ride_from BOOLEAN NOT NULL DEFAULT false,
    -- Justificación si cancela
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_window_time CHECK (end_time > start_time)
);

-- 7. TABLA: coverage_alerts (Alertas de tramo solitario o rotura de regla de 2)
CREATE TABLE IF NOT EXISTS public.coverage_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presence_window_id UUID REFERENCES public.presence_windows(id) ON DELETE SET NULL,
    alert_type alert_type NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    affected_user_ids UUID[] NOT NULL DEFAULT '{}',
    message TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABLA: ride_requests (Solicitudes de transporte de ida o regreso)
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    presence_window_id UUID NOT NULL REFERENCES public.presence_windows(id) ON DELETE CASCADE,
    direction ride_direction NOT NULL,
    target_time TIMESTAMPTZ NOT NULL,
    pickup_zone TEXT,
    pickup_address TEXT,
    status ride_request_status NOT NULL DEFAULT 'unassigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABLA: ride_assignments (Asignación automática o manual de pasajero a conductor)
CREATE TABLE IF NOT EXISTS public.ride_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_window_id UUID REFERENCES public.presence_windows(id) ON DELETE SET NULL,
    scheduled_pickup_time TIMESTAMPTZ NOT NULL,
    pickup_location TEXT NOT NULL,
    status ride_assignment_status NOT NULL DEFAULT 'pending_driver_acceptance',
    rejection_reason TEXT,
    driver_response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. TABLA: driver_history (Historial para balanceo y rotación equitativa de conductores)
CREATE TABLE IF NOT EXISTS public.driver_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.ride_assignments(id) ON DELETE SET NULL,
    ride_date DATE NOT NULL,
    passenger_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. TABLA: notifications (Cola y registro de notificaciones enviadas)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. TABLA: audit_log (Registro inmutable y exclusivo del admin)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    action audit_action NOT NULL,
    old_data JSONB,
    new_data JSONB,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_presence_windows_times ON public.presence_windows(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_presence_windows_user_status ON public.presence_windows(user_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_slots_user ON public.availability_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_day ON public.availability_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.ride_requests(status, target_time);
CREATE INDEX IF NOT EXISTS idx_ride_assignments_driver ON public.ride_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_coverage_alerts_unresolved ON public.coverage_alerts(is_resolved) WHERE NOT is_resolved;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON public.notifications(user_id, is_sent);

-- 14. TRIGGER DE ACTUALIZACIÓN DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_presence_windows_updated_at ON public.presence_windows;
CREATE TRIGGER trg_presence_windows_updated_at BEFORE UPDATE ON public.presence_windows
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ride_requests_updated_at ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_updated_at BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ride_assignments_updated_at ON public.ride_assignments;
CREATE TRIGGER trg_ride_assignments_updated_at BEFORE UPDATE ON public.ride_assignments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
