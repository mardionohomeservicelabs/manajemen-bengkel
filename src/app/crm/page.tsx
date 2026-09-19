'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { CRMLog, CRMStatus, CRMReminderPeriod, FollowupHistoryEntry } from '@/lib/types/database';
import {
  formatDate,
  formatDateTime,
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
  Eye,
  FileText,
  X,
  MessageCircle,
  AlertTriangle,
  Wrench,
  Gauge,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { BranchId } from '@/lib/auth/users';

interface CRMItem {
  id: string;
  vehicle_id: string;
  work_order_id?: string;
  spk_number?: string;
  invoice_number?: string;
  branch: string;
  service_date?: string;
  due_date: string;
  reminder_type: CRMReminderPeriod;
  status: CRMStatus;
  contacted_at?: string;
  contacted_by?: string;
  question_sent?: string;
  customer_response?: string;
  customer_sentiment?: 'very_satisfied' | 'satisfied' | 'complaint' | 'reschedule' | 'unresponsive';
  scheduled_date?: string;
  notes?: string;
  is_optional?: boolean;
  followup_history?: FollowupHistoryEntry[];

  // Joined vehicle & service info
  licensePlate: string;
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carYear?: number | string;
  currentMileage?: number;
  engineNumber?: string;
  chassisNumber?: string;
  complaints?: string;
  serviceSummary?: string;

  // Calculation info
  daysUntilNext: number | null;
  isOverdue: boolean;
  isDueToday: boolean;
}

export default function CRMPage() {
  const { allCrmLogs, vehicles, allWorkOrders, allInvoices, refreshData, showToast } = useApp();
  const { activeBranch, currentUser } = useAuth();

  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timingFilter, setTimingFilter] = useState<'all' | 'due' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal 1: Follow-Up & Input Respon
  const [followupModalItem, setFollowupModalItem] = useState<CRMItem | null>(null);
  const [modalPeriod, setModalPeriod] = useState<CRMReminderPeriod>('1_week');
  const [modalQuestion, setModalQuestion] = useState<string>('');
  const [modalResponse, setModalResponse] = useState<string>('');
  const [modalSentiment, setModalSentiment] = useState<CRMLog['customer_sentiment'] | ''>('satisfied');
  const [modalPic, setModalPic] = useState<string>('');
  const [modalScheduledDate, setModalScheduledDate] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');

  // Modal 2: Buka Riwayat Respon Customer
  const [responseDetailItem, setResponseDetailItem] = useState<CRMItem | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTime = new Date(todayStr).getTime();

  // Opsi periode follow up
  const periodOptions: { id: CRMReminderPeriod; label: string; days: number; desc: string; badgeClass: string }[] = [
    { id: 'none', label: 'Tanpa Follow Up', days: 0, desc: 'Tidak wajib / dilewati', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
    { id: '1_week', label: '1 Minggu', days: 7, desc: 'Kepuasan servis awal (+7 hari)', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
    { id: '2_weeks', label: '2 Minggu', days: 14, desc: 'Performa mesin & AC (+14 hari)', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' },
    { id: '1_month', label: '1 Bulan', days: 30, desc: 'Masa garansi servis (+30 hari)', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
    { id: '3_months', label: '3 Bulan', days: 90, desc: 'Servis berkala & oli (+90 hari)', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    { id: 'custom', label: 'Custom', days: 0, desc: 'Jadwal khusus bengkel', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300' },
  ];

  const sentimentMap: Record<
    NonNullable<CRMLog['customer_sentiment']>,
    { label: string; icon: string; badgeClass: string }
  > = {
    very_satisfied: {
      label: 'Sangat Puas',
      icon: '😍',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    satisfied: {
      label: 'Puas / Sesuai',
      icon: '👍',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    complaint: {
      label: 'Komplain / Keluhan',
      icon: '⚠️',
      badgeClass: 'bg-red-100 text-red-900 border-red-300',
    },
    reschedule: {
      label: 'Minta Jadwal Ulang',
      icon: '📅',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    unresponsive: {
      label: 'Tidak Merespon',
      icon: '🔕',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    },
  };

  const statusMap: Record<CRMStatus, { label: string; class: string }> = {
    pending: { label: 'Belum Dihubungi', class: 'bg-amber-50 text-amber-800 border-amber-300' },
    contacted: { label: 'Sudah Dihubungi', class: 'bg-blue-50 text-blue-800 border-blue-300' },
    scheduled: { label: 'Booking Dibuat', class: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    declined: { label: 'Ditolak / Tunda', class: 'bg-red-50 text-red-800 border-red-300' },
  };

  // Helper template pertanyaan WA per periode
  const getQuestionTemplate = (
    period: CRMReminderPeriod,
    customerName: string,
    car: string,
    plate: string,
    serviceDateStr?: string
  ) => {
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
        return `Halo Bpk/Ibu ${customerName}, salam hangat dari Mardiono Home Service.

Sudah 3 bulan sejak perawatan terakhir mobil ${car} (${plate}) di bengkel kami pada tanggal ${sDate}. Untuk menjaga performa mesin tetap awet, bertenaga, dan hemat BBM, kini sudah waktunya untuk Servis Berkala / Ganti Oli Mesin berikutnya.

Apakah berkenan kami bantu jadwalkan booking servis minggu ini? Terima kasih! 📅🔧`;

      default:
        return `Halo Bpk/Ibu ${customerName}, salam hangat dari Mardiono Home Service.

Kami ingin menanyakan bagaimana kondisi dan kenyamanan mobil ${car} (${plate}) setelah selesai servis di bengkel kami pada tanggal ${sDate}. Semoga aktivitas berkendara selalu lancar dan prima! 🙏`;
    }
  };

  // 1. Filter log mentah berdasarkan Cabang
  const sourceLogs = useMemo(() => {
    return selectedBranch === 'ALL'
      ? allCrmLogs
      : allCrmLogs.filter((l) => (l.branch || 'MHS 1') === selectedBranch);
  }, [allCrmLogs, selectedBranch]);

  // 2. Olah data: 1 baris per unit transaksi kendaraan
  const crmItems: CRMItem[] = useMemo(() => {
    const list: CRMItem[] = [];
    const seenWo = new Set<string>();

    sourceLogs.forEach((log) => {
      // Deduplikasi per transaksi work_order_id atau spk_number
      const cleanId = log.id.replace(/-(1_week|2_weeks|1_month|3_months)$/, '');
      const woKey = log.work_order_id || log.spk_number || cleanId;
      if (seenWo.has(woKey)) return;
      seenWo.add(woKey);

      const matchedWo = log.work_order || allWorkOrders.find((w) => w.id === log.work_order_id || w.spk_number === log.spk_number);
      const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id) || matchedWo?.vehicle;
      const plate = (vehicle?.license_plate || (log as any).license_plate || '').trim().toUpperCase();

      const matchedInv = allInvoices.find(
        (i) => (matchedWo?.id && i.work_order_id === matchedWo.id) || (log.spk_number && i.invoice_number?.includes(log.spk_number))
      );

      let serviceSummary = '';
      if (matchedInv && Array.isArray(matchedInv.items) && matchedInv.items.length > 0) {
        serviceSummary = matchedInv.items.map((it) => it.name).filter(Boolean).slice(0, 4).join(', ');
      } else if (matchedWo?.checklist_data?.estimation?.items && Array.isArray(matchedWo.checklist_data.estimation.items)) {
        serviceSummary = matchedWo.checklist_data.estimation.items.map((it: any) => it.name).filter(Boolean).slice(0, 4).join(', ');
      }

      const history = (log.followup_history && log.followup_history.length > 0)
        ? log.followup_history
        : (matchedWo?.checklist_data?.crm?.history && Array.isArray(matchedWo.checklist_data.crm.history))
        ? matchedWo.checklist_data.crm.history
        : [];

      let daysUntilNext: number | null = null;
      let isOverdue = false;
      let isDueToday = false;

      if (log.due_date && log.reminder_type !== 'none') {
        const dueTime = new Date(log.due_date).getTime();
        const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
        daysUntilNext = diffDays;
        isOverdue = diffDays < 0 && log.status === 'pending';
        isDueToday = diffDays === 0 && log.status === 'pending';
      }

      list.push({
        id: log.id,
        vehicle_id: log.vehicle_id || vehicle?.id || '',
        work_order_id: log.work_order_id,
        spk_number: log.spk_number || matchedWo?.spk_number || 'SPK',
        invoice_number: log.invoice_number || matchedInv?.invoice_number,
        branch: log.branch || matchedWo?.received_at_branch || 'MHS 1',
        service_date: log.service_date || matchedWo?.finish_date || matchedWo?.entry_date,
        due_date: log.due_date,
        reminder_type: log.reminder_type || 'none',
        status: log.status || 'pending',
        contacted_at: log.contacted_at,
        contacted_by: log.contacted_by,
        question_sent: log.question_sent,
        customer_response: log.customer_response,
        customer_sentiment: log.customer_sentiment,
        scheduled_date: log.scheduled_date,
        notes: log.notes,
        is_optional: log.is_optional ?? (log.reminder_type === 'none'),
        followup_history: history,

        licensePlate: plate || vehicle?.license_plate || 'Tanpa Plat',
        customerName: vehicle?.customer_name || 'Pelanggan',
        phoneNumber: vehicle?.phone_number || '',
        carBrand: vehicle?.car_brand || '',
        carModel: vehicle?.car_model || '',
        carYear: vehicle?.car_year,
        currentMileage: vehicle?.current_mileage || matchedWo?.checklist_data?.current_mileage,
        engineNumber: vehicle?.engine_number,
        chassisNumber: vehicle?.chassis_number,
        complaints: matchedWo?.complaints || '',
        serviceSummary,

        daysUntilNext,
        isOverdue,
        isDueToday,
      });
    });

    // Urutan prioritas:
    // 1. Yang jatuh tempo (overdue / hari ini) di paling atas
    // 2. Yang upcoming berikutnya
    // 3. Yang sudah dihubungi
    // 4. Yang 'none' (tanpa follow up) di paling bawah
    return list.sort((a, b) => {
      const aIsDue = a.reminder_type !== 'none' && a.due_date && a.status === 'pending' && (a.isOverdue || a.isDueToday);
      const bIsDue = b.reminder_type !== 'none' && b.due_date && b.status === 'pending' && (b.isOverdue || b.isDueToday);

      if (aIsDue && !bIsDue) return -1;
      if (!aIsDue && bIsDue) return 1;

      const aPending = a.reminder_type !== 'none' && a.status === 'pending';
      const bPending = b.reminder_type !== 'none' && b.status === 'pending';
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      if (aPending && bPending) {
        return (a.daysUntilNext ?? 999) - (b.daysUntilNext ?? 999);
      }

      if (a.reminder_type === 'none' && b.reminder_type !== 'none') return 1;
      if (a.reminder_type !== 'none' && b.reminder_type === 'none') return -1;

      return new Date(b.service_date || 0).getTime() - new Date(a.service_date || 0).getTime();
    });
  }, [sourceLogs, vehicles, allWorkOrders, allInvoices, todayTime]);

  // List transaksi yang jatuh tempo hari ini atau overdue (Notifikasi Utama)
  const dueNowList = useMemo(() => {
    return crmItems.filter(
      (item) => item.reminder_type !== 'none' && item.status === 'pending' && (item.isOverdue || item.isDueToday)
    );
  }, [crmItems]);

  // KPI Counters
  const countDueNow = dueNowList.length;
  const count1W2W = crmItems.filter((i) => i.reminder_type === '1_week' || i.reminder_type === '2_weeks').length;
  const count1M3M = crmItems.filter((i) => i.reminder_type === '1_month' || i.reminder_type === '3_months').length;
  const countNone = crmItems.filter((i) => i.reminder_type === 'none').length;
  const countCompleted = crmItems.filter((i) => i.status === 'contacted' || i.status === 'scheduled').length;

  const count1Week = crmItems.filter((i) => i.reminder_type === '1_week').length;
  const count2Weeks = crmItems.filter((i) => i.reminder_type === '2_weeks').length;
  const count1Month = crmItems.filter((i) => i.reminder_type === '1_month').length;
  const count3Months = crmItems.filter((i) => i.reminder_type === '3_months').length;

  // Filter Data Tabel
  const filteredItems = useMemo(() => {
    return crmItems.filter((item) => {
      // Period filter
      if (periodFilter !== 'all') {
        if (periodFilter === 'due') {
          if (!item.isOverdue && !item.isDueToday) return false;
        } else if (periodFilter === 'completed') {
          if (item.status !== 'contacted' && item.status !== 'scheduled') return false;
        } else if (item.reminder_type !== periodFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Timing filter
      if (timingFilter === 'due') {
        if ((!item.isOverdue && !item.isDueToday) || item.reminder_type === 'none' || item.status !== 'pending') {
          return false;
        }
      } else if (timingFilter === 'upcoming') {
        if (item.daysUntilNext === null || item.daysUntilNext <= 0 || item.reminder_type === 'none' || item.status !== 'pending') {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const plate = item.licensePlate.toLowerCase();
        const name = item.customerName.toLowerCase();
        const phone = item.phoneNumber.toLowerCase();
        const car = `${item.carBrand} ${item.carModel}`.toLowerCase();
        const spk = (item.spk_number || '').toLowerCase();
        const br = item.branch.toLowerCase();
        const resp = (item.customer_response || '').toLowerCase();
        return plate.includes(q) || name.includes(q) || phone.includes(q) || car.includes(q) || spk.includes(q) || br.includes(q) || resp.includes(q);
      }

      return true;
    });
  }, [crmItems, periodFilter, statusFilter, timingFilter, searchQuery]);

  // Ubah Jadwal Follow Up 1 Waktu Secara Langsung Dari Baris Tabel
  const handleChangeFollowupPeriod = async (item: CRMItem, newPeriod: CRMReminderPeriod) => {
    if (!item.work_order_id) {
      showToast('ID Work Order tidak valid.', 'error');
      return;
    }

    try {
      await DBService.setTransactionFollowupPeriodAsync(
        item.work_order_id,
        newPeriod,
        undefined,
        item.branch as BranchId
      );
      refreshData();
      const opt = periodOptions.find((p) => p.id === newPeriod);
      showToast(
        `Jadwal follow-up ${item.licensePlate ? formatPlate(item.licensePlate) : item.customerName} berhasil diubah ke "${opt?.label || newPeriod}" dan disimpan.`,
        'success'
      );
    } catch (err) {
      console.error('Gagal mengubah periode:', err);
      showToast('Terjadi kesalahan saat mengubah jadwal follow-up.', 'error');
    }
  };

  // Buka Modal 1: Follow Up WA & Input Respon
  const handleOpenFollowupModal = (item: CRMItem) => {
    setFollowupModalItem(item);
    const period = item.reminder_type !== 'none' ? item.reminder_type : '1_week';
    setModalPeriod(period);
    const car = `${item.carBrand} ${item.carModel}`.trim() || 'Mobil';
    const plate = item.licensePlate ? formatPlate(item.licensePlate) : '';
    const defaultQuestion = item.question_sent || getQuestionTemplate(period, item.customerName, car, plate, item.service_date);
    setModalQuestion(defaultQuestion);
    setModalResponse(item.customer_response || '');
    setModalSentiment(item.customer_sentiment || 'satisfied');
    setModalPic(item.contacted_by || currentUser?.full_name || 'Admin CRM');
    setModalScheduledDate(item.scheduled_date || '');
    setModalNotes(item.notes || '');
  };

  // Ganti periode saat sedang berada di dalam Modal 1
  const handleModalPeriodChange = (newPeriod: CRMReminderPeriod) => {
    setModalPeriod(newPeriod);
    if (!followupModalItem) return;
    const car = `${followupModalItem.carBrand} ${followupModalItem.carModel}`.trim() || 'Mobil';
    const plate = followupModalItem.licensePlate ? formatPlate(followupModalItem.licensePlate) : '';
    setModalQuestion(getQuestionTemplate(newPeriod, followupModalItem.customerName, car, plate, followupModalItem.service_date));
  };

  // Buka tautan WhatsApp
  const handleOpenWhatsApp = () => {
    if (!followupModalItem?.phoneNumber) {
      showToast('Nomor WhatsApp pelanggan tidak ditemukan.', 'error');
      return;
    }
    const url = createWhatsAppLink(followupModalItem.phoneNumber, modalQuestion);
    window.open(url, '_blank');
    showToast('WhatsApp dibuka. Silakan hubungi customer dan simpan catatan respon di bawah ini.', 'info');
  };

  // Simpan Hasil Follow Up (Pertanyaan, Respon Customer, Sentimen, PIC)
  const handleSaveFollowupResult = async (statusToSet: CRMStatus = 'contacted') => {
    if (!followupModalItem) return;

    try {
      setIsSaving(true);
      // Jika periode di modal berbeda dari yang tersimpan, update periodenya juga
      if (modalPeriod !== followupModalItem.reminder_type && followupModalItem.work_order_id) {
        await DBService.setTransactionFollowupPeriodAsync(
          followupModalItem.work_order_id,
          modalPeriod,
          undefined,
          followupModalItem.branch as BranchId
        );
      }

      await DBService.recordFollowupResultAsync(
        followupModalItem.id,
        {
          period: modalPeriod,
          question_sent: modalQuestion,
          customer_response: modalResponse,
          customer_sentiment: modalSentiment || undefined,
          contacted_by: modalPic,
          scheduled_date: modalScheduledDate,
          notes: modalNotes,
          status: modalScheduledDate ? 'scheduled' : statusToSet,
        },
        followupModalItem.branch as BranchId
      );

      refreshData();
      showToast(
        `Hasil follow-up untuk ${followupModalItem.licensePlate ? formatPlate(followupModalItem.licensePlate) : followupModalItem.customerName} berhasil disimpan ke database!`,
        'success'
      );
      setFollowupModalItem(null);
    } catch (err) {
      console.error('Gagal menyimpan follow up:', err);
      showToast('Gagal menyimpan hasil follow-up. Silakan coba lagi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Buka Modal 2: Buka Detail Riwayat Respon Customer
  const handleOpenResponseDetailModal = (item: CRMItem) => {
    setResponseDetailItem(item);
  };

  // Quick reset status ke pending
  const handleQuickResetStatus = (item: CRMItem) => {
    DBService.updateCRMStatus(
      item.id,
      'pending',
      item.notes,
      item.scheduled_date,
      item.branch as BranchId
    );
    refreshData();
    showToast(`Status ${item.licensePlate ? formatPlate(item.licensePlate) : 'kendaraan'} dikembalikan ke "Belum Dihubungi".`, 'info');
  };

  // Render badge hitung hari
  const renderCountdownBadge = (diffDays: number | null, period: CRMReminderPeriod, isContacted: boolean) => {
    if (period === 'none') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
          <span>Tanpa Follow Up</span>
        </span>
      );
    }

    if (isContacted) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-black px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sudah Di-follow Up</span>
        </span>
      );
    }

    if (diffDays === null) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
          <span>-</span>
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
        <span className="inline-flex items-center space-x-1 text-[11px] font-black px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
          <BellRing className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
          <span>Waktunya Hari Ini!</span>
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
    <div className="space-y-5">
      {/* 1. TOP NOTIFICATION BANNER: NOTIFIKASI DI ATAS JIKA SUDAH WAKTUNYA FOLLOW UP */}
      {dueNowList.length > 0 ? (
        <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 p-4 sm:p-5 rounded-2xl text-white shadow-lg border border-red-500/50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 animate-bounce">
                <BellRing className="w-6 h-6 text-amber-300" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-xs tracking-wider uppercase bg-white/20 px-2.5 py-0.5 rounded-md text-amber-200">
                    Notifikasi Jatuh Tempo
                  </span>
                  <span className="bg-red-900/90 text-white font-black text-xs px-2.5 py-0.5 rounded-full border border-red-300/40">
                    {countDueNow} Transaksi Waktunya Follow-Up
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Ada {countDueNow} Kendaraan Memerlukan Follow-Up Hari Ini / Sudah Lewat Jadwal!
                </h2>
                <p className="text-xs text-white/85 leading-relaxed max-w-2xl">
                  Pelanggan berikut telah mencapai waktu follow-up yang ditentukan (1 Minggu, 2 Minggu, 1 Bulan, atau 3 Bulan). Segera hubungi via WhatsApp untuk memastikan kepuasan kendaraan dan menjalin relasi.
                </p>

                {/* Quick Chips Kendaraan Jatuh Tempo */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {dueNowList.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenFollowupModal(item)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/30 border border-white/30 text-[11px] font-bold cursor-pointer transition shadow-xs"
                      title="Klik untuk follow up sekarang"
                    >
                      <span className="font-mono text-amber-200">{item.licensePlate ? formatPlate(item.licensePlate) : 'Unit'}</span>
                      <span className="text-white/90">· {item.customerName}</span>
                      <span className="text-[10px] bg-red-800/80 px-1 rounded text-white">
                        {item.daysUntilNext === 0 ? 'Hari Ini' : `Lewat ${Math.abs(item.daysUntilNext || 0)}h`}
                      </span>
                    </button>
                  ))}
                  {dueNowList.length > 6 && (
                    <span className="text-xs text-white/80 self-center font-bold px-1">
                      +{dueNowList.length - 6} unit lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => {
                  setTimingFilter('due');
                  setPeriodFilter('all');
                  setStatusFilter('pending');
                }}
                className="px-4 py-2.5 rounded-xl bg-white text-red-800 hover:bg-amber-50 font-black text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Tampilkan Semua Yang Jatuh Tempo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/90 border border-emerald-200/90 p-3.5 rounded-2xl text-emerald-950 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-black text-emerald-900">Semua Jadwal Aman &amp; Terkendali:</span>
              <span className="text-emerald-800 ml-1.5">
                Tidak ada antrean follow-up yang jatuh tempo hari ini atau terlambat. Semua transaksi berjalan sesuai jadwal.
              </span>
            </div>
          </div>
          <div className="text-xs font-mono font-black text-emerald-700 bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
            0 Pending Due
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-maroon-700" />
            <span>CRM &amp; Service Reminder Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Penjadwalan 1 Waktu Follow Up Per Transaksi (1 Minggu, 2 Minggu, 1 Bulan, 3 Bulan, atau Tanpa Follow Up), Notifikasi Jatuh Tempo &amp; Riwayat Respon Pelanggan.
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
              {crmItems.length} Unit
            </span>
          </button>
          {(['MHS 1', 'MHS 2', 'MHS 3'] as BranchId[]).map((b) => {
            const count = crmItems.filter((i) => (i.branch || 'MHS 1') === b).length;
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

      {/* KPI Cards (Per Transaksi Kendaraan) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Sudah Waktunya */}
        <div className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-red-600 font-black flex items-center space-x-1">
              <BellRing className="w-3.5 h-3.5" />
              <span>Waktunya Follow Up</span>
            </span>
            <div className="text-2xl font-black text-red-700 font-mono mt-0.5">
              {countDueNow} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Jatuh tempo / lewat jadwal</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Jadwal 1 & 2 Minggu */}
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-indigo-700 font-bold">1 &amp; 2 Minggu</span>
            <div className="text-2xl font-black text-indigo-800 font-mono mt-0.5">
              {count1W2W} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Kepuasan &amp; kenyamanan awal</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Jadwal 1 & 3 Bulan */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-amber-700 font-bold">1 &amp; 3 Bulan</span>
            <div className="text-2xl font-black text-amber-800 font-mono mt-0.5">
              {count1M3M} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Garansi &amp; servis berkala</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Selesai Di-follow Up */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-emerald-700 font-bold">Sudah Di-follow Up</span>
            <div className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
              {countCompleted} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Respon tercatat</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Tanpa Follow Up (Opsional) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold">Tanpa Follow Up</span>
            <div className="text-2xl font-black text-slate-700 font-mono mt-0.5">
              {countNone} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Tidak wajib / dilewati</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Milestone / Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({crmItems.length})
            </button>
            <button
              onClick={() => setPeriodFilter('due')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === 'due'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              🔥 Jatuh Tempo ({countDueNow})
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
            <button
              onClick={() => setPeriodFilter('none')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === 'none'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tanpa Follow Up ({countNone})
            </button>
            <button
              onClick={() => setPeriodFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodFilter === 'completed'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selesai ({countCompleted})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Plat / Customer / Respon..."
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
            🔥 Jatuh Tempo / Lewat ({countDueNow})
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

      {/* Info Petunjuk Ringkas */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Panduan CRM:</strong> Tiap transaksi servis dapat ditentukan <strong>1 waktu follow up</strong> (1 Minggu, 2 Minggu, 1 Bulan, 3 Bulan, atau Tanpa Follow Up). Dropdown jadwal dapat diedit kapan saja. Klik <strong>&ldquo;Follow Up WA&rdquo;</strong> untuk menghubungi dan mencatat respon pelanggan.
          </span>
        </div>
      </div>

      {/* TABEL CRM TERPADU */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                <th className="p-3.5">Plat &amp; Kendaraan</th>
                <th className="p-3.5">Pelanggan &amp; WhatsApp</th>
                <th className="p-3.5">Cabang &amp; SPK</th>
                <th className="p-3.5">Pilihan Jadwal Follow Up (Bisa Diedit)</th>
                <th className="p-3.5">Hitung Hari / Jatuh Tempo</th>
                <th className="p-3.5">Pertanyaan &amp; Respon Customer</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    {searchQuery || periodFilter !== 'all' || statusFilter !== 'all' || timingFilter !== 'all'
                      ? 'Tidak ada data mobil yang sesuai filter.'
                      : 'Belum ada data follow-up CRM. Selesaikan SPK di antrean servis untuk mendaftarkan transaksi ke jadwal CRM.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isDone = item.status === 'contacted' || item.status === 'scheduled';
                  const currentPeriodOpt = periodOptions.find((p) => p.id === item.reminder_type) || periodOptions[0];

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/90 transition group"
                    >
                      {/* 1. Plat & Kendaraan */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-maroon-900 text-sm flex items-center space-x-1.5">
                          <span>{item.licensePlate ? formatPlate(item.licensePlate) : '-'}</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {item.carBrand} {item.carModel} {item.carYear ? `(${item.carYear})` : ''}
                        </div>
                        {item.currentMileage ? (
                          <div className="text-[10.5px] text-slate-500 font-mono font-bold flex items-center space-x-1 mt-0.5">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>{Number(item.currentMileage).toLocaleString('id-ID')} KM</span>
                          </div>
                        ) : null}
                        {item.complaints ? (
                          <div className="text-[10px] text-slate-500 italic truncate max-w-[200px] mt-0.5" title={item.complaints}>
                            Keluhan: {item.complaints}
                          </div>
                        ) : null}
                      </td>

                      {/* 2. Pelanggan & WhatsApp */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.phoneNumber || '-'}</span>
                        </div>
                      </td>

                      {/* 3. Cabang & SPK */}
                      <td className="p-3.5 space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-black border ${
                          item.branch === 'MHS 2'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : item.branch === 'MHS 3'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-blue-50 text-blue-900 border-blue-300'
                        }`}>
                          {item.branch}
                        </span>
                        <div className="font-mono text-[10.5px] text-[#001F7A] font-bold">
                          {item.spk_number}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Servis: {item.service_date ? formatDate(item.service_date) : '-'}
                        </div>
                      </td>

                      {/* 4. Dropdown Pilihan Jadwal Follow Up (Bisa Diedit Kapan Saja) */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <select
                            value={item.reminder_type || 'none'}
                            onChange={(e) => handleChangeFollowupPeriod(item, e.target.value as CRMReminderPeriod)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer transition ${
                              item.reminder_type === 'none'
                                ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                : item.reminder_type === '1_week'
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                                : item.reminder_type === '2_weeks'
                                ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                                : item.reminder_type === '1_month'
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                : item.reminder_type === '3_months'
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                            }`}
                          >
                            <option value="none">Tanpa Follow Up (Tidak wajib)</option>
                            <option value="1_week">1 Minggu (+7 hari)</option>
                            <option value="2_weeks">2 Minggu (+14 hari)</option>
                            <option value="1_month">1 Bulan (+30 hari)</option>
                            <option value="3_months">3 Bulan (+90 hari)</option>
                            <option value="custom">Custom Jadwal Khusus</option>
                          </select>
                          <div className="text-[10px] text-slate-400">
                            {item.reminder_type === 'none' ? 'Dilewati dari notifikasi' : 'Bisa diganti sewaktu-waktu'}
                          </div>
                        </div>
                      </td>

                      {/* 5. Hitung Hari / Jatuh Tempo */}
                      <td className="p-3.5 space-y-1">
                        <div>
                          {renderCountdownBadge(item.daysUntilNext, item.reminder_type, isDone)}
                        </div>
                        {item.reminder_type !== 'none' && item.due_date && (
                          <div className="text-[10.5px] text-slate-500">
                            Jatuh tempo: <strong>{formatDate(item.due_date)}</strong>
                          </div>
                        )}
                      </td>

                      {/* 6. Pertanyaan & Respon Customer (Tercantum dan Bisa Dibuka) */}
                      <td className="p-3.5 max-w-xs">
                        {isDone || item.customer_response ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Sudah Follow Up</span>
                              </span>
                              {item.followup_history && item.followup_history.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResponseDetailModal(item)}
                                  className="inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition cursor-pointer"
                                  title="Lihat riwayat tanya-jawab lengkap"
                                >
                                  <History className="w-3 h-3 text-purple-600" />
                                  <span>{item.followup_history.length}x Catatan</span>
                                </button>
                              )}
                              {item.customer_sentiment && sentimentMap[item.customer_sentiment] && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sentimentMap[item.customer_sentiment].badgeClass}`}>
                                  <span>{sentimentMap[item.customer_sentiment].icon}</span>
                                  <span className="ml-1">{sentimentMap[item.customer_sentiment].label}</span>
                                </span>
                              )}
                            </div>

                            {item.customer_response ? (
                              <p className="text-[11px] text-slate-700 italic line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                &ldquo;{item.customer_response}&rdquo;
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                (Terhubungi via WA, belum ada catatan detail)
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-[10px] text-slate-400">
                                PIC: <strong>{item.contacted_by || 'Admin'}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenResponseDetailModal(item)}
                                className="inline-flex items-center space-x-1 text-[10.5px] font-bold text-maroon-700 hover:text-maroon-900 underline cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Buka Respon</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-xs italic space-y-1">
                            <div>Belum ada respon</div>
                            <div className="text-[10.5px] text-slate-400 not-italic">
                              Klik tombol &ldquo;Follow Up WA&rdquo;
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 7. Tombol Aksi */}
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        {isDone ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenResponseDetailModal(item)}
                              className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                              title="Buka rincian pertanyaan dan respon customer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Lihat Respon</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenFollowupModal(item)}
                              className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                              title="Follow up ulang atau perbarui catatan"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>WA / Edit</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenFollowupModal(item)}
                            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                            title="Buka form follow up dan kirim WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Follow Up WA</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: FORM FOLLOW UP, DATA MOBIL LENGKAP & PENCATATAN RESPON CUSTOMER */}
      {followupModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold flex-shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
                    <span className="font-mono bg-maroon-50 text-maroon-900 px-2 py-0.5 rounded-lg border border-maroon-200 text-sm">
                      {followupModalItem.licensePlate ? formatPlate(followupModalItem.licensePlate) : 'Tanpa Plat'}
                    </span>
                    <span>{followupModalItem.carBrand} {followupModalItem.carModel}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Form Follow-Up &amp; Input Catatan Respon Pelanggan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFollowupModalItem(null)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* PANEL INFORMASI LENGKAP KENDARAAN & SERVIS TERAKHIR */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <Car className="w-4 h-4 text-maroon-700" />
                  <span>Data Kendaraan &amp; Riwayat Servis</span>
                </span>
                <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  SPK: <strong className="font-mono text-[#001F7A]">{followupModalItem.spk_number}</strong> ({followupModalItem.branch})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold">Merk &amp; Tipe Mobil:</span>
                  <span className="font-black text-slate-900 block truncate">{followupModalItem.carBrand} {followupModalItem.carModel}</span>
                  {followupModalItem.carYear && <span className="text-slate-500 text-[10px]">Tahun {followupModalItem.carYear}</span>}
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold flex items-center space-x-1">
                    <Gauge className="w-3 h-3 text-slate-400" />
                    <span>KM Terakhir (Odo):</span>
                  </span>
                  <span className="font-black text-slate-900 font-mono text-[12px] block">
                    {followupModalItem.currentMileage ? `${Number(followupModalItem.currentMileage).toLocaleString('id-ID')} KM` : '-'}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold">Pelanggan &amp; WhatsApp:</span>
                  <span className="font-bold text-slate-800 block truncate">{followupModalItem.customerName}</span>
                  <span className="font-mono text-slate-600 text-[10.5px] block">{followupModalItem.phoneNumber || '-'}</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold">Tanggal Servis:</span>
                  <span className="font-bold text-slate-800 block">
                    {followupModalItem.service_date ? formatDate(followupModalItem.service_date) : '-'}
                  </span>
                </div>
              </div>

              {/* Keluhan Kendaraan Saat Masuk */}
              {followupModalItem.complaints && (
                <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-950 flex items-start space-x-2">
                  <Wrench className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-[10.5px] uppercase tracking-wide text-amber-900 block">
                      Keluhan / Kerusakan Servis Terakhir:
                    </span>
                    <span className="font-medium text-[11.5px] leading-relaxed">{followupModalItem.complaints}</span>
                  </div>
                </div>
              )}

              {/* Rincian Pekerjaan & Sparepart */}
              {followupModalItem.serviceSummary && (
                <div className="bg-blue-50/80 p-2 rounded-lg border border-blue-200 text-xs text-blue-950 flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[10.5px] uppercase tracking-wide text-blue-900">Pekerjaan / Sparepart: </span>
                    <span className="font-medium text-[11px] leading-relaxed text-blue-900">{followupModalItem.serviceSummary}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pilihan Waktu Follow Up (Bisa Dipilih & Diedit) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <CalendarClock className="w-4 h-4 text-maroon-700" />
                  <span>Pilihan Waktu Follow-Up:</span>
                </label>
                <span className="text-[10.5px] text-slate-400">Pilih periode yang berlaku</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: '1_week', label: '1 Minggu', desc: 'Kepuasan awal' },
                  { id: '2_weeks', label: '2 Minggu', desc: 'Mesin & AC' },
                  { id: '1_month', label: '1 Bulan', desc: 'Garansi servis' },
                  { id: '3_months', label: '3 Bulan', desc: 'Servis berkala' },
                  { id: 'none', label: 'Tanpa Follow Up', desc: 'Dilewati' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleModalPeriodChange(opt.id as CRMReminderPeriod)}
                    className={`p-2 rounded-xl border text-left transition ${
                      modalPeriod === opt.id
                        ? 'bg-maroon-700 text-white border-maroon-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className={`text-[9.5px] ${modalPeriod === opt.id ? 'text-maroon-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* BAGIAN 1: PERTANYAAN UNTUK CUSTOMER (DRAFT WA) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>1. Pertanyaan / Pesan untuk Customer:</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const car = `${followupModalItem.carBrand} ${followupModalItem.carModel}`.trim() || 'Mobil';
                    const plate = followupModalItem.licensePlate ? formatPlate(followupModalItem.licensePlate) : '';
                    setModalQuestion(getQuestionTemplate(modalPeriod, followupModalItem.customerName, car, plate, followupModalItem.service_date));
                    showToast('Template pesan disesuaikan dengan periode.', 'info');
                  }}
                  className="text-[10.5px] text-maroon-700 hover:text-maroon-900 font-bold underline cursor-pointer"
                >
                  Muat Template Standar
                </button>
              </div>

              <textarea
                rows={4}
                value={modalQuestion}
                onChange={(e) => setModalQuestion(e.target.value)}
                placeholder="Tuliskan pertanyaan yang akan diajukan ke customer..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-emerald-50/20 focus:border-emerald-600 focus:bg-white outline-none leading-relaxed font-medium text-slate-800 text-[11.5px]"
              />

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl transition shadow-xs cursor-pointer text-xs"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim Pesan Melalui WhatsApp</span>
              </button>
            </div>

            {/* BAGIAN 2: JAWABAN CUSTOMER & PENCATATAN RESPON */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <label className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>2. Jawaban Customer &amp; Keterangan Respon:</span>
              </label>

              <div>
                <textarea
                  rows={3}
                  value={modalResponse}
                  onChange={(e) => setModalResponse(e.target.value)}
                  placeholder="Tuliskan jawaban dari customer (misal: 'Customer puas tarikan mesin enteng, AC dingin', atau 'Ada sedikit bunyi saat rem mendadak, minta dicek minggu depan')..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-blue-50/20 focus:border-blue-600 focus:bg-white outline-none text-xs leading-relaxed font-medium"
                />
              </div>

              {/* Sentimen Kepuasan Customer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Tingkat Kepuasan / Kategori Respon:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(['very_satisfied', 'satisfied', 'complaint', 'reschedule', 'unresponsive'] as const).map((sent) => {
                    const info = sentimentMap[sent];
                    const isSelected = modalSentiment === sent;
                    return (
                      <button
                        key={sent}
                        type="button"
                        onClick={() => setModalSentiment(sent)}
                        className={`p-2 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-base">{info.icon}</div>
                        <div className="text-[10.5px] mt-0.5">{info.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIC Petugas & Booking Lanjutan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Petugas Follow Up (PIC):
                  </label>
                  <input
                    type="text"
                    value={modalPic}
                    onChange={(e) => setModalPic(e.target.value)}
                    placeholder="Nama PIC (contoh: Mey Wulandari)"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jadwal Booking Servis Baru (Jika Ada):
                  </label>
                  <input
                    type="date"
                    value={modalScheduledDate}
                    onChange={(e) => setModalScheduledDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none"
                  />
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Catatan tambahan bila diperlukan..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none"
                />
              </div>
            </div>

            {/* BAGIAN 3: HISTORI FOLLOW-UP SEBELUMNYA */}
            {followupModalItem.followup_history && followupModalItem.followup_history.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Riwayat Follow-Up Sebelumnya ({followupModalItem.followup_history.length} Catatan):</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Tersimpan di cloud</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {followupModalItem.followup_history.map((hist, hIdx) => {
                    const sentInfo = hist.customer_sentiment && sentimentMap[hist.customer_sentiment];
                    return (
                      <div key={hist.id || hIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-mono font-bold text-slate-700">
                            {hist.timestamp ? formatDateTime(hist.timestamp) : '-'} · PIC: <strong>{hist.contacted_by || 'Admin'}</strong>
                          </span>
                          {sentInfo && (
                            <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${sentInfo.badgeClass}`}>
                              {sentInfo.icon} {sentInfo.label}
                            </span>
                          )}
                        </div>
                        {hist.question_sent && (
                          <div className="text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-emerald-800 block">Pertanyaan:</span>
                            <p className="line-clamp-2 italic">{hist.question_sent}</p>
                          </div>
                        )}
                        {hist.customer_response && (
                          <div className="text-slate-900 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] font-bold text-blue-800 block">Jawaban Customer:</span>
                            <p className="font-semibold italic">&ldquo;{hist.customer_response}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFollowupModalItem(null)}
                disabled={isSaving}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveFollowupResult('contacted')}
                disabled={isSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Follow-Up &amp; Tandai Selesai</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RIWAYAT & HISTORI LENGKAP FOLLOW-UP PELANGGAN */}
      {responseDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Histori Follow-Up &amp; Respon Pelanggan
                  </h3>
                  <p className="text-xs text-slate-500">
                    {responseDetailItem.carBrand} {responseDetailItem.carModel} · <strong className="font-mono text-maroon-900">{responseDetailItem.licensePlate ? formatPlate(responseDetailItem.licensePlate) : '-'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResponseDetailItem(null)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Data Ringkas Unit & Kontak */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Pelanggan:</span>
                <span className="font-bold text-slate-900 block truncate">{responseDetailItem.customerName}</span>
                <span className="text-slate-600 font-mono text-[10.5px] block">{responseDetailItem.phoneNumber || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">SPK &amp; Cabang:</span>
                <span className="font-bold text-slate-900 font-mono text-[11px] block">{responseDetailItem.spk_number}</span>
                <span className="text-slate-500 text-[10px]">{responseDetailItem.branch}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Tgl Servis:</span>
                <span className="font-bold text-slate-800 block">
                  {responseDetailItem.service_date ? formatDate(responseDetailItem.service_date) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">KM Odometer:</span>
                <span className="font-bold text-slate-900 font-mono block">
                  {responseDetailItem.currentMileage ? `${Number(responseDetailItem.currentMileage).toLocaleString('id-ID')} KM` : '-'}
                </span>
              </div>
            </div>

            {/* Keluhan Servis SPK (Jika ada) */}
            {responseDetailItem.complaints && (
              <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-950 flex items-start space-x-2">
                <Wrench className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[10.5px] uppercase tracking-wide text-amber-900 block">Keluhan Saat Servis:</span>
                  <span className="font-medium">{responseDetailItem.complaints}</span>
                </div>
              </div>
            )}

            {/* DAFTAR TIMELINE HISTORI FOLLOW-UP */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-purple-600" />
                  <span>Timeline Riwayat Percakapan / Tanya-Jawab Customer:</span>
                </label>
                <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  {responseDetailItem.followup_history && responseDetailItem.followup_history.length > 0
                    ? `${responseDetailItem.followup_history.length} Interaksi Tersimpan`
                    : '1 Interaksi'}
                </span>
              </div>

              {responseDetailItem.followup_history && responseDetailItem.followup_history.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {responseDetailItem.followup_history.map((hist, idx) => {
                    const sentInfo = hist.customer_sentiment && sentimentMap[hist.customer_sentiment];
                    return (
                      <div
                        key={hist.id || idx}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5 relative"
                      >
                        {/* Header Tiap Riwayat */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {hist.timestamp ? formatDateTime(hist.timestamp) : '-'}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-600">
                              PIC: <strong>{hist.contacted_by || 'Admin CRM'}</strong>
                            </span>
                          </div>
                          {sentInfo && (
                            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${sentInfo.badgeClass}`}>
                              {sentInfo.icon} {sentInfo.label}
                            </span>
                          )}
                        </div>

                        {/* Pertanyaan */}
                        <div className="space-y-1">
                          <span className="text-[10.5px] font-black text-emerald-800 flex items-center space-x-1">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pertanyaan yang Diajukan Bengkel:</span>
                          </span>
                          <div className="p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-100 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                            {hist.question_sent || '(Tanpa draf pertanyaan)'}
                          </div>
                        </div>

                        {/* Jawaban Customer */}
                        <div className="space-y-1">
                          <span className="text-[10.5px] font-black text-blue-800 flex items-center space-x-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Jawaban / Respon Customer:</span>
                          </span>
                          <div className="p-2.5 bg-blue-50/40 rounded-lg border border-blue-100 text-xs text-slate-900 leading-relaxed font-semibold italic">
                            &ldquo;{hist.customer_response || 'Belum ada catatan tertulis.'}&rdquo;
                          </div>
                        </div>

                        {/* Booking Servis Baru jika ada */}
                        {hist.scheduled_date && (
                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                              <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Booking Servis Lanjutan:</span>
                            </div>
                            <span className="font-bold text-amber-900 font-mono">
                              {formatDate(hist.scheduled_date)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback jika data lama belum memiliki history array */
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {responseDetailItem.contacted_at ? formatDateTime(responseDetailItem.contacted_at) : 'Telah Terhubung'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-600">
                        PIC: <strong>{responseDetailItem.contacted_by || 'Admin CRM'}</strong>
                      </span>
                    </div>
                    {responseDetailItem.customer_sentiment && sentimentMap[responseDetailItem.customer_sentiment] && (
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${sentimentMap[responseDetailItem.customer_sentiment].badgeClass}`}>
                        {sentimentMap[responseDetailItem.customer_sentiment].icon} {sentimentMap[responseDetailItem.customer_sentiment].label}
                      </span>
                    )}
                  </div>

                  {/* Pertanyaan */}
                  <div className="space-y-1">
                    <span className="text-[10.5px] font-black text-emerald-800 flex items-center space-x-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pertanyaan yang Diajukan:</span>
                    </span>
                    <div className="p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-100 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      {responseDetailItem.question_sent || getQuestionTemplate(
                        responseDetailItem.reminder_type,
                        responseDetailItem.customerName,
                        `${responseDetailItem.carBrand} ${responseDetailItem.carModel}`,
                        responseDetailItem.licensePlate,
                        responseDetailItem.service_date
                      )}
                    </div>
                  </div>

                  {/* Jawaban Customer */}
                  <div className="space-y-1">
                    <span className="text-[10.5px] font-black text-blue-800 flex items-center space-x-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Jawaban / Respon Customer:</span>
                    </span>
                    <div className="p-2.5 bg-blue-50/40 rounded-lg border border-blue-100 text-xs text-slate-900 leading-relaxed font-semibold italic">
                      &ldquo;{responseDetailItem.customer_response || 'Belum ada catatan detail tertulis.'}&rdquo;
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = responseDetailItem;
                  setResponseDetailItem(null);
                  handleOpenFollowupModal(target);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 transition cursor-pointer"
              >
                ✏️ Input Follow-Up Baru / Hubungi Ulang
              </button>

              <button
                type="button"
                onClick={() => setResponseDetailItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
