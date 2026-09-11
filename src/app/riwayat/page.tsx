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
  Eye,
  Printer,
  Calendar,
  Car,
  Unlock,
  Calculator,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronRight,
  Phone,
  Layers,
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
  const [docFilter, setDocFilter] = useState<'all' | 'has_estimation' | 'has_invoice'>('all');

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

  // Build unified Vehicle Archive Entries
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

    // 2. Check for unmatched invoices (to prevent any orphan invoice from disappearing)
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
        (entry.estimation?.invoice_number || '').toLowerCase().includes(q) ||
        (entry.invoice?.invoice_number || '').toLowerCase().includes(q);

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

      // Document filter
      let matchesDoc = true;
      if (docFilter === 'has_estimation') {
        matchesDoc = Boolean(entry.estimation);
      } else if (docFilter === 'has_invoice') {
        matchesDoc = Boolean(entry.invoice);
      }

      return matchesSearch && matchesStatus && matchesDoc;
    });
  }, [archiveEntries, searchQuery, statusFilter, docFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = archiveEntries.length;
    const completed = archiveEntries.filter((e) => e.status === 'completed' || e.isPaid).length;
    const withEst = archiveEntries.filter((e) => Boolean(e.estimation)).length;
    const withInv = archiveEntries.filter((e) => Boolean(e.invoice)).length;
    return { total, completed, withEst, withInv };
  }, [archiveEntries]);

  // Helper for status badge
  const renderStatusBadge = (entry: VehicleArchiveEntry) => {
    if (entry.status === 'completed' || entry.isPaid) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Selesai & Lunas</span>
        </span>
      );
    }
    if (entry.status === 'servicing') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-600 animate-spin" />
          <span>Sedang Dikerjakan</span>
        </span>
      );
    }
    if (entry.status === 'estimating') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          <Calculator className="w-3 h-3 text-amber-600" />
          <span>Estimasi</span>
        </span>
      );
    }
    if (entry.status === 'cancelled') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
          <X className="w-3 h-3 text-rose-600" />
          <span>Dibatalkan</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
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
              <span>Arsip & Riwayat Kendaraan</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Database riwayat mobil masuk bengkel. Pilih data mobil untuk langsung membuka & mencetak <strong>SPK</strong>, <strong>Estimasi</strong>, atau <strong>Nota</strong>.
            </p>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Total Riwayat Mobil</div>
              <div className="text-lg font-black text-slate-900">{stats.total}</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Selesai / Lunas</div>
              <div className="text-lg font-black text-emerald-700">{stats.completed}</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Memiliki Estimasi</div>
              <div className="text-lg font-black text-amber-700">{stats.withEst}</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Memiliki Nota</div>
              <div className="text-lg font-black text-purple-700">{stats.withInv}</div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-card space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Plat Nomor, Pelanggan, No. SPK / Estimasi / Nota..."
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

            {/* Dropdown Filters */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-maroon-600 font-medium"
              >
                <option value="all">Semua Status Pengerjaan</option>
                <option value="completed">Selesai & Lunas</option>
                <option value="servicing">Sedang Dikerjakan</option>
                <option value="estimating">Dalam Estimasi</option>
                <option value="queue">Antrean Masuk</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Filter Dokumen:</span>
            <button
              type="button"
              onClick={() => setDocFilter('all')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                docFilter === 'all'
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({archiveEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setDocFilter('has_estimation')}
              className={`px-3 py-1 rounded-lg transition font-medium flex items-center space-x-1 ${
                docFilter === 'has_estimation'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>Ada Estimasi ({stats.withEst})</span>
            </button>
            <button
              type="button"
              onClick={() => setDocFilter('has_invoice')}
              className={`px-3 py-1 rounded-lg transition font-medium flex items-center space-x-1 ${
                docFilter === 'has_invoice'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              <Receipt className="w-3 h-3" />
              <span>Ada Nota ({stats.withInv})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VEHICLE LIST / TABLE */}
      <div className="no-print">
        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Tidak ada riwayat kendaraan ditemukan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || docFilter !== 'all'
                ? 'Coba sesuaikan kata kunci pencarian atau filter status untuk menemukan riwayat kendaraan.'
                : 'Belum ada data riwayat kendaraan yang tercatat di sistem.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                    <th className="p-4">Plat & Kendaraan</th>
                    <th className="p-4">Pelanggan</th>
                    <th className="p-4">Tanggal Masuk</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Pilihan Buka Dokumen</th>
                    {currentRole === 'owner' && <th className="p-4 text-right">Kelola</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((entry) => {
                    const hasSpk = Boolean(entry.workOrder);
                    const hasEst = Boolean(entry.estimation);
                    const hasInv = Boolean(entry.invoice);

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition">
                        {/* 1. Plat & Kendaraan */}
                        <td className="p-4 align-top">
                          <div className="flex items-start space-x-2.5">
                            <div className="mt-0.5">
                              <span className="inline-block bg-slate-900 text-white font-mono font-black text-xs px-2.5 py-1 rounded-md border border-slate-700 shadow-xs tracking-wider">
                                {entry.licensePlate ? formatPlate(entry.licensePlate) : '-'}
                              </span>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                {entry.carBrand || entry.carModel
                                  ? `${entry.carBrand} ${entry.carModel}`
                                  : 'Kendaraan'}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                                <ClipboardList className="w-3 h-3 text-slate-400" />
                                <span>{entry.spkNumber}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Pelanggan */}
                        <td className="p-4 align-top">
                          <div className="font-bold text-slate-800 text-xs">
                            {entry.customerName || '-'}
                          </div>
                          {entry.phoneNumber && (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{entry.phoneNumber}</span>
                            </div>
                          )}
                          {entry.complaints && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 max-w-xs mt-1 italic">
                              &ldquo;{entry.complaints}&rdquo;
                            </div>
                          )}
                        </td>

                        {/* 3. Tanggal Masuk */}
                        <td className="p-4 align-top">
                          <div className="text-slate-700 font-medium text-[11px] flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateTime(entry.entryDate)}</span>
                          </div>
                        </td>

                        {/* 4. Status */}
                        <td className="p-4 align-top text-center">
                          {renderStatusBadge(entry)}
                          {entry.totalInvoice !== undefined && entry.totalInvoice > 0 && (
                            <div className="text-[11px] font-mono font-bold text-slate-700 mt-1">
                              {formatCurrency(entry.totalInvoice)}
                            </div>
                          )}
                        </td>

                        {/* 5. Aksi Buka Dokumen (SPK, Estimasi, Nota) */}
                        <td className="p-4 align-top">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {/* Tombol Buka SPK */}
                            {hasSpk ? (
                              <button
                                type="button"
                                onClick={() => setSelectedWorkOrder(entry.workOrder)}
                                className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-blue-200 shadow-xs active:scale-95"
                                title="Buka & Cetak Surat Perintah Kerja (SPK)"
                              >
                                <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                                <span>Buka SPK</span>
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 bg-slate-50 text-slate-300 px-2.5 py-1.5 rounded-xl text-xs border border-slate-100 cursor-not-allowed"
                                title="SPK tidak tersedia"
                              >
                                <ClipboardList className="w-3.5 h-3.5 text-slate-300" />
                                <span>SPK (-)</span>
                              </span>
                            )}

                            {/* Tombol Buka Estimasi */}
                            {hasEst ? (
                              <button
                                type="button"
                                onClick={() => setSelectedEstimation(entry.estimation)}
                                className="inline-flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-amber-200 shadow-xs active:scale-95"
                                title={`Buka & Cetak Surat Estimasi Biaya (${entry.estimation?.invoice_number || ''})`}
                              >
                                <Calculator className="w-3.5 h-3.5 text-amber-600" />
                                <span>Buka Estimasi</span>
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 bg-slate-50 text-slate-300 px-2.5 py-1.5 rounded-xl text-xs border border-slate-100 cursor-not-allowed"
                                title="Belum ada estimasi yang diterbitkan untuk mobil ini"
                              >
                                <Calculator className="w-3.5 h-3.5 text-slate-300" />
                                <span>Estimasi (-)</span>
                              </span>
                            )}

                            {/* Tombol Buka Nota */}
                            {hasInv ? (
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(entry.invoice)}
                                className="inline-flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-emerald-200 shadow-xs active:scale-95"
                                title={`Buka & Cetak Nota Pembayaran (${entry.invoice?.invoice_number || ''})`}
                              >
                                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Buka Nota</span>
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 bg-slate-50 text-slate-300 px-2.5 py-1.5 rounded-xl text-xs border border-slate-100 cursor-not-allowed"
                                title="Belum ada nota pembayaran yang diterbitkan untuk mobil ini"
                              >
                                <Receipt className="w-3.5 h-3.5 text-slate-300" />
                                <span>Nota (-)</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Kelola (Khusus Owner jika Selesai) */}
                        {currentRole === 'owner' && (
                          <td className="p-4 align-top text-right whitespace-nowrap">
                            {entry.workOrder && entry.workOrder.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => unlockWorkOrderAsync(entry.workOrder!.id, 'servicing')}
                                className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1.5 rounded-lg text-[11px] transition border border-emerald-300 shadow-xs"
                                title="Buka Kunci SPK (Pindah kembali ke Sedang Dikerjakan)"
                              >
                                <Unlock className="w-3 h-3 text-emerald-700" />
                                <span>Buka Kunci</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-medium">Memuat Arsip & Riwayat Kendaraan...</div>}>
      <HistoryArchiveContent />
    </Suspense>
  );
}

