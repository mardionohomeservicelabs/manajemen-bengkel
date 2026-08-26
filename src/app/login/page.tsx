'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { BRANCHES, BranchId } from '@/lib/auth/users';
import {
  Shield,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Building2,
} from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated && mounted) {
      if (currentUser?.role === 'mekanik') {
        window.location.href = '/checkup';
      } else {
        window.location.href = '/';
      }
    }
  }, [isAuthenticated, mounted, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email dan password tidak boleh kosong.');
      return;
    }

    setIsLoading(true);
    // Simulasi delay autentikasi untuk UX
    await new Promise((r) => setTimeout(r, 600));

    const result = login(email, password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Login gagal. Silakan coba lagi.');
    } else {
      if (result.user?.role === 'mekanik') {
        window.location.href = '/checkup';
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-maroon-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-maroon-800/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-maroon-900/10 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Top glow */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-maroon-500 to-transparent rounded-full" />

        <div
          className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 0 60px rgba(139, 0, 0, 0.15), 0 25px 50px rgba(0,0,0,0.5)' }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center bg-gradient-to-b from-maroon-950/60 to-transparent border-b border-slate-700/30">
            {/* Logo area */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-maroon-800 to-maroon-950 flex items-center justify-center border border-maroon-700/50 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-shield.png"
                    alt="Mardiono Home Service"
                    className="w-14 h-14 object-contain"
                    style={{ mixBlendMode: 'screen' }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>

            <h1 className="text-xl font-black text-white uppercase tracking-wider">
              MARDIONO
            </h1>
            <p className="text-sm font-black text-white tracking-widest uppercase -mt-0.5">
              Home Service
            </p>
            <p className="text-xs text-slate-300 font-medium mt-2">
              Sistem Manajemen Bengkel
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            <div className="mb-5 text-center">
              <h2 className="text-base font-black text-white">Masuk ke Sistem</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gunakan email & password sesuai cabang Anda
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="email@mhs.mardiono"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-600/50 text-white placeholder:text-slate-500 text-sm rounded-xl focus:outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500/20 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Masukkan password..."
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 bg-slate-800/60 border border-slate-600/50 text-white placeholder:text-slate-500 text-sm rounded-xl focus:outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-950/60 border border-red-800/50 rounded-xl text-red-300 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-maroon-700 to-maroon-800 hover:from-maroon-600 hover:to-maroon-700 text-white font-black text-sm rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-maroon-900/40 disabled:opacity-60 disabled:cursor-not-allowed border border-maroon-600/30 mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>

            {/* Branches & Mechanic Quick Fill Info */}
            <div className="mt-6 pt-5 border-t border-slate-700/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                    Akses Cepat Login Mekanik
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Klik untuk isi otomatis</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('mekanik@mhs1.mardiono');
                    setPassword('mhs1mekanik');
                    setError('');
                  }}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-left transition cursor-pointer group"
                >
                  <div className="text-[10px] font-black text-amber-300 group-hover:text-amber-200">MHS 1 (Trosobo)</div>
                  <div className="text-[9px] text-slate-400 truncate">Agus Susanto</div>
                  <div className="text-[8.5px] text-slate-500 font-mono mt-0.5">mhs1mekanik</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('mekanik@mhs2.mardiono');
                    setPassword('mhs2mekanik');
                    setError('');
                  }}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-left transition cursor-pointer group"
                >
                  <div className="text-[10px] font-black text-amber-300 group-hover:text-amber-200">MHS 2 (Wiyung)</div>
                  <div className="text-[9px] text-slate-400 truncate">Budi Santoso</div>
                  <div className="text-[8.5px] text-slate-500 font-mono mt-0.5">mhs2mekanik</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('mekanik@mhs3.mardiono');
                    setPassword('mhs3mekanik');
                    setError('');
                  }}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-left transition cursor-pointer group"
                >
                  <div className="text-[10px] font-black text-amber-300 group-hover:text-amber-200">MHS 3 (Kenjeran)</div>
                  <div className="text-[9px] text-slate-400 truncate">Agus Susanto</div>
                  <div className="text-[8.5px] text-slate-500 font-mono mt-0.5">mhs3mekanik</div>
                </button>
              </div>

              <p className="text-[10px] text-slate-500 text-center pt-1">
                🔒 Akun mekanik hanya memiliki izin untuk mengisi &amp; melihat formulir checklist.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom glow */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-800 to-transparent rounded-full opacity-50" />
      </div>
    </div>
  );
}
