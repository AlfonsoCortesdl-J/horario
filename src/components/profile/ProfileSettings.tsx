'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { 
  User, 
  Car, 
  MapPin, 
  Phone, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Copy,
  KeyRound,
  Eye,
  EyeOff,
  Edit2,
  Check,
  Shield
} from 'lucide-react';
import { getAdminMembersList, adminUpdateMemberPassword } from '@/app/actions/auth';

interface ProfileSettingsProps {
  profile: Profile;
  onUpdateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  onInviteUser?: (fullName: string) => Promise<{ success: boolean; message: string }>;
}

export default function ProfileSettings({
  profile,
  onUpdateProfile,
  onInviteUser,
}: ProfileSettingsProps) {
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    has_car: profile.has_car || false,
    available_seats: profile.available_seats || 0,
    pickup_zone: profile.pickup_zone || '',
    default_pickup_point: profile.default_pickup_point || '',
    notify_by_telegram: profile.notify_by_telegram ?? true,
    notify_by_email: profile.notify_by_email ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Estados exclusivos de administración de contraseñas
  const [adminMembers, setAdminMembers] = useState<{ id: string; full_name: string; role: string; plain_password: string }[]>([]);
  const [loadingPasswords, setLoadingPasswords] = useState(false);
  const [copiedPassId, setCopiedPassId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPassValue, setEditingPassValue] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  // Cargar contraseñas si el usuario es administrador
  useEffect(() => {
    if (profile.role === 'admin') {
      setLoadingPasswords(true);
      getAdminMembersList()
        .then((list) => {
          setAdminMembers(list);
          setLoadingPasswords(false);
        })
        .catch((err) => {
          console.error('Error al cargar contraseñas admin:', err);
          setLoadingPasswords(false);
        });
    }
  }, [profile.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile({
        full_name: formData.full_name,
        has_car: formData.has_car,
        available_seats: formData.has_car ? Number(formData.available_seats) : 0,
        pickup_zone: formData.pickup_zone || null,
        default_pickup_point: formData.default_pickup_point || null,
        notify_by_telegram: formData.notify_by_telegram,
        notify_by_email: formData.notify_by_email,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = (id: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedPassId(id);
    setTimeout(() => setCopiedPassId(null), 2000);
  };

  const handleSaveEditedPassword = async (userId: string) => {
    if (!editingPassValue.trim()) return;
    setSavingPass(true);
    try {
      await adminUpdateMemberPassword(userId, editingPassValue.trim());
      setAdminMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, plain_password: editingPassValue.trim() } : m))
      );
      setEditingUserId(null);
      setEditingPassValue('');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar contraseña');
    } finally {
      setSavingPass(false);
    }
  };

  const copyTelegramCode = () => {
    if (profile.telegram_verification_code || profile.id) {
      const code = profile.telegram_verification_code || profile.id.slice(0, 8);
      navigator.clipboard.writeText(`/start ${code}`);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 text-zinc-100">
      {/* Información del Perfil */}
      <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              Mi Perfil
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configura tus preferencias de presencia y transporte
            </p>
          </div>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold border ${
            profile.role === 'admin'
              ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
              : 'bg-zinc-950 text-zinc-400 border-zinc-800'
          }`}>
            {profile.role === 'admin' ? 'Administrador' : 'Integrante'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none"
            />
          </div>

          {/* Datos de Automóvil para Carpooling */}
          <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Car className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  ¿Tienes auto para apoyar con transporte?
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.has_car}
                onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0"
              />
            </div>

            {formData.has_car && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-900">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Lugares disponibles para compañeros
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={formData.available_seats}
                    onChange={(e) => setFormData({ ...formData, available_seats: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Zona o Punto de partida habitual
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Glorieta del Cartero / TecMM"
                    value={formData.default_pickup_point}
                    onChange={(e) => setFormData({ ...formData, default_pickup_point: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {success ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Perfil guardado
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      {/* PANEL EXCLUSIVO DE ADMINISTRADOR: VER Y GESTIONAR CONTRASEÑAS SIN ENCRIPTAR */}
      {profile.role === 'admin' && (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Contraseñas del Equipo (Visible solo para Admin)
              </h2>
            </div>
            <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
              Texto Plano
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Aquí puedes consultar la contraseña de cualquier integrante si la olvida, o cambiarla directamente.
          </p>

          {loadingPasswords ? (
            <div className="py-4 text-center text-xs text-zinc-500">
              Cargando contraseñas del equipo...
            </div>
          ) : adminMembers.length === 0 ? (
            <div className="py-3 text-center text-xs text-zinc-500">
              No hay integrantes registrados aún.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950">
              {adminMembers.map((m) => {
                const isEditing = editingUserId === m.id;

                return (
                  <div key={m.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-900/40 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                          {m.full_name}
                          {m.role === 'admin' && (
                            <span className="text-[9px] text-zinc-500 border border-zinc-800 px-1 rounded">Admin</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={editingPassValue}
                            onChange={(e) => setEditingPassValue(e.target.value)}
                            placeholder="Nueva clave"
                            className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white outline-none w-28"
                          />
                          <button
                            type="button"
                            disabled={savingPass}
                            onClick={() => handleSaveEditedPassword(m.id)}
                            className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                            title="Guardar contraseña"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(null);
                              setEditingPassValue('');
                            }}
                            className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="bg-zinc-900 text-amber-300 px-2.5 py-1 rounded text-xs font-mono font-bold border border-zinc-800">
                            {m.plain_password}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyPassword(m.id, m.plain_password)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Copiar contraseña"
                          >
                            {copiedPassId === m.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(m.id);
                              setEditingPassValue(m.plain_password === '(Sin contraseña)' ? '' : m.plain_password);
                            }}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Modificar contraseña"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vinculación con Telegram */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2">
            <Send className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Alertas por Telegram</h2>
          </div>
          {profile.telegram_chat_id ? (
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Vinculado
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
              No vinculado
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400">
          El bot notifica inmediatamente si un tramo horario queda con 1 sola persona o cuando se asigna un viaje.
        </p>

        <div className="flex items-center space-x-2 pt-1">
          <code className="flex-1 bg-zinc-950 text-zinc-300 border border-zinc-800 px-3 py-2 rounded-xl font-mono text-xs select-all">
            /start {profile.telegram_verification_code || profile.id.slice(0, 8)}
          </code>
          <button
            type="button"
            onClick={copyTelegramCode}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
