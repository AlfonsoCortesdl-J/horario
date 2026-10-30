import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://nctjlmfxgvdmvnkzbwfj.supabase.co';
const DEFAULT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdGpsbWZ4Z3ZkbXZua3pid2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzMyMjkwNywiZXhwIjoyMTA4ODk4OTA3fQ.fcg_muTU5D1MZmRByAbgpKjxgSTIrA__MF2a8gGc5cs';

export function createAdminClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : DEFAULT_URL;
  const serviceKey = envKey && envKey.length > 20 ? envKey : DEFAULT_SERVICE_KEY;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
