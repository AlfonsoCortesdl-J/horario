import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('team_user_id');
  const hasUserSession = Boolean(sessionCookie?.value);

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';

  // Si no ha elegido nombre y trata de acceder a la app, redirigir a /login
  if (!hasUserSession && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Si ya tiene sesión activa e intenta ir a /login, redirigir al panel principal
  if (hasUserSession && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto:
     * - _next/static, _next/image, favicon.ico, api/cron, manifest.json, y archivos multimedia
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
