import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { Profile, AvailabilitySlot } from '@/types/database';
import { getPresenceWindowsAndCoverage } from '@/app/actions/presence';
import { getRidesData } from '@/app/actions/rides';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect('/login');
  }

  const supabase = createAdminClient();

  // Obtener perfil del usuario activo en el sistema de confianza
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // Si por alguna razón el perfil fue eliminado, volver a la selección de nombre
  if (!profile) {
    redirect('/login');
  }

  const todayIso = new Date().toISOString();

  // Cargar disponibilidad, perfiles, ventanas de presencia y datos de carpooling
  const [userSlotsRes, allSlotsRes, profilesRes, presenceData, ridesData] = await Promise.all([
    supabase.from('availability_slots').select('*').eq('user_id', profile.id),
    supabase.from('availability_slots').select('*'),
    supabase.from('profiles').select('*').eq('is_active', true),
    getPresenceWindowsAndCoverage(todayIso),
    getRidesData(todayIso),
  ]);

  const userSlots = (userSlotsRes.data || []) as AvailabilitySlot[];
  const allSlots = (allSlotsRes.data || []) as AvailabilitySlot[];
  const profiles = (profilesRes.data || []) as Profile[];

  return (
    <DashboardClient
      initialProfile={profile as Profile}
      initialUserSlots={userSlots}
      initialAllSlots={allSlots}
      initialProfiles={profiles}
      initialWindows={presenceData.windows}
      initialCoverageSlots={presenceData.coverageSlots}
      initialRidesData={ridesData}
    />
  );
}
