'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { WorkOrder, Invoice } from '@/lib/types/database';
import {
  formatCurrency,
  formatDateTime,
  formatPlate,
} from '@/lib/utils';
import {
  History,
  ClipboardList,
  Receipt,
  Search,
  Filter,
  Calendar,
  Car,
  Unlock,
  Calculator,
  CheckCircle2,
  Clock,
  FileText,
  Phone,
  User,
  FolderOpen,
  X,
} from 'lucide-react';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';
import { PrintableInvoice } from '@/components/ui/PrintableInvoice';

interface VehicleArchiveEntry {
  id: string;
  spkNumber: string;
  entryDate: string;
  licensePlate: string;
  carBrand: string;
  carModel: string;
  customerName: string;
  phoneNumber: string;
  complaints?: string;
  status: string;
  isPaid: boolean;
  totalInvoice?: number;
  workOrder: WorkOrder | null;
  estimation: Invoice | null;
  invoice: Invoice | null;
}

function HistoryArchiveContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || searchParams.get('q') || '';

  const { workOrders, invoices, settings, currentRole, unlockWorkOrderAsync } = useApp();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('all');

  // Preview modals
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedEstimation, setSelectedEstimation] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Helper to find matching estimation for a work order
  const findEstimation = (wo: WorkOrder): Invoice | null => {
    // 1. Cek di daftar invoices dengan type 'estimation'
    const match = invoices.find(
      (inv) =>
        inv.type === 'estimation' &&
        (inv.work_order_id === wo.id ||
          inv.work_order_id === wo.spk_number ||
          inv.invoice_number === (wo.checklist_data as any)?.estimation?.invoice_number ||
          (inv.work_order && (inv.work_order.id === wo.id || inv.work_order.spk_number === wo.spk_number)))
    );
    if (match) {
      if (!match.vehicle && wo.vehicle) {
        return { ...match, vehicle: wo.vehicle, work_order: wo };
      }
      return match;
    }

    // 2. Cek di checklist_data.estimation jika ada
    const checklistEst = (wo.checklist_data as any)?.estimation;
    if (checklistEst && (checklistEst.items?.length || checklistEst.invoice_number)) {
      return {
        ...checklistEst,
        type: 'estimation',
        work_order_id: wo.id,
        vehicle_id: wo.vehicle_id,
        vehicle: wo.vehicle,
        work_order: wo,
      } as Invoice;
    }

    return null;
  };

  // Helper to find matching final invoice (nota) for a work order
  const findInvoice = (wo: WorkOrder): Invoice | null => {
    const match = invoices.find(
      (inv) =>
        (inv.type === 'invoice' || !inv.type) &&
        (inv.work_order_id === wo.id ||
          inv.work_order_id === wo.spk_number ||
          (inv.work_order && (inv.work_order.id === wo.id || inv.work_order.spk_number === wo.spk_number)))
    );
    if (match) {
      if (!match.vehicle && wo.vehicle) {
        return { ...match, vehicle: wo.vehicle, work_order: wo };
      }
      return match;
    }
    return null;
  };

  // Build unified Vehicle Archive Entries (murni per data mobil)
  const archiveEntries = useMemo(() => {
    const entries: VehicleArchiveEntry[] = [];
    const matchedInvoiceIds = new Set<string>();

    // 1. Map from work orders
    workOrders.forEach((wo) => {
      const est = findEstimation(wo);
      const inv = findInvoice(wo);

      if (est?.id) matchedInvoiceIds.add(est.id);
      if (inv?.id) matchedInvoiceIds.add(inv.id);

      const isPaid = inv?.payment_status === 'paid' || wo.status === 'completed';

      entries.push({
        id: wo.id,
        spkNumber: wo.spk_number,
        entryDate: wo.created_at || wo.entry_date || '',
        licensePlate: wo.vehicle?.license_plate || '',
        carBrand: wo.vehicle?.car_brand || '',
        carModel: wo.vehicle?.car_model || '',
        customerName: wo.vehicle?.customer_name || '',
        phoneNumber: wo.vehicle?.phone_number || '',
        complaints: wo.complaints,
        status: wo.status,
        isPaid,
        totalInvoice: inv?.total_amount,
        workOrder: wo,
        estimation: est,
        invoice: inv,
      });
    });

    // 2. Check for unmatched invoices
    invoices.forEach((inv) => {
      if (!matchedInvoiceIds.has(inv.id)) {
        const isEstimation = inv.type === 'estimation';
        entries.push({
          id: inv.id,
          spkNumber: inv.work_order?.spk_number || inv.work_order_id || '-',
          entryDate: inv.created_at || '',
          licensePlate: inv.vehicle?.license_plate || '',
          carBrand: inv.vehicle?.car_brand || '',
          carModel: inv.vehicle?.car_model || '',
          customerName: inv.vehicle?.customer_name || '',
          phoneNumber: inv.vehicle?.phone_number || '',
          complaints: inv.admin_notes || '',
          status: inv.payment_status === 'paid' ? 'completed' : 'servicing',
          isPaid: inv.payment_status === 'paid',
          totalInvoice: inv.total_amount,
          workOrder: inv.work_order || null,
          estimation: isEstimation ? inv : null,
          invoice: !isEstimation ? inv : null,
        });
      }
    });

    // Sort by entryDate descending
    return entries.sort((a, b) => {
      const timeA = new Date(a.entryDate || 0).getTime() || 0;
      const timeB = new Date(b.entryDate || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [workOrders, invoices]);

  // Filtered Archive
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/\s+/g, '');

    return archiveEntries.filter((entry) => {
      // Search matching
      const cleanPlate = (entry.licensePlate || '').toLowerCase().replace(/\s+/g, '');
      const matchesSearch =
        !q ||
        entry.spkNumber.toLowerCase().includes(q) ||
        (entry.customerName || '').toLowerCase().includes(q) ||
        (entry.phoneNumber || '').toLowerCase().includes(q) ||
        (entry.carBrand || '').toLowerCase().includes(q) ||
        (entry.carModel || '').toLowerCase().includes(q) ||
        cleanPlate.includes(cleanQ) ||
        (entry.complaints || '').toLowerCase().includes(q);

      // Status matching
      let matchesStatus = true;
      if (statusFilter === 'completed') {
        matchesStatus = entry.status === 'completed' || entry.isPaid;
      } else if (statusFilter === 'servicing') {
        matchesStatus = entry.status === 'servicing';
      } else if (statusFilter === 'estimating') {
        matchesStatus = entry.status === 'estimating';
      } else if (statusFilter === 'queue') {
        matchesStatus = entry.status === 'queue';
      } else if (statusFilter === 'cancelled') {
        matchesStatus = entry.status === 'cancelled';
      }

      return matchesSearch && matchesStatus;
    });
  }, [archiveEntries, searchQuery, statusFilter]);

  // Statistics Summary (khusus data mobil)
  const stats = useMemo(() => {
    const total = archiveEntries.length;
    const completed = archiveEntries.filter((e) => e.status === 'completed' || e.isPaid).length;
    const active = archiveEntries.filter((e) => e.status === 'servicing' || e.status === 'estimating' || e.status === 'queue').length;
    return { total, completed, active };
  }, [archiveEntries]);

  // Helper for status badge
  const renderStatusBadge = (entry: VehicleArchiveEntry) => {
    if (entry.status === 'completed' || entry.isPaid) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Selesai & Lunas</span>
        </span>
      );
    }
    if (entry.status === 'servicing') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
          <Clock className="w-3 h-3 text-blue-600 animate-spin" />
          <span>Sedang Dikerjakan</span>
        </span>
      );
    }
    if (entry.status === 'estimating') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
          <Calculator className="w-3 h-3 text-amber-600" />
          <span>Estimasi</span>
        </span>
      );
    }
    if (entry.status === 'cancelled') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
          <X className="w-3 h-3 text-rose-600" />
          <span>Dibatalkan</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
        <Clock className="w-3 h-3 text-slate-500" />
        <span>Antrean Masuk</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <History className="w-6 h-6 text-maroon-700" />
              <span>Arsip Data Mobil</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Daftar riwayat data mobil yang masuk bengkel. Di tiap data mobil tersedia pilihan untuk membuka dokumen <strong>SPK</strong>, <strong>Estimasi</strong>, dan <strong>Nota</strong>.
            </p>
          </div>
        </div>

        {/* Quick Stats Banner (Khusus Data Mobil) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Total Riwayat Mobil</div>
              <div className="text-lg font-black text-slate-900">{stats.total} Mobil</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Mobil Selesai & Lunas</div>
              <div className="text-lg font-black text-emerald-700">{stats.completed} Mobil</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Mobil Masih Aktif</div>
              <div className="text-lg font-black text-blue-700">{stats.active} Mobil</div>
            </div>
          </div>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Plat Nomor, Nama Pemilik, Tipe Mobil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-maroon-600 focus:border-maroon-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-maroon-600 font-medium"
            >
              <option value="all">Semua Status Mobil</option>
              <option value="completed">Selesai & Lunas</option>
              <option value="servicing">Sedang Dikerjakan</option>
              <option value="estimating">Dalam Estimasi</option>
              <option value="queue">Antrean Masuk</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* VEHICLE LIST (DAFTAR DATA MOBIL) */}
      <div className="no-print space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Tidak ada riwayat kendaraan ditemukan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Coba sesuaikan kata kunci pencarian atau filter status untuk menemukan data mobil.'
                : 'Belum ada data riwayat kendaraan yang tercatat di sistem.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredEntries.map((entry) => {
              const hasSpk = Boolean(entry.workOrder);
              const hasEst = Boolean(entry.estimation);
              const hasInv = Boolean(entry.invoice);

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-card hover:shadow-md transition duration-200 overflow-hidden"
                >
                  {/* Bagian Atas: Data Pokok Mobil */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                      {/* Identitas Kendaraan */}
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-950 text-white font-mono font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg border-2 border-slate-800 shadow-2xs tracking-wider shrink-0">
                          {entry.licensePlate ? formatPlate(entry.licensePlate) : '-'}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                            {entry.carBrand || entry.carModel
                              ? `${entry.carBrand} ${entry.carModel}`
                              : 'Kendaraan'}
                          </h3>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            No. SPK: <span className="font-semibold text-slate-600">{entry.spkNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Total Tagihan */}
                      <div className="flex items-center space-x-2 self-start sm:self-center flex-wrap gap-y-1">
                        {renderStatusBadge(entry)}
                        {entry.totalInvoice !== undefined && entry.totalInvoice > 0 && (
                          <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {formatCurrency(entry.totalInvoice)}
                          </span>
                        )}
                        {currentRole === 'owner' && entry.workOrder && entry.workOrder.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => unlockWorkOrderAsync(entry.workOrder!.id, 'servicing')}
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg text-xs transition border border-emerald-300 shadow-2xs"
                            title="Buka Kunci SPK (Pindah kembali ke Sedang Dikerjakan)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Buka Kunci</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Informasi Pemilik, Waktu, & Keluhan */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                      {/* Pelanggan */}
                      <div className="flex items-start space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pemilik Kendaraan</span>
                          <div className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">{entry.customerName || '-'}</div>
                          {entry.phoneNumber && (
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{entry.phoneNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Waktu Masuk */}
                      <div className="flex items-start space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Waktu Masuk</span>
                          <div className="font-semibold text-slate-700 text-xs sm:text-sm mt-0.5">{formatDateTime(entry.entryDate)}</div>
                        </div>
                      </div>

                      {/* Keluhan */}
                      <div className="flex items-start space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Keluhan / Diagnosa</span>
                          <div className="text-slate-600 italic line-clamp-2 mt-0.5 text-xs">
                            {entry.complaints ? `"${entry.complaints}"` : 'Tidak ada catatan keluhan.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION DOKUMEN: Bagian Khusus untuk Buka SPK, Estimasi, Nota */}
                  <div className="bg-slate-50/90 px-4 sm:px-5 py-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                      <FolderOpen className="w-4 h-4 text-maroon-700" />
                      <span>Dokumen & Berkas:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 w-full sm:w-auto">
                      {/* 1. Buka SPK */}
                      {hasSpk ? (
                        <button
                          type="button"
                          onClick={() => setSelectedWorkOrder(entry.workOrder)}
                          className="flex items-center justify-center space-x-2 bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 hover:border-blue-400 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 group"
                          title={`Buka Surat Perintah Kerja (${entry.spkNumber})`}
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition" />
                          <span>Buka SPK</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-center space-x-1.5 bg-slate-100 text-slate-400 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium cursor-not-allowed">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-300" />
                          <span>SPK Tidak Ada</span>
                        </div>
                      )}

                      {/* 2. Buka Estimasi */}
                      {hasEst ? (
                        <button
                          type="button"
                          onClick={() => setSelectedEstimation(entry.estimation)}
                          className="flex items-center justify-center space-x-2 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 hover:border-amber-400 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 group"
                          title={`Buka Surat Estimasi Biaya (${entry.estimation?.invoice_number || ''})`}
                        >
                          <Calculator className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition" />
                          <span>Buka Estimasi</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-center space-x-1.5 bg-slate-100 text-slate-400 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium cursor-not-allowed">
                          <Calculator className="w-3.5 h-3.5 text-slate-300" />
                          <span>Belum Ada Estimasi</span>
                        </div>
                      )}

                      {/* 3. Buka Nota */}
                      {hasInv ? (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(entry.invoice)}
                          className="flex items-center justify-center space-x-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 hover:border-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 group"
                          title={`Buka Nota Pembayaran (${entry.invoice?.invoice_number || ''})`}
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition" />
                          <span>Buka Nota</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-center space-x-1.5 bg-slate-100 text-slate-400 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium cursor-not-allowed">
                          <Receipt className="w-3.5 h-3.5 text-slate-300" />
                          <span>Belum Ada Nota</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PREVIEW MODALS */}

      {/* 1. Modal Buka SPK */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableSPK
              workOrder={selectedWorkOrder}
              settings={settings}
              onClose={() => setSelectedWorkOrder(null)}
            />
          </div>
        </div>
      )}

      {/* 2. Modal Buka Estimasi */}
      {selectedEstimation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableEstimation
              estimation={selectedEstimation}
              settings={settings}
              onClose={() => setSelectedEstimation(null)}
            />
          </div>
        </div>
      )}

      {/* 3. Modal Buka Nota */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableInvoice
              invoice={selectedInvoice}
              settings={settings}
              onClose={() => setSelectedInvoice(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryArchivePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-medium">Memuat Arsip Data Mobil...</div>}>
      <HistoryArchiveContent />
    </Suspense>
  );
}


