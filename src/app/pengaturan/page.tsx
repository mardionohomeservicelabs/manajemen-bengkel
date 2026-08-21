'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  Settings,
  Building,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  MessageSquare,
  Database,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, refreshData, showToast, currentRole } = useApp();

  const [form, setForm] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    updateSettings(form);
    setIsSaving(false);
  };

  const handleResetData = () => {
    if (
      window.confirm(
        'Apakah Anda yakin ingin mereset seluruh database demo ke data awal bengkel? Data penambahan baru akan kembali ke default.'
      )
    ) {
      DBService.resetToDefault();
      refreshData();
      showToast('Database demo berhasil direset ke kondisi awal!', 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <Settings className="w-6 h-6 text-maroon-700" />
          <span>Pengaturan Profil Bengkel & Integrasi</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Konfigurasi nama bengkel, rekening pembayaran nota, template WhatsApp & status database.
        </p>
      </div>

      {/* Supabase Status Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isSupabaseConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Status Koneksi Database Supabase
              </h3>
              <p className="text-xs text-slate-500">
                {isSupabaseConfigured
                  ? 'Terhubung dengan Supabase Cloud PostgreSQL'
                  : 'Mode Hybrid Lokal (Simulasi & Pengujian Instan Tanpa Setup)'}
              </p>
            </div>
          </div>

          <span
            className={`text-xs px-3 py-1 rounded-full font-bold border ${
              isSupabaseConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isSupabaseConfigured ? '🟢 Online (Supabase)' : '🟡 Local Storage Active'}
          </span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1.5">
          <p>
            <strong>Panduan Setup Supabase untuk Deployment Vercel:</strong>
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-500">
            <li>
              Buat proyek baru di{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-maroon-700 underline font-medium"
              >
                Supabase Dashboard
              </a>
              .
            </li>
            <li>
              Salin dan jalankan skrip SQL dari berkas{' '}
              <code className="bg-slate-200 px-1 py-0.5 rounded text-maroon-900 font-mono">
                supabase/schema.sql
              </code>{' '}
              dan{' '}
              <code className="bg-slate-200 px-1 py-0.5 rounded text-maroon-900 font-mono">
                supabase/seed.sql
              </code>{' '}
              di SQL Editor Supabase.
            </li>
            <li>
              Isi environment variables pada <code className="font-mono">.env.local</code> atau di Vercel:
              <br />
              <code className="font-mono text-[11px] text-slate-700">
                NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
                <br />
                NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
              </code>
            </li>
          </ol>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-3 border-b border-slate-100">
          Informasi Profil Bengkel (Tampil di Lembar SPK & Nota Cetak)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Nama Bengkel / Usaha</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-semibold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Nomor Telepon & WhatsApp Bengkel</label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email Resmi</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Alamat Lengkap Bengkel</label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600"
            />
          </div>
        </div>

        <div className="space-y-4 text-xs pt-4 border-t border-slate-100">
          <div>
            <label className="block font-bold text-slate-800 uppercase tracking-wider mb-1">
              Rekening Pembayaran Bank (Tampil di Nota & Invoice):
            </label>
            <textarea
              rows={2}
              value={form.bank_account_info}
              onChange={(e) => setForm({ ...form, bank_account_info: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase tracking-wider mb-1">
              Ketentuan Garansi & Syarat Layanan:
            </label>
            <textarea
              rows={3}
              value={form.terms_conditions}
              onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase tracking-wider mb-1">
              Template Pesan Pengingat Servis Berkala (CRM WhatsApp):
            </label>
            <textarea
              rows={3}
              value={form.wa_template_reminder}
              onChange={(e) => setForm({ ...form, wa_template_reminder: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-emerald-50/20"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Variabel otomatis yang tersedia:{' '}
              <code className="font-mono">[Customer]</code>,{' '}
              <code className="font-mono">[Mobil]</code>,{' '}
              <code className="font-mono">[Plat]</code>,{' '}
              <code className="font-mono">[Tanggal]</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetData}
            className="inline-flex items-center space-x-1.5 text-xs text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data Demo ke Awal</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
