import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_URL = 'https://nctjlmfxgvdmvnkzbwfj.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdGpsbWZ4Z3ZkbXZua3pid2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjI5MDcsImV4cCI6MjEwODg5ODkwN30.YMtCRfu00PGfieA5Ue6yC49QBCuMx8maf9QTW5MBmfg';

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL).trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY).trim();

  return createBrowserClient(url, key);
}
