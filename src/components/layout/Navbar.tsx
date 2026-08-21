'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { UserRole } from '@/lib/types/database';
import {
  ShieldCheck,
  User,
  Wrench,
  Clock,
  Calendar,
  Database,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function Navbar() {
  const { currentRole, setCurrentRole, settings } = useApp();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const roles: { role: UserRole; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      role: 'sa',
      label: 'Service Advisor',
      icon: <Wrench className="w-3.5 h-3.5" />,
      desc: 'Intake, SPK & 3 TTD',
    },
    {
      role: 'admin',
      label: 'Admin',
      icon: <User className="w-3.5 h-3.5" />,
      desc: 'Antrean, Kasir & CRM',
    },
    {
      role: 'owner',
      label: 'Owner',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      desc: 'Akses Penuh & Laporan',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b-2 border-maroon-800/20 shadow-subtle no-print">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Workshop Quick Title & Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
              Bengkel Buka
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-3 text-xs text-slate-600 border-l border-slate-300 pl-3">
            <span className="flex items-center space-x-1 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-maroon-700" />
              <span>{currentDate || 'Hari ini'}</span>
            </span>
            <span className="flex items-center space-x-1 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <Clock className="w-3 h-3 text-maroon-700" />
              <span>{currentTime || '00:00:00'}</span>
            </span>
          </div>
        </div>

        {/* Center/Right: Quick Actions & Role Switcher */}
        <div className="flex items-center space-x-3">
          {/* Quick Intake Button */}
          <Link
            href="/spk/new"
            className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition hover:shadow duration-150"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intake SPK Baru</span>
            <span className="sm:hidden">+ SPK</span>
          </Link>

          {/* Quick Checkup Button */}
          <Link
            href="/checkup/new"
            className="hidden sm:inline-flex items-center space-x-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition hover:shadow duration-150"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Checkup QC/AC</span>
          </Link>

          {/* Role Switcher Pill Container */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 px-2 hidden sm:block">
              Role:
            </div>
            <div className="flex space-x-1">
              {roles.map((r) => {
                const isActive = currentRole === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => setCurrentRole(r.role)}
                    title={r.desc}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 ${
                      isActive
                        ? 'bg-maroon-700 text-white shadow-sm ring-1 ring-maroon-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {r.icon}
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
