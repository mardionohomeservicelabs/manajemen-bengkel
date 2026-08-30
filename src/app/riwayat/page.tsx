'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { WorkOrder, Invoice } from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
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
  Share2,
  Calendar,
  CreditCard,
  Car,
  Unlock,
} from 'lucide-react';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { PrintableInvoice } from '@/components/ui/PrintableInvoice';

export default function HistoryArchivePage() {
  const { workOrders, invoices, settings, currentRole, unlockWorkOrderAsync } = useApp();

  const [activeTab, setActiveTab] = useState<'spk' | 'invoices'>('spk');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Preview modals
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filtered SPK
  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.spk_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wo.vehicle?.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wo.vehicle?.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.vehicle?.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.vehicle?.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <History className="w-6 h-6 text-maroon-700" />
          <span>Arsip & Database Riwayat Transaksi</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Pencarian histori Surat Perintah Kerja (SPK) dan riwayat nota pembayaran dari masa lalu.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs w-full sm:w-fit">
        <button
          onClick={() => {
            setActiveTab('spk');
            setStatusFilter('all');
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
            activeTab === 'spk'
              ? 'bg-white text-maroon-900 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Histori SPK ({workOrders.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('invoices');
            setStatusFilter('all');
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
            activeTab === 'invoices'
              ? 'bg-white text-maroon-900 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Histori Nota & Pembayaran ({invoices.length})</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Plat Nomor, No. Dokumen, Pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none"
          >
            <option value="all">Semua Status</option>
            {activeTab === 'spk' ? (
              <>
                <option value="queue">Antrean Masuk</option>
                <option value="estimating">Estimasi</option>
                <option value="servicing">Sedang Dikerjakan</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
              </>
            ) : (
              <>
                <option value="paid">Lunas (Paid)</option>
                <option value="pending">Belum Bayar (Pending)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* TAB 1: WORK ORDERS (SPK) ARCHIVE */}
      {activeTab === 'spk' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3.5">No. SPK & Tanggal</th>
                  <th className="p-3.5">Plat & Kendaraan</th>
                  <th className="p-3.5">Pemilik / WhatsApp</th>
                  <th className="p-3.5">Keluhan</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkOrders.map((order) => {
                  const vehicle = order.vehicle;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-slate-900">{order.spk_number}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(order.entry_date)}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-maroon-900 text-sm">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="text-slate-600">
                          {vehicle?.car_brand} {vehicle?.car_model}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-900">{vehicle?.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{vehicle?.phone_number}</div>
                      </td>
                      <td className="p-3.5 max-w-xs text-slate-600 line-clamp-2">
                        {order.complaints}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 uppercase border border-slate-200">
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {order.status === 'completed' && currentRole === 'owner' && (
                          <button
                            type="button"
                            onClick={() => unlockWorkOrderAsync(order.id, 'servicing')}
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-emerald-300 shadow-xs"
                            title="Buka Kunci SPK (Pindah kembali ke Sedang Dikerjakan)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Buka Kunci</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedWorkOrder(order)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-maroon-50 text-slate-700 hover:text-maroon-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail & Cetak</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES & PAYMENTS ARCHIVE */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3.5">No. Nota & Jenis</th>
                  <th className="p-3.5">Plat & Pelanggan</th>
                  <th className="p-3.5">Waktu Transaksi</th>
                  <th className="p-3.5 text-right">Total Tagihan</th>
                  <th className="p-3.5 text-center">Status Bayar</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const vehicle = inv.vehicle;
                  const isPaid = inv.payment_status === 'paid';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-slate-900">{inv.invoice_number}</div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            inv.type === 'estimation'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {inv.type === 'estimation' ? 'Estimasi' : 'Nota Servis'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-maroon-900">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="text-slate-600">{vehicle?.customer_name}</div>
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {formatDateTime(inv.created_at)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isPaid ? 'LUNAS' : 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-maroon-50 text-slate-700 hover:text-maroon-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Cetak / Nota</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Preview Modal for SPK */}
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

      {/* Preview Modal for Invoice */}
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
