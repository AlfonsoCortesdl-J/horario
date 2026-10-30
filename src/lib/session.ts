import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'team_user_id';

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value || null;
}

export async function setSessionUserId(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 año de sesión persistente
    httpOnly: false, // Accesible por cliente y servidor
    sameSite: 'lax',
  });
}

export async function clearSessionUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
