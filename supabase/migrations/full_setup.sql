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
-- ====================================================================
-- MIGRACIÓN 02: POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (RLS)
-- Seguridad estricta en base de datos.
-- ====================================================================

-- 1. FUNCIÓN AUXILIAR DE VERIFICACIÓN DE ROL ADMIN
-- SECURITY DEFINER evita problemas de recursión al evaluar perfiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND role = 'admin' 
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- POLÍTICAS: app_settings
-- --------------------------------------------------------------------
CREATE POLICY "app_settings_read_all"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "app_settings_admin_manage"
    ON public.app_settings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: profiles
-- --------------------------------------------------------------------
-- Todos los miembros autenticados pueden ver perfiles para saber quién asiste/conduce
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (is_active = true OR public.is_admin());

-- Cada usuario puede actualizar sus propios datos (vehículo, teléfono, etc.)
-- pero solo admin puede cambiar roles (protegido por trigger o control de columna)
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (
        public.is_admin() OR (
            id = auth.uid() AND 
            role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "profiles_admin_all"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: availability_slots
-- --------------------------------------------------------------------
-- Todos ven la disponibilidad de todos para el mapa de calor grupal
CREATE POLICY "availability_slots_select_all"
    ON public.availability_slots FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "availability_slots_insert_own"
    ON public.availability_slots FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "availability_slots_update_own"
    ON public.availability_slots FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "availability_slots_delete_own"
    ON public.availability_slots FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: presence_windows
-- --------------------------------------------------------------------
-- Visibilidad pública de ventanas para cálculo de mapa de cobertura
CREATE POLICY "presence_windows_select_all"
    ON public.presence_windows FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "presence_windows_insert_own"
    ON public.presence_windows FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "presence_windows_update_own"
    ON public.presence_windows FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "presence_windows_delete_own"
    ON public.presence_windows FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: coverage_alerts
-- --------------------------------------------------------------------
CREATE POLICY "coverage_alerts_select_all"
    ON public.coverage_alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "coverage_alerts_admin_modify"
    ON public.coverage_alerts FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: ride_requests
-- --------------------------------------------------------------------
CREATE POLICY "ride_requests_select"
    ON public.ride_requests FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.ride_assignments ra 
            WHERE ra.request_id = public.ride_requests.id 
              AND ra.driver_id = auth.uid()
        )
    );

CREATE POLICY "ride_requests_manage_own"
    ON public.ride_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "ride_requests_update_own"
    ON public.ride_requests FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "ride_requests_delete_own"
    ON public.ride_requests FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: ride_assignments
-- --------------------------------------------------------------------
CREATE POLICY "ride_assignments_select"
    ON public.ride_assignments FOR SELECT
    TO authenticated
    USING (
        driver_id = auth.uid() 
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.ride_requests rr
            WHERE rr.id = public.ride_assignments.request_id
              AND rr.user_id = auth.uid()
        )
    );

CREATE POLICY "ride_assignments_update_driver_or_admin"
    ON public.ride_assignments FOR UPDATE
    TO authenticated
    USING (driver_id = auth.uid() OR public.is_admin())
    WITH CHECK (driver_id = auth.uid() OR public.is_admin());

CREATE POLICY "ride_assignments_admin_all"
    ON public.ride_assignments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: driver_history
-- --------------------------------------------------------------------
CREATE POLICY "driver_history_select"
    ON public.driver_history FOR SELECT
    TO authenticated
    USING (driver_id = auth.uid() OR public.is_admin());

CREATE POLICY "driver_history_admin_all"
    ON public.driver_history FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: notifications
-- --------------------------------------------------------------------
CREATE POLICY "notifications_select_own"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_update_own"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------------------
-- POLÍTICAS: audit_log (EXCLUSIVO DEL ADMIN POR RLS)
-- --------------------------------------------------------------------
-- Un miembro regular recibe 0 filas si intenta consultar audit_log
CREATE POLICY "audit_log_admin_select_only"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- No se permite que nadie modifique ni borre el audit log directamente
CREATE POLICY "audit_log_immutable"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin() OR auth.uid() IS NOT NULL);
-- ====================================================================
-- MIGRACIÓN 03: FUNCIONES DE CÁLCULO DE COBERTURA Y AUDITORÍA
-- Algoritmo SQL para mapa de calor/cobertura de bloques de 30 minutos
-- y verificación de la REGLA DE 2.
-- ====================================================================

