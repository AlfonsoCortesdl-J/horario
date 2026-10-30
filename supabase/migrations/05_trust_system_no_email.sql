-- ====================================================================
-- MIGRACIÓN 05: SISTEMA DE CONFIANZA (SIN CORREO NI MAGIC LINKS)
-- Permite registrarse e ingresar únicamente con el nombre
-- ====================================================================

-- 1. Eliminar la restricción de que el ID de perfil deba provenir de auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Asegurar que id tenga valor por defecto si no se pasa
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Hacer el email opcional (ya que ahora el acceso es por nombre)
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- 4. Permitir lectura y escritura abierta a usuarios anónimos/de confianza
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

-- 5. Crear índice por nombre para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);
