import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://nctjlmfxgvdmvnkzbwfj.supabase.co';
const DEFAULT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdGpsbWZ4Z3ZkbXZua3pid2ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzMyMjkwNywiZXhwIjoyMTA4ODk4OTA3fQ.fcg_muTU5D1MZmRByAbgpKjxgSTIrA__MF2a8gGc5cs';

export function createAdminClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY).trim();

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
