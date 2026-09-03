'use client';

import React from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Shield,
  Lock,
  Download,
  Calendar,
  Users,
  Wrench,
  FileText,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const { currentRole, invoices, workOrders, inventory } = useApp();

  // If not owner or estimator, show restricted view
  if (currentRole !== 'owner' && currentRole !== 'estimator') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Akses Terbatas: Khusus Owner &amp; Estimator</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Modul Laporan Keuangan, Analisis Laba Kotor, dan Global Audit Log hanya dapat diakses oleh peran <strong>Owner</strong> dan <strong>Estimator</strong>.
        </p>
      </div>
    );
  }

  // Owner Financial Analytics
  const paidInvoices = invoices.filter((i) => i.type === 'invoice' && i.payment_status === 'paid');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  const totalCost = paidInvoices.reduce((acc, inv) => {
    const invCost = inv.items.reduce((sum, item) => {
      const buyPrice = item.buy_price || 0;
      return sum + buyPrice * item.qty;
    }, 0);
    return acc + invCost;
  }, 0);

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
  const averageTicket = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  const auditLogs = DBService.getAuditLogs();

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['No Nota', 'Tanggal', 'Plat', 'Pelanggan', 'Subtotal', 'Diskon', 'Total', 'Metode'];
    const rows = paidInvoices.map((inv) => [
      inv.invoice_number,
      inv.created_at,
      inv.vehicle?.license_plate || '-',
      inv.vehicle?.customer_name || '-',
      inv.subtotal,
      inv.discount_amount,
      inv.total_amount,
      inv.payment_method || 'Tunai',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan_keuangan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-maroon-700" />
            <span>Laporan Keuangan & Analitik Operasional (Owner)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ikhtisar performa omzet, estimasi laba kotor, produktivitas teknisi & rekam jejak audit sistem.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Laporan CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Omzet Pendapatan
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Dari {paidInvoices.length} transaksi nota lunas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Estimasi Laba Kotor (Gross Profit)
          </span>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {formatCurrency(grossProfit)}
          </div>
          <p className="text-[11px] text-emerald-700 font-bold mt-1">Margin: {profitMarginPercent}%</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Estimasi HPP (Modal Part)
          </span>
          <div className="text-2xl font-black text-slate-700 font-mono mt-1">
            {formatCurrency(totalCost)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Biaya modal suku cadang terpakai</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rata-rata Transaksi (Ticket Size)
          </span>
          <div className="text-2xl font-black text-maroon-900 font-mono mt-1">
            {formatCurrency(averageTicket)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Rata-rata per kendaraan masuk</p>
        </div>
      </div>

      {/* Breakdown Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Kategori Servis & Suku Cadang Terpopuler</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Servis & Perawatan AC Mobil</span>
                <span>42%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '42%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Ganti Oli Mesin & Tune Up</span>
                <span>35%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-maroon-700 rounded-full" style={{ width: '35%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Pengereman & Kaki-kaki</span>
                <span>15%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '15%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Penggantian Filter & Aksesoris</span>
                <span>8%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: '8%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mechanic Workload Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Beban Kerja & Produktivitas Mekanik</span>
            <Users className="w-4 h-4 text-maroon-700" />
          </h3>

          <div className="space-y-3">
            {[
              { name: 'Mekanik MHS 1', specialty: 'Senior AC & Mesin', spkCount: 14, rating: '4.9/5' },
              { name: 'Mekanik MHS 2', specialty: 'Spesialis Sistem AC', spkCount: 9, rating: '4.8/5' },
              { name: 'Mekanik MHS 3', specialty: 'Mekanik Mesin & Tune Up', spkCount: 8, rating: '4.7/5' },
              { name: 'Teknisi Understeel', specialty: 'Teknisi Rem & Kaki-kaki', spkCount: 6, rating: '4.8/5' },
            ].map((m, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.specialty}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-maroon-900">{m.spkCount} SPK Selesai</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Rating: {m.rating}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Audit Log */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-maroon-700" />
            <h3 className="font-bold text-sm text-slate-900">
              Audit Trail & Aktivitas Pengguna (Global Log)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Terakhir 200 aktivitas</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3">Waktu</th>
                <th className="p-3">Pengguna & Role</th>
                <th className="p-3">Tindakan / Aksi</th>
                <th className="p-3">Tabel Sasaran</th>
                <th className="p-3">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 10).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500 font-mono text-[11px]">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-900">{log.user_name}</span>{' '}
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      ({log.user_role})
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs font-bold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-100">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-600">{log.target_table}</td>
                  <td className="p-3 text-slate-500 font-mono text-[11px]">
                    {log.details ? JSON.stringify(log.details) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
