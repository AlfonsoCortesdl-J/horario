import { createClient } from '@supabase/supabase-js';

const DUMMY_URL = 'https://placeholder.supabase.co';
const DUMMY_KEY = 'placeholder-key-for-build';

export function createAdminClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : DUMMY_URL;
  const serviceKey = envKey && envKey.length > 20 ? envKey : DUMMY_KEY;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
