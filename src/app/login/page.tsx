'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, CheckCircle2, AlertCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
        shouldCreateUser: false, // ¡IMPORTANTE!: Solo usuarios previamente invitados pueden entrar
      },
    });

    setLoading(false);

    if (authError) {
      if (
        authError.message.toLowerCase().includes('signups not allowed') ||
        authError.message.toLowerCase().includes('user not found')
      ) {
        setError('Este correo no está registrado en el equipo. Solicita una invitación al administrador.');
      } else {
        setError(authError.message || 'Error al enviar el enlace. Verifica tu conexión.');
      }
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30">
            <Clock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Coordinación de Presencia
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Vigilancia de Regla de 2 y carpooling para el equipo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-white">¡Enlace mágico enviado!</h2>
              <p className="mt-2 text-sm text-slate-300">
                Hemos enviado un acceso directo a:
              </p>
              <p className="font-medium text-sky-400 mt-1 break-all">{email}</p>
              <p className="mt-4 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-700/40">
                Abre el enlace desde tu celular o navegador para ingresar inmediatamente sin contraseña. Revisa también tu carpeta de spam.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 text-sm text-slate-400 hover:text-white underline underline-offset-4"
              >
                Probar con otro correo
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                  Correo electrónico
                </label>
                <div className="mt-2 relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu-correo@ejemplo.com"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-base transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 flex items-start space-x-2 text-red-200 text-xs sm:text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-base font-medium text-white bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="inline-flex items-center space-x-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    Enviando enlace...
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    Entrar con enlace mágico
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </span>
                )}
              </button>

              <div className="flex items-center justify-center space-x-2 pt-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Acceso privado restringido solo por invitación</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
