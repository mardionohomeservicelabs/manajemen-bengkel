'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context/AppContext';
import { CheckupRecord } from '@/lib/types/database';
import { formatDate, formatPlate } from '@/lib/utils';
import {
  Wrench,
  ThermometerSnowflake,
  Plus,
  Search,
  Trash2,
  Eye,
  ShieldCheck,
  Car,
  Lock,
} from 'lucide-react';
import { PrintableGeneralCheckup } from '@/components/ui/PrintableGeneralCheckup';
import { PrintableACCheckup } from '@/components/ui/PrintableACCheckup';
import { PrintableUndersteelCheckup } from '@/components/ui/PrintableUndersteelCheckup';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';

export default function CheckupPage() {
  const { checkups, workOrders, settings, deleteCheckupAsync, showToast, currentRole } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'qc_general' | 'ac_specialist' | 'understeel'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CheckupRecord | null>(null);
  const [editingPlateRecord, setEditingPlateRecord] = useState<CheckupRecord | null>(null);

  const filteredCheckups = checkups
    .filter((c) => {
      const matchesTab = activeTab === 'all' || c.type === activeTab;
      const matchesSearch =
        c.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.car_model.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.check_date || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.check_date || 0).getTime() || 0;
      return timeB - timeA;
    });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Hapus lembar checkup ini secara permanen?')) {
      const ok = await deleteCheckupAsync(id);
      if (ok) {
        showToast('Formulir checkup berhasil dihapus.', 'info');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-maroon-700" />
              <span>Checklist Quality Control (Tune Up, AC &amp; Understeel)</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pemeriksaan 23 Titik Tune Up, Spesialis AC &amp; 26 Titik Form Keluhan Understeel Kaki-Kaki.
            </p>
          </div>

          <Link
            href="/checkup/new"
            className="inline-flex items-center justify-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Checkup Baru</span>
          </Link>
        </div>

        {/* Tabs Filter */}
        <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'all' ? 'bg-white text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Semua Form ({checkups.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('qc_general')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'qc_general' ? 'bg-white text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-red-600" />
            <span>QC Tune Up</span>
          </button>
          <button
            onClick={() => setActiveTab('ac_specialist')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'ac_specialist' ? 'bg-white text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-600" />
            <span>Quality Control AC</span>
          </button>
          <button
            onClick={() => setActiveTab('understeel')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
              activeTab === 'understeel' ? 'bg-white text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-amber-600" />
            <span>Form Keluhan Understeel</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Plat, No. Form, Pelanggan..."
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
                  <th className="p-3.5">No. Dokumen &amp; Jenis</th>
                  <th className="p-3.5">Plat &amp; Kendaraan</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Tanggal &amp; Teknisi</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCheckups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">Belum ada data.</td>
                  </tr>
                ) : (
                  filteredCheckups.map((rec) => {
                    const linkedWo = workOrders.find((w) => w.id === rec.work_order_id);
                    const isCompleted = linkedWo?.status === 'completed';
                    const isLocked = isCompleted && currentRole !== 'owner';

                    return (
                      <tr key={rec.id} onClick={() => setSelectedRecord(rec)} className="hover:bg-maroon-50/30 transition cursor-pointer">
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-900">{rec.document_number}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                rec.type === 'qc_general' ? 'bg-red-50 text-red-700 border-red-200' : 
                                rec.type === 'understeel' ? 'bg-amber-50 text-amber-800 border-amber-200' : 
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                              {rec.type === 'qc_general' ? 'QC Tune Up' : rec.type === 'understeel' ? 'Understeel' : 'QC AC'}
                            </span>
                            {isCompleted && isLocked && (
                              <span className="inline-flex items-center space-x-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                <Lock className="w-2.5 h-2.5 text-amber-700" />
                                <span>Terkunci</span>
                              </span>
                            )}
                            {isCompleted && !isLocked && (
                              <span className="inline-flex items-center space-x-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <span>🔓 Owner</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-black text-maroon-900 text-sm">{formatPlate(rec.license_plate)}</div>
                          <div className="text-slate-700 font-medium">{rec.car_model}</div>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">{rec.customer_name}</td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-800">{formatDate(rec.check_date)}</div>
                          <div className="text-[11px] text-slate-500 font-medium">Teknisi: {rec.technician_name}</div>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlateRecord(rec);
                            }}
                            className="inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-blue-200"
                            title="Ganti Plat Nomor Kendaraan"
                          >
                            <Car className="w-3.5 h-3.5" />
                            <span>Ganti Plat</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedRecord(rec); }} className="inline-flex items-center space-x-1 bg-maroon-50 hover:bg-maroon-100 text-maroon-800 font-bold px-3 py-1.5 rounded-lg text-xs transition border border-maroon-200">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                          <button onClick={(e) => handleDelete(rec.id, e)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Preview Checklist */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {selectedRecord.type === 'qc_general' && selectedRecord.qc_data && (
              <PrintableGeneralCheckup checkup={selectedRecord.qc_data} settings={settings} onClose={() => setSelectedRecord(null)} />
            )}
            {selectedRecord.type === 'ac_specialist' && selectedRecord.ac_data && (
              <PrintableACCheckup checkup={selectedRecord.ac_data} settings={settings} onClose={() => setSelectedRecord(null)} />
            )}
            {selectedRecord.type === 'understeel' && selectedRecord.understeel_data && (
              <PrintableUndersteelCheckup checkup={selectedRecord.understeel_data} settings={settings} onClose={() => setSelectedRecord(null)} />
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Plat Nomor */}
      {editingPlateRecord && (
        <EditLicensePlateModal
          vehicleId={editingPlateRecord.vehicle_id || ''}
          currentPlate={editingPlateRecord.license_plate}
          customerName={editingPlateRecord.customer_name}
          carModel={editingPlateRecord.car_model}
          onClose={() => setEditingPlateRecord(null)}
          onSuccess={(newPlate) => {
            editingPlateRecord.license_plate = newPlate;
          }}
        />
      )}
    </div>
  );
}
