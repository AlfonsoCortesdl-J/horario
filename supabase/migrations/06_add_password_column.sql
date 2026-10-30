-- ====================================================================
-- MIGRACIÓN 06: COLUMNA DE CONTRASEÑA EN TEXTO PLANO
-- Permite acceso protegido por usuario y visualización por el admin
-- ====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';

-- Asignar contraseña por defecto al admin si no tiene una
UPDATE public.profiles 
SET password = 'admin' 
WHERE role = 'admin' AND (password IS NULL OR password = '');
