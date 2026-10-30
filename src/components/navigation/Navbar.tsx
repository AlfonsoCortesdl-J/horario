'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Profile } from '@/types/database';
import { 
  CalendarClock, 
  Users, 
  Car, 
  User, 
  ShieldCheck, 
  LogOut,
  Clock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  profile: Profile | null;
  activeTab: 'availability' | 'presence' | 'rides' | 'profile';
  setActiveTab: (tab: 'availability' | 'presence' | 'rides' | 'profile') => void;
}

export default function Navbar({ profile, activeTab, setActiveTab }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Barra Superior */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center shadow-md shadow-sky-600/30">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none text-white flex items-center gap-1.5">
              Presencia
              {profile?.role === 'admin' && (
                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">
              {profile ? profile.full_name : 'Cargando...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Indicador de regla de 2 */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Mínimo 2 presentes</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Barra de Navegación Inferior Móvil (Mobile-first bottom navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-1 px-2 flex justify-around items-center">
        <button
          type="button"
          onClick={() => setActiveTab('availability')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            activeTab === 'availability'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarClock className={`w-5 h-5 ${activeTab === 'availability' ? 'scale-110' : ''}`} />
          <span className="text-[11px] mt-1">Disponibilidad</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presence')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            activeTab === 'presence'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'presence' ? 'scale-110' : ''}`} />
          <span className="text-[11px] mt-1">Presencia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rides')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            activeTab === 'rides'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Car className={`w-5 h-5 ${activeTab === 'rides' ? 'scale-110' : ''}`} />
          <span className="text-[11px] mt-1">Transporte</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            activeTab === 'profile'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'scale-110' : ''}`} />
          <span className="text-[11px] mt-1">
            {profile?.role === 'admin' ? 'Admin / Perfil' : 'Mi Perfil'}
          </span>
        </button>
      </nav>
    </>
  );
}
