'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { CheckupRecord, VehicleCustomer, WorkOrder } from '@/lib/types/database';
import { formatDate, formatPlate, resolveWorkOrderBranch } from '@/lib/utils';
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
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Phone,
  AlertCircle,
  PlusCircle,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { PrintableGeneralCheckup } from '@/components/ui/PrintableGeneralCheckup';
import { PrintableACCheckup } from '@/components/ui/PrintableACCheckup';
import { PrintableUndersteelCheckup } from '@/components/ui/PrintableUndersteelCheckup';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';
import { BranchId } from '@/lib/auth/users';
import { Building2 } from 'lucide-react';

interface VehicleCheckupGroup {
  key: string;
  vehicleId?: string;
  license_plate: string;
  customer_name: string;
  phone_number?: string;
  car_brand: string;
  car_model: string;
  car_year?: number | string;
  car_color?: string;
  branch: BranchId;
  latestSpk?: WorkOrder;
  lastDate: string;
  qcGeneralList: CheckupRecord[];
  acList: CheckupRecord[];
  understeelList: CheckupRecord[];
  allRecords: CheckupRecord[];
}

// Helper menentukan cabang bengkel mobil
const resolveGroupBranch = (wo?: WorkOrder, v?: any, rec?: any): BranchId => {
  if (wo) return resolveWorkOrderBranch(wo);
  const plate = (v?.license_plate || rec?.license_plate || '').replace(/\s+/g, '').toUpperCase();
  if (['N1640CY', 'B1747SYB', 'N1220EV', 'L1609WK'].includes(plate)) {
    return 'MHS 2';
  }
  const raw = rec?.received_at_branch || 
              rec?.branch || 
              v?.branch || 
              v?.received_at_branch || 
              '';
  if (raw) {
    const upper = String(raw).toUpperCase();
    if (upper.includes('3') || upper.includes('SURABAYA')) return 'MHS 3';
    if (upper.includes('2') || upper.includes('TROSOBO')) return 'MHS 2';
    if (upper.includes('1') || upper.includes('RUNGKUT')) return 'MHS 1';
  }
  return 'MHS 1';
};

