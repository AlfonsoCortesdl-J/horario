'use client';

import { useState } from 'react';
import { Profile, AvailabilitySlot, PresenceWindow, CoverageSlot } from '@/types/database';
import Navbar from '@/components/navigation/Navbar';
import AvailabilityGrid from '@/components/availability/AvailabilityGrid';
import PresenceCalendar from '@/components/presence/PresenceCalendar';
import RidesHub from '@/components/rides/RidesHub';
import ProfileSettings from '@/components/profile/ProfileSettings';
import ReportPanel from '@/components/report/ReportPanel';
import { saveUserAvailabilitySlots } from '@/app/actions/availability';
import { updateUserProfile, inviteTeamMember } from '@/app/actions/profile';
import { 
  createPresenceWindow, 
  cancelPresenceWindow, 
  checkInPresence, 
  checkOutPresence,
  getPresenceWindowsAndCoverage
} from '@/app/actions/presence';
import { executeAutomaticRideMatching, respondToRideAssignment } from '@/app/actions/rides';

interface DashboardClientProps {
  initialProfile: Profile;
  initialUserSlots: AvailabilitySlot[];
  initialAllSlots: AvailabilitySlot[];
  initialProfiles: Profile[];
  initialWindows: (PresenceWindow & { profiles?: Profile })[];
  initialCoverageSlots: CoverageSlot[];
  initialRidesData: {
    myPassengerRequests: any[];
    myDriverAssignments: any[];
    availableDriversCount: number;
    allDayRequests: any[];
  };
}

export default function DashboardClient({
  initialProfile,
  initialUserSlots,
  initialAllSlots,
  initialProfiles,
  initialWindows,
  initialCoverageSlots,
  initialRidesData,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'availability' | 'presence' | 'rides' | 'profile' | 'report'>('availability');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [userSlots, setUserSlots] = useState<AvailabilitySlot[]>(initialUserSlots);
  const [allSlots, setAllSlots] = useState<AvailabilitySlot[]>(initialAllSlots);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [windows, setWindows] = useState<(PresenceWindow & { profiles?: Profile })[]>(initialWindows);
  const [coverageSlots, setCoverageSlots] = useState<CoverageSlot[]>(initialCoverageSlots);
  const [ridesData, setRidesData] = useState(initialRidesData);

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

  const handleInviteUser = async (fullName: string) => {
    return await inviteTeamMember(fullName);
  };

  // Manejador de Crear Ventana de Presencia
  const handleCreateWindow = async (data: {
    start_time: string;
    end_time: string;
    note?: string;
    need_ride_to?: boolean;
    need_ride_from?: boolean;
  }) => {
    await createPresenceWindow(data);
    const refreshed = await getPresenceWindowsAndCoverage(data.start_time);
    setWindows(refreshed.windows);
    setCoverageSlots(refreshed.coverageSlots);
  };

  // Manejador de Cancelar Ventana
  const handleCancelWindow = async (windowId: string, reason: string) => {
    await cancelPresenceWindow({ windowId, reason });
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

  // Manejador de Transporte
  const handleRunMatching = async (dateStr: string) => {
    return await executeAutomaticRideMatching(dateStr);
  };

  const handleRespondAssignment = async (assignmentId: string, accepted: boolean, reason?: string) => {
    return await respondToRideAssignment({ assignmentId, accepted, rejectionReason: reason });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 sm:p-4 pb-24">
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
          <div className="flex-1 flex flex-col bg-zinc-900/60 rounded-2xl border border-zinc-800/80 overflow-hidden">
            <AvailabilityGrid
              currentUserId={profile.id}
              userSlots={userSlots}
              allSlots={allSlots}
              profiles={profiles}
              onSaveSlots={handleSaveSlots}
            />
          </div>
        )}

        {/* Pestaña: Transporte y Carpooling Automático (Módulo 3) */}
        {activeTab === 'rides' && (
          <RidesHub
            currentUserId={profile.id}
            userProfile={profile}
            initialData={ridesData}
            onRunMatching={handleRunMatching}
            onRespondAssignment={handleRespondAssignment}
          />
        )}

        {/* Pestaña: Mi Perfil y Gestión de Miembros */}
        {activeTab === 'profile' && (
          <ProfileSettings
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onInviteUser={handleInviteUser}
          />
        )}

        {/* Pestaña: Reporte Semanal con descarga PDF */}
        {activeTab === 'report' && (
          <ReportPanel />
        )}
      </main>
    </div>
  );
}