-- 1. FUNCIÓN PRINCIPAL: calculate_coverage_slots
-- Retorna cada bloque de tiempo con número de personas, nombres y estado (gris, rojo, verde)
CREATE OR REPLACE FUNCTION public.calculate_coverage_slots(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_interval_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    person_count INTEGER,
    user_ids UUID[],
    user_names TEXT[],
    status TEXT -- 'empty' (0), 'solo' (1 - violación), 'covered' (>=2)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_min_presence INTEGER;
    v_admin_counts BOOLEAN;
BEGIN
    -- Obtener configuraciones del sistema
    SELECT 
        COALESCE(min_presence_required, 2),
        COALESCE(admin_counts_for_coverage, true)
    INTO v_min_presence, v_admin_counts
    FROM public.app_settings
    LIMIT 1;

    IF v_min_presence IS NULL THEN
        v_min_presence := 2;
    END IF;
    IF v_admin_counts IS NULL THEN
        v_admin_counts := true;
    END IF;

    RETURN QUERY
    WITH slot_generator AS (
        SELECT 
            s AS current_slot_start,
            s + (p_interval_minutes || ' minutes')::INTERVAL AS current_slot_end
        FROM generate_series(
            p_start_time,
            p_end_time - (p_interval_minutes || ' minutes')::INTERVAL,
            (p_interval_minutes || ' minutes')::INTERVAL
        ) AS s
    ),
    active_windows AS (
        SELECT 
            pw.id AS window_id,
            pw.user_id,
            p.full_name,
            p.role,
            pw.start_time,
            pw.end_time
        FROM public.presence_windows pw
        JOIN public.profiles p ON p.id = pw.user_id
        WHERE pw.status != 'cancelled'
          AND pw.end_time > p_start_time
          AND pw.start_time < p_end_time
    ),
    slot_overlaps AS (
        SELECT 
            sg.current_slot_start,
            sg.current_slot_end,
            aw.user_id,
            aw.full_name,
            aw.role
        FROM slot_generator sg
        LEFT JOIN active_windows aw 
          ON aw.start_time < sg.current_slot_end 
         AND aw.end_time > sg.current_slot_start
    ),
    aggregated_slots AS (
        SELECT 
            so.current_slot_start,
            so.current_slot_end,
            -- Conteo: si admin_counts es falso, no se cuenta al admin para el quorum de cobertura
            COUNT(DISTINCT CASE 
                WHEN so.user_id IS NULL THEN NULL
                WHEN NOT v_admin_counts AND so.role = 'admin' THEN NULL 
                ELSE so.user_id 
            END)::INTEGER AS active_count,
            ARRAY_AGG(DISTINCT so.user_id) FILTER (WHERE so.user_id IS NOT NULL) AS ids,
            ARRAY_AGG(DISTINCT so.full_name) FILTER (WHERE so.full_name IS NOT NULL) AS names
        FROM slot_overlaps so
        GROUP BY so.current_slot_start, so.current_slot_end
    )
    SELECT 
        agg.current_slot_start AS slot_start,
        agg.current_slot_end AS slot_end,
        COALESCE(agg.active_count, 0) AS person_count,
        COALESCE(agg.ids, ARRAY[]::UUID[]) AS user_ids,
        COALESCE(agg.names, ARRAY[]::TEXT[]) AS user_names,
        CASE 
            WHEN COALESCE(agg.active_count, 0) = 0 THEN 'empty'
            WHEN COALESCE(agg.active_count, 0) < v_min_presence THEN 'solo' -- ROJO
            ELSE 'covered' -- VERDE
        END AS status
    FROM aggregated_slots agg
    ORDER BY agg.current_slot_start ASC;
END;
$$;

-- 2. FUNCIÓN DE IMPACTO: analyze_presence_change
-- Evalúa el impacto de agregar, modificar o cancelar una ventana antes de ejecutar la acción
CREATE OR REPLACE FUNCTION public.analyze_presence_change(
    p_user_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_action TEXT, -- 'CREATE', 'UPDATE', 'CANCEL'
    p_exclude_window_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_solo_slots_count INTEGER := 0;
    v_affected_slots JSONB := '[]'::jsonb;
    v_affected_users JSONB := '[]'::jsonb;
    v_min_presence INTEGER;
    v_has_solo_violation BOOLEAN := false;
BEGIN
    SELECT COALESCE(min_presence_required, 2) INTO v_min_presence
    FROM public.app_settings LIMIT 1;

    -- Simulación temporal según acción
    IF p_action = 'CANCEL' THEN
        -- Al cancelar: revisamos si en los bloques de la ventana cancelada
        -- otros usuarios quedarían exactamente con 1 persona
        WITH simulated_active AS (
            SELECT pw.id, pw.user_id, p.full_name, pw.start_time, pw.end_time
            FROM public.presence_windows pw
            JOIN public.profiles p ON p.id = pw.user_id
            WHERE pw.status != 'cancelled'
              AND pw.id != p_exclude_window_id
              AND pw.start_time < p_end_time
              AND pw.end_time > p_start_time
        ),
        slots AS (
            SELECT 
                s AS slot_s, 
                s + INTERVAL '30 minutes' AS slot_e
            FROM generate_series(p_start_time, p_end_time - INTERVAL '30 minutes', INTERVAL '30 minutes') AS s
        ),
        counts AS (
            SELECT 
                sl.slot_s,
                sl.slot_e,
                COUNT(DISTINCT sa.user_id)::INTEGER AS person_count,
                ARRAY_AGG(DISTINCT sa.full_name) FILTER (WHERE sa.user_id IS NOT NULL) AS remaining_names,
                ARRAY_AGG(DISTINCT sa.user_id) FILTER (WHERE sa.user_id IS NOT NULL) AS remaining_ids
            FROM slots sl
            LEFT JOIN simulated_active sa 
              ON sa.start_time < sl.slot_e AND sa.end_time > sl.slot_s
            GROUP BY sl.slot_s, sl.slot_e
        )
        SELECT 
            COUNT(*) FILTER (WHERE person_count = 1),
            COALESCE(jsonb_agg(jsonb_build_object(
                'start', slot_s,
                'end', slot_e,
                'count', person_count,
                'remaining_users', remaining_names,
                'remaining_user_ids', remaining_ids
            )) FILTER (WHERE person_count = 1), '[]'::jsonb)
        INTO v_solo_slots_count, v_affected_slots
        FROM counts;

        v_has_solo_violation := (v_solo_slots_count > 0);

    ELSIF p_action IN ('CREATE', 'UPDATE') THEN
        -- Al crear: revisamos si la nueva ventana tiene tramos donde el usuario estará solo (count = 1)
        WITH other_active AS (
            SELECT pw.id, pw.user_id, pw.start_time, pw.end_time
            FROM public.presence_windows pw
            WHERE pw.status != 'cancelled'
              AND (p_exclude_window_id IS NULL OR pw.id != p_exclude_window_id)
              AND pw.start_time < p_end_time
              AND pw.end_time > p_start_time
        ),
        slots AS (
            SELECT 
                s AS slot_s, 
                s + INTERVAL '30 minutes' AS slot_e
            FROM generate_series(p_start_time, p_end_time - INTERVAL '30 minutes', INTERVAL '30 minutes') AS s
        ),
        counts AS (
            SELECT 
                sl.slot_s,
                sl.slot_e,
                -- 1 (el usuario actual) + conteo de otros usuarios presentes
                (1 + COUNT(DISTINCT oa.user_id) FILTER (WHERE oa.user_id != p_user_id))::INTEGER AS total_count
            FROM slots sl
            LEFT JOIN other_active oa 
              ON oa.start_time < sl.slot_e AND oa.end_time > sl.slot_s
            GROUP BY sl.slot_s, sl.slot_e
        )
        SELECT 
            COUNT(*) FILTER (WHERE total_count < v_min_presence),
            COALESCE(jsonb_agg(jsonb_build_object(
                'start', slot_s,
                'end', slot_e,
                'count', total_count
            )) FILTER (WHERE total_count < v_min_presence), '[]'::jsonb)
        INTO v_solo_slots_count, v_affected_slots
        FROM counts;

        v_has_solo_violation := (v_solo_slots_count > 0);
    END IF;

    RETURN jsonb_build_object(
        'has_solo_violation', v_has_solo_violation,
        'solo_slots_count', v_solo_slots_count,
        'affected_slots', v_affected_slots
    );
END;
$$;

-- 3. AUDITORÍA AUTOMÁTICA EN AUDIT_LOG
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor UUID;
    v_action audit_action;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_record_id UUID;
    v_note TEXT := NULL;
BEGIN
    v_actor := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;

        -- Detección de check-in / check-out / cancel específico
        IF TG_TABLE_NAME = 'presence_windows' THEN
            IF OLD.checked_in_at IS NULL AND NEW.checked_in_at IS NOT NULL THEN
                v_action := 'CHECK_IN';
                v_note := 'Check-in registrado';
            ELSIF OLD.checked_out_at IS NULL AND NEW.checked_out_at IS NOT NULL THEN
                v_action := 'CHECK_OUT';
                v_note := 'Check-out registrado';
            ELSIF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
                v_action := 'CANCEL';
                v_note := COALESCE(NEW.cancellation_reason, 'Cancelación de ventana');
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_old := to_jsonb(OLD);
        v_record_id := OLD.id;
    END IF;

    INSERT INTO public.audit_log (
        performed_by,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        note
    ) VALUES (
        v_actor,
        TG_TABLE_NAME,
        v_record_id,
        v_action,
        v_old,
        v_new,
        v_note
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparadores de auditoría en tablas clave
DROP TRIGGER IF EXISTS trg_audit_presence_windows ON public.presence_windows;
CREATE TRIGGER trg_audit_presence_windows
AFTER INSERT OR UPDATE OR DELETE ON public.presence_windows
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ride_requests ON public.ride_requests;
CREATE TRIGGER trg_audit_ride_requests
AFTER INSERT OR UPDATE OR DELETE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ride_assignments ON public.ride_assignments;
CREATE TRIGGER trg_audit_ride_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.ride_assignments
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_app_settings ON public.app_settings;
CREATE TRIGGER trg_audit_app_settings
AFTER UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. TRIGGER AUTOMÁTICO: Creación de perfil al registrarse nuevo usuario vía Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_count INTEGER;
    v_role user_role := 'member';
BEGIN
    -- Si es el primer usuario que se registra en la base de datos, asignarle rol 'admin' automáticamente
    SELECT COUNT(*) INTO v_user_count FROM public.profiles;
    IF v_user_count = 0 THEN
        v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        v_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
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
