'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { ROLE_LABELS } from '@/lib/auth/users';
import {
  Clock,
  Calendar,
  PlusCircle,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const { currentRole } = useApp();
  const { currentUser, activeBranch } = useAuth();
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

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b-2 border-maroon-800/20 shadow-subtle no-print">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">

        {/* Left: Tanggal & Jam + Cabang */}
        <div className="flex items-center space-x-3">
          {/* Badge Cabang */}
          <div className="flex items-center space-x-1.5 bg-maroon-50 border border-maroon-200 px-2.5 py-1 rounded-full">
            <Building2 className="w-3 h-3 text-maroon-700" />
            <span className="text-xs font-black text-maroon-800 uppercase tracking-wider">
              {activeBranch}
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

        {/* Right: User Info + Quick Actions */}
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

          {/* User Pill */}
          <div className="hidden sm:flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="w-6 h-6 rounded-md bg-maroon-900 flex items-center justify-center text-amber-300 font-black text-[10px]">
              {currentRole === 'owner' ? 'OW' : currentRole === 'admin' ? 'AD' : 'SA'}
            </div>
            <div className="leading-none">
              <div className="text-[11px] font-black text-slate-900">
                {currentUser?.full_name || 'Pengguna'}
              </div>
              <div className="text-[9px] text-maroon-700 font-bold uppercase tracking-wider">
                {ROLE_LABELS[currentRole]}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