export default function CheckupPage() {
  const { checkups, allCheckups, workOrders, allWorkOrders, vehicles, settings, deleteCheckupAsync, showToast, currentRole, refreshData, syncWithSupabase, isSyncing } = useApp();
  const { currentUser, activeBranch } = useAuth();
  const canAccessAll = !!currentUser?.canAccessAllBranches;

  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>(
    canAccessAll ? 'ALL' : activeBranch
  );
  const [filterTab, setFilterTab] = useState<'all' | 'has_checkup' | 'empty'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleGroup, setSelectedVehicleGroup] = useState<VehicleCheckupGroup | null>(null);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState<CheckupRecord | null>(null);
  const [editingPlateTarget, setEditingPlateTarget] = useState<{ vehicleId: string; plate: string; name: string; model: string } | null>(null);

  // Muat data saat halaman checklist dibuka & sinkronkan dari cloud Supabase
  useEffect(() => {
    refreshData();
    syncWithSupabase(false);
  }, [refreshData, syncWithSupabase]);

  // Sinkronkan jika activeBranch berganti dari switcher sidebar oleh Via atau Owner
  const prevActiveBranchRef = React.useRef(activeBranch);
  useEffect(() => {
    if (!canAccessAll) {
      setSelectedBranch(activeBranch);
    } else if (prevActiveBranchRef.current !== activeBranch) {
      prevActiveBranchRef.current = activeBranch;
      setSelectedBranch(activeBranch);
    }
  }, [activeBranch, canAccessAll]);

  // Group checkups & workOrders by car (license_plate / vehicle_id)
  const vehicleGroups: VehicleCheckupGroup[] = useMemo(() => {
    const map = new Map<string, VehicleCheckupGroup>();

    // 1. Seed from vehicles list
    vehicles.forEach((v) => {
      const normPlate = (v.license_plate || '').trim().toUpperCase().replace(/\s+/g, '');
      const key = v.id || normPlate;
      if (!normPlate) return;

      const latestWo = allWorkOrders
        .filter((w) => {
          if (w.vehicle_id && v.id && w.vehicle_id === v.id) return true;
          const wPlate = (
            w.vehicle?.license_plate ||
            (w.checklist_data as any)?.license_plate ||
            (w.checklist_data as any)?.vehicle?.license_plate ||
            ''
          ).trim().toUpperCase().replace(/\s+/g, '');
          return Boolean(wPlate && wPlate === normPlate);
        })
        .sort((a, b) => new Date(b.created_at || b.entry_date || 0).getTime() - new Date(a.created_at || a.entry_date || 0).getTime())[0];

      map.set(key, {
        key,
        vehicleId: v.id,
        license_plate: v.license_plate,
        customer_name: v.customer_name || 'Pelanggan',
        phone_number: v.phone_number || '',
        car_brand: v.car_brand || '',
        car_model: v.car_model || '',
        car_year: v.car_year || '',
        car_color: (v as any).color || (v as any).car_color || '',
        branch: resolveGroupBranch(latestWo, v),
        latestSpk: latestWo,
        lastDate: latestWo?.created_at || latestWo?.entry_date || v.updated_at || v.created_at || '',
        qcGeneralList: [],
        acList: [],
        understeelList: [],
        allRecords: [],
      });
    });

    // 2. Seed / attach from active workOrders (jika ada yang belum masuk vehicles)
    allWorkOrders.forEach((wo) => {
      const v = wo.vehicle;
      if (!v || !v.license_plate) return;
      const normPlate = v.license_plate.trim().toUpperCase().replace(/\s+/g, '');
      const key = v.id || normPlate;

      if (!map.has(key)) {
        map.set(key, {
          key,
          vehicleId: v.id,
          license_plate: v.license_plate,
          customer_name: v.customer_name || 'Pelanggan',
          phone_number: v.phone_number || '',
          car_brand: v.car_brand || '',
          car_model: v.car_model || '',
          car_year: v.car_year || '',
          car_color: (v as any).color || (v as any).car_color || '',
          branch: resolveGroupBranch(wo, v),
          latestSpk: wo,
          lastDate: wo.created_at || wo.entry_date || '',
          qcGeneralList: [],
          acList: [],
          understeelList: [],
          allRecords: [],
        });
      } else {
        const existing = map.get(key)!;
        const woTime = new Date(wo.created_at || wo.entry_date || 0).getTime();
        const existingTime = new Date(existing.latestSpk?.created_at || existing.latestSpk?.entry_date || existing.lastDate || 0).getTime();
        if (!existing.latestSpk || woTime > existingTime) {
          existing.latestSpk = wo;
          existing.lastDate = wo.created_at || wo.entry_date || existing.lastDate;
          existing.branch = resolveGroupBranch(wo, v);
        }
      }
    });

    // Helper untuk memasukkan checkup record ke dalam group mobil yang sesuai
    const attachCheckupToGroup = (rec: CheckupRecord) => {
      if (!rec || !rec.document_number) return;
      const normPlate = (rec.license_plate || '').trim().toUpperCase().replace(/\s+/g, '');
      const matchKey = rec.vehicle_id || normPlate;

      let group = map.get(matchKey);
      if (!group) {
        for (const g of map.values()) {
          if (g.license_plate.replace(/\s+/g, '').toUpperCase() === normPlate) {
            group = g;
            break;
          }
        }
      }

      if (!group) {
        const latestWo = allWorkOrders.find((w) => w.id === rec.work_order_id || w.spk_number === rec.document_number);
        group = {
          key: matchKey || `rec-${rec.id}`,
          vehicleId: rec.vehicle_id,
          license_plate: rec.license_plate || 'TANPA-PLAT',
          customer_name: rec.customer_name || 'Pelanggan',
          phone_number: '',
          car_brand: '',
          car_model: rec.car_model || '',
          branch: resolveGroupBranch(latestWo, undefined, rec),
          latestSpk: latestWo,
          lastDate: rec.check_date || rec.created_at || '',
          qcGeneralList: [],
          acList: [],
          understeelList: [],
          allRecords: [],
        };
        map.set(group.key, group);
      }

      // Cegah duplikasi berdasarkan ID atau Nomor Dokumen
      const isDuplicate = group.allRecords.some(
        (r) => r.id === rec.id || r.document_number === rec.document_number
      );
      if (!isDuplicate) {
        group.allRecords.push(rec);
        if (rec.type === 'qc_general') group.qcGeneralList.push(rec);
        else if (rec.type === 'ac_specialist') group.acList.push(rec);
        else if (rec.type === 'understeel') group.understeelList.push(rec);
      }
    };

    // 3. Attach checkups dari database storage
    const sourceCheckups = selectedBranch === 'ALL' ? (allCheckups || checkups) : checkups;
    sourceCheckups.forEach(attachCheckupToGroup);

    // 4. Attach checkups langsung dari work_orders (sinkronisasi instan antar device)
    allWorkOrders.forEach((wo) => {
      const cl = wo.checklist_data;
      if (!cl || typeof cl !== 'object') return;

      const vehicle = wo.vehicle;
      const custName = vehicle?.customer_name || 'Pelanggan';
      const plate = vehicle?.license_plate || 'W 0000 XX';
      const model = vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil';
      const dateStr = wo.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10);

      // 4a. Dari checklist_data.checkup_records
      if (cl.checkup_records && typeof cl.checkup_records === 'object') {
        Object.values(cl.checkup_records).forEach((r: any) => {
          if (r && typeof r === 'object' && r.document_number) {
            attachCheckupToGroup({
              ...r,
              work_order_id: wo.id,
              vehicle_id: wo.vehicle_id,
              customer_name: r.customer_name || custName,
              license_plate: r.license_plate || plate,
              car_model: r.car_model || model,
            });
          }
        });
      }

      // 4b. Dari checklist_data.checkup_record
      if (cl.checkup_record && typeof cl.checkup_record === 'object' && cl.checkup_record.document_number) {
        attachCheckupToGroup({
          ...cl.checkup_record,
          work_order_id: wo.id,
          vehicle_id: wo.vehicle_id,
          customer_name: cl.checkup_record.customer_name || custName,
          license_plate: cl.checkup_record.license_plate || plate,
          car_model: cl.checkup_record.car_model || model,
        });
      }

      // 4c. Dari qc_data
      if (cl.qc_data && typeof cl.qc_data === 'object') {
        attachCheckupToGroup({
          id: `qc-${wo.id}`,
          type: 'qc_general',
          document_number: cl.qc_data.document_number || `QC-${(wo.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
          work_order_id: wo.id,
          vehicle_id: wo.vehicle_id,
          customer_name: custName,
          license_plate: plate,
          car_model: model,
          technician_name: wo.mechanic_name || 'Mekanik',
          check_date: dateStr,
          qc_data: cl.qc_data,
          created_at: wo.created_at || new Date().toISOString(),
          updated_at: wo.updated_at,
        });
      }

      // 4d. Dari ac_data
      if (cl.ac_data && typeof cl.ac_data === 'object') {
        attachCheckupToGroup({
          id: `ac-${wo.id}`,
          type: 'ac_specialist',
          document_number: cl.ac_data.document_number || `AC-${(wo.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
          work_order_id: wo.id,
          vehicle_id: wo.vehicle_id,
          customer_name: custName,
          license_plate: plate,
          car_model: model,
          technician_name: wo.mechanic_name || 'Mekanik',
          check_date: dateStr,
          ac_data: cl.ac_data,
          created_at: wo.created_at || new Date().toISOString(),
          updated_at: wo.updated_at,
        });
      }

      // 4e. Dari understeel_data
      if (cl.understeel_data && typeof cl.understeel_data === 'object') {
        attachCheckupToGroup({
          id: `und-${wo.id}`,
          type: 'understeel',
          document_number: cl.understeel_data.document_number || `UND-${(wo.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
          work_order_id: wo.id,
          vehicle_id: wo.vehicle_id,
          customer_name: custName,
          license_plate: plate,
          car_model: model,
          technician_name: cl.understeel_data.technician_name || wo.mechanic_name || 'Mekanik',
          check_date: dateStr,
          understeel_data: cl.understeel_data,
          created_at: wo.created_at || new Date().toISOString(),
          updated_at: wo.updated_at,
        });
      }
    });

    const groups = Array.from(map.values());

    // Urutkan checklist internal per mobil berdasarkan tanggal terbaru
    groups.forEach((g) => {
      g.allRecords.sort((a, b) => new Date(b.check_date || b.created_at || 0).getTime() - new Date(a.check_date || a.created_at || 0).getTime());
      g.qcGeneralList.sort((a, b) => new Date(b.check_date || b.created_at || 0).getTime() - new Date(a.check_date || a.created_at || 0).getTime());
      g.acList.sort((a, b) => new Date(b.check_date || b.created_at || 0).getTime() - new Date(a.check_date || a.created_at || 0).getTime());
      g.understeelList.sort((a, b) => new Date(b.check_date || b.created_at || 0).getTime() - new Date(a.check_date || a.created_at || 0).getTime());
    });

    // Urutkan daftar mobil secara kronologis berdasarkan saat SPK tersebut diterbitkan
    return groups.sort((a, b) => {
      const timeA = new Date(a.latestSpk?.created_at || a.latestSpk?.entry_date || a.lastDate || 0).getTime();
      const timeB = new Date(b.latestSpk?.created_at || b.latestSpk?.entry_date || b.lastDate || 0).getTime();
      return timeB - timeA;
    });
  }, [checkups, allWorkOrders, vehicles]);

  // Hitung jumlah kendaraan per cabang
  const countMhs1 = vehicleGroups.filter((g) => g.branch === 'MHS 1').length;
  const countMhs2 = vehicleGroups.filter((g) => g.branch === 'MHS 2').length;
  const countMhs3 = vehicleGroups.filter((g) => g.branch === 'MHS 3').length;

  // Filter & Search
  const filteredVehicleGroups = vehicleGroups.filter((g) => {
    // Branch filter (MHS 1, MHS 2, MHS 3, atau Semua)
    if (selectedBranch !== 'ALL' && g.branch !== selectedBranch) return false;

    // Tab filter
    if (filterTab === 'has_checkup' && g.allRecords.length === 0) return false;
    if (filterTab === 'empty' && g.allRecords.length > 0) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const plate = g.license_plate.toLowerCase();
      const cust = g.customer_name.toLowerCase();
      const car = `${g.car_brand} ${g.car_model}`.toLowerCase();
      const spk = (g.latestSpk?.spk_number || '').toLowerCase();
      const phone = (g.phone_number || '').toLowerCase();
      const branch = g.branch.toLowerCase();
      return plate.includes(q) || cust.includes(q) || car.includes(q) || spk.includes(q) || phone.includes(q) || branch.includes(q);
    }

    return true;
  });

  const handleDeleteCheckup = async (recId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Hapus lembar checkup ini secara permanen?')) {
      const ok = await deleteCheckupAsync(recId);
      if (ok) {
        showToast('Formulir checkup berhasil dihapus.', 'info');
        // Update state modal jika sedang terbuka
        if (selectedVehicleGroup) {
          setSelectedVehicleGroup((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              qcGeneralList: prev.qcGeneralList.filter((r) => r.id !== recId),
              acList: prev.acList.filter((r) => r.id !== recId),
              understeelList: prev.understeelList.filter((r) => r.id !== recId),
              allRecords: prev.allRecords.filter((r) => r.id !== recId),
            };
          });
        }
      }
    }
  };

  const currentBranchGroups = selectedBranch === 'ALL'
    ? vehicleGroups
    : vehicleGroups.filter((g) => g.branch === selectedBranch);
  const countHasCheckup = currentBranchGroups.filter((g) => g.allRecords.length > 0).length;
  const countEmpty = currentBranchGroups.filter((g) => g.allRecords.length === 0).length;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-maroon-700" />
              <span>Checklist Quality Control Kendaraan</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pilih data mobil untuk melihat, mengisi, atau mencetak formulir QC Tune Up, Spesialis AC, dan Keluhan Understeel.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => syncWithSupabase(true)}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Sinkronkan data langsung dari Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-maroon-700' : 'text-slate-500'}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
            </button>
            <Link
              href="/checkup/new"
              className="inline-flex items-center justify-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Checkup Baru</span>
            </Link>
          </div>
        </div>

        {/* Filter Cabang & Filter Status Checklist */}
        <div className="space-y-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          {/* Baris 1: Filter Cabang (Semua, MHS 1, MHS 2, MHS 3) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <div className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                <Building2 className="w-4 h-4 text-maroon-700" />
                <span>Cabang:</span>
              </div>
              {canAccessAll ? (
                <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedBranch('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition font-black cursor-pointer ${
                      selectedBranch === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Cabang ({vehicleGroups.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBranch('MHS 1')}
                    className={`px-3 py-1.5 rounded-lg transition font-black cursor-pointer ${
                      selectedBranch === 'MHS 1'
                        ? 'bg-[#8B0000] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MHS 1 ({countMhs1})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBranch('MHS 2')}
                    className={`px-3 py-1.5 rounded-lg transition font-black cursor-pointer ${
                      selectedBranch === 'MHS 2'
                        ? 'bg-[#001F7A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MHS 2 ({countMhs2})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBranch('MHS 3')}
                    className={`px-3 py-1.5 rounded-lg transition font-black cursor-pointer ${
                      selectedBranch === 'MHS 3'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MHS 3 ({countMhs3})
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-[11px] font-bold text-slate-500">Cabang Anda:</span>
                  <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{activeBranch}</span>
                </div>
              )}
            </div>
          </div>

          {/* Baris 2: Filter Status Checklist & Pencarian */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-fit">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Mobil ({currentBranchGroups.length})
              </button>
              <button
                onClick={() => setFilterTab('has_checkup')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                  filterTab === 'has_checkup'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sudah Ada Checklist ({countHasCheckup})
              </button>
              <button
                onClick={() => setFilterTab('empty')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                  filterTab === 'empty'
                    ? 'bg-white text-amber-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Belum Diisi ({countEmpty})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Plat / Mobil / Customer / SPK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 outline-none focus:border-maroon-600 focus:bg-white transition font-medium"
              />
            </div>
          </div>
        </div>

        {/* Data Mobil Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                  <th className="p-3.5">Plat &amp; Kendaraan</th>
                  <th className="p-3.5">Pemilik &amp; Kontak</th>
                  <th className="p-3.5">SPK / Servis Terakhir</th>
                  <th className="p-3.5">Kelengkapan Form Checklist</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicleGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                      Tidak ada data kendaraan yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredVehicleGroups.map((group) => {
                    const totalForms = group.allRecords.length;
                    const hasQc = group.qcGeneralList.length > 0;
                    const hasAc = group.acList.length > 0;
                    const hasUndersteel = group.understeelList.length > 0;

                    return (
                      <tr
                        key={group.key}
                        onClick={() => setSelectedVehicleGroup(group)}
                        className="hover:bg-slate-50/80 transition cursor-pointer group"
                      >
                        {/* 1. Plat & Kendaraan */}
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <div className="font-mono font-black text-maroon-900 text-sm tracking-wide">
                              {formatPlate(group.license_plate)}
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              group.branch === 'MHS 2' ? 'bg-[#001F7A] text-white' :
                              group.branch === 'MHS 3' ? 'bg-emerald-700 text-white' :
                              'bg-[#8B0000] text-white'
                            }`}>
                              {group.branch}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {group.car_brand} {group.car_model} {group.car_year ? `(${group.car_year})` : ''}
                          </div>
                          {group.car_color && (
                            <div className="text-[10px] text-slate-500 font-medium">
                              Warna: {group.car_color}
                            </div>
                          )}
                        </td>

                        {/* 2. Pemilik & Kontak */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{group.customer_name}</div>
                          {group.phone_number && (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{group.phone_number}</span>
                            </div>
                          )}
                        </td>

                        {/* 3. SPK / Servis */}
                        <td className="p-3.5 space-y-0.5">
                          {group.latestSpk ? (
                            <>
                              <div className="font-mono font-bold text-[#001F7A]">
                                {group.latestSpk.spk_number}
                              </div>
                              <div className="text-[10.5px] text-slate-500 font-medium">
                                Terbit: {formatDate(group.latestSpk.created_at || group.latestSpk.entry_date)}
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-400 italic text-[11px]">Database Kendaraan</div>
                          )}
                        </td>

                        {/* 4. Kelengkapan Form Checklist */}
                        <td className="p-3.5 space-y-1">
                          <div>
                            {totalForms > 0 ? (
                              <span className="inline-flex items-center space-x-1 text-[10.5px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Selesai Checklist ({totalForms} Form)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                <span>Belum Diisi Checklist</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* QC Tune Up Badge */}
                            <span
                              className={`inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                hasQc
                                  ? 'bg-red-50 text-red-700 border-red-200 font-black'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}
                            >
                              <Wrench className="w-2.5 h-2.5" />
                              <span>QC Tune Up {hasQc ? `(${group.qcGeneralList.length})` : '(-) '}</span>
                            </span>

                            {/* QC AC Badge */}
                            <span
                              className={`inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                hasAc
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-black'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}
                            >
                              <ThermometerSnowflake className="w-2.5 h-2.5" />
                              <span>QC AC {hasAc ? `(${group.acList.length})` : '(-) '}</span>
                            </span>

                            {/* Understeel Badge */}
                            <span
                              className={`inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                hasUndersteel
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 font-black'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}
                            >
                              <Car className="w-2.5 h-2.5" />
                              <span>Understeel {hasUndersteel ? `(${group.understeelList.length})` : '(-) '}</span>
                            </span>
                          </div>
                        </td>

                        {/* 5. Aksi */}
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlateTarget({
                                vehicleId: group.vehicleId || '',
                                plate: group.license_plate,
                                name: group.customer_name,
                                model: `${group.car_brand} ${group.car_model}`.trim(),
                              });
                            }}
                            className="inline-flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg text-xs transition border border-blue-200"
                            title="Ganti Plat Nomor Kendaraan"
                          >
                            <Car className="w-3.5 h-3.5" />
                            <span>Ganti Plat</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicleGroup(group);
                            }}
                            className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs"
                          >
                            <span>Buka Checklist</span>
                            <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-black">
                              {totalForms}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
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

      {/* MODAL: DAFTAR SEMUA FORM CHECKLIST UNTUK MOBIL YANG DI-KLIK */}
      {selectedVehicleGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-maroon-50 text-maroon-800 flex items-center justify-center font-black">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-lg text-maroon-900 font-mono tracking-wide">
                      {formatPlate(selectedVehicleGroup.license_plate)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      selectedVehicleGroup.branch === 'MHS 2' ? 'bg-[#001F7A] text-white' :
                      selectedVehicleGroup.branch === 'MHS 3' ? 'bg-emerald-700 text-white' :
                      'bg-[#8B0000] text-white'
                    }`}>
                      {selectedVehicleGroup.branch}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {selectedVehicleGroup.car_brand} {selectedVehicleGroup.car_model} • {selectedVehicleGroup.customer_name}
                  </div>
                  {selectedVehicleGroup.latestSpk && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      No. SPK: <strong className="text-[#001F7A] font-mono">{selectedVehicleGroup.latestSpk.spk_number}</strong>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedVehicleGroup(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* 3 Inspection Sections */}
            <div className="space-y-4">
              {(() => {
                const isCarFinished =
                  selectedVehicleGroup.latestSpk?.status === 'completed' ||
                  selectedVehicleGroup.latestSpk?.status === 'paid';
                return isCarFinished ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center space-x-2.5">
                    <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Mobil ini telah berstatus <strong>Selesai / Lunas</strong>. Pengisian checklist baru telah dikunci permanen (hanya dapat melihat lembar hasil checkup).
                    </span>
                  </div>
                ) : null;
              })()}

              <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                Formulir Checklist Terisi &amp; Input Baru ({selectedVehicleGroup.allRecords.length} Form Terdaftar)
              </h3>

              {/* 1. QC TUNE UP 23 TITIK */}
              <div className="rounded-2xl border border-red-200 bg-red-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-red-950 uppercase">
                        1. QC Tune Up (23 Titik Pemeriksaan Mesin)
                      </h4>
                      <p className="text-[11px] text-red-800 font-medium">
                        {selectedVehicleGroup.qcGeneralList.length > 0
                          ? `Sudah terisi ${selectedVehicleGroup.qcGeneralList.length} formulir pemeriksaan`
                          : 'Belum ada formulir QC Tune Up untuk mobil ini'}
                      </p>
                    </div>
                  </div>

                  {selectedVehicleGroup.latestSpk?.status === 'completed' ||
                  selectedVehicleGroup.latestSpk?.status === 'paid' ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Selesai (Terkunci)</span>
                    </span>
                  ) : (
                    <Link
                      href={`/checkup/new?type=qc_general${selectedVehicleGroup.latestSpk ? `&spkId=${selectedVehicleGroup.latestSpk.id}` : ''}`}
                      className="inline-flex items-center space-x-1 text-[11px] bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Isi QC Tune Up</span>
                    </Link>
                  )}
                </div>

                {selectedVehicleGroup.qcGeneralList.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-red-200/60">
                    {selectedVehicleGroup.qcGeneralList.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-white p-3 rounded-xl border border-red-200 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {rec.document_number}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Tanggal: {formatDate(rec.check_date)} • Teknisi: <strong>{rec.technician_name}</strong>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintRecord(rec)}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold transition"
                          >
                            Lihat Lembar QC
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCheckup(rec.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. QUALITY CONTROL AC SPESIALIS */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <ThermometerSnowflake className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-blue-950 uppercase">
                        2. QC Spesialis AC Mobil
                      </h4>
                      <p className="text-[11px] text-blue-800 font-medium">
                        {selectedVehicleGroup.acList.length > 0
                          ? `Sudah terisi ${selectedVehicleGroup.acList.length} formulir AC`
                          : 'Belum ada formulir QC AC untuk mobil ini'}
                      </p>
                    </div>
                  </div>

                  {selectedVehicleGroup.latestSpk?.status === 'completed' ||
                  selectedVehicleGroup.latestSpk?.status === 'paid' ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Selesai (Terkunci)</span>
                    </span>
                  ) : (
                    <Link
                      href={`/checkup/new?type=ac_specialist${selectedVehicleGroup.latestSpk ? `&spkId=${selectedVehicleGroup.latestSpk.id}` : ''}`}
                      className="inline-flex items-center space-x-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Isi QC AC</span>
                    </Link>
                  )}
                </div>

                {selectedVehicleGroup.acList.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-blue-200/60">
                    {selectedVehicleGroup.acList.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-white p-3 rounded-xl border border-blue-200 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {rec.document_number}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Tanggal: {formatDate(rec.check_date)} • Teknisi: <strong>{rec.technician_name}</strong>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintRecord(rec)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition"
                          >
                            Lihat Lembar AC
                          </button>
                          {!(
                            selectedVehicleGroup.latestSpk?.status === 'completed' ||
                            selectedVehicleGroup.latestSpk?.status === 'paid'
                          ) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCheckup(rec.id, e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. FORM KELUHAN UNDERSTEEL 26 TITIK */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase">
                        3. Form Keluhan Understeel (26 Titik Kaki-Kaki)
                      </h4>
                      <p className="text-[11px] text-amber-800 font-medium">
                        {selectedVehicleGroup.understeelList.length > 0
                          ? `Sudah terisi ${selectedVehicleGroup.understeelList.length} formulir Understeel`
                          : 'Belum ada formulir Understeel untuk mobil ini'}
                      </p>
                    </div>
                  </div>

                  {selectedVehicleGroup.latestSpk?.status === 'completed' ||
                  selectedVehicleGroup.latestSpk?.status === 'paid' ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Selesai (Terkunci)</span>
                    </span>
                  ) : (
                    <Link
                      href={`/checkup/new?type=understeel${selectedVehicleGroup.latestSpk ? `&spkId=${selectedVehicleGroup.latestSpk.id}` : ''}`}
                      className="inline-flex items-center space-x-1 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Isi Understeel</span>
                    </Link>
                  )}
                </div>

                {selectedVehicleGroup.understeelList.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-amber-200/60">
                    {selectedVehicleGroup.understeelList.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {rec.document_number}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Tanggal: {formatDate(rec.check_date)} • Teknisi: <strong>{rec.technician_name}</strong>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintRecord(rec)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition"
                          >
                            Lihat Lembar Understeel
                          </button>
                          {!(
                            selectedVehicleGroup.latestSpk?.status === 'completed' ||
                            selectedVehicleGroup.latestSpk?.status === 'paid'
                          ) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCheckup(rec.id, e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Printable Checklist Sheet */}
      {selectedPrintRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {selectedPrintRecord.type === 'qc_general' && selectedPrintRecord.qc_data && (
              <PrintableGeneralCheckup
                checkup={selectedPrintRecord.qc_data}
                settings={settings}
                onClose={() => setSelectedPrintRecord(null)}
              />
            )}
            {selectedPrintRecord.type === 'ac_specialist' && selectedPrintRecord.ac_data && (
              <PrintableACCheckup
                checkup={selectedPrintRecord.ac_data}
                settings={settings}
                onClose={() => setSelectedPrintRecord(null)}
              />
            )}
            {selectedPrintRecord.type === 'understeel' && selectedPrintRecord.understeel_data && (
              <PrintableUndersteelCheckup
                checkup={selectedPrintRecord.understeel_data}
                settings={settings}
                onClose={() => setSelectedPrintRecord(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Plat Nomor */}
      {editingPlateTarget && (
        <EditLicensePlateModal
          vehicleId={editingPlateTarget.vehicleId}
          currentPlate={editingPlateTarget.plate}
          customerName={editingPlateTarget.name}
          carModel={editingPlateTarget.model}
          onClose={() => setEditingPlateTarget(null)}
          onSuccess={(newPlate) => {
            editingPlateTarget.plate = newPlate;
          }}
        />
      )}
    </div>
  );
}

