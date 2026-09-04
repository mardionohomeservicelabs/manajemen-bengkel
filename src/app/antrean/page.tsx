'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { BranchId } from '@/lib/auth/users';
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
  Calculator,
  Receipt,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Filter,
  Search,
  Database,
  Archive,
  ArrowRight,
  RotateCcw,
  Calendar,
  CheckCircle,
  FolderCheck,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';

const ACTIVE_COLUMNS: { id: WorkOrderStatus; title: string; color: string; border: string; bg: string }[] = [
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
];

function QueueBoardContent() {
  const { workOrders, allWorkOrders, showToast, settings, currentRole, updateWorkOrderStatusAsync, refreshData, syncWithSupabase } = useApp();
  const { activeBranch, setActiveBranch, currentUser } = useAuth();
  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch');

  const [pageTab, setPageTab] = useState<'active' | 'database'>('active');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>(
    (branchParam as BranchId) || 'ALL'
  );
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [editingPlateOrder, setEditingPlateOrder] = useState<WorkOrder | null>(null);
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  // Sinkronkan data saat halaman dibuka
  useEffect(() => {
    refreshData();
    syncWithSupabase();
  }, [refreshData, syncWithSupabase]);

  // Sinkronkan jika query param branch berubah
  useEffect(() => {
    if (branchParam && (branchParam === 'MHS 1' || branchParam === 'MHS 2' || branchParam === 'MHS 3')) {
      setSelectedBranch(branchParam as BranchId);
    }
  }, [branchParam]);

  // Sumber data: Semua cabang atau difilter per cabang tertentu
  const sourceOrders = selectedBranch === 'ALL'
    ? allWorkOrders
    : allWorkOrders.filter((w) => (w.received_at_branch || 'MHS 1') === selectedBranch);

  // Pisahkan antrean aktif dan pekerjaan selesai
  const activeOrders = sourceOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled');
  const completedOrders = sourceOrders
    .filter((w) => w.status === 'completed')
    .filter((w) => {
      if (!dbSearchQuery.trim()) return true;
      const q = dbSearchQuery.toLowerCase();
      const plate = (w.vehicle?.license_plate || '').toLowerCase();
      const name = (w.vehicle?.customer_name || '').toLowerCase();
      const spk = (w.spk_number || '').toLowerCase();
      const car = `${w.vehicle?.car_brand || ''} ${w.vehicle?.car_model || ''}`.toLowerCase();
      const mech = (w.mechanic_name || '').toLowerCase();
      const branch = (w.received_at_branch || '').toLowerCase();
      return plate.includes(q) || name.includes(q) || spk.includes(q) || car.includes(q) || mech.includes(q) || branch.includes(q);
    })
    .sort((a, b) => {
      const timeA = new Date(a.finish_date || a.updated_at || a.created_at || 0).getTime() || 0;
      const timeB = new Date(b.finish_date || b.updated_at || b.created_at || 0).getTime() || 0;
      return timeB - timeA;
    });

  const totalCompletedCount = sourceOrders.filter((w) => w.status === 'completed').length;

  const handleStatusChange = async (orderId: string, newStatus: WorkOrderStatus) => {
    const success = await updateWorkOrderStatusAsync(orderId, newStatus);
    if (success) {
      if (newStatus === 'completed') {
        showToast('Pekerjaan ditandai selesai dan berhasil dipindahkan ke Database!', 'success');
      } else {
        showToast('Status antrean berhasil diperbarui', 'success');
      }
    }
  };

  const handleMarkAsComplete = async (order: WorkOrder) => {
    const success = await updateWorkOrderStatusAsync(order.id, 'completed');
    if (success) {
      showToast(`Pekerjaan ${order.vehicle?.license_plate ? formatPlate(order.vehicle.license_plate) : order.spk_number} selesai & dipindahkan ke Database!`, 'success');
    }
  };

  return (
    <div>
      <div className="no-print space-y-5">
        {/* Top Header & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Kanban className="w-6 h-6 text-maroon-700" />
              <span>Board Antrean &amp; Manajemen Servis</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pelacakan alur pengerjaan kendaraan aktif serta arsip database pekerjaan selesai lintas cabang.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/spk/new"
              className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Intake SPK Baru</span>
            </Link>
          </div>
        </div>

        {/* Filter Cabang Terpadu (Semua Cabang / MHS 1 / MHS 2 / MHS 3) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Filter Lokasi Cabang Bengkel
              </div>
              <div className="text-[11px] text-slate-500">
                Pilih cabang untuk memantau antrean unit di bengkel yang bersangkutan
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => setSelectedBranch('ALL')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition ${
                selectedBranch === 'ALL'
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>Semua Cabang</span>
              <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-black ${
                selectedBranch === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {allWorkOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').length}
              </span>
            </button>
            {(['MHS 1', 'MHS 2', 'MHS 3'] as BranchId[]).map((b) => {
              const activeCount = allWorkOrders.filter(
                (w) => (w.received_at_branch || 'MHS 1') === b && w.status !== 'completed' && w.status !== 'cancelled'
              ).length;
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBranch(b)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition ${
                    selectedBranch === b
                      ? 'bg-maroon-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{b}</span>
                  <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedBranch === b ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {activeCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Tab Switcher: Antrean Aktif vs Database Selesai */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPageTab('active')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                pageTab === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-indigo-600" />
              <span>Antrean &amp; Pengerjaan Aktif</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-indigo-100 text-indigo-800">
                {activeOrders.length} Unit
              </span>
            </button>

            <button
              onClick={() => setPageTab('database')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                pageTab === 'database'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Database Pekerjaan Selesai</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800">
                {totalCompletedCount} Unit
              </span>
            </button>
          </div>

          {/* Sub-controls based on active tab */}
          {pageTab === 'active' ? (
            <div className="flex items-center space-x-2">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                    viewMode === 'kanban'
                      ? 'bg-white text-slate-900 shadow-xs'
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
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabel Ringkas</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Cari Plat / Customer / SPK..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          )}
        </div>

        {/* TAB 1: ANTREAN & PENGERJAAN AKTIF */}
        {pageTab === 'active' && (
          <>
            {/* Mode 1: Kanban Board */}
            {viewMode === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto pb-4">
                {ACTIVE_COLUMNS.map((col) => {
                  const columnOrders = activeOrders.filter((w) => w.status === col.id);

                  return (
                    <div
                      key={col.id}
                      className={`flex flex-col rounded-2xl border ${col.border} ${col.bg} p-3 min-h-[520px] shadow-xs`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                        <span className={`text-xs font-black uppercase tracking-wide ${col.color}`}>{col.title}</span>
                        <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-800 shadow-xs">
                          {columnOrders.length}
                        </span>
                      </div>

                      {/* Cards Container */}
                      <div className="flex-1 space-y-3 overflow-y-auto">
                        {columnOrders.length === 0 ? (
                          <div className="h-36 flex items-center justify-center border-2 border-dashed border-slate-200/90 rounded-xl text-[11px] text-slate-400 text-center p-3 font-medium">
                            Tidak ada mobil pada tahap ini
                          </div>
                        ) : (
                          columnOrders.map((order) => {
                            const vehicle = order.vehicle;
                            const branchLabel = order.received_at_branch || 'MHS 1';

                            return (
                              <div
                                key={order.id}
                                className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-xs hover:shadow-md transition space-y-2.5"
                              >
                                {/* Card Top: Plate & Branch & SPK */}
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="font-black text-sm text-maroon-900 tracking-wide font-mono">
                                      {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                                    </div>
                                    <div className="text-xs font-bold text-slate-900">
                                      {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}
                                    </div>
                                    <div className="text-[11px] font-medium text-slate-600">
                                      {vehicle?.customer_name || 'Pelanggan'}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end space-y-1">
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                      branchLabel === 'MHS 2'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : branchLabel === 'MHS 3'
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                        : 'bg-blue-50 text-blue-900 border-blue-300'
                                    }`}>
                                      {branchLabel}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                      {order.spk_number.slice(-7)}
                                    </span>
                                  </div>
                                </div>

                                {/* Complaints Snippet */}
                                <p className="text-[10.5px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                                  {order.complaints || 'Perawatan berkala'}
                                </p>

                                {/* Meta: Mechanic & Entry Time */}
                                <div className="text-[10px] text-slate-500 space-y-1 bg-white pt-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1">
                                      <Wrench className="w-3 h-3 text-slate-400" />
                                      <span className="text-slate-700 font-semibold truncate max-w-[120px]">
                                        {order.mechanic_name || 'Mekanik belum di-assign'}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{formatDate(order.entry_date)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Action Buttons */}
                                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrder(order)}
                                      className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2 rounded-lg font-bold text-center transition"
                                    >
                                      SPK &amp; Cek
                                    </button>
                                    <Link
                                      href={`/estimasi?spkId=${order.id}`}
                                      className="text-[10.5px] bg-amber-50 hover:bg-amber-100 text-amber-800 py-1.5 px-2 rounded-lg font-bold text-center border border-amber-200 transition"
                                    >
                                      Estimasi
                                    </Link>
                                  </div>

                                  {/* Ganti Plat Button */}
                                  {vehicle && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingPlateOrder(order)}
                                      className="w-full inline-flex items-center justify-center space-x-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 py-1 px-2 rounded-lg font-bold border border-blue-200 transition"
                                    >
                                      <Car className="w-3 h-3" />
                                      <span>Ganti Plat Nomor</span>
                                    </button>
                                  )}

                                  {/* Button Tandai Selesai (Memindahkan ke Database) */}
                                  <button
                                    type="button"
                                    onClick={() => handleMarkAsComplete(order)}
                                    className="w-full inline-flex items-center justify-center space-x-1.5 text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2 rounded-lg font-black shadow-xs transition cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Tandai Pekerjaan Selesai</span>
                                  </button>

                                  {/* Stage Move Dropdown */}
                                  <select
                                    value={order.status}
                                    onChange={(e) =>
                                      handleStatusChange(order.id, e.target.value as WorkOrderStatus)
                                    }
                                    className="w-full text-[10px] p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold outline-none cursor-pointer"
                                  >
                                    <option value="queue">Pindah: Antrean</option>
                                    <option value="estimating">Pindah: Estimasi</option>
                                    <option value="approved">Pindah: Disetujui</option>
                                    <option value="servicing">Pindah: Dikerjakan</option>
                                    <option value="waiting_parts">Pindah: Tunggu Part</option>
                                    <option value="completed">Pindah: Selesai (Arsipkan ke Database)</option>
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

            {/* Mode 2: List View Antrean Aktif */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                        <th className="p-3.5">Plat &amp; Kendaraan</th>
                        <th className="p-3.5">Cabang</th>
                        <th className="p-3.5">No. SPK</th>
                        <th className="p-3.5">Pemilik &amp; Kontak</th>
                        <th className="p-3.5">Mekanik</th>
                        <th className="p-3.5">Tahap Pengerjaan</th>
                        <th className="p-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                            Tidak ada antrean kendaraan aktif saat ini di cabang yang dipilih.
                          </td>
                        </tr>
                      ) : (
                        activeOrders.map((order) => {
                          const vehicle = order.vehicle;
                          const branchLabel = order.received_at_branch || 'MHS 1';
                          return (
                            <tr key={order.id} className="hover:bg-slate-50">
                              <td className="p-3.5">
                                <div className="font-bold text-maroon-900 text-sm font-mono">
                                  {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                                </div>
                                <div className="text-slate-700 font-medium">
                                  {vehicle?.car_brand} {vehicle?.car_model}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10.5px] font-black border ${
                                  branchLabel === 'MHS 2'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : branchLabel === 'MHS 3'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                    : 'bg-blue-50 text-blue-900 border-blue-300'
                                }`}>
                                  {branchLabel}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-slate-900">{order.spk_number}</td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900">{vehicle?.customer_name || 'Pelanggan'}</div>
                                <div className="text-[11px] text-slate-500">{vehicle?.phone_number || '-'}</div>
                              </td>
                              <td className="p-3.5 text-slate-700 font-medium">{order.mechanic_name || '-'}</td>
                              <td className="p-3.5">
                                <select
                                  value={order.status}
                                  onChange={(e) =>
                                    handleStatusChange(order.id, e.target.value as WorkOrderStatus)
                                  }
                                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                                >
                                  <option value="queue">Antrean Masuk</option>
                                  <option value="estimating">Proses Estimasi</option>
                                  <option value="approved">Disetujui</option>
                                  <option value="servicing">Sedang Dikerjakan</option>
                                  <option value="waiting_parts">Menunggu Part</option>
                                  <option value="completed">Selesai (Pindah ke Database)</option>
                                  <option value="cancelled">Batal</option>
                                </select>
                              </td>
                              <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsComplete(order)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition cursor-pointer"
                                >
                                  ✓ Selesai
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(order)}
                                  className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                >
                                  SPK
                                </button>
                                <Link
                                  href={`/estimasi?spkId=${order.id}`}
                                  className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs"
                                >
                                  Estimasi
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: DATABASE PEKERJAAN SELESAI */}
        {pageTab === 'database' && (
          <div className="space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    Database Pekerjaan Selesai {selectedBranch !== 'ALL' ? `(${selectedBranch})` : '(Semua Cabang)'}
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    Menampilkan seluruh mobil yang telah selesai dikerjakan dan siap diambil atau telah diserahkan ke pelanggan.
                  </p>
                </div>
              </div>
              <div className="text-xs font-black text-emerald-900 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 shadow-xs">
                Total Tersimpan: {completedOrders.length} Unit
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                      <th className="p-3.5">Plat &amp; Kendaraan</th>
                      <th className="p-3.5">Cabang</th>
                      <th className="p-3.5">No. SPK</th>
                      <th className="p-3.5">Customer &amp; Kontak</th>
                      <th className="p-3.5">Mekanik PIC</th>
                      <th className="p-3.5">Waktu Masuk &amp; Selesai</th>
                      <th className="p-3.5">Status Database</th>
                      <th className="p-3.5 text-right">Aksi Dokumen &amp; Kasir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                          {dbSearchQuery ? 'Tidak ada data selesai yang cocok dengan pencarian.' : 'Belum ada data pekerjaan selesai di database cabang yang dipilih.'}
                        </td>
                      </tr>
                    ) : (
                      completedOrders.map((order) => {
                        const vehicle = order.vehicle;
                        const branchLabel = order.received_at_branch || 'MHS 1';
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3.5">
                              <div className="font-mono font-black text-maroon-900 text-sm">
                                {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                              </div>
                              <div className="font-bold text-slate-900">
                                {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                branchLabel === 'MHS 2'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : branchLabel === 'MHS 3'
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  : 'bg-blue-50 text-blue-900 border-blue-300'
                              }`}>
                                {branchLabel}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono font-bold text-[#001F7A]">
                              {order.spk_number}
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{vehicle?.customer_name || 'Pelanggan'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{vehicle?.phone_number || '-'}</div>
                            </td>
                            <td className="p-3.5 font-medium text-slate-800">
                              {order.mechanic_name || '-'}
                            </td>
                            <td className="p-3.5 space-y-0.5 text-[11px]">
                              <div className="text-slate-600">
                                Masuk: <strong>{formatDate(order.entry_date)}</strong>
                              </div>
                              <div className="text-emerald-700 font-bold">
                                Selesai: {order.finish_date ? formatDate(order.finish_date) : formatDate(order.updated_at || order.entry_date)}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle className="w-3 h-3 text-emerald-700" />
                                <span>SELESAI (DATABASE)</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                              >
                                Lihat SPK
                              </button>
                              <Link
                                href={`/estimasi?spkId=${order.id}`}
                                className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition"
                              >
                                Estimasi
                              </Link>
                              <Link
                                href={`/kasir?spkId=${order.id}`}
                                className="px-2.5 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition"
                              >
                                Kasir / Invoice
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.id, 'servicing')}
                                className="px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-[11px] border border-slate-200 transition"
                                title="Kembalikan kendaraan ke antrean pengerjaan jika ada pengerjaan tambahan"
                              >
                                <RotateCcw className="w-3 h-3 inline mr-1" />
                                <span>Kembalikan</span>
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

export default function QueueBoardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Memuat Board Antrean Servis...</div>}>
      <QueueBoardContent />
    </Suspense>
  );
}
