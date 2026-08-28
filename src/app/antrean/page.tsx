'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { WorkOrder, WorkOrderStatus } from '@/lib/types/database';
import {
  formatDate,
  formatDateTime,
  formatPlate,
} from '@/lib/utils';
import {
  Kanban,
  List,
  Car,
  Clock,
  Wrench,
  ArrowRight,
  Calculator,
  Receipt,
  FileText,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ChevronRight,
  Filter,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';

const COLUMNS: { id: WorkOrderStatus; title: string; color: string; border: string; bg: string }[] = [
  {
    id: 'queue',
    title: 'Antrean Masuk',
    color: 'text-slate-700',
    border: 'border-slate-300',
    bg: 'bg-slate-50',
  },
  {
    id: 'estimating',
    title: 'Proses Estimasi',
    color: 'text-amber-800',
    border: 'border-amber-300',
    bg: 'bg-amber-50/50',
  },
  {
    id: 'approved',
    title: 'Disetujui Pelanggan',
    color: 'text-blue-800',
    border: 'border-blue-300',
    bg: 'bg-blue-50/50',
  },
  {
    id: 'servicing',
    title: 'Dalam Pengerjaan',
    color: 'text-indigo-800',
    border: 'border-indigo-300',
    bg: 'bg-indigo-50/50',
  },
  {
    id: 'waiting_parts',
    title: 'Menunggu Part',
    color: 'text-orange-800',
    border: 'border-orange-300',
    bg: 'bg-orange-50/50',
  },
  {
    id: 'completed',
    title: 'Selesai / Siap Ambil',
    color: 'text-emerald-800',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/50',
  },
];

export default function QueueBoardPage() {
  const { workOrders, showToast, settings, currentRole, updateWorkOrderStatusAsync } = useApp();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [editingPlateOrder, setEditingPlateOrder] = useState<WorkOrder | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: WorkOrderStatus) => {
    const success = await updateWorkOrderStatusAsync(orderId, newStatus);
    if (success) {
      showToast('Status antrean berhasil diperbarui di Supabase', 'success');
    }
  };

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Kanban className="w-6 h-6 text-maroon-700" />
            <span>Board Antrean & Pengerjaan Servis</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelacakan alur pengerjaan kendaraan secara visual dari intake hingga penyerahan kunci.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel Antrean</span>
            </button>
          </div>

          <Link
            href="/spk/new"
            className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Intake Baru</span>
          </Link>
        </div>
      </div>

      {/* Mode 1: Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const columnOrders = workOrders.filter((w) => w.status === col.id);

            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-2xl border ${col.border} ${col.bg} p-3 min-h-[500px] shadow-sm`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                  <span className={`text-xs font-bold ${col.color}`}>{col.title}</span>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-xs">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {columnOrders.length === 0 ? (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400 text-center p-2">
                      Kosong
                    </div>
                  ) : (
                    columnOrders.map((order) => {
                      const vehicle = order.vehicle;

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-sm hover:shadow-md transition space-y-2.5"
                        >
                          {/* Card Top: Plate & SPK */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-black text-xs text-maroon-900 tracking-wide">
                                {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                              </div>
                              <div className="text-[11px] font-medium text-slate-800">
                                {vehicle?.car_brand} {vehicle?.car_model}
                              </div>
                            </div>
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {order.spk_number.slice(-7)}
                            </span>
                          </div>

                          {/* Complaints Snippet */}
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            {order.complaints}
                          </p>

                          {/* Meta: Mechanic & Customer */}
                          <div className="text-[10px] text-slate-400 space-y-0.5">
                            <div className="flex items-center space-x-1">
                              <Wrench className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600 font-medium">
                                {order.mechanic_name || 'Agus S.'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatDateTime(order.entry_date)}</span>
                            </div>
                          </div>

                            {/* Quick Action Buttons */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  onClick={() => setSelectedOrder(order)}
                                  className="flex-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 px-1.5 rounded font-medium text-center transition"
                                >
                                  SPK & Cek
                                </button>
                                <Link
                                  href={`/estimasi?spkId=${order.id}`}
                                  className="flex-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 py-1 px-1.5 rounded font-medium text-center border border-amber-200 transition"
                                >
                                  Estimasi
                                </Link>
                                {col.id === 'completed' && (
                                  <Link
                                    href={`/kasir?spkId=${order.id}`}
                                    className="flex-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-1 px-1.5 rounded font-medium text-center border border-emerald-200 transition"
                                  >
                                    Kasir
                                  </Link>
                                )}
                              </div>

                              {/* Ganti Plat Button */}
                              {vehicle && (
                                <button
                                  type="button"
                                  onClick={() => setEditingPlateOrder(order)}
                                  className="w-full inline-flex items-center justify-center space-x-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 py-1 px-1.5 rounded font-bold border border-blue-200 transition"
                                >
                                  <Car className="w-3 h-3" />
                                  <span>Ganti Plat Nomor</span>
                                </button>
                              )}

                              {/* Stage Move Dropdown */}
                              <select
                                value={order.status}
                                onChange={(e) =>
                                  handleStatusChange(order.id, e.target.value as WorkOrderStatus)
                                }
                                className="w-full text-[10px] p-1 rounded border border-slate-200 bg-slate-50 text-slate-700 outline-none"
                              >
                                <option value="queue">Pindah: Antrean</option>
                                <option value="estimating">Pindah: Estimasi</option>
                                <option value="approved">Pindah: Disetujui</option>
                                <option value="servicing">Pindah: Dikerjakan</option>
                                <option value="waiting_parts">Pindah: Tunggu Part</option>
                                <option value="completed">Pindah: Selesai</option>
                                <option value="cancelled">Pindah: Batal</option>
                              </select>
                            </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 2: List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3.5">Plat & Kendaraan</th>
                  <th className="p-3.5">No. SPK</th>
                  <th className="p-3.5">Pemilik & Kontak</th>
                  <th className="p-3.5">Mekanik</th>
                  <th className="p-3.5">Status Antrean</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((order) => {
                  const vehicle = order.vehicle;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="p-3.5">
                        <div className="font-bold text-maroon-900 text-sm">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="text-slate-600">
                          {vehicle?.car_brand} {vehicle?.car_model}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-medium">{order.spk_number}</td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-900">{vehicle?.customer_name}</div>
                        <div className="text-[11px] text-slate-500">{vehicle?.phone_number}</div>
                      </td>
                      <td className="p-3.5 text-slate-700">{order.mechanic_name || 'Agus S.'}</td>
                      <td className="p-3.5">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value as WorkOrderStatus)
                          }
                          className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <option value="queue">Antrean Masuk</option>
                          <option value="estimating">Proses Estimasi</option>
                          <option value="approved">Disetujui</option>
                          <option value="servicing">Sedang Dikerjakan</option>
                          <option value="waiting_parts">Menunggu Part</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Batal</option>
                        </select>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {vehicle && (
                          <button
                            type="button"
                            onClick={() => setEditingPlateOrder(order)}
                            className="px-2.5 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 inline-flex items-center space-x-1"
                            title="Ganti Plat Nomor Kendaraan"
                          >
                            <Car className="w-3.5 h-3.5" />
                            <span>Ganti Plat</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                        >
                          Lihat SPK
                        </button>
                        <Link
                          href={`/estimasi?spkId=${order.id}`}
                          className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium text-xs"
                        >
                          Estimasi
                        </Link>
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
