'use client';

import { Profile } from '@/types/database';
import { 
  CalendarClock, 
  Users, 
  Car, 
  User, 
  LogOut,
  FileText
} from 'lucide-react';
import { logoutMember } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  profile: Profile | null;
  activeTab: 'availability' | 'presence' | 'rides' | 'profile' | 'report';
  setActiveTab: (tab: 'availability' | 'presence' | 'rides' | 'profile' | 'report') => void;
}

export default function Navbar({ profile, activeTab, setActiveTab }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutMember();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Barra Superior */}
      <header className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 text-zinc-100 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Logo Minimalista de la Regla de 2 (Dos anillos enlazados) */}
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="12" r="5" />
              <circle cx="15" cy="12" r="5" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-tight text-white flex items-center gap-1.5">
              <span>Coordinación</span>
              <span className="text-[10px] text-zinc-400 font-normal">Zapopan</span>
              {profile?.role === 'admin' && (
                <span className="text-[9px] uppercase tracking-wider font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.2 rounded">
                  Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {profile ? profile.full_name : 'Cargando...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Badge sutil de Regla de 2 */}
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Regla de 2 activa</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Cambiar de usuario"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Barra de Navegación Inferior Móvil (Dock moderno) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800/80 py-1.5 px-3 flex justify-around items-center">
        <button
          type="button"
          onClick={() => setActiveTab('availability')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'availability'
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'availability' ? 'bg-zinc-800 text-white' : ''}`}>
            <CalendarClock className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Horarios</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presence')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'presence'
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'presence' ? 'bg-zinc-800 text-white' : ''}`}>
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Presencia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rides')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'rides'
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'rides' ? 'bg-zinc-800 text-white' : ''}`}>
            <Car className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Transporte</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'report'
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'report' ? 'bg-zinc-800 text-white' : ''}`}>
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Reporte</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'profile'
              ? 'text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'profile' ? 'bg-zinc-800 text-white' : ''}`}>
            <User className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">
            {profile?.role === 'admin' ? 'Admin' : 'Perfil'}
          </span>
        </button>
      </nav>
    </>
  );
}
