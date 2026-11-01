import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DUMMY_URL = 'https://placeholder.supabase.co';
const DUMMY_KEY = 'placeholder-key-for-build';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const url = envUrl && envUrl.startsWith('http') ? envUrl : DUMMY_URL;
  const key = envKey && envKey.length > 20 ? envKey : DUMMY_KEY;

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // Maneja llamadas desde Server Components donde no se pueden mutar cookies
          }
        },
      },
    }
  );
}
