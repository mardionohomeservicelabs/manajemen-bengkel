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
  RotateCcw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
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

  const { workOrders, invoices, settings, currentRole, unlockWorkOrderAsync, deleteVehicleArchiveAsync } = useApp();

  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Delete modal state (Owner)
  const [deletingEntry, setDeletingEntry] = useState<VehicleArchiveEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Build unified Vehicle Archive Entries (hanya mobil yang sudah selesai & lunas)
  const archiveEntries = useMemo(() => {
    const entries: VehicleArchiveEntry[] = [];
    const seenSpkNumbers = new Set<string>();

    // Hanya dari work orders yang statusnya completed ATAU sudah ada nota yang paid
    workOrders.forEach((wo) => {
      const inv = findInvoice(wo);
      const isPaid = inv?.payment_status === 'paid';
      const isCompleted = wo.status === 'completed';

      // Hanya masukkan arsip jika sudah selesai servis DAN sudah pembayaran nota
      if (!isPaid && !isCompleted) return;

      // Hindari double entry berdasarkan nomor SPK
      if (seenSpkNumbers.has(wo.spk_number)) return;
      seenSpkNumbers.add(wo.spk_number);

      const est = findEstimation(wo);

      entries.push({
        id: wo.id,
        spkNumber: wo.spk_number,
        entryDate: inv?.paid_at || wo.created_at || wo.entry_date || '',
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

    // Sort by entryDate descending (terbaru di atas)
    return entries.sort((a, b) => {
      const timeA = new Date(a.entryDate || 0).getTime() || 0;
      const timeB = new Date(b.entryDate || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [workOrders, invoices]);

  // Filtered Archive (hanya mobil selesai & lunas, filter hanya pencarian)
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/\s+/g, '');

    return archiveEntries.filter((entry) => {
      const cleanPlate = (entry.licensePlate || '').toLowerCase().replace(/\s+/g, '');
      return (
        !q ||
        entry.spkNumber.toLowerCase().includes(q) ||
        (entry.customerName || '').toLowerCase().includes(q) ||
        (entry.phoneNumber || '').toLowerCase().includes(q) ||
        (entry.carBrand || '').toLowerCase().includes(q) ||
        (entry.carModel || '').toLowerCase().includes(q) ||
        cleanPlate.includes(cleanQ) ||
        (entry.complaints || '').toLowerCase().includes(q)
      );
    });
  }, [archiveEntries, searchQuery]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = archiveEntries.length;
    const withInvoice = archiveEntries.filter((e) => Boolean(e.invoice)).length;
    const withEstimation = archiveEntries.filter((e) => Boolean(e.estimation)).length;
    return { total, withInvoice, withEstimation };
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

        {/* Quick Stats Banner — Arsip Mobil Lunas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Total Mobil Selesai</div>
              <div className="text-lg font-black text-slate-900">{stats.total} Mobil</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Memiliki Nota Pembayaran</div>
              <div className="text-lg font-black text-emerald-700">{stats.withInvoice} Mobil</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Memiliki Estimasi Biaya</div>
              <div className="text-lg font-black text-amber-700">{stats.withEstimation} Mobil</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
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
          <div className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:block">
            Menampilkan mobil yang sudah selesai servis &amp; pembayaran
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
              {searchQuery
                ? 'Coba sesuaikan kata kunci pencarian untuk menemukan data mobil.'
                : 'Belum ada data riwayat kendaraan selesai & lunas yang tercatat di sistem.'}
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
                        {currentRole === 'owner' && entry.workOrder && (entry.workOrder.status === 'completed' || entry.workOrder.status === 'paid') && (
                          <button
                            type="button"
                            onClick={() => unlockWorkOrderAsync(entry.workOrder!.id, 'servicing')}
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg text-xs transition border border-emerald-300 shadow-2xs cursor-pointer"
                            title="Buka Kunci SPK (Pindah kembali ke Sedang Dikerjakan)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Buka Kunci Mobil</span>
                          </button>
                        )}
                        {currentRole === 'owner' && (
                          <button
                            type="button"
                            onClick={() => setDeletingEntry(entry)}
                            className="inline-flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded-lg text-xs transition border border-red-200 shadow-2xs cursor-pointer"
                            title="Hapus data mobil ini dari arsip (status selesai servis, batal, atau duplikat) - Khusus Owner"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Hapus Arsip</span>
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

                      {/* 3. Buka Nota & Koreksi Nota (Owner) */}
                      {hasInv ? (
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(entry.invoice)}
                            className="flex-1 flex items-center justify-center space-x-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 hover:border-emerald-400 px-3 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 group cursor-pointer"
                            title={`Buka Nota Pembayaran (${entry.invoice?.invoice_number || ''})`}
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition" />
                            <span>Buka Nota</span>
                          </button>
                          {currentRole === 'owner' && entry.invoice && (
                            <Link
                              href={`/kasir?invoiceId=${entry.invoice.id}&mode=owner_edit`}
                              className="inline-flex items-center justify-center space-x-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer shrink-0"
                              title="Koreksi Nota & Pembayaran Ulang di Kasir (Khusus Owner)"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Koreksi Nota</span>
                            </Link>
                          )}
                        </div>
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

      {/* 4. Modal Konfirmasi Hapus Data Mobil dari Arsip (Khusus Owner) */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Data Mobil dari Arsip</h3>
                <p className="text-xs text-red-600 font-bold">Khusus Hak Akses Owner</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Plat Nomor:</span>
                <span className="font-mono font-black text-slate-900">{formatPlate(deletingEntry.licensePlate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Kendaraan:</span>
                <span className="font-bold text-slate-800">{deletingEntry.carBrand} {deletingEntry.carModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">No. SPK:</span>
                <span className="font-mono font-bold text-[#001F7A]">{deletingEntry.spkNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Pelanggan:</span>
                <span className="font-bold text-slate-800">{deletingEntry.customerName || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Status Mobil:</span>
                {renderStatusBadge(deletingEntry)}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
              ⚠️ <strong>Perhatian:</strong> Menghapus data mobil ini akan menghapus seluruh berkas arsip riwayat, surat perintah kerja (SPK), estimasi, serta nota transaksi kasir terkait dari sistem secara permanen.
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingEntry(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteVehicleArchiveAsync({
                    workOrderId: deletingEntry.workOrder?.id,
                    invoiceId: deletingEntry.invoice?.id || deletingEntry.estimation?.id,
                    spkNumber: deletingEntry.spkNumber,
                    licensePlate: deletingEntry.licensePlate,
                    customerName: deletingEntry.customerName,
                  });
                  setIsDeleting(false);
                  setDeletingEntry(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Menghapus...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
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


