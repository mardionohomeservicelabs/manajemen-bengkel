'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { CRMLog, CRMStatus } from '@/lib/types/database';
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
} from 'lucide-react';

export default function CRMPage() {
  const { crmLogs, vehicles, refreshData, showToast, settings } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<CRMLog | null>(null);
  const [customWaMessage, setCustomWaMessage] = useState<string>('');
  const [followupNotes, setFollowupNotes] = useState<string>('');

  const filteredLogs = crmLogs.filter((log) => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const handleOpenContactModal = (log: CRMLog) => {
    setSelectedLog(log);
    const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
    const customerName = vehicle?.customer_name || 'Pelanggan';
    const car = vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil';
    const plate = vehicle?.license_plate || '';

    const defaultMsg = settings.wa_template_reminder
      .replace(/\[Customer\]/g, customerName)
      .replace(/\[Mobil\]/g, car)
      .replace(/\[Plat\]/g, plate)
      .replace(/\[Tanggal\]/g, formatDate(log.due_date));

    setCustomWaMessage(log.whatsapp_message || defaultMsg);
    setFollowupNotes(log.notes || '');
  };

  const handleUpdateStatus = (status: CRMStatus) => {
    if (!selectedLog) return;
    DBService.updateCRMStatus(selectedLog.id, status, followupNotes);
    refreshData();
    showToast(`Status CRM berhasil diubah menjadi "${status.toUpperCase()}"`, 'success');
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

    DBService.updateCRMStatus(selectedLog.id, 'contacted', followupNotes);
    refreshData();
    showToast('Pesan WhatsApp dibuka & status diubah menjadi "Sudah Dihubungi"', 'success');
    setSelectedLog(null);
  };

  const statusMap: Record<CRMStatus, { label: string; class: string }> = {
    pending: { label: 'Belum Dihubungi', class: 'bg-amber-50 text-amber-800 border-amber-200' },
    contacted: { label: 'Sudah Dihubungi', class: 'bg-blue-50 text-blue-800 border-blue-200' },
    scheduled: { label: 'Booking Dibuat', class: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' },
    declined: { label: 'Ditolak / Tunda', class: 'bg-red-50 text-red-800 border-red-200' },
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-maroon-700" />
            <span>CRM & Service Reminder Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Otomatisasi pengingat servis berkala (3/6 bulan atau estimasi KM) & follow-up pelanggan via WhatsApp.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Perlu Dihubungi</span>
            <div className="text-2xl font-black text-amber-600 font-mono mt-0.5">
              {crmLogs.filter((c) => c.status === 'pending').length} Unit
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Sudah Dihubungi</span>
            <div className="text-2xl font-black text-blue-600 font-mono mt-0.5">
              {crmLogs.filter((c) => c.status === 'contacted').length} Unit
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Booking Dibuat</span>
            <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
              {crmLogs.filter((c) => c.status === 'scheduled').length} Unit
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs w-full sm:w-fit">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            statusFilter === 'all' ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600'
          }`}
        >
          Semua Jadwal ({crmLogs.length})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            statusFilter === 'pending' ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600'
          }`}
        >
          Belum Dihubungi
        </button>
        <button
          onClick={() => setStatusFilter('contacted')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            statusFilter === 'contacted' ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600'
          }`}
        >
          Sudah Dihubungi
        </button>
        <button
          onClick={() => setStatusFilter('scheduled')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            statusFilter === 'scheduled' ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600'
          }`}
        >
          Booking Terjadwal
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3.5">Plat & Kendaraan</th>
                <th className="p-3.5">Pemilik / WhatsApp</th>
                <th className="p-3.5">Jatuh Tempo Servis</th>
                <th className="p-3.5">Jenis Reminder</th>
                <th className="p-3.5">Status Follow-up</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const vehicle = log.vehicle || vehicles.find((v) => v.id === log.vehicle_id);
                const badge = statusMap[log.status] || statusMap.pending;

                return (
                  <tr key={log.id} className="hover:bg-slate-50">
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
                      <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{vehicle?.phone_number}</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 font-mono">{formatDate(log.due_date)}</div>
                      <div className="text-[10px] text-slate-400">
                        KM Terakhir: {vehicle?.current_mileage?.toLocaleString('id-ID')}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {log.reminder_type === 'periodic_service'
                          ? 'Servis Berkala'
                          : log.reminder_type === 'ac_cleaning'
                          ? 'Perawatan AC'
                          : 'Ganti Oli Mesin'}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border ${badge.class}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenContactModal(log)}
                        className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Follow-up WA</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up Action Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Kirim Pengingat Servis via WhatsApp</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div>
                  <strong>Pelanggan:</strong>{' '}
                  {selectedLog.vehicle?.customer_name || 'Pelanggan'}
                </div>
                <div>
                  <strong>Kendaraan:</strong>{' '}
                  {selectedLog.vehicle?.car_brand} {selectedLog.vehicle?.car_model} (
                  {selectedLog.vehicle?.license_plate})
                </div>
                <div>
                  <strong>Nomor HP:</strong> {selectedLog.vehicle?.phone_number}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Draft Pesan WhatsApp (Dapat diedit sebelum dikirim):
                </label>
                <textarea
                  rows={4}
                  value={customWaMessage}
                  onChange={(e) => setCustomWaMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-emerald-50/20 focus:ring-1 focus:ring-emerald-600 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Follow-up Internal:</label>
                <input
                  type="text"
                  placeholder="Contoh: Sudah konfirmasi, rencana datang Sabtu pagi..."
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              {/* Status Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleSendWhatsAppAndMarkContacted}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim WhatsApp Sekarang</span>
                </button>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('scheduled')}
                    className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold text-[11px]"
                  >
                    Set: Booking Dibuat
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('declined')}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg font-semibold text-[11px]"
                  >
                    Set: Ditolak / Tunda
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
