'use client';

import { useState } from 'react';
import { Profile, AvailabilitySlot, PresenceWindow, CoverageSlot } from '@/types/database';
import Navbar from '@/components/navigation/Navbar';
import AvailabilityGrid from '@/components/availability/AvailabilityGrid';
import PresenceCalendar from '@/components/presence/PresenceCalendar';
import ProfileSettings from '@/components/profile/ProfileSettings';
import { saveUserAvailabilitySlots } from '@/app/actions/availability';
import { updateUserProfile, inviteTeamMember } from '@/app/actions/profile';
import { 
  createPresenceWindow, 
  cancelPresenceWindow, 
  checkInPresence, 
  checkOutPresence,
  getPresenceWindowsAndCoverage
} from '@/app/actions/presence';
import { Car, ArrowRight } from 'lucide-react';

interface DashboardClientProps {
  initialProfile: Profile;
  initialUserSlots: AvailabilitySlot[];
  initialAllSlots: AvailabilitySlot[];
  initialProfiles: Profile[];
  initialWindows: (PresenceWindow & { profiles?: Profile })[];
  initialCoverageSlots: CoverageSlot[];
}

export default function DashboardClient({
  initialProfile,
  initialUserSlots,
  initialAllSlots,
  initialProfiles,
  initialWindows,
  initialCoverageSlots,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'availability' | 'presence' | 'rides' | 'profile'>('presence');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [userSlots, setUserSlots] = useState<AvailabilitySlot[]>(initialUserSlots);
  const [allSlots, setAllSlots] = useState<AvailabilitySlot[]>(initialAllSlots);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [windows, setWindows] = useState<(PresenceWindow & { profiles?: Profile })[]>(initialWindows);
  const [coverageSlots, setCoverageSlots] = useState<CoverageSlot[]>(initialCoverageSlots);

  // Manejador de Disponibilidad
  const handleSaveSlots = async (
    slots: { day_of_week: number; start_time: string; end_time: string; is_recurring: boolean }[]
  ) => {
    await saveUserAvailabilitySlots(slots);
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
    const otherSlots = allSlots.filter((s) => s.user_id !== profile.id);
    setAllSlots([...otherSlots, ...updatedUserSlots]);
  };

  // Manejador de Perfil
  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    await updateUserProfile(updates);
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleInviteUser = async (email: string, fullName: string) => {
    return await inviteTeamMember(email, fullName);
  };

  // Manejador de Crear Ventana de Presencia
  const handleCreateWindow = async (data: {
    start_time: string;
    end_time: string;
    note?: string;
    need_ride_to?: boolean;
    need_ride_from?: boolean;
  }) => {
    const res = await createPresenceWindow(data);
    // Recargar ventanas y cobertura actualizadas
    const refreshed = await getPresenceWindowsAndCoverage(data.start_time);
    setWindows(refreshed.windows);
    setCoverageSlots(refreshed.coverageSlots);
  };

  // Manejador de Cancelar Ventana
  const handleCancelWindow = async (windowId: string, reason: string) => {
    await cancelPresenceWindow({ windowId, reason });
    // Recargar ventanas y cobertura
    const targetDate = windows.find((w) => w.id === windowId)?.start_time || new Date().toISOString();
    const refreshed = await getPresenceWindowsAndCoverage(targetDate);
    setWindows(refreshed.windows);
    setCoverageSlots(refreshed.coverageSlots);
  };

  // Check-in / Check-out
  const handleCheckIn = async (windowId: string) => {
    await checkInPresence(windowId);
  };

  const handleCheckOut = async (windowId: string) => {
    return await checkOutPresence(windowId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 sm:p-4 pb-20">
        {/* Pestaña: Presencia y Mapa de Cobertura (Módulo 2 Núcleo) */}
        {activeTab === 'presence' && (
          <PresenceCalendar
            currentUserId={profile.id}
            currentUserName={profile.full_name}
            initialWindows={windows}
            initialCoverageSlots={coverageSlots}
            onCreateWindow={handleCreateWindow}
            onCancelWindow={handleCancelWindow}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />
        )}

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
