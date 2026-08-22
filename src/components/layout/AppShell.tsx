'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // Halaman login: tampilkan saja tanpa shell
  if (isLoginPage) {
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
