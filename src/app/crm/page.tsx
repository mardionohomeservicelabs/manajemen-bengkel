'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { CRMLog, CRMStatus, CRMReminderPeriod } from '@/lib/types/database';
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
} from 'lucide-react';
import Link from 'next/link';

export default function CRMPage() {
  const { crmLogs, vehicles, refreshData, showToast, settings } = useApp();
  const { activeBranch } = useAuth();

  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timingFilter, setTimingFilter] = useState<'all' | 'due' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<CRMLog | null>(null);
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

  const filteredLogs = crmLogs.filter((log) => {
    // 1. Period filter
    if (periodFilter !== 'all' && log.reminder_type !== periodFilter) {
      return false;
    }

    // 2. Status filter
    if (statusFilter !== 'all' && log.status !== statusFilter) {
      return false;
    }

    // 3. Timing filter (due now vs upcoming)
    const logDueTime = new Date(log.due_date).getTime();
    if (timingFilter === 'due' && logDueTime > todayTime) {
      return false;
    }
    if (timingFilter === 'upcoming' && logDueTime <= todayTime) {
      return false;
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
      const plate = (vehicle?.license_plate || '').toLowerCase();
      const name = (vehicle?.customer_name || '').toLowerCase();
      const phone = (vehicle?.phone_number || '').toLowerCase();
      const car = `${vehicle?.car_brand || ''} ${vehicle?.car_model || ''}`.toLowerCase();
      const spk = (log.spk_number || '').toLowerCase();
      return plate.includes(q) || name.includes(q) || phone.includes(q) || car.includes(q) || spk.includes(q);
    }

    return true;
  });

  const handleOpenContactModal = (log: CRMLog) => {
    setSelectedLog(log);
    const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
    const customerName = vehicle?.customer_name || 'Pelanggan';
    const car = vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil';
    const plate = vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '';

    const defaultMsg = getTemplateForPeriod(log.reminder_type, customerName, car, plate, log.service_date);
    setCustomWaMessage(log.whatsapp_message || defaultMsg);
    setFollowupNotes(log.notes || '');
    setScheduledBookingDate(log.scheduled_date || '');
  };

  const handleUpdateStatus = (status: CRMStatus) => {
    if (!selectedLog) return;
    DBService.updateCRMStatus(selectedLog.id, status, followupNotes, scheduledBookingDate, activeBranch);
    refreshData();
    showToast(`Status follow-up berhasil diubah menjadi "${status.toUpperCase()}"`, 'success');
    setSelectedLog(null);
  };

  const handleSendWhatsAppAndMarkContacted = () => {
    if (!selectedLog) return;
    const vehicle = selectedLog.vehicle || vehicles.find((v) => v.id === selectedLog.vehicle_id);
    if (!vehicle?.phone_number) {
      showToast('Nomor WhatsApp pelanggan tidak ditemukan.', 'error');
      return;
    }

    const waUrl = createWhatsAppLink(vehicle.phone_number, customWaMessage);
    window.open(waUrl, '_blank');

    DBService.updateCRMStatus(selectedLog.id, 'contacted', followupNotes, scheduledBookingDate, activeBranch);
    refreshData();
    showToast('WhatsApp dibuka & status diubah menjadi "Sudah Dihubungi"', 'success');
    setSelectedLog(null);
  };

  const handleQuickMarkFollowup = (log: CRMLog, newStatus: CRMStatus = 'contacted') => {
    DBService.updateCRMStatus(log.id, newStatus, log.notes, log.scheduled_date, activeBranch);
    refreshData();
    const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
    const plate = vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '';
    if (newStatus === 'contacted') {
      showToast(`Kendaraan ${plate} berhasil ditandai "Sudah Follow-up"!`, 'success');
    } else {
      showToast(`Status kendaraan ${plate} dikembalikan ke "${newStatus.toUpperCase()}"`, 'info');
    }
  };

  const periodLabels: Record<string, { label: string; badgeClass: string; desc: string }> = {
    '1_week': { label: '1 Minggu', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300', desc: 'Kepuasan Servis Awal' },
    '2_weeks': { label: '2 Minggu', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300', desc: 'Performa Mesin & AC' },
    '1_month': { label: '1 Bulan', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', desc: 'Masa Garansi & Cek Ringan' },
    '3_months': { label: '3 Bulan', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300', desc: 'Servis Berkala & Ganti Oli' },
    'periodic_service': { label: 'Servis Berkala', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300', desc: 'Perawatan Rutin' },
    'ac_cleaning': { label: 'Perawatan AC', badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300', desc: 'Pembersihan AC' },
    'oil_change': { label: 'Ganti Oli', badgeClass: 'bg-orange-100 text-orange-900 border-orange-300', desc: 'Oli Mesin' },
    'general_check': { label: 'Cek Umum', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300', desc: 'Checkup Kendaraan' },
    'custom': { label: 'Custom', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', desc: 'Jadwal Khusus' },
  };

  const statusMap: Record<CRMStatus, { label: string; class: string }> = {
    pending: { label: 'Belum Dihubungi', class: 'bg-amber-50 text-amber-800 border-amber-300' },
    contacted: { label: 'Sudah Dihubungi', class: 'bg-blue-50 text-blue-800 border-blue-300' },
    scheduled: { label: 'Booking Dibuat', class: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    declined: { label: 'Ditolak / Tunda', class: 'bg-red-50 text-red-800 border-red-300' },
  };

  // KPI Counters
  const count1Week = crmLogs.filter((c) => c.reminder_type === '1_week').length;
  const count2Weeks = crmLogs.filter((c) => c.reminder_type === '2_weeks').length;
  const count1Month = crmLogs.filter((c) => c.reminder_type === '1_month').length;
  const count3Months = crmLogs.filter((c) => c.reminder_type === '3_months').length;
  const countDueNow = crmLogs.filter((c) => new Date(c.due_date).getTime() <= todayTime && c.status === 'pending').length;

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
            Otomatisasi pengingat servis berjenjang (1 Minggu, 2 Minggu, 1 Bulan &amp; 3 Bulan) pasca servis SPK selesai.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
            Cabang Aktif: <strong className="text-maroon-900">{activeBranch}</strong>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-red-600 font-bold flex items-center space-x-1">
              <BellRing className="w-3.5 h-3.5" />
              <span>Sudah Waktunya / Lewat</span>
            </span>
            <div className="text-2xl font-black text-red-700 font-mono mt-0.5">
              {countDueNow} Unit
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Perlu follow-up hari ini</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-indigo-700 font-bold">1 &amp; 2 Minggu Pasca Servis</span>
            <div className="text-2xl font-black text-indigo-800 font-mono mt-0.5">
              {count1Week + count2Weeks} Unit
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
              {count1Month + count3Months} Unit
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Garansi &amp; ganti oli berkala</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-700 font-bold">Sudah Dihubungi / Booking</span>
            <div className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
              {crmLogs.filter((c) => c.status === 'contacted' || c.status === 'scheduled').length} Unit
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">Customer ter-followup</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER TABS: 1 MINGGU, 2 MINGGU, 1 BULAN, 3 BULAN */}
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
              Semua Jadwal ({crmLogs.length})
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
            🔥 Sudah Waktunya / Lewat
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
              {st === 'all' ? 'Semua' : statusMap[st]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* CRM Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                <th className="p-3.5">Plat &amp; Kendaraan</th>
                <th className="p-3.5">No. SPK &amp; Pelanggan</th>
                <th className="p-3.5">Kategori Pengingat</th>
                <th className="p-3.5">Tgl Servis &amp; Jatuh Tempo</th>
                <th className="p-3.5">Status Follow-up</th>
                <th className="p-3.5 text-right">Aksi WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">
                    {searchQuery || periodFilter !== 'all' || statusFilter !== 'all'
                      ? 'Tidak ada data pengingat CRM yang sesuai filter.'
                      : 'Belum ada data pengingat CRM. Selesaikan SPK di antrean untuk memasukkan mobil ke database CRM.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
                  const badge = statusMap[log.status] || statusMap.pending;
                  const periodInfo = periodLabels[log.reminder_type] || periodLabels.custom;

                  const logDueTime = new Date(log.due_date).getTime();
                  const isDueOrOverdue = logDueTime <= todayTime;
                  const diffDays = Math.round((todayTime - logDueTime) / (1000 * 60 * 60 * 24));

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. Plat & Kendaraan */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-maroon-900 text-sm">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </div>
                        <div className="font-bold text-slate-900">
                          {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}
                        </div>
                      </td>

                      {/* 2. No. SPK & Pelanggan */}
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-[#001F7A]">
                          {log.spk_number || 'SPK Servis'}
                        </div>
                        <div className="font-bold text-slate-900">{vehicle?.customer_name || 'Pelanggan'}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{vehicle?.phone_number || '-'}</span>
                        </div>
                      </td>

                      {/* 3. Kategori Pengingat */}
                      <td className="p-3.5 space-y-1">
                        <span className={`inline-block text-[10.5px] px-2.5 py-0.5 rounded-full font-black border ${periodInfo.badgeClass}`}>
                          {periodInfo.label}
                        </span>
                        <div className="text-[10.5px] text-slate-500 font-medium">
                          {periodInfo.desc}
                        </div>
                      </td>

                      {/* 4. Tgl Servis & Jatuh Tempo */}
                      <td className="p-3.5 space-y-0.5">
                        <div className="text-[11px] text-slate-500">
                          Servis: <strong>{log.service_date ? formatDate(log.service_date) : '-'}</strong>
                        </div>
                        <div className="font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>Tempo: {formatDate(log.due_date)}</span>
                          {isDueOrOverdue ? (
                            <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-800 border border-red-200">
                              {diffDays === 0 ? 'Hari Ini' : `Lewat ${diffDays} hari`}
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {Math.abs(diffDays)} hari lagi
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Status Follow-up */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center space-x-1 text-[10.5px] px-2.5 py-1 rounded-full border ${badge.class}`}>
                          {log.status === 'scheduled' && <CheckCircle className="w-3 h-3" />}
                          <span>{badge.label}</span>
                        </span>
                        {log.scheduled_date && (
                          <div className="text-[10px] text-emerald-800 font-bold mt-1">
                            Booking: {formatDate(log.scheduled_date)}
                          </div>
                        )}
                        {log.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[140px]" title={log.notes}>
                            &quot;{log.notes}&quot;
                          </div>
                        )}
                      </td>

                      {/* 6. Aksi */}
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        {log.status !== 'contacted' && log.status !== 'scheduled' ? (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkFollowup(log, 'contacted')}
                            className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs cursor-pointer"
                            title="Tandai customer ini sudah di-follow up secara langsung"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Tandai Sudah Follow-up</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkFollowup(log, 'pending')}
                            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium text-xs px-2.5 py-2 rounded-xl transition cursor-pointer"
                            title="Klik untuk mereset status kembali ke Belum Dihubungi"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                            <span>Reset</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenContactModal(log)}
                          className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Follow-up WA</span>
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

      {/* Follow-up Action Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Kirim Follow-up Pelanggan via WhatsApp</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Customer & Vehicle Info */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Pelanggan:</span>
                  <strong className="text-slate-900 font-bold">{selectedLog.vehicle?.customer_name || 'Pelanggan'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Nomor WhatsApp:</span>
                  <strong className="text-emerald-800 font-mono">{selectedLog.vehicle?.phone_number || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Kendaraan:</span>
                  <strong className="text-slate-900">{selectedLog.vehicle?.car_brand} {selectedLog.vehicle?.car_model}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Plat Nomor:</span>
                  <strong className="text-maroon-900 font-mono">{selectedLog.vehicle?.license_plate ? formatPlate(selectedLog.vehicle.license_plate) : '-'}</strong>
                </div>
              </div>

              {/* Draft Pesan WA */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Draft Pesan WhatsApp (Dapat diedit bebas):
                </label>
                <textarea
                  rows={6}
                  value={customWaMessage}
                  onChange={(e) => setCustomWaMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-emerald-50/20 focus:border-emerald-600 focus:bg-white outline-none leading-relaxed font-medium text-slate-800 text-[11.5px]"
                />
              </div>

              {/* Catatan Internal & Booking Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Follow-up:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Sudah konfirmasi, rencana mampir..."
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jadwal Booking Servis:</label>
                  <input
                    type="date"
                    value={scheduledBookingDate}
                    onChange={(e) => setScheduledBookingDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleSendWhatsAppAndMarkContacted}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim WhatsApp &amp; Tandai Sudah Dihubungi</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

