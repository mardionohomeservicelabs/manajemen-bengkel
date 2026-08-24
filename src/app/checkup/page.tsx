'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { CheckupRecord } from '@/lib/types/database';
import { formatDate, formatPlate, createWhatsAppLink } from '@/lib/utils';
import {
  Wrench,
  ThermometerSnowflake,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Share2,
  Printer,
  ShieldCheck,
  Calendar,
  Car,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { PrintableGeneralCheckup } from '@/components/ui/PrintableGeneralCheckup';
import { PrintableACCheckup } from '@/components/ui/PrintableACCheckup';

export default function CheckupPage() {
  const { settings, showToast, refreshData, checkups, deleteCheckupAsync, isSyncing } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'qc_general' | 'ac_specialist'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CheckupRecord | null>(null);

  const filteredCheckups = checkups.filter((c) => {
    const matchesTab = activeTab === 'all' || c.type === activeTab;
    const matchesSearch =
      c.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.car_model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Hapus lembar checkup ini dari database Supabase?')) {
      await deleteCheckupAsync(id);
      showToast('Data checkup berhasil dihapus dari database Supabase', 'info');
    }
  };

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-maroon-700" />
            <span>Checklist General Checkup Tune Up &amp; AC Mobil</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pemeriksaan menyeluruh kendaraan (QC 23 Titik & Form Spesialis AC) dengan output dokumen PDF resmi.
          </p>
        </div>

        <Link
          href="/checkup/new"
          className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Input Checkup Baru</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'all'
              ? 'bg-white text-maroon-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Semua Form ({checkups.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('qc_general')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'qc_general'
              ? 'bg-white text-maroon-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-red-600" />
          <span>QC General Checkup (23 Titik)</span>
        </button>
        <button
          onClick={() => setActiveTab('ac_specialist')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'ac_specialist'
              ? 'bg-white text-maroon-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-600" />
          <span>Pemeriksaan AC & Pendingin</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Plat Nomor, No. Form, Pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-medium"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <th className="p-3.5">No. Dokumen & Jenis</th>
                <th className="p-3.5">Plat & Kendaraan</th>
                <th className="p-3.5">Pelanggan</th>
                <th className="p-3.5">Tanggal & Teknisi</th>
                <th className="p-3.5 text-right">Aksi Dokumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheckups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Belum ada data formulir checkup. Klik "+ Input Checkup Baru" untuk membuat.
                  </td>
                </tr>
              ) : (
                filteredCheckups.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => setSelectedRecord(rec)}
                    className="hover:bg-maroon-50/30 transition cursor-pointer"
                  >
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-slate-900">{rec.document_number}</div>
                      <span
                        className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          rec.type === 'qc_general'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {rec.type === 'qc_general' ? 'QC General Checkup (23 Titik)' : 'Form AC & Pendingin'}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-black text-maroon-900 text-sm">
                        {formatPlate(rec.license_plate)}
                      </div>
                      <div className="text-slate-700 font-medium">{rec.car_model}</div>
                    </td>

                    <td className="p-3.5 font-semibold text-slate-900">{rec.customer_name}</td>

                    <td className="p-3.5">
                      <div className="font-medium text-slate-800">{formatDate(rec.check_date)}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Teknisi: {rec.technician_name}</div>
                    </td>

                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(rec);
                        }}
                        className="inline-flex items-center space-x-1 bg-maroon-50 hover:bg-maroon-100 text-maroon-800 font-bold px-3 py-1.5 rounded-lg text-xs transition border border-maroon-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Cetak / Detail</span>
                      </button>
                      <button
                        onClick={(e) => handleDelete(rec.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Modal Preview Printable Form */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {selectedRecord.type === 'qc_general' && selectedRecord.qc_data && (
              <PrintableGeneralCheckup
                checkup={selectedRecord.qc_data}
                settings={settings}
                onClose={() => setSelectedRecord(null)}
              />
            )}
            {selectedRecord.type === 'ac_specialist' && selectedRecord.ac_data && (
              <PrintableACCheckup
                checkup={selectedRecord.ac_data}
                settings={settings}
                onClose={() => setSelectedRecord(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
