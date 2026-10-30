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
