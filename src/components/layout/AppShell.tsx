'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = pathname === '/login' || pathname.startsWith('/estimasi/ttd');
  const isMekanik = currentUser?.role === 'mekanik';
  const isEstimator = currentUser?.role === 'estimator';

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPage) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && isMekanik && !pathname.startsWith('/checkup') && !isPublicPage) {
      router.replace('/checkup');
    } else if (!isLoading && isAuthenticated && isEstimator && !pathname.startsWith('/estimasi') && !isPublicPage) {
      router.replace('/estimasi');
    }
  }, [isLoading, isAuthenticated, isPublicPage, isMekanik, isEstimator, pathname, router]);

  // Halaman publik (Login atau Lembar TTD Customer Publik): tampilkan langsung tanpa shell/sidebar/navbar
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Loading spinner saat cek sesi
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  // Belum login: tampilkan loading (redirect segera)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Mekanik mencoba membuka halaman non-checkup: tampilkan pesan akses terbatas selagi redirect
  if (isMekanik && !pathname.startsWith('/checkup')) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex items-center justify-center">
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-card max-w-md">
              <div className="w-12 h-12 rounded-2xl bg-maroon-100 text-maroon-700 flex items-center justify-center mx-auto mb-3 font-black text-sm">
                MK
              </div>
              <h2 className="text-base font-black text-slate-900">Hak Akses Terbatas (Role Mekanik)</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Role Mekanik dikhususkan untuk mengisi modul <strong>Checklist Quality Control (Tune Up, AC &amp; Understeel)</strong>. Mengalihkan ke lembar checklist...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Estimator mencoba membuka halaman non-estimasi: tampilkan pesan akses terbatas selagi redirect
  if (isEstimator && !pathname.startsWith('/estimasi')) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex items-center justify-center">
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-card max-w-md">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 font-black text-sm">
                EST
              </div>
              <h2 className="text-base font-black text-slate-900">Hak Akses Estimasi Biaya</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Akun Anda dikhususkan untuk modul <strong>Estimasi Biaya</strong> untuk seluruh cabang. Mengalihkan ke modul estimasi...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Sudah login: tampilkan layout penuh
  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
        {/* Sticky Top Navbar */}
        <Navbar />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
