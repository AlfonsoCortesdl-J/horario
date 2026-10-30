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
