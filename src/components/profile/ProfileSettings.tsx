'use client';

import { useState } from 'react';
import { Profile } from '@/types/database';
import { 
  User, 
  Car, 
  MapPin, 
  Phone, 
  Send, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Mail, 
  ShieldAlert,
  Copy,
  ExternalLink
} from 'lucide-react';

interface ProfileSettingsProps {
  profile: Profile;
  onUpdateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  onInviteUser?: (email: string, fullName: string) => Promise<{ success: boolean; message: string }>;
}

export default function ProfileSettings({
  profile,
  onUpdateProfile,
  onInviteUser,
}: ProfileSettingsProps) {
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    has_car: profile.has_car || false,
    available_seats: profile.available_seats || 0,
    pickup_zone: profile.pickup_zone || '',
    default_pickup_point: profile.default_pickup_point || '',
    notify_by_telegram: profile.notify_by_telegram ?? true,
    notify_by_email: profile.notify_by_email ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Estado para invitar miembros (solo admin)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile({
        full_name: formData.full_name,
        phone: formData.phone || null,
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

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onInviteUser || !inviteEmail.trim()) return;

    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await onInviteUser(inviteEmail.trim(), inviteName.trim());
      if (res.success) {
        setInviteMsg({ type: 'success', text: `¡Invitación enviada a ${inviteEmail}!` });
        setInviteEmail('');
        setInviteName('');
      } else {
        setInviteMsg({ type: 'error', text: res.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar invitación';
      setInviteMsg({ type: 'error', text: msg });
    } finally {
      setInviting(false);
    }
  };

  const copyTelegramCode = () => {
    if (profile.telegram_verification_code) {
      navigator.clipboard.writeText(profile.telegram_verification_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Información del Perfil */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-sky-500" />
              Mi Perfil
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Datos para coordinación de presencia y transporte
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            profile.role === 'admin'
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            Rol: {profile.role === 'admin' ? 'Administrador' : 'Miembro'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Teléfono / WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                placeholder="55 1234 5678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sección de Transporte / Conductor */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Car className="w-5 h-5 text-sky-500" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">¿Tienes vehículo propio?</h3>
                <p className="text-xs text-slate-500">Para participar como conductor voluntario en carpooling</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_car}
                onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {formData.has_car && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-semibold text-sky-900 dark:text-sky-300 mb-1">
                  Asientos Libres
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.available_seats}
                  onChange={(e) => setFormData({ ...formData, available_seats: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-sky-900 dark:text-sky-300 mb-1">
                  Zona / Colonia de Salida
                </label>
                <input
                  type="text"
                  placeholder="Ej. Garza Sada / Valle"
                  value={formData.pickup_zone}
                  onChange={(e) => setFormData({ ...formData, pickup_zone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-sky-900 dark:text-sky-300 mb-1">
                  Punto Habitual de Recogida
                </label>
                <input
                  type="text"
                  placeholder="Ej. Oxxo estación / Entrada campus"
                  value={formData.default_pickup_point}
                  onChange={(e) => setFormData({ ...formData, default_pickup_point: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 rounded-lg outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notificaciones */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-sky-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Canales de Notificación</h3>
          </div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notify_by_telegram}
                onChange={(e) => setFormData({ ...formData, notify_by_telegram: e.target.checked })}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Recibir avisos por Telegram (recomendado, instantáneo)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notify_by_email}
                onChange={(e) => setFormData({ ...formData, notify_by_email: e.target.checked })}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Recibir avisos por Correo Electrónico (respaldo)</span>
            </label>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between">
          {success ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Perfil guardado con éxito
            </span>
          ) : <span />}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-all shadow-md shadow-sky-600/30 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      {/* Vinculación con Telegram */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Send className="w-5 h-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bot de Telegram</h2>
          </div>
          {profile.telegram_chat_id ? (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> No vinculado
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          El bot te avisa en segundos si un tramo queda sin compañero, si alguien necesita acompañante o cuando se te asigne un viaje de transporte.
        </p>

        {profile.telegram_chat_id ? (
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
            Tu cuenta está vinculada al Chat ID: <span className="font-mono font-bold">{profile.telegram_chat_id}</span>. Ya puedes recibir todas las alertas en tiempo real.
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Instrucciones para vincular tu Telegram en 2 pasos:
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
              <li>Abre nuestro bot en Telegram buscándolo como el bot configurado por tu admin.</li>
              <li>Envíale el siguiente comando con tu código único:</li>
            </ol>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-slate-900 text-sky-400 px-3 py-2 rounded-lg font-mono text-xs select-all">
                /start {profile.telegram_verification_code || profile.id.slice(0, 8)}
              </code>
              <button
                type="button"
                onClick={copyTelegramCode}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panel Exclusivo de Administrador: Invitar Miembros */}
      {profile.role === 'admin' && onInviteUser && (
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-amber-100 dark:border-amber-950/60">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gestión de Miembros (Solo Admin)
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Invita a las otras 9 personas del equipo. Recibirán un correo con su enlace mágico directo para ingresar a la app.
          </p>

          <form onSubmit={handleInviteSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nombre de la persona
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sofía Martínez"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="sofia@ejemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {inviteMsg && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
                inviteMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300'
              }`}>
                {inviteMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{inviteMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={inviting}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
            >
              {inviting ? 'Enviando invitación...' : 'Enviar Invitación'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
