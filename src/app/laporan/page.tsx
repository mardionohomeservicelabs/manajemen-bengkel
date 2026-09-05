'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { BranchId } from '@/lib/auth/users';
import { formatCurrency, formatDateTime, formatDate, formatPlate } from '@/lib/utils';
import {
  BarChart3,
  DollarSign,
  Lock,
  Download,
  Search,
  Building2,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Activity,
  ExternalLink,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const { currentRole, invoices, allInvoices } = useApp();

  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>('ALL');
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<'ALL' | 'cash' | 'transfer' | 'qris' | 'debit'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // If not owner or estimator, show restricted view
  if (currentRole !== 'owner' && currentRole !== 'estimator') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Akses Terbatas: Khusus Owner &amp; Estimator</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Modul Laporan Keuangan, Analisis Omzet Pembayaran Servis, dan Global Audit Log hanya dapat diakses oleh peran <strong>Owner</strong> dan <strong>Estimator</strong>.
        </p>
      </div>
    );
  }

  // 1. Data Sumber: Semua Cabang atau Filter Per Cabang
  const rawInvoices = selectedBranch === 'ALL' ? allInvoices : invoices;

  // 2. Transaksi Servis Lunas (Masuk Omzet)
  const paidInvoices = rawInvoices.filter((i) => i.type === 'invoice' && i.payment_status === 'paid');

  // Metrik Finansial Keseluruhan
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  const totalCost = paidInvoices.reduce((acc, inv) => {
    const invCost = (inv.items || []).reduce((sum, item) => {
      const buyPrice = item.buy_price || 0;
      return sum + buyPrice * item.qty;
    }, 0);
    return acc + invCost;
  }, 0);

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';
  const averageTicket = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  // 3. Klasifikasi Kategori Pembayaran yang Masuk Omzet
  const getPaymentCategory = (method?: string): 'cash' | 'transfer' | 'qris' | 'debit' => {
    const m = (method || 'cash').toLowerCase();
    if (m.includes('qris')) return 'qris';
    if (m.includes('transfer') || m.includes('bca') || m.includes('mandiri') || m.includes('bri') || m.includes('bank')) return 'transfer';
    if (m.includes('debit') || m.includes('edc') || m.includes('card') || m.includes('kredit')) return 'debit';
    return 'cash';
  };

  const cashInvoices = paidInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'cash');
  const transferInvoices = paidInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'transfer');
  const qrisInvoices = paidInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'qris');
  const debitInvoices = paidInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'debit');

  const cashTotal = cashInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const transferTotal = transferInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const qrisTotal = qrisInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const debitTotal = debitInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  const cashPercent = totalRevenue > 0 ? ((cashTotal / totalRevenue) * 100).toFixed(1) : '0';
  const transferPercent = totalRevenue > 0 ? ((transferTotal / totalRevenue) * 100).toFixed(1) : '0';
  const qrisPercent = totalRevenue > 0 ? ((qrisTotal / totalRevenue) * 100).toFixed(1) : '0';
  const debitPercent = totalRevenue > 0 ? ((debitTotal / totalRevenue) * 100).toFixed(1) : '0';

  // 4. Data Transaksi Terfilter untuk Tabel
  const filteredTransactions = paidInvoices
    .filter((inv) => {
      if (paymentCategoryFilter !== 'ALL' && getPaymentCategory(inv.payment_method) !== paymentCategoryFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const invoiceNum = (inv.invoice_number || '').toLowerCase();
      const spkNum = (inv.work_order?.spk_number || inv.work_order_id || '').toLowerCase();
      const plate = (inv.vehicle?.license_plate || '').toLowerCase();
      const cust = (inv.vehicle?.customer_name || '').toLowerCase();
      const car = `${inv.vehicle?.car_brand || ''} ${inv.vehicle?.car_model || ''}`.toLowerCase();
      return invoiceNum.includes(q) || spkNum.includes(q) || plate.includes(q) || cust.includes(q) || car.includes(q);
    })
    .sort((a, b) => {
      const timeA = new Date(a.paid_at || a.created_at || 0).getTime() || 0;
      const timeB = new Date(b.paid_at || b.created_at || 0).getTime() || 0;
      return timeB - timeA;
    });

  const auditLogs = DBService.getAuditLogs();

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'No Nota',
      'Tanggal Bayar',
      'Plat Nomor',
      'Pelanggan',
      'Model Kendaraan',
      'Kategori Pembayaran',
      'Cabang',
      'Subtotal',
      'Diskon',
      'Pajak',
      'Total Masuk Omzet',
      'Status',
    ];
    const rows = filteredTransactions.map((inv) => {
      const branchName = inv.work_order?.received_at_branch || 'MHS 1';
      const cat = getPaymentCategory(inv.payment_method);
      const catLabel = cat === 'cash' ? 'Tunai (Cash)' : cat === 'transfer' ? 'Transfer Bank' : cat === 'qris' ? 'QRIS' : 'Kartu Debit/EDC';
      return [
        inv.invoice_number,
        inv.paid_at || inv.created_at,
        inv.vehicle?.license_plate ? formatPlate(inv.vehicle.license_plate) : '-',
        inv.vehicle?.customer_name || '-',
        `${inv.vehicle?.car_brand || ''} ${inv.vehicle?.car_model || ''}`.trim() || '-',
        catLabel,
        branchName,
        inv.subtotal,
        inv.discount_amount || 0,
        inv.tax_amount || 0,
        inv.total_amount,
        'LUNAS',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `laporan_omzet_pembayaran_${selectedBranch}_${new Date().toISOString().slice(0, 10)}.csv`
    );
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
            <span>Laporan Keuangan &amp; Omzet Pembayaran Servis</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rincian data pembayaran servis, klasifikasi metode pembayaran, dan rekapitulasi omzet riil bengkel.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Laporan CSV</span>
        </button>
      </div>

      {/* Filter Lokasi Cabang Bengkel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Filter Lokasi Cabang Laporan
            </div>
            <div className="text-[11px] text-slate-500">
              Pilih cabang untuk memfilter omzet dan rincian transaksi nota servis
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
              {allInvoices.filter((i) => i.type === 'invoice' && i.payment_status === 'paid').length}
            </span>
          </button>
          {(['MHS 1', 'MHS 2', 'MHS 3'] as BranchId[]).map((b) => {
            const count = allInvoices.filter(
              (i) => i.type === 'invoice' && i.payment_status === 'paid' && (i.work_order?.received_at_branch || 'MHS 1') === b
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
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Ringkasan Finansial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Omzet Pendapatan
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-2">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            Dari {paidInvoices.length} transaksi pembayaran servis lunas
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Estimasi Laba Kotor
            </span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono mt-2">
            {formatCurrency(grossProfit)}
          </div>
          <p className="text-[11px] text-blue-700 font-bold mt-1">
            Margin: {profitMarginPercent}% dari omzet
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Estimasi HPP (Modal Part)
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-700 font-mono mt-2">
            {formatCurrency(totalCost)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Biaya modal pembelian suku cadang terpakai
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rata-rata Transaksi (Ticket)
            </span>
            <div className="p-2 rounded-xl bg-maroon-100 text-maroon-800">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-maroon-900 font-mono mt-2">
            {formatCurrency(averageTicket)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Rata-rata nominal per mobil yang selesai servis
          </p>
        </div>
      </div>

      {/* SECTION: Kategori Pembayaran Servis yang Masuk Omzet */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-maroon-700" />
              <span>Nominal &amp; Kategori Pembayaran Servis yang Masuk Omzet</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian kontribusi nominal pendapatan servis berdasarkan metode pembayaran resmi yang digunakan pelanggan.
            </p>
          </div>
          <div className="text-xs font-black text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Total Transaksi Lunas: {paidInvoices.length} Nota
          </div>
        </div>

        {/* 4 Cards Kategori Pembayaran */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Tunai / Cash */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'cash' ? 'ALL' : 'cash')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'cash'
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5">
                <Banknote className="w-4 h-4 text-emerald-700" />
                <span>Tunai (Cash)</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                {cashPercent}%
              </span>
            </div>
            <div className="text-xl font-black text-emerald-950 font-mono mt-2">
              {formatCurrency(cashTotal)}
            </div>
            <div className="text-[11px] text-emerald-800 font-medium mt-1">
              {cashInvoices.length} transaksi nota servis
            </div>
          </div>

          {/* 2. Transfer Bank */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'transfer' ? 'ALL' : 'transfer')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'transfer'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                : 'bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" />
                <span>Transfer Bank</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                {transferPercent}%
              </span>
            </div>
            <div className="text-xl font-black text-indigo-950 font-mono mt-2">
              {formatCurrency(transferTotal)}
            </div>
            <div className="text-[11px] text-indigo-800 font-medium mt-1">
              {transferInvoices.length} transaksi (BCA / Mandiri / BRI)
            </div>
          </div>

          {/* 3. QRIS */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'qris' ? 'ALL' : 'qris')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'qris'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>QRIS Instant</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                {qrisPercent}%
              </span>
            </div>
            <div className="text-xl font-black text-amber-950 font-mono mt-2">
              {formatCurrency(qrisTotal)}
            </div>
            <div className="text-[11px] text-amber-800 font-medium mt-1">
              {qrisInvoices.length} transaksi QRIS digital
            </div>
          </div>

          {/* 4. Kartu Debit / EDC */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'debit' ? 'ALL' : 'debit')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'debit'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 shadow-md'
                : 'bg-purple-50/40 border-purple-200/80 hover:bg-purple-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-purple-700" />
                <span>Kartu Debit / EDC</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                {debitPercent}%
              </span>
            </div>
            <div className="text-xl font-black text-purple-950 font-mono mt-2">
              {formatCurrency(debitTotal)}
            </div>
            <div className="text-[11px] text-purple-800 font-medium mt-1">
              {debitInvoices.length} transaksi mesin EDC / Kartu
            </div>
          </div>
        </div>

        {/* Bar Komposisi Omzet */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Komposisi Arus Kas Masuk (Cashflow Distribution):</span>
            <span className="font-mono text-slate-900">Total Omzet: {formatCurrency(totalRevenue)}</span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${cashPercent}%` }}
              className="h-full bg-emerald-500 hover:opacity-90 transition"
              title={`Tunai: ${formatCurrency(cashTotal)} (${cashPercent}%)`}
            />
            <div
              style={{ width: `${transferPercent}%` }}
              className="h-full bg-indigo-500 hover:opacity-90 transition"
              title={`Transfer: ${formatCurrency(transferTotal)} (${transferPercent}%)`}
            />
            <div
              style={{ width: `${qrisPercent}%` }}
              className="h-full bg-amber-500 hover:opacity-90 transition"
              title={`QRIS: ${formatCurrency(qrisTotal)} (${qrisPercent}%)`}
            />
            <div
              style={{ width: `${debitPercent}%` }}
              className="h-full bg-purple-500 hover:opacity-90 transition"
              title={`Debit: ${formatCurrency(debitTotal)} (${debitPercent}%)`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 text-slate-600 font-medium">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Tunai: <strong>{cashPercent}%</strong> ({formatCurrency(cashTotal)})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Transfer: <strong>{transferPercent}%</strong> ({formatCurrency(transferTotal)})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>QRIS: <strong>{qrisPercent}%</strong> ({formatCurrency(qrisTotal)})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Debit / EDC: <strong>{debitPercent}%</strong> ({formatCurrency(debitTotal)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Tabel Rincian Data Pembayaran Servis Masuk Omzet */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Daftar Transaksi Pembayaran Servis (Data Riil Masuk Omzet)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan seluruh nota servis lunas dengan rincian waktu bayar, nominal omzet, dan metode pembayaran.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Quick Category Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
              <button
                onClick={() => setPaymentCategoryFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition ${
                  paymentCategoryFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setPaymentCategoryFilter('cash')}
                className={`px-3 py-1 rounded-lg transition ${
                  paymentCategoryFilter === 'cash'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tunai
              </button>
              <button
                onClick={() => setPaymentCategoryFilter('transfer')}
                className={`px-3 py-1 rounded-lg transition ${
                  paymentCategoryFilter === 'transfer'
                    ? 'bg-white text-indigo-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Transfer
              </button>
              <button
                onClick={() => setPaymentCategoryFilter('qris')}
                className={`px-3 py-1 rounded-lg transition ${
                  paymentCategoryFilter === 'qris'
                    ? 'bg-white text-amber-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                QRIS
              </button>
              <button
                onClick={() => setPaymentCategoryFilter('debit')}
                className={`px-3 py-1 rounded-lg transition ${
                  paymentCategoryFilter === 'debit'
                    ? 'bg-white text-purple-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Debit
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Plat / No Nota / SPK..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Tabel Data Pembayaran */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                  <th className="p-3.5">Waktu Pembayaran</th>
                  <th className="p-3.5">No. Nota &amp; SPK</th>
                  <th className="p-3.5">Plat &amp; Kendaraan</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Cabang</th>
                  <th className="p-3.5">Kategori Bayar</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Nominal Omzet</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400 font-medium">
                      {searchQuery || paymentCategoryFilter !== 'ALL'
                        ? 'Tidak ada data pembayaran servis yang cocok dengan kriteria filter.'
                        : 'Belum ada data transaksi pembayaran servis di cabang yang dipilih.'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((inv) => {
                    const vehicle = inv.vehicle;
                    const branchLabel = inv.work_order?.received_at_branch || 'MHS 1';
                    const cat = getPaymentCategory(inv.payment_method);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        {/* Waktu Pembayaran */}
                        <td className="p-3.5 space-y-0.5">
                          <div className="font-bold text-slate-900">
                            {formatDate(inv.paid_at || inv.created_at)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatDateTime(inv.paid_at || inv.created_at).split(' ')[1] || ''} WIB
                          </div>
                        </td>

                        {/* No Nota & SPK */}
                        <td className="p-3.5 space-y-0.5 font-mono">
                          <div className="font-bold text-maroon-900 text-xs">
                            {inv.invoice_number}
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            SPK: {inv.work_order?.spk_number || inv.work_order_id?.slice(-8) || '-'}
                          </div>
                        </td>

                        {/* Plat & Kendaraan */}
                        <td className="p-3.5">
                          <div className="font-mono font-black text-slate-900 text-xs">
                            {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                          </div>
                          <div className="text-slate-600 text-[11px] font-medium">
                            {vehicle?.car_brand} {vehicle?.car_model}
                          </div>
                        </td>

                        {/* Pelanggan */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">
                            {vehicle?.customer_name || 'Pelanggan'}
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-mono">
                            {vehicle?.phone_number || '-'}
                          </div>
                        </td>

                        {/* Cabang */}
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

                        {/* Kategori Pembayaran Badge */}
                        <td className="p-3.5">
                          {cat === 'cash' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <Banknote className="w-3 h-3 text-emerald-700" />
                              <span>TUNAI (CASH)</span>
                            </span>
                          )}
                          {cat === 'transfer' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                              <Building2 className="w-3 h-3 text-indigo-700" />
                              <span>TRANSFER BANK</span>
                            </span>
                          )}
                          {cat === 'qris' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              <QrCode className="w-3 h-3 text-amber-700" />
                              <span>QRIS</span>
                            </span>
                          )}
                          {cat === 'debit' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                              <CreditCard className="w-3 h-3 text-purple-700" />
                              <span>KARTU DEBIT</span>
                            </span>
                          )}
                        </td>

                        {/* Status Lunas */}
                        <td className="p-3.5">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>LUNAS</span>
                          </span>
                        </td>

                        {/* Nominal Masuk Omzet */}
                        <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-sm">
                          {formatCurrency(inv.total_amount)}
                        </td>

                        {/* Aksi */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <Link
                            href={`/kasir?spkId=${inv.work_order_id || ''}`}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-700 hover:text-maroon-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
                          >
                            <span>Lihat Nota</span>
                            <ArrowUpRight className="w-3 h-3" />
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
      </div>

      {/* Global Audit Log */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-maroon-700" />
            <h3 className="font-bold text-sm text-slate-900">
              Audit Trail &amp; Aktivitas Pengguna (Global Log)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Terakhir 200 aktivitas</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3">Waktu</th>
                <th className="p-3">Pengguna &amp; Role</th>
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
