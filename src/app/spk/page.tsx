'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { WorkOrder, WorkOrderStatus } from '@/lib/types/database';
import {
  formatDate,
  formatDateTime,
  formatPlate,
  createWhatsAppLink,
} from '@/lib/utils';
import {
  ClipboardList,
  PlusCircle,
  Search,
  Filter,
  Printer,
  Share2,
  Eye,
  CheckCircle2,
  Clock,
  Car,
  ChevronRight,
  User,
  Wrench,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';

function SPKListContent() {
  const { workOrders, refreshData, showToast, settings, currentRole, updateWorkOrderStatusAsync } = useApp();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [editingPlateOrder, setEditingPlateOrder] = useState<WorkOrder | null>(null);

  useEffect(() => {
    if (targetId && workOrders.length > 0) {
      const found = workOrders.find((w) => w.id === targetId);
      if (found) {
        setSelectedOrder(found);
      }
    }
  }, [targetId, workOrders]);

  const filteredOrders = workOrders.filter((order) => {
    const vehicle = order.vehicle;
    const matchesSearch =
      order.spk_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle?.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle?.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle?.car_model || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (id: string, newStatus: WorkOrderStatus) => {
    const success = await updateWorkOrderStatusAsync(id, newStatus);
    if (success) {
      showToast('Status SPK berhasil diperbarui di Supabase', 'success');
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    }
  };

  const statusBadgeMap: Record<WorkOrderStatus, { label: string; class: string }> = {
    queue: { label: 'Antrean Masuk', class: 'bg-slate-100 text-slate-800 border-slate-300' },
    estimating: { label: 'Proses Estimasi', class: 'bg-amber-100 text-amber-800 border-amber-300' },
    approved: { label: 'Disetujui', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    servicing: { label: 'Sedang Servis', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    waiting_parts: { label: 'Menunggu Part', class: 'bg-orange-100 text-orange-800 border-orange-300' },
    completed: { label: 'Selesai', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    cancelled: { label: 'Dibatalkan', class: 'bg-red-100 text-red-800 border-red-300' },
  };

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <ClipboardList className="w-6 h-6 text-maroon-700" />
            <span>Manajemen Surat Perintah Kerja (SPK)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar intake kendaraan, lembar checklist inspeksi fisik & persetujuan pelanggan.
          </p>
        </div>

        <Link
          href="/spk/new"
          className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Buat SPK & Intake Baru</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Plat Nomor, No SPK, Pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 font-medium flex-shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-maroon-600"
          >
            <option value="all">Semua Status ({workOrders.length})</option>
            <option value="queue">Antrean Masuk</option>
            <option value="estimating">Proses Estimasi</option>
            <option value="approved">Disetujui</option>
            <option value="servicing">Sedang Dikerjakan</option>
            <option value="waiting_parts">Menunggu Part</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* Work Orders Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <th className="p-3.5">No. SPK & Tanggal</th>
                <th className="p-3.5">Kendaraan & Pelanggan</th>
                <th className="p-3.5">Keluhan Utama</th>
                <th className="p-3.5">Mekanik / SA</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Tidak ada data SPK yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const vehicle = order.vehicle;
                  const badge = statusBadgeMap[order.status] || statusBadgeMap.queue;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 align-top">
                        <div className="font-mono font-bold text-slate-900">{order.spk_number}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateTime(order.entry_date)}
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="font-bold text-maroon-900">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="text-slate-800 font-medium">
                          {vehicle?.car_brand} {vehicle?.car_model}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {vehicle?.customer_name} ({vehicle?.phone_number})
                        </div>
                      </td>

                      <td className="p-3.5 align-top max-w-xs">
                        <p className="text-slate-900 font-semibold line-clamp-2">{order.complaints}</p>
                        {order.notes && (
                          <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5 italic">
                            Pengerjaan: {order.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 items-center text-[9.5px] mt-1.5">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                            KM: {vehicle?.current_mileage?.toLocaleString('id-ID')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold ${order.vehicle_status === 'Ditinggal' ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'}`}>
                            {order.vehicle_status || 'Ditunggu'}
                          </span>
                          {order.source_info && (
                            <span className="bg-blue-50 text-[#001F7A] px-1.5 py-0.5 rounded font-medium">
                              Ref: {order.source_info}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="font-medium text-slate-800">{order.mechanic_name || 'Agus S.'}</div>
                        <div className="text-[10px] text-slate-400">SA: {order.sa_profile?.full_name || 'Eko P.'}</div>
                      </td>

                      <td className="p-3.5 align-top text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as WorkOrderStatus)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer ${badge.class}`}
                        >
                          <option value="queue">Antrean Masuk</option>
                          <option value="estimating">Estimasi</option>
                          <option value="approved">Disetujui</option>
                          <option value="servicing">Dikerjakan</option>
                          <option value="waiting_parts">Tunggu Part</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Batal</option>
                        </select>
                      </td>

                      <td className="p-3.5 align-top text-right space-x-1.5 whitespace-nowrap">
                        {order.vehicle && (
                          <button
                            type="button"
                            onClick={() => setEditingPlateOrder(order)}
                            className="inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-blue-200"
                            title="Ganti Plat Nomor Kendaraan"
                          >
                            <Car className="w-3.5 h-3.5" />
                            <span>Ganti Plat</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-maroon-50 text-slate-700 hover:text-maroon-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                          title="Pratinjau Lembar SPK & Checklist"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Cetak / Detail</span>
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

      {/* Modal Preview Printable SPK */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableSPK
              workOrder={selectedOrder}
              settings={settings}
              onClose={() => setSelectedOrder(null)}
            />
          </div>
        </div>
      )}

      {/* Modal Edit Plat Nomor */}
      {editingPlateOrder && editingPlateOrder.vehicle && (
        <EditLicensePlateModal
          vehicleId={editingPlateOrder.vehicle.id}
          currentPlate={editingPlateOrder.vehicle.license_plate}
          customerName={editingPlateOrder.vehicle.customer_name}
          carModel={`${editingPlateOrder.vehicle.car_brand} ${editingPlateOrder.vehicle.car_model}`}
          onClose={() => setEditingPlateOrder(null)}
          onSuccess={(newPlate) => {
            if (editingPlateOrder.vehicle) {
              editingPlateOrder.vehicle.license_plate = newPlate;
            }
          }}
        />
      )}
    </div>
  );
}

export default function SPKPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat data SPK...</div>}>
      <SPKListContent />
    </Suspense>
  );
}
