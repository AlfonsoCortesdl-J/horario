'use client';

import { useState } from 'react';
import { Profile, AvailabilitySlot } from '@/types/database';
import Navbar from '@/components/navigation/Navbar';
import AvailabilityGrid from '@/components/availability/AvailabilityGrid';
import ProfileSettings from '@/components/profile/ProfileSettings';
import { saveUserAvailabilitySlots } from '@/app/actions/availability';
import { updateUserProfile, inviteTeamMember } from '@/app/actions/profile';
import { ShieldCheck, Calendar, Car, ArrowRight } from 'lucide-react';

interface DashboardClientProps {
  initialProfile: Profile;
  initialUserSlots: AvailabilitySlot[];
  initialAllSlots: AvailabilitySlot[];
  initialProfiles: Profile[];
}

export default function DashboardClient({
  initialProfile,
  initialUserSlots,
  initialAllSlots,
  initialProfiles,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'availability' | 'presence' | 'rides' | 'profile'>('availability');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [userSlots, setUserSlots] = useState<AvailabilitySlot[]>(initialUserSlots);
  const [allSlots, setAllSlots] = useState<AvailabilitySlot[]>(initialAllSlots);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);

  const handleSaveSlots = async (
    slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]
  ) => {
    await saveUserAvailabilitySlots(slots);
    // Actualizar estado local inmediatamente para respuesta instantánea
    const updatedUserSlots: AvailabilitySlot[] = slots.map((s, idx) => ({
      id: `local-${idx}`,
      user_id: profile.id,
      day_of_week: s.day_of_week,
      specific_date: null,
      start_time: s.start_time,
      end_time: s.end_time,
      is_recurring: s.is_recurring,
      created_at: new Date().toISOString(),
    }));
    setUserSlots(updatedUserSlots);

    // Actualizar slots grupales
    const otherSlots = allSlots.filter((s) => s.user_id !== profile.id);
    setAllSlots([...otherSlots, ...updatedUserSlots]);
  };

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    await updateUserProfile(updates);
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleInviteUser = async (email: string, fullName: string) => {
    return await inviteTeamMember(email, fullName);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 sm:p-4 pb-20">
        {/* Pestaña: Disponibilidad (When2Meet y Mapa de Calor) */}
        {activeTab === 'availability' && (
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <AvailabilityGrid
              currentUserId={profile.id}
              userSlots={userSlots}
              allSlots={allSlots}
              profiles={profiles}
              onSaveSlots={handleSaveSlots}
            />
          </div>
        )}

        {/* Pestaña: Presencia (Vista previa para Fase 2) */}
        {activeTab === 'presence' && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 bg-sky-100 dark:bg-sky-950/60 text-sky-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Ventanas de Presencia y Regla de 2
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Aquí declararás tus horas exactas de llegada y salida. El sistema vigila que nunca haya una persona sola (mínimo 2 presentes).
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400"
              >
                <span>Configurar mi disponibilidad primero</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Pestaña: Transporte (Vista previa para Fase 3) */}
        {activeTab === 'rides' && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Coordinación Automática de Transporte
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Emparejamiento inteligente de conductores y pasajeros por cercanía de zona y horarios de ida/regreso.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              >
                <span>Configurar si tengo auto en Mi Perfil</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Pestaña: Mi Perfil y Gestión de Miembros */}
        {activeTab === 'profile' && (
          <ProfileSettings
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onInviteUser={handleInviteUser}
          />
        )}
      </main>
    </div>
  );
}
