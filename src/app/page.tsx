import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { Profile, AvailabilitySlot } from '@/types/database';
import { getPresenceWindowsAndCoverage } from '@/app/actions/presence';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Obtener perfil del usuario autenticado
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Si aún no existe el perfil (por ejemplo primera sesión), crearlo automáticamente
  if (!profile) {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const isFirstUser = (count || 0) === 0;

    const newProfile = {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Miembro',
      role: isFirstUser ? ('admin' as const) : ('member' as const),
      is_active: true,
      has_car: false,
      available_seats: 0,
      notify_by_telegram: true,
      notify_by_email: true,
    };

    const { data: insertedProfile } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select('*')
      .single();

    profile = insertedProfile || newProfile;
  }

  // Cargar slots de disponibilidad, perfiles y ventanas de presencia de hoy
  const todayIso = new Date().toISOString();

  const [userSlotsRes, allSlotsRes, profilesRes, presenceData] = await Promise.all([
    supabase.from('availability_slots').select('*').eq('user_id', user.id),
    supabase.from('availability_slots').select('*'),
    supabase.from('profiles').select('*').eq('is_active', true),
    getPresenceWindowsAndCoverage(todayIso),
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
    />
  );
}
