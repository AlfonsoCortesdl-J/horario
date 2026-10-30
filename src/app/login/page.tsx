'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamProfiles, selectExistingMember, registerNewMember } from '@/app/actions/auth';
import { Profile } from '@/types/database';
import { Clock, User, UserPlus, Users, ArrowRight, ShieldCheck, Car } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'new'>('select');

  useEffect(() => {
    getTeamProfiles().then((list) => {
      setProfiles(list);
      setLoading(false);
      if (list.length === 0) {
        setMode('new');
      }
    });
  }, []);

  const handleSelectUser = async (userId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await selectExistingMember(userId);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al seleccionar usuario';
      setError(msg);
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await registerNewMember(newName.trim());
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrarte';
      setError(msg);
      setSubmitting(false);
    }
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
        <p className="mt-1 text-center text-xs sm:text-sm text-slate-400">
          Regla de 2 y Carpooling para el equipo
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 py-6 px-5 sm:px-8 shadow-xl rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Sistema de Confianza
            </h2>
            <span className="text-[10px] text-slate-400">Sin correos ni contraseñas</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Toggle entre elegir miembro o escribir nombre nuevo */}
          {profiles.length > 0 && (
            <div className="flex bg-slate-900/80 p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode('select')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  mode === 'select'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Soy miembro existente
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  mode === 'new'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Soy nuevo (+ registrarme)
              </button>
            </div>
          )}

          {/* LISTA DE MIEMBROS EXISTENTES */}
          {mode === 'select' && profiles.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Toca tu nombre para entrar:
              </label>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSelectUser(p.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-sky-950/40 border border-slate-700/60 hover:border-sky-500/60 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-sky-600 text-white flex items-center justify-center font-bold text-xs transition-colors">
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-white">
                          {p.full_name}
                        </div>
                        {p.has_car && (
                          <div className="text-[10px] text-sky-400 flex items-center gap-1">
                            <Car className="w-3 h-3" /> Conductor ({p.available_seats} asientos)
                          </div>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FORMULARIO PARA REGISTRAR NOMBRE NUEVO */}
          {(mode === 'new' || profiles.length === 0) && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ¿Cómo te llamas?
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Alfonso Cortés"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-600/30 transition-all disabled:opacity-50"
              >
                {submitting ? 'Entrando...' : 'Entrar al Equipo 🚀'}
              </button>
            </form>
          )}

          <div className="pt-2 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Tu nombre se guardará en tu dispositivo para recordar tu sesión.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
