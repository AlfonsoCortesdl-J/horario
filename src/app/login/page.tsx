'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamProfiles, selectExistingMember, registerNewMember } from '@/app/actions/auth';
import { Profile } from '@/types/database';
import { User, ArrowRight, Car, Plus, Check, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setSelectedId(userId);
    setSubmitting(true);
    setError(null);
    try {
      await selectExistingMember(userId);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión';
      setError(msg);
      setSubmitting(false);
      setSelectedId(null);
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
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el nombre';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between px-4 py-8 sm:px-6 relative overflow-hidden">
      {/* Luz ambiental sutil en la parte superior (no el azul neón estridente de plantilla IA) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-gradient-to-b from-zinc-700/10 via-zinc-800/5 to-transparent blur-3xl pointer-events-none" />

      {/* Contenido principal centrado */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10">
        {/* Cabecera elegante y minimalista */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-400 mb-4 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>TecMM Zapopan · Coordinación</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            {mode === 'select' ? '¿Quién eres?' : 'Nuevo integrante'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
            {mode === 'select'
              ? 'Toca tu nombre para entrar al horario. Sin contraseñas ni correos.'
              : 'Escribe tu nombre para agregarte a la lista del equipo.'}
          </p>
        </div>

        {/* Tarjeta de interacción */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* LISTA DE INTEGRANTES */}
          {mode === 'select' && (
            <div className="space-y-2">
              {loading ? (
                <div className="py-10 text-center text-xs text-zinc-500">
                  Cargando integrantes del equipo...
                </div>
              ) : profiles.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  Aún no hay integrantes registrados.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                  {profiles.map((p) => {
                    const isCurrentLoading = submitting && selectedId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => handleSelectUser(p.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border ${
                          isCurrentLoading
                            ? 'bg-zinc-800 border-zinc-600'
                            : 'bg-zinc-950/60 border-zinc-800/70 hover:bg-zinc-800/60 hover:border-zinc-700'
                        } group`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/80 text-zinc-200 flex items-center justify-center font-semibold text-xs transition-colors group-hover:border-zinc-500">
                            {p.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-100 flex items-center gap-1.5">
                              {p.full_name}
                              {p.role === 'admin' && (
                                <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded font-normal">
                                  Admin
                                </span>
                              )}
                            </div>
                            {p.has_car ? (
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                                <Car className="w-3 h-3 text-zinc-400" />
                                <span>Conductor · {p.available_seats} lugares</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 mt-0.5">
                                Integrante
                              </div>
                            )}
                          </div>
                        </div>

                        {isCurrentLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Botón para cambiar a registro de nuevo integrante */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('new');
                }}
                className="w-full mt-3 py-2.5 px-3 rounded-xl border border-dashed border-zinc-700/80 hover:border-zinc-500 text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>¿No estás en la lista? Regístrate aquí</span>
              </button>
            </div>
          )}

          {/* FORMULARIO PARA AGREGAR NUEVO INTEGRANTE */}
          {mode === 'new' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej. Juan Pérez"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 text-sm transition-colors"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Este es el nombre que verán tus compañeros en el horario y carpooling.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                {profiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('select');
                    }}
                    className="py-2.5 px-4 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    Volver
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting || !newName.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {submitting ? 'Guardando...' : 'Unirme al equipo'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pie informativo */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-zinc-400" />
            <span>Sistema interno · Regla de 2 obligatoria en el lugar</span>
          </p>
        </div>
      </div>

      {/* Footer discreto */}
      <footer className="text-center text-[10px] text-zinc-600 relative z-10">
        Coordinación Asíncrona · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
