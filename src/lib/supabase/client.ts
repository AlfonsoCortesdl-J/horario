import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_URL = 'https://nctjlmfxgvdmvnkzbwfj.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdGpsbWZ4Z3ZkbXZua3pid2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjI5MDcsImV4cCI6MjEwODg5ODkwN30.YMtCRfu00PGfieA5Ue6yC49QBCuMx8maf9QTW5MBmfg';

export function createClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const url = envUrl && envUrl.startsWith('http') ? envUrl : DEFAULT_URL;
  const key = envKey && envKey.length > 20 ? envKey : DEFAULT_ANON_KEY;

  return createBrowserClient(url, key);
}
