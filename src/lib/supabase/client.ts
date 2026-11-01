import { createBrowserClient } from '@supabase/ssr';

const DUMMY_URL = 'https://placeholder.supabase.co';
const DUMMY_KEY = 'placeholder-key-for-build';

export function createClient() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const url = envUrl && envUrl.startsWith('http') ? envUrl : DUMMY_URL;
  const key = envKey && envKey.length > 20 ? envKey : DUMMY_KEY;

  return createBrowserClient(url, key);
}
