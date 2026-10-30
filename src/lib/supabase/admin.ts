import { createClient } from '@supabase/supabase-js';

// Cliente con service_role EXCLUSIVO para uso del servidor (invitaciones, triggers de fondo)
// NUNCA importar ni ejecutar en componentes del cliente
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
