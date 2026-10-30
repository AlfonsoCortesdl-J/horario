'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamProfiles, verifyMemberPassword, registerNewMember } from '@/app/actions/auth';
import { Profile } from '@/types/database';
import { User, ArrowRight, Car, Plus, Shield, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<(Profile & { has_password: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo: lista, password prompt para usuario seleccionado, o nuevo registro
  const [selectedUser, setSelectedUser] = useState<(Profile & { has_password: boolean }) | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Formulario nuevo usuario
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    getTeamProfiles().then((list) => {
      setProfiles(list);
      setLoading(false);
      if (list.length === 0) {
        setMode('new');
      }
    });
  }, []);

  const handleSelectUserClick = (p: Profile & { has_password: boolean }) => {
    setError(null);
    setPassword('');
    setSelectedUser(p);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!password.trim()) {
      setError('Por favor ingresa tu contraseña');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyMemberPassword(selectedUser.id, password);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al verificar contraseña';
      setError(msg);
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!newPassword.trim()) {
      setError('Debes asignar una contraseña para tu cuenta');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerNewMember(newName.trim(), newPassword.trim());
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el usuario';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between px-4 py-8 sm:px-6 relative overflow-hidden">
      {/* Luz ambiental superior */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-gradient-to-b from-zinc-700/10 via-zinc-800/5 to-transparent blur-3xl pointer-events-none" />

      {/* Contenedor central */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10">
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-400 mb-4 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>TecMM Zapopan · Coordinación</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            {selectedUser
              ? `Hola, ${selectedUser.full_name.split(' ')[0]}`
              : mode === 'select'
              ? '¿Quién eres?'
              : 'Nuevo integrante'}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto">
            {selectedUser
              ? 'Ingresa tu contraseña para entrar al horario.'
              : mode === 'select'
              ? 'Selecciona tu nombre para ingresar.'
              : 'Regístrate con tu nombre y contraseña personal.'}
          </p>
        </div>

        {/* Tarjeta de interacción */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* VISTA 1: INGRESO DE CONTRASEÑA DE UN USUARIO SELECCIONADO */}
          {selectedUser ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center font-semibold text-sm">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-100 truncate">
                    {selectedUser.full_name}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {selectedUser.role === 'admin' ? 'Administrador' : 'Integrante'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                >
                  Cambiar
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Contraseña</span>
                  {selectedUser.role === 'admin' && (
                    <span className="text-[10px] text-zinc-500 font-normal">
                      (Clave admin requerida)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Escribe tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!selectedUser.has_password && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Aún no tienes contraseña; la que ingreses ahora quedará guardada.</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setError(null);
                  }}
                  className="py-2.5 px-4 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting || !password.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {submitting ? 'Verificando...' : 'Entrar'}
                </button>
              </div>
            </form>
          ) : mode === 'select' ? (
            /* VISTA 2: LISTA DE INTEGRANTES */
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
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectUserClick(p)}
                      className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border bg-zinc-950/60 border-zinc-800/70 hover:bg-zinc-800/60 hover:border-zinc-700 group"
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

                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
                        <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Botón para registrarse */}
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
          ) : (
            /* VISTA 3: REGISTRO DE NUEVO INTEGRANTE CON CONTRASEÑA */
            <form onSubmit={handleCreateUser} className="space-y-3.5">
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
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Asigna tu contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tu contraseña personal"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Guarda esta contraseña. Si la olvidas, el administrador del equipo podrá consultarla para recordártela.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
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
                  disabled={submitting || !newName.trim() || !newPassword.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {submitting ? 'Creando cuenta...' : 'Crear mi cuenta y entrar'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pie informativo */}
        <div className="mt-5 text-center">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sistema interno · Regla de 2 obligatoria en el lugar</span>
          </p>
        </div>
      </div>

      <footer className="text-center text-[10px] text-zinc-600 relative z-10">
        Coordinación Asíncrona TecMM Zapopan
      </footer>
    </main>
  );
}
