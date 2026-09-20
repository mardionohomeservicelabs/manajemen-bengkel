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
  createWhatsAppLink,
  formatKM,
  resolveWorkOrderBranch,
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
  Unlock,
  Building2,
  FileEdit,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';
import { PrintableSPK } from '@/components/ui/PrintableSPK';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';
import { EditSPKModal } from '@/components/ui/EditSPKModal';

function SPKListContent() {
  const {
    workOrders,
    allWorkOrders,
    refreshData,
    showToast,
    settings,
    currentRole,
    updateWorkOrderStatusAsync,
    unlockWorkOrderAsync,
    deleteWorkOrderAsync,
    syncWithSupabase,
    isSyncing,
  } = useApp();
  const { currentUser, activeBranch } = useAuth();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');
  const branchParam = searchParams.get('branch');

  const canAccessAll = !!currentUser?.canAccessAllBranches;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>(
    canAccessAll ? ((branchParam as BranchId) || activeBranch || 'ALL') : activeBranch
  );
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [editingPlateOrder, setEditingPlateOrder] = useState<WorkOrder | null>(null);
  const [editingSpkOrder, setEditingSpkOrder] = useState<WorkOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<WorkOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Muat data & sinkronkan dari database cloud Supabase
  useEffect(() => {
    refreshData();
    syncWithSupabase(true);
  }, [refreshData, syncWithSupabase]);

  // Sinkronkan selectedBranch saat URL branchParam atau activeBranch berganti
  useEffect(() => {
    if (branchParam && (branchParam === 'MHS 1' || branchParam === 'MHS 2' || branchParam === 'MHS 3')) {
      setSelectedBranch(branchParam as BranchId);
    } else if (!canAccessAll) {
      setSelectedBranch(activeBranch);
    } else if (activeBranch) {
      setSelectedBranch(activeBranch);
    }
  }, [branchParam, activeBranch, canAccessAll]);

  const baseOrders = !canAccessAll
    ? allWorkOrders.filter((w) => resolveWorkOrderBranch(w) === activeBranch)
    : selectedBranch === 'ALL'
    ? allWorkOrders
    : allWorkOrders.filter((w) => resolveWorkOrderBranch(w) === selectedBranch);

  useEffect(() => {
    if (targetId && allWorkOrders.length > 0) {
      const found = allWorkOrders.find((w) => w.id === targetId || w.spk_number === targetId);
      if (found) {
        setSelectedOrder(found);
      }
    }
  }, [targetId, allWorkOrders]);

  const filteredOrders = baseOrders
    .filter((order) => {
      const vehicle = order.vehicle;
      const matchesSearch =
        order.spk_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle?.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle?.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle?.car_model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.mechanic_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.entry_date || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.entry_date || 0).getTime() || 0;
      return timeB - timeA;
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

  const handleConfirmDelete = async () => {
    if (!deletingOrder) return;
    setIsDeleting(true);
    try {
      const ok = await deleteWorkOrderAsync(deletingOrder.id);
      if (ok) {
        setDeletingOrder(null);
      } else {
        showToast('Gagal menghapus SPK. Hanya Owner yang berwenang.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat menghapus SPK.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusBadgeMap: Record<WorkOrderStatus, { label: string; class: string }> = {
    queue: { label: 'Antrean Masuk', class: 'bg-slate-100 text-slate-800 border-slate-300' },
    estimating: { label: 'Proses Estimasi', class: 'bg-amber-100 text-amber-800 border-amber-300' },
    approved: { label: 'Disetujui', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    servicing: { label: 'Sedang Servis', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    waiting_parts: { label: 'Menunggu Part', class: 'bg-orange-100 text-orange-800 border-orange-300' },
    completed_service: { label: 'Selesai Servis', class: 'bg-teal-100 text-teal-800 border-teal-300' },
    paid: { label: 'Sudah Pembayaran', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    completed: { label: 'Selesai (Database)', class: 'bg-emerald-200 text-emerald-900 border-emerald-400' },
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
            Daftar intake kendaraan, lembar checklist inspeksi fisik &amp; persetujuan pelanggan lintas cabang.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => syncWithSupabase(true)}
            disabled={isSyncing}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Sinkronkan data langsung dari Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-maroon-700' : 'text-slate-500'}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
          </button>
          <Link
            href={`/spk/new?branch=${selectedBranch === 'ALL' ? activeBranch : selectedBranch}`}
            className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Buat SPK &amp; Intake Baru</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Plat, No SPK, Pelanggan, Mekanik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter Cabang */}
          {canAccessAll ? (
            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <Building2 className="w-3.5 h-3.5 text-maroon-700 ml-1.5" />
              <span className="text-[11px] font-bold text-slate-500">Cabang:</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as any)}
                className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Cabang ({allWorkOrders.length})</option>
                <option value="MHS 1">MHS 1 ({allWorkOrders.filter(w => resolveWorkOrderBranch(w) === 'MHS 1').length})</option>
                <option value="MHS 2">MHS 2 ({allWorkOrders.filter(w => resolveWorkOrderBranch(w) === 'MHS 2').length})</option>
                <option value="MHS 3">MHS 3 ({allWorkOrders.filter(w => resolveWorkOrderBranch(w) === 'MHS 3').length})</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Building2 className="w-3.5 h-3.5 text-maroon-700" />
              <span className="text-[11px] font-bold text-slate-500">Cabang:</span>
              <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{activeBranch}</span>
            </div>
          )}

          {/* Filter Status */}
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <span className="text-[11px] font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">Semua Status ({baseOrders.length})</option>
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
      </div>

      {/* Work Orders Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <th className="p-3.5">No. SPK &amp; Tanggal</th>
                <th className="p-3.5">Cabang</th>
                <th className="p-3.5">Kendaraan &amp; Pelanggan</th>
                <th className="p-3.5">Keluhan Utama</th>
                <th className="p-3.5">Mekanik / SA</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Tidak ada data SPK yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const vehicle = order.vehicle;
                  const badge = statusBadgeMap[order.status] || statusBadgeMap.queue;
                  const branchLabel = resolveWorkOrderBranch(order);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 align-top">
                        <div className="font-mono font-bold text-slate-900">{order.spk_number}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateTime(order.entry_date)}
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
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

                      <td className="p-3.5 align-top">
                        <div className="font-bold text-maroon-900 uppercase">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="text-slate-800 font-medium uppercase">
                          {vehicle?.car_brand} {vehicle?.car_model}
                        </div>
                        <div className="text-[11px] text-slate-500 uppercase">
                          {vehicle?.customer_name} ({vehicle?.phone_number})
                        </div>
                      </td>

                      <td className="p-3.5 align-top max-w-xs">
                        <p className="text-slate-900 font-semibold line-clamp-2 uppercase">{order.complaints}</p>
                        {order.notes && (
                          <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5 italic uppercase">
                            Pengerjaan: {order.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 items-center text-[9.5px] mt-1.5">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                            KM: {formatKM(vehicle?.current_mileage, false)}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${order.vehicle_status === 'Ditinggal' ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'}`}>
                            {order.vehicle_status || 'Ditunggu'}
                          </span>
                          {order.source_info && (
                            <span className="bg-blue-50 text-[#001F7A] px-1.5 py-0.5 rounded font-medium uppercase">
                              Ref: {order.source_info}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="font-medium text-slate-800 uppercase">{order.mechanic_name || '-'}</div>
                        <div className="text-[10px] text-slate-400">SA: {order.sa_profile?.full_name || 'SA'}</div>
                      </td>

                      <td className="p-3.5 align-top text-center">
                        <select
                          value={order.status}
                          disabled={order.status === 'completed' && currentRole !== 'owner'}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as WorkOrderStatus)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                            order.status === 'completed' && currentRole !== 'owner' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                          } ${badge.class}`}
                          title={order.status === 'completed' && currentRole !== 'owner' ? 'Pekerjaan Selesai / Terkunci di Arsip (Hanya Owner yang dapat mengubah status)' : 'Ubah Status'}
                        >
                          <option value="queue">Antrean Masuk</option>
                          <option value="estimating">Proses Estimasi</option>
                          <option value="approved">Disetujui</option>
                          <option value="servicing">Sedang Dikerjakan</option>
                          <option value="waiting_parts">Menunggu Part</option>
                          <option value="completed_service">Selesai Servis (Siap Bayar Kasir)</option>
                          <option value="paid">Sudah Bayar di Kasir (Lunas)</option>
                          <option value="completed">Selesai (Masuk Arsip)</option>
                          <option value="cancelled">Dibatalkan</option>
                        </select>
                      </td>

                      <td className="p-3.5 align-top text-right space-x-1.5 whitespace-nowrap">
                        {(order.status === 'completed_service' || order.status === 'paid') && (
                          <Link
                            href={`/kasir?spkId=${order.id}`}
                            className="inline-flex items-center space-x-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-teal-300 shadow-xs cursor-pointer"
                            title="Buka SPK di Kasir untuk proses pembayaran / cek nota"
                          >
                            <Receipt className="w-3.5 h-3.5 text-teal-700" />
                            <span>Ke Kasir</span>
                          </Link>
                        )}
                        {(order.status !== 'completed' || currentRole === 'owner') && (
                          <button
                            type="button"
                            onClick={() => setEditingSpkOrder(order)}
                            className="inline-flex items-center space-x-1 bg-maroon-50 hover:bg-maroon-100 text-maroon-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-maroon-200 cursor-pointer"
                            title="Edit Isi SPK (Keluhan, Mekanik, Kendaraan, dll.)"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-maroon-700" />
                            <span>Edit SPK</span>
                          </button>
                        )}
                        {order.status === 'completed' && currentRole === 'owner' && (
                          <button
                            type="button"
                            onClick={() => unlockWorkOrderAsync(order.id, 'servicing')}
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-emerald-300 shadow-xs cursor-pointer"
                            title="Buka Kunci SPK (Pindah kembali ke Sedang Dikerjakan)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Buka Kunci</span>
                          </button>
                        )}
                        {currentRole === 'owner' && (
                          <button
                            type="button"
                            onClick={() => setDeletingOrder(order)}
                            className="inline-flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1.5 rounded-lg text-xs transition border border-red-200 cursor-pointer"
                            title="Hapus SPK jika duplikat atau salah input (Khusus Owner)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Hapus</span>
                          </button>
                        )}
                        {order.vehicle && (
                          <button
                            type="button"
                            onClick={() => setEditingPlateOrder(order)}
                            className="inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-blue-200 cursor-pointer"
                            title="Ganti Plat Nomor Kendaraan"
                          >
                            <Car className="w-3.5 h-3.5" />
                            <span>Ganti Plat</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-maroon-50 text-slate-700 hover:text-maroon-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
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
              onEdit={() => {
                setEditingSpkOrder(selectedOrder);
                setSelectedOrder(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Edit Isi SPK */}
      {editingSpkOrder && (
        <EditSPKModal
          workOrder={editingSpkOrder}
          onClose={() => setEditingSpkOrder(null)}
          onSuccess={() => {
            setEditingSpkOrder(null);
            refreshData();
          }}
        />
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

      {/* Modal Konfirmasi Hapus SPK (Khusus Owner) */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600 pb-3 border-b border-slate-100">
              <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200 shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus SPK Antrean</h3>
                <p className="text-xs text-red-600 font-bold">Wewenang Khusus Peran Owner</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menghapus SPK ini dari antrean sistem. Gunakan fitur ini apabila terdapat{' '}
              <strong className="text-slate-800">double data kendaraan</strong> atau{' '}
              <strong className="text-slate-800">kesalahan input antrean</strong>.
            </p>

            {/* Rincian SPK yang akan dihapus */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">No. SPK:</span>
                <span className="font-mono font-black text-slate-900">{deletingOrder.spk_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Plat Nomor:</span>
                <span className="font-mono font-black text-maroon-900">
                  {deletingOrder.vehicle?.license_plate ? formatPlate(deletingOrder.vehicle.license_plate) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kendaraan:</span>
                <span className="font-bold text-slate-800">
                  {deletingOrder.vehicle?.car_brand} {deletingOrder.vehicle?.car_model}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Pelanggan:</span>
                <span className="font-bold text-slate-800">
                  {deletingOrder.vehicle?.customer_name || '-'}
                </span>
              </div>
              {deletingOrder.complaints && (
                <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-400">Keluhan: </span>
                  {deletingOrder.complaints}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 transition cursor-pointer flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus SPK Permanen</span>
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

export default function SPKPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat data SPK...</div>}>
      <SPKListContent />
    </Suspense>
  );
}
