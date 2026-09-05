'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { CRMLog, CRMStatus, CRMReminderPeriod, VehicleCustomer } from '@/lib/types/database';
import {
  formatDate,
  formatPlate,
  createWhatsAppLink,
} from '@/lib/utils';
import {
  MessageSquare,
  Share2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Car,
  UserCheck,
  Send,
  Sparkles,
  Phone,
  Search,
  Filter,
  CheckCircle,
  BellRing,
  CalendarClock,
  History,
  RotateCcw,
  Check,
  ShieldCheck,
  Sparkle,
  Building2,
  ChevronRight,
  ChevronDown,
  Info,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { BranchId } from '@/lib/auth/users';

interface CRMVehicleGroup {
  key: string;
  vehicleId?: string;
  licensePlate: string;
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carYear?: number | string;
  branch: string;
  spkNumber: string;
  serviceDate?: string;
  logs: CRMLog[];
  milestones: {
    '1_week'?: CRMLog;
    '2_weeks'?: CRMLog;
    '1_month'?: CRMLog;
    '3_months'?: CRMLog;
    [key: string]: CRMLog | undefined;
  };
  activeMilestone?: CRMLog;
  daysUntilNext: number | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isCompletedAll: boolean;
}

export default function CRMPage() {
  const { allCrmLogs, vehicles, refreshData, showToast } = useApp();
  const { activeBranch } = useAuth();

  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timingFilter, setTimingFilter] = useState<'all' | 'due' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected vehicle group for detail / follow-up modal
  const [selectedGroup, setSelectedGroup] = useState<CRMVehicleGroup | null>(null);
  const [selectedMilestonePeriod, setSelectedMilestonePeriod] = useState<CRMReminderPeriod>('1_week');
  const [customWaMessage, setCustomWaMessage] = useState<string>('');
  const [followupNotes, setFollowupNotes] = useState<string>('');
  const [scheduledBookingDate, setScheduledBookingDate] = useState<string>('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTime = new Date(todayStr).getTime();

  // Helper template pesan WA per milestone
  const getTemplateForPeriod = (period: CRMReminderPeriod, customerName: string, car: string, plate: string, serviceDateStr?: string) => {
    const sDate = serviceDateStr ? formatDate(serviceDateStr) : 'beberapa waktu lalu';

    switch (period) {
      case '1_week':
        return `Halo Bpk/Ibu ${customerName}, salam hangat dari Mardiono Home Service.

Bagaimana kondisi mobil ${car} (${plate}) setelah 1 minggu selesai servis di bengkel kami pada tanggal ${sDate}? Semoga performanya nyaman dan prima.

Jika ada hal yang ingin dikonsultasikan atau ada kendala, jangan ragu untuk menghubungi kami ya. Terima kasih! 🙏`;

      case '2_weeks':
        return `Halo Bpk/Ibu ${customerName}, salam dari Mardiono Home Service.

Sudah 2 minggu sejak mobil ${car} (${plate}) selesai pengerjaan di bengkel kami. Kami ingin memastikan tarikan mesin dan fungsi AC kendaraan tetap nyaman dan optimal.

Semoga aktivitas berkendara Bpk/Ibu selalu lancar, aman, dan menyenangkan! 🚗✨`;

      case '1_month':
        return `Halo Bpk/Ibu ${customerName}, salam dari Mardiono Home Service.

Mengingatkan bahwa masa garansi servis 1 bulan untuk mobil ${car} (${plate}) akan segera berakhir. Pastikan seluruh fungsi kendaraan Anda tetap dalam kondisi prima.

Bpk/Ibu juga dipersilakan mampir ke bengkel kami untuk cek tekanan angin ban & air radiator gratis kapan saja. Terima kasih! 🛠️`;

      case '3_months':
      default:
        return `Halo Bpk/Ibu ${customerName}, salam hangat dari Mardiono Home Service.

Sudah 3 bulan sejak perawatan terakhir mobil ${car} (${plate}) di bengkel kami pada tanggal ${sDate}. Untuk menjaga performa mesin tetap awet, bertenaga, dan hemat BBM, kini sudah waktunya untuk Servis Berkala / Ganti Oli Mesin berikutnya.

Apakah berkenan kami bantu jadwalkan booking servis minggu ini? Terima kasih! 📅🔧`;
    }
  };

  const periodLabels: Record<string, { label: string; badgeClass: string; desc: string; shortLabel: string }> = {
    '1_week': { label: '1 Minggu', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300', desc: 'Kepuasan Servis Awal', shortLabel: '1 Mgg' },
    '2_weeks': { label: '2 Minggu', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300', desc: 'Performa Mesin & AC', shortLabel: '2 Mgg' },
    '1_month': { label: '1 Bulan', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', desc: 'Masa Garansi Servis', shortLabel: '1 Bln' },
    '3_months': { label: '3 Bulan', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300', desc: 'Servis Berkala & Ganti Oli', shortLabel: '3 Bln' },
    'periodic_service': { label: 'Servis Berkala', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300', desc: 'Perawatan Rutin', shortLabel: 'Berkala' },
    'ac_cleaning': { label: 'Perawatan AC', badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300', desc: 'Pembersihan AC', shortLabel: 'AC' },
    'oil_change': { label: 'Ganti Oli', badgeClass: 'bg-orange-100 text-orange-900 border-orange-300', desc: 'Oli Mesin', shortLabel: 'Oli' },
    'general_check': { label: 'Cek Umum', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300', desc: 'Checkup Kendaraan', shortLabel: 'Check' },
    'custom': { label: 'Custom', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', desc: 'Jadwal Khusus', shortLabel: 'Custom' },
  };

  const statusMap: Record<CRMStatus, { label: string; class: string }> = {
    pending: { label: 'Belum Dihubungi', class: 'bg-amber-50 text-amber-800 border-amber-300' },
    contacted: { label: 'Sudah Dihubungi', class: 'bg-blue-50 text-blue-800 border-blue-300' },
    scheduled: { label: 'Booking Dibuat', class: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    declined: { label: 'Ditolak / Tunda', class: 'bg-red-50 text-red-800 border-red-300' },
  };

  // 1. Sumber data sesuai Cabang yang dipilih
  const sourceLogs = useMemo(() => {
    return selectedBranch === 'ALL'
      ? allCrmLogs
      : allCrmLogs.filter((l) => (l.branch || 'MHS 1') === selectedBranch);
  }, [allCrmLogs, selectedBranch]);

  // 2. Kelompokkan data menjadi 1 baris per unit mobil (Deduplikasi)
  const vehicleGroups: CRMVehicleGroup[] = useMemo(() => {
    const map = new Map<string, CRMVehicleGroup>();

    sourceLogs.forEach((log) => {
      const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id) || log.work_order?.vehicle;
      const plate = (vehicle?.license_plate || (log as any).license_plate || '').trim().toUpperCase();
      const normPlate = plate.replace(/\s+/g, '');
      const key = log.vehicle_id || normPlate || log.spk_number || log.id;

      let group = map.get(key);
      if (!group) {
        group = {
          key,
          vehicleId: log.vehicle_id || vehicle?.id,
          licensePlate: vehicle?.license_plate || (log as any).license_plate || 'Tanpa Plat',
          customerName: vehicle?.customer_name || 'Pelanggan',
          phoneNumber: vehicle?.phone_number || '',
          carBrand: vehicle?.car_brand || '',
          carModel: vehicle?.car_model || '',
          carYear: vehicle?.car_year || '',
          branch: log.branch || 'MHS 1',
          spkNumber: log.spk_number || 'SPK Servis',
          serviceDate: log.service_date,
          logs: [],
          milestones: {},
          daysUntilNext: null,
          isOverdue: false,
          isDueToday: false,
          isCompletedAll: false,
        };
        map.set(key, group);
      }

      group.logs.push(log);
      group.milestones[log.reminder_type] = log;
      if (log.service_date && (!group.serviceDate || new Date(log.service_date).getTime() > new Date(group.serviceDate).getTime())) {
        group.serviceDate = log.service_date;
      }
    });

    // Evaluasi milestone tiap mobil & hitung hari
    return Array.from(map.values()).map((group) => {
      // Urutkan logs berdasarkan due_date
      group.logs.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      // Cari milestone yang masih pending terdekat
      const pendingLogs = group.logs.filter((l) => l.status === 'pending');
      let targetLog: CRMLog | undefined;

      if (pendingLogs.length > 0) {
        // Milestone pending dengan due_date paling awal
        targetLog = pendingLogs[0];
      } else if (group.logs.length > 0) {
        // Jika sudah dihubungi semua, ambil milestone terakhir
        targetLog = group.logs[group.logs.length - 1];
      }

      group.activeMilestone = targetLog;

      if (targetLog) {
        const dueTime = new Date(targetLog.due_date).getTime();
        const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
        group.daysUntilNext = diffDays;
        group.isOverdue = diffDays < 0 && targetLog.status === 'pending';
        group.isDueToday = diffDays === 0 && targetLog.status === 'pending';
      }

      group.isCompletedAll = group.logs.length > 0 && group.logs.every((l) => l.status === 'contacted' || l.status === 'scheduled');

      return group;
    });
  }, [sourceLogs, vehicles, todayTime]);

  // 3. Filter mobil
  const filteredVehicleGroups = useMemo(() => {
    return vehicleGroups.filter((group) => {
      // Filter Milestone: cek apakah mobil memiliki milestone tertentu yang aktif atau match
      if (periodFilter !== 'all') {
        const hasMatchingMilestone = group.logs.some((l) => l.reminder_type === periodFilter);
        if (!hasMatchingMilestone) return false;
      }

      // Filter Status: cek status dari activeMilestone atau salah satu milestone
      if (statusFilter !== 'all') {
        if (group.activeMilestone?.status !== statusFilter) {
          return false;
        }
      }

      // Filter Timing (Due now vs Upcoming)
      if (timingFilter === 'due') {
        if (!group.isOverdue && !group.isDueToday) {
          return false;
        }
      } else if (timingFilter === 'upcoming') {
        if (group.daysUntilNext === null || group.daysUntilNext <= 0 || group.isCompletedAll) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const plate = group.licensePlate.toLowerCase();
        const name = group.customerName.toLowerCase();
        const phone = group.phoneNumber.toLowerCase();
        const car = `${group.carBrand} ${group.carModel}`.toLowerCase();
        const spk = group.spkNumber.toLowerCase();
        const br = group.branch.toLowerCase();
        return plate.includes(q) || name.includes(q) || phone.includes(q) || car.includes(q) || spk.includes(q) || br.includes(q);
      }

      return true;
    });
  }, [vehicleGroups, periodFilter, statusFilter, timingFilter, searchQuery]);

  // KPI Counters (dihitung berdasarkan Unit Mobil Unik)
  const countDueNow = useMemo(() => {
    return vehicleGroups.filter((g) => g.isOverdue || g.isDueToday).length;
  }, [vehicleGroups]);

  const count1W2W = useMemo(() => {
    return vehicleGroups.filter((g) => {
      const type = g.activeMilestone?.reminder_type;
      return type === '1_week' || type === '2_weeks';
    }).length;
  }, [vehicleGroups]);

  const count1M3M = useMemo(() => {
    return vehicleGroups.filter((g) => {
      const type = g.activeMilestone?.reminder_type;
      return type === '1_month' || type === '3_months';
    }).length;
  }, [vehicleGroups]);

  const countCompleted = useMemo(() => {
    return vehicleGroups.filter((g) => g.isCompletedAll).length;
  }, [vehicleGroups]);

  // Tab counters
  const count1Week = vehicleGroups.filter((g) => g.logs.some((l) => l.reminder_type === '1_week')).length;
  const count2Weeks = vehicleGroups.filter((g) => g.logs.some((l) => l.reminder_type === '2_weeks')).length;
  const count1Month = vehicleGroups.filter((g) => g.logs.some((l) => l.reminder_type === '1_month')).length;
  const count3Months = vehicleGroups.filter((g) => g.logs.some((l) => l.reminder_type === '3_months')).length;

  // Open detail / follow-up modal for a vehicle group
  const handleOpenGroupModal = (group: CRMVehicleGroup, targetPeriod?: CRMReminderPeriod) => {
    setSelectedGroup(group);

    // Tentukan milestone mana yang difokuskan:
    // Jika targetPeriod diberikan dan ada log-nya, gunakan itu.
    // Jika tidak, gunakan activeMilestone group, atau default '1_week'.
    let periodToSelect: CRMReminderPeriod = targetPeriod || group.activeMilestone?.reminder_type || '1_week';
    if (!group.milestones[periodToSelect] && group.logs.length > 0) {
      periodToSelect = group.logs[0].reminder_type;
    }

    setSelectedMilestonePeriod(periodToSelect);
    loadMilestoneDraft(group, periodToSelect);
  };

  const loadMilestoneDraft = (group: CRMVehicleGroup, period: CRMReminderPeriod) => {
    const log = group.milestones[period] || group.activeMilestone;
    const car = `${group.carBrand} ${group.carModel}`.trim() || 'Mobil';
    const plate = group.licensePlate ? formatPlate(group.licensePlate) : '';
    const defaultMsg = getTemplateForPeriod(period, group.customerName, car, plate, group.serviceDate);

    setCustomWaMessage(log?.whatsapp_message || defaultMsg);
    setFollowupNotes(log?.notes || '');
    setScheduledBookingDate(log?.scheduled_date || '');
  };

  const handleSelectMilestoneTabInModal = (period: CRMReminderPeriod) => {
    if (!selectedGroup) return;
    setSelectedMilestonePeriod(period);
    loadMilestoneDraft(selectedGroup, period);
  };

  // Update status untuk milestone yang sedang dipilih di modal
  const handleUpdateStatus = (status: CRMStatus) => {
    if (!selectedGroup) return;
    const log = selectedGroup.milestones[selectedMilestonePeriod] || selectedGroup.activeMilestone;
    if (!log) return;

    DBService.updateCRMStatus(
      log.id,
      status,
      followupNotes,
      scheduledBookingDate,
      (log.branch as BranchId) || activeBranch,
      log
    );
    refreshData();
    showToast(`Status milestone ${periodLabels[selectedMilestonePeriod]?.label || selectedMilestonePeriod} berhasil diubah ke "${status.toUpperCase()}"`, 'success');
    setSelectedGroup(null);
  };

  // Kirim WA & otomatis set status ke 'contacted'
  const handleSendWhatsAppAndMarkContacted = () => {
    if (!selectedGroup) return;
    const log = selectedGroup.milestones[selectedMilestonePeriod] || selectedGroup.activeMilestone;
    if (!log) return;

    if (!selectedGroup.phoneNumber) {
      showToast('Nomor WhatsApp pelanggan tidak ditemukan.', 'error');
      return;
    }

    const waUrl = createWhatsAppLink(selectedGroup.phoneNumber, customWaMessage);
    window.open(waUrl, '_blank');

    DBService.updateCRMStatus(
      log.id,
      'contacted',
      followupNotes,
      scheduledBookingDate,
      (log.branch as BranchId) || activeBranch,
      log
    );
    refreshData();
    showToast(`WhatsApp dibuka & milestone ${periodLabels[selectedMilestonePeriod]?.label || selectedMilestonePeriod} ditandai "Sudah Dihubungi"!`, 'success');
    setSelectedGroup(null);
  };

  // Quick mark status langsung dari baris tabel
  const handleQuickMarkFollowup = (group: CRMVehicleGroup, newStatus: CRMStatus = 'contacted') => {
    const log = group.activeMilestone;
    if (!log) return;

    DBService.updateCRMStatus(
      log.id,
      newStatus,
      log.notes,
      log.scheduled_date,
      (log.branch as BranchId) || activeBranch,
      log
    );
    refreshData();
    const plate = group.licensePlate ? formatPlate(group.licensePlate) : '';
    if (newStatus === 'contacted') {
      showToast(`Kendaraan ${plate || group.customerName} berhasil ditandai "Sudah Follow-up"!`, 'success');
    } else {
      showToast(`Status kendaraan ${plate || group.customerName} dikembalikan ke "${newStatus.toUpperCase()}"`, 'info');
    }
  };

  // Render badge hitung hari
  const renderCountdownBadge = (diffDays: number | null, isPending: boolean) => {
    if (diffDays === null) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
          <span>-</span>
        </span>
      );
    }
    if (!isPending) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Selesai Ter-followup</span>
        </span>
      );
    }
    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-black px-2.5 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          <span>Lewat {Math.abs(diffDays)} hari</span>
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-black px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
          <BellRing className="w-3.5 h-3.5 text-amber-600" />
          <span>Hari Ini</span>
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
          <Clock className="w-3 h-3 text-indigo-600" />
          <span>{diffDays} hari lagi</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
        <Calendar className="w-3 h-3 text-slate-500" />
        <span>{diffDays} hari lagi</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-maroon-700" />
            <span>CRM &amp; Service Reminder Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar follow-up pelanggan per unit mobil dengan hitung mundur waktu jatuh tempo otomatis (1 Minggu, 2 Minggu, 1 Bulan &amp; 3 Bulan).
          </p>
        </div>
      </div>

      {/* Filter Cabang Terpadu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Filter Cabang Bengkel
            </div>
            <div className="text-[11px] text-slate-500">
              Pilih cabang bengkel tempat servis dilakukan untuk follow-up pelanggan
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
              {vehicleGroups.length} Mobil
            </span>
          </button>
          {(['MHS 1', 'MHS 2', 'MHS 3'] as BranchId[]).map((b) => {
            const count = allCrmLogs
              .filter((l) => (l.branch || 'MHS 1') === b)
              .reduce((set, item) => {
                const vehicle = item.vehicle || item.work_order?.vehicle;
                const plate = (vehicle?.license_plate || (item as any).license_plate || item.vehicle_id || item.id).trim().toUpperCase().replace(/\s+/g, '');
                set.add(plate);
                return set;
              }, new Set<string>()).size;

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
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards (Per Mobil Unik) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-red-600 font-bold flex items-center space-x-1">
              <BellRing className="w-3.5 h-3.5" />
              <span>Sudah Waktunya / Lewat</span>
            </span>
            <div className="text-2xl font-black text-red-700 font-mono mt-0.5">
              {countDueNow} Mobil
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Perlu follow-up segera</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-indigo-700 font-bold">1 &amp; 2 Minggu Pasca Servis</span>
            <div className="text-2xl font-black text-indigo-800 font-mono mt-0.5">
              {count1W2W} Mobil
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Cek kepuasan &amp; kenyamanan</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-700 font-bold">1 &amp; 3 Bulan Servis Rutin</span>
            <div className="text-2xl font-black text-amber-800 font-mono mt-0.5">
              {count1M3M} Mobil
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Garansi &amp; ganti oli berkala</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-700 font-bold">Selesai Ter-followup</span>
            <div className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
              {countCompleted} Mobil
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Semua jadwal terhubungi</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Milestone Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Mobil ({vehicleGroups.length})
            </button>
            <button
              onClick={() => setPeriodFilter('1_week')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === '1_week'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Minggu ({count1Week})
            </button>
            <button
              onClick={() => setPeriodFilter('2_weeks')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === '2_weeks'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 Minggu ({count2Weeks})
            </button>
            <button
              onClick={() => setPeriodFilter('1_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === '1_month'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Bulan ({count1Month})
            </button>
            <button
              onClick={() => setPeriodFilter('3_months')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === '3_months'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 Bulan ({count3Months})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Plat / Customer / SPK..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-maroon-600 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Sub-Filters: Timing & Status */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-semibold text-[11px] mr-1">Waktu:</span>
          <button
            onClick={() => setTimingFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium border text-[11px] transition ${
              timingFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Waktu
          </button>
          <button
            onClick={() => setTimingFilter('due')}
            className={`px-2.5 py-1 rounded-lg font-medium border text-[11px] transition ${
              timingFilter === 'due'
                ? 'bg-red-600 text-white border-red-600 font-bold'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            🔥 Sudah Waktunya / Lewat ({countDueNow})
          </button>
          <button
            onClick={() => setTimingFilter('upcoming')}
            className={`px-2.5 py-1 rounded-lg font-medium border text-[11px] transition ${
              timingFilter === 'upcoming'
                ? 'bg-slate-800 text-white border-slate-800 font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ⏳ Mendatang
          </button>

          <span className="text-slate-300 mx-2">|</span>

          <span className="text-slate-500 font-semibold text-[11px] mr-1">Status:</span>
          {(['all', 'pending', 'contacted', 'scheduled', 'declined'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-medium border text-[11px] transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st === 'all' ? 'Semua Status' : statusMap[st]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* Petunjuk Interaktif */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Tips CRM:</strong> Setiap baris mewakili <strong>1 unit mobil</strong>. Klik pada baris mobil untuk melihat rincian hitung hari menuju jadwal follow-up ke-4 milestone (1 Minggu, 2 Minggu, 1 Bulan, 3 Bulan) dan mengirim WhatsApp.
          </span>
        </div>
      </div>

      {/* CRM Deduplicated Table (1 Baris Per Unit Mobil) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                <th className="p-3.5">Plat &amp; Kendaraan</th>
                <th className="p-3.5">Pelanggan &amp; WhatsApp</th>
                <th className="p-3.5">Cabang &amp; SPK</th>
                <th className="p-3.5">Tgl Servis</th>
                <th className="p-3.5">Hitung Hari Menuju Follow-up</th>
                <th className="p-3.5">Status 4 Milestone</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicleGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    {searchQuery || periodFilter !== 'all' || statusFilter !== 'all' || timingFilter !== 'all'
                      ? 'Tidak ada data mobil yang sesuai filter.'
                      : 'Belum ada data follow-up CRM. Selesaikan SPK di antrean servis untuk mendaftarkan mobil ke jadwal CRM otomatis.'}
                  </td>
                </tr>
              ) : (
                filteredVehicleGroups.map((group) => {
                  const activeLog = group.activeMilestone;
                  const periodInfo = activeLog ? (periodLabels[activeLog.reminder_type] || periodLabels.custom) : null;
                  const isPending = activeLog?.status === 'pending';

                  return (
                    <tr
                      key={group.key}
                      onClick={() => handleOpenGroupModal(group)}
                      className="hover:bg-slate-50/90 transition cursor-pointer group"
                    >
                      {/* 1. Plat & Kendaraan */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-maroon-900 text-sm group-hover:text-maroon-700 transition flex items-center space-x-1.5">
                          <span>{group.licensePlate ? formatPlate(group.licensePlate) : '-'}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-maroon-600 transition" />
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {group.carBrand} {group.carModel} {group.carYear ? `(${group.carYear})` : ''}
                        </div>
                      </td>

                      {/* 2. Pelanggan & WhatsApp */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{group.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{group.phoneNumber || '-'}</span>
                        </div>
                      </td>

                      {/* 3. Cabang & SPK */}
                      <td className="p-3.5 space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-black border ${
                          group.branch === 'MHS 2'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : group.branch === 'MHS 3'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-blue-50 text-blue-900 border-blue-300'
                        }`}>
                          {group.branch}
                        </span>
                        <div className="font-mono text-[10.5px] text-[#001F7A] font-bold">
                          {group.spkNumber}
                        </div>
                      </td>

                      {/* 4. Tgl Servis Terakhir */}
                      <td className="p-3.5">
                        <div className="text-slate-800 font-medium">
                          {group.serviceDate ? formatDate(group.serviceDate) : '-'}
                        </div>
                      </td>

                      {/* 5. Hitung Hari Menuju Follow-up (Highlight Utama) */}
                      <td className="p-3.5 space-y-1">
                        <div>
                          {renderCountdownBadge(group.daysUntilNext, isPending)}
                        </div>
                        {activeLog && (
                          <div className="text-[10.5px] text-slate-500">
                            <span>Jadwal: <strong>{periodInfo?.label}</strong> ({formatDate(activeLog.due_date)})</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Status 4 Milestone (Mini Progress Pills) */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1">
                          {(['1_week', '2_weeks', '1_month', '3_months'] as CRMReminderPeriod[]).map((periodKey) => {
                            const log = group.milestones[periodKey];
                            const shortLabel = periodLabels[periodKey]?.shortLabel || periodKey;
                            if (!log) {
                              return (
                                <span
                                  key={periodKey}
                                  className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 text-slate-400"
                                  title={`${shortLabel}: Tidak Terjadwal`}
                                >
                                  {shortLabel}
                                </span>
                              );
                            }

                            const isDone = log.status === 'contacted' || log.status === 'scheduled';
                            const dueTime = new Date(log.due_date).getTime();
                            const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
                            const isOverdue = diffDays < 0 && log.status === 'pending';

                            return (
                              <button
                                key={periodKey}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenGroupModal(group, periodKey);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition ${
                                  isDone
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : isOverdue
                                    ? 'bg-red-50 text-red-800 border-red-300 font-black animate-pulse'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                                title={`${periodLabels[periodKey]?.label}: ${statusMap[log.status]?.label || log.status} (${diffDays < 0 ? `Lewat ${Math.abs(diffDays)} hari` : diffDays === 0 ? 'Hari ini' : `${diffDays} hari lagi`})`}
                              >
                                {isDone ? '✓ ' : ''}{shortLabel}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Klik untuk rincian hari
                        </div>
                      </td>

                      {/* 7. Tombol Aksi */}
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {activeLog && activeLog.status !== 'contacted' && activeLog.status !== 'scheduled' ? (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkFollowup(group, 'contacted')}
                            className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs px-2.5 py-1.5 rounded-xl transition shadow-xs cursor-pointer"
                            title="Tandai tahap follow-up ini sudah selesai dilakukan"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Tandai Selesai</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkFollowup(group, 'pending')}
                            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium text-xs px-2 py-1.5 rounded-xl transition cursor-pointer"
                            title="Reset status kembali ke Belum Dihubungi"
                          >
                            <RotateCcw className="w-3 h-3 text-slate-400" />
                            <span>Reset</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenGroupModal(group)}
                          className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Rincian &amp; WA</span>
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

      {/* DETAIL MODAL: HITUNG HARI & FOLLOW-UP 4 MILESTONE */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
                    <span className="font-mono text-maroon-900">{selectedGroup.licensePlate ? formatPlate(selectedGroup.licensePlate) : 'Tanpa Plat'}</span>
                    <span className="text-slate-400">·</span>
                    <span>{selectedGroup.carBrand} {selectedGroup.carModel}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pelanggan: <strong>{selectedGroup.customerName}</strong> ({selectedGroup.phoneNumber || 'Tanpa No HP'}) · SPK: <strong>{selectedGroup.spkNumber}</strong> ({selectedGroup.branch})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* HIGHLIGHT HITUNG HARI UTAMA */}
            {(() => {
              const activeLog = selectedGroup.milestones[selectedMilestonePeriod] || selectedGroup.activeMilestone;
              if (!activeLog) return null;
              const dueTime = new Date(activeLog.due_date).getTime();
              const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
              const isDone = activeLog.status === 'contacted' || activeLog.status === 'scheduled';

              return (
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  isDone
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : diffDays < 0
                    ? 'bg-red-50 border-red-200 text-red-950'
                    : diffDays === 0
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isDone
                        ? 'bg-emerald-200 text-emerald-800'
                        : diffDays < 0
                        ? 'bg-red-200 text-red-800 animate-pulse'
                        : diffDays === 0
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-indigo-200 text-indigo-800'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide opacity-75">
                        Tahap Aktif: {periodLabels[selectedMilestonePeriod]?.label} ({periodLabels[selectedMilestonePeriod]?.desc})
                      </div>
                      <div className="text-sm font-black mt-0.5">
                        {isDone ? (
                          <span>Sudah selesai di-follow up ({statusMap[activeLog.status]?.label || activeLog.status})</span>
                        ) : diffDays < 0 ? (
                          <span className="text-red-700">🔥 Lewat {Math.abs(diffDays)} hari dari jadwal jatuh tempo!</span>
                        ) : diffDays === 0 ? (
                          <span className="text-amber-800">⚡ Jatuh tempo hari ini! Segera hubungi pelanggan.</span>
                        ) : (
                          <span className="text-indigo-900">⏳ Kurang {diffDays} hari lagi menuju waktu follow-up.</span>
                        )}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        Tanggal Jatuh Tempo: <strong>{formatDate(activeLog.due_date)}</strong> · Servis Terakhir: {selectedGroup.serviceDate ? formatDate(selectedGroup.serviceDate) : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black border ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : diffDays < 0
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-white text-slate-800 border-slate-300'
                    }`}>
                      {statusMap[activeLog.status]?.label || activeLog.status}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* TABEL KARTU JADWAL 4 MILESTONE (HITUNG HARI LENGKAP) */}
            <div>
              <div className="text-xs font-black text-slate-900 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>Rincian Waktu &amp; Hitung Hari Ke-4 Milestone:</span>
                <span className="text-[11px] font-medium text-slate-500">Klik salah satu tahap di bawah untuk mengirim pesan WA</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['1_week', '2_weeks', '1_month', '3_months'] as CRMReminderPeriod[]).map((periodKey) => {
                  const log = selectedGroup.milestones[periodKey];
                  const info = periodLabels[periodKey];
                  const isSelected = selectedMilestonePeriod === periodKey;

                  if (!log) {
                    return (
                      <div key={periodKey} className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 text-xs">
                        <div className="font-bold">{info?.label}</div>
                        <div className="text-[11px]">Tidak ada jadwal khusus</div>
                      </div>
                    );
                  }

                  const dueTime = new Date(log.due_date).getTime();
                  const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
                  const isDone = log.status === 'contacted' || log.status === 'scheduled';
                  const isOverdue = diffDays < 0 && log.status === 'pending';

                  return (
                    <div
                      key={periodKey}
                      onClick={() => handleSelectMilestoneTabInModal(periodKey)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-maroon-600 bg-maroon-50/30 ring-2 ring-maroon-600/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${info?.badgeClass}`}>
                          {info?.label}
                        </span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isOverdue
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isDone ? '✓ ' : ''}{statusMap[log.status]?.label || log.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-500 font-medium">Jatuh Tempo:</div>
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            {formatDate(log.due_date)}
                          </div>
                        </div>

                        {/* HITUNG HARI PER MILESTONE */}
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 font-medium">Hitung Hari:</div>
                          <div className="text-xs font-black font-mono">
                            {isDone ? (
                              <span className="text-emerald-700">Sudah Selesai</span>
                            ) : diffDays < 0 ? (
                              <span className="text-red-600">Lewat {Math.abs(diffDays)} hari</span>
                            ) : diffDays === 0 ? (
                              <span className="text-amber-700 font-bold">Hari Ini!</span>
                            ) : (
                              <span className="text-indigo-700">{diffDays} hari lagi</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DRAFT PESAN WHATSAPP SESUAI MILESTONE YANG DIPILIH */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-black text-slate-800 flex items-center space-x-1.5">
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Draft Pesan WhatsApp ({periodLabels[selectedMilestonePeriod]?.label}):</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const car = `${selectedGroup.carBrand} ${selectedGroup.carModel}`.trim() || 'Mobil';
                    const plate = selectedGroup.licensePlate ? formatPlate(selectedGroup.licensePlate) : '';
                    setCustomWaMessage(getTemplateForPeriod(selectedMilestonePeriod, selectedGroup.customerName, car, plate, selectedGroup.serviceDate));
                    showToast('Template pesan WhatsApp di-reset ke default.', 'info');
                  }}
                  className="text-[10.5px] text-maroon-700 hover:text-maroon-900 font-bold underline"
                >
                  Muat Ulang Template Default
                </button>
              </div>

              <textarea
                rows={5}
                value={customWaMessage}
                onChange={(e) => setCustomWaMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-emerald-50/20 focus:border-emerald-600 focus:bg-white outline-none leading-relaxed font-medium text-slate-800 text-[11.5px]"
              />

              {/* Catatan Internal & Booking Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Follow-up Internal:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Sudah ditelepon, pelanggan puas dengan tarikan mesin..."
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jadwal Booking Servis Baru (Jika Ada):</label>
                  <input
                    type="date"
                    value={scheduledBookingDate}
                    onChange={(e) => setScheduledBookingDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleSendWhatsAppAndMarkContacted}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl transition shadow-xs cursor-pointer text-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim WhatsApp &amp; Tandai Sudah Dihubungi</span>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('contacted')}
                    className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold text-[11px] transition inline-flex items-center justify-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>✓ Sudah Follow-up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('scheduled')}
                    className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-[11px] transition inline-flex items-center justify-center space-x-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Booking Dibuat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('declined')}
                    className="py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl font-bold text-[11px] transition inline-flex items-center justify-center space-x-1"
                  >
                    <span>Ditolak / Tunda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('pending')}
                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-[11px] transition inline-flex items-center justify-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Reset Pending</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
