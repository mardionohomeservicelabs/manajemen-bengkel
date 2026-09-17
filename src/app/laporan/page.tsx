'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { BranchId, canUserAccessFinancialReports } from '@/lib/auth/users';
import { formatCurrency, formatDateTime, formatDate, formatPlate, resolveInvoiceBranch } from '@/lib/utils';
import {
  BarChart3,
  DollarSign,
  Lock,
  Download,
  Search,
  Building2,
  Receipt,
  CreditCard,
  CheckCircle2,
  Activity,
  ArrowUpRight,
  Wallet,
  RotateCcw,
  Calendar,
  CalendarDays,
  TrendingUp,
  Filter,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export default function ReportsPage() {
  const { currentRole, invoices, allInvoices, allWorkOrders } = useApp();
  const { currentUser, activeBranch } = useAuth();
  const canAccessAll = !!currentUser?.canAccessAllBranches;

  // Helper resolusi cabang invoice yang akurat dan anti-salah-kamar
  const getInvoiceBranch = (inv: any): BranchId => {
    return (inv?.branch as BranchId) || resolveInvoiceBranch(inv, allWorkOrders);
  };

  // State Filter Cabang: Terkunci ke activeBranch jika staf biasa, bebas untuk Owner / Via
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>(
    canAccessAll ? 'ALL' : activeBranch
  );

  // Sinkronkan selectedBranch saat activeBranch berganti
  useEffect(() => {
    if (!canAccessAll) {
      setSelectedBranch(activeBranch);
    }
  }, [activeBranch, canAccessAll]);

  // State Filter Waktu: Tahun & Bulan
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<'ALL' | number>('ALL'); // 'ALL' = 1 Tahun Penuh, 0-11 = Bulan Jan-Des

  // State Filter Tambahan
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<'ALL' | 'cash' | 'transfer_bca' | 'transfer_bri'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Validasi Otorisasi: Khusus Owner, Mey, Via, dan Arida
  if (!canUserAccessFinancialReports(currentUser)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Akses Terbatas: Laporan Keuangan</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Modul Laporan Keuangan, Analisis Omzet Pembayaran Servis, dan Rekapitulasi Finansial Bulanan/Tahunan hanya dapat diakses oleh <strong>Owner</strong>, <strong>Mey</strong>, <strong>Via</strong>, dan <strong>Arida</strong>.
        </p>
      </div>
    );
  }

  // 2. Data Sumber: Dibatasi pada cabang akun (untuk staf/admin) atau sesuai pilihan (untuk owner/via)
  const rawInvoices = !canAccessAll
    ? allInvoices.filter((i) => getInvoiceBranch(i) === activeBranch)
    : selectedBranch === 'ALL'
    ? allInvoices
    : allInvoices.filter((i) => getInvoiceBranch(i) === selectedBranch);

  // 3. Transaksi Servis Lunas (Masuk Omzet)
  const allPaidInvoices = rawInvoices.filter((i) => i.type === 'invoice' && i.payment_status === 'paid');

  // Deteksi daftar tahun yang tersedia dari data nota
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    allPaidInvoices.forEach((inv) => {
      const d = new Date(inv.paid_at || inv.created_at || '');
      if (!isNaN(d.getFullYear())) {
        yearsSet.add(d.getFullYear());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [allPaidInvoices, currentYear]);

  // Helper Klasifikasi Kategori Pembayaran
  const getPaymentCategory = (method?: string): 'cash' | 'transfer_bca' | 'transfer_bri' => {
    const m = (method || 'cash').toLowerCase();
    if (m.includes('bri')) return 'transfer_bri';
    if (m.includes('bca') || m.includes('transfer') || m.includes('mandiri') || m.includes('bank')) return 'transfer_bca';
    return 'cash';
  };

  // Helper Hitung Biaya / HPP per Invoice
  const getInvoiceCost = (inv: (typeof allPaidInvoices)[0]): number => {
    return (inv.items || []).reduce((sum, item) => {
      const buyPrice = item.buy_price || 0;
      return sum + buyPrice * (item.qty || 1);
    }, 0);
  };

  // 4. Data Transaksi Tahun Terpilih
  const yearPaidInvoices = useMemo(() => {
    return allPaidInvoices.filter((inv) => {
      const d = new Date(inv.paid_at || inv.created_at || '');
      return !isNaN(d.getFullYear()) && d.getFullYear() === selectedYear;
    });
  }, [allPaidInvoices, selectedYear]);

  // 5. Rekapitulasi 12 Bulan dalam Tahun Terpilih
  const monthlyBreakdown = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIdx) => {
      const monthInvs = yearPaidInvoices.filter((inv) => {
        const d = new Date(inv.paid_at || inv.created_at || '');
        return !isNaN(d.getMonth()) && d.getMonth() === monthIdx;
      });

      const revenue = monthInvs.reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const cost = monthInvs.reduce((sum, i) => sum + getInvoiceCost(i), 0);
      const profit = revenue - cost;
      const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

      const cash = monthInvs
        .filter((i) => getPaymentCategory(i.payment_method) === 'cash')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const bca = monthInvs
        .filter((i) => getPaymentCategory(i.payment_method) === 'transfer_bca')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const bri = monthInvs
        .filter((i) => getPaymentCategory(i.payment_method) === 'transfer_bri')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);

      return {
        monthIndex: monthIdx,
        monthName: MONTH_NAMES[monthIdx],
        monthShort: MONTH_SHORT[monthIdx],
        count: monthInvs.length,
        revenue,
        cost,
        profit,
        margin,
        cash,
        bca,
        bri,
      };
    });
  }, [yearPaidInvoices]);

  // Total Akumulasi 1 Tahun Penuh
  const yearSummary = useMemo(() => {
    const totalRevenue = monthlyBreakdown.reduce((sum, m) => sum + m.revenue, 0);
    const totalCost = monthlyBreakdown.reduce((sum, m) => sum + m.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalCount = monthlyBreakdown.reduce((sum, m) => sum + m.count, 0);
    const totalCash = monthlyBreakdown.reduce((sum, m) => sum + m.cash, 0);
    const totalBca = monthlyBreakdown.reduce((sum, m) => sum + m.bca, 0);
    const totalBri = monthlyBreakdown.reduce((sum, m) => sum + m.bri, 0);
    const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
    const averageMonthly = totalRevenue / 12;

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      totalCount,
      totalCash,
      totalBca,
      totalBri,
      margin,
      averageMonthly,
    };
  }, [monthlyBreakdown]);

  // 6. Transaksi Periode Aktif (Sesuai Bulan yang Dipilih atau 1 Tahun Penuh)
  const activePeriodInvoices = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return yearPaidInvoices;
    }
    return yearPaidInvoices.filter((inv) => {
      const d = new Date(inv.paid_at || inv.created_at || '');
      return d.getMonth() === selectedMonth;
    });
  }, [yearPaidInvoices, selectedMonth]);

  // Metrik Finansial untuk Periode Aktif (Ditampilkan di Kartu KPI)
  const activeRevenue = activePeriodInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const activeCost = activePeriodInvoices.reduce((sum, i) => sum + getInvoiceCost(i), 0);
  const activeProfit = activeRevenue - activeCost;
  const activeMarginPercent = activeRevenue > 0 ? ((activeProfit / activeRevenue) * 100).toFixed(1) : '0';
  const activeAverageTicket = activePeriodInvoices.length > 0 ? activeRevenue / activePeriodInvoices.length : 0;

  // Breakdown Metode Pembayaran Periode Aktif
  const activeCashInvoices = activePeriodInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'cash');
  const activeBcaInvoices = activePeriodInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'transfer_bca');
  const activeBriInvoices = activePeriodInvoices.filter((i) => getPaymentCategory(i.payment_method) === 'transfer_bri');

  const activeCashTotal = activeCashInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const activeBcaTotal = activeBcaInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const activeBriTotal = activeBriInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

  const activeCashPercent = activeRevenue > 0 ? ((activeCashTotal / activeRevenue) * 100).toFixed(1) : '0';
  const activeBcaPercent = activeRevenue > 0 ? ((activeBcaTotal / activeRevenue) * 100).toFixed(1) : '0';
  const activeBriPercent = activeRevenue > 0 ? ((activeBriTotal / activeRevenue) * 100).toFixed(1) : '0';

  // 7. Data Transaksi Terfilter untuk Tabel Rincian
  const filteredTransactions = useMemo(() => {
    return activePeriodInvoices
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
  }, [activePeriodInvoices, paymentCategoryFilter, searchQuery]);

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
      const branchName = getInvoiceBranch(inv);
      const cat = getPaymentCategory(inv.payment_method);
      const catLabel =
        cat === 'cash'
          ? 'Tunai (Cash)'
          : cat === 'transfer_bca'
          ? 'Transfer Bank BCA'
          : 'Transfer Bank BRI';
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

    const periodStr = selectedMonth === 'ALL' ? `Tahun_${selectedYear}` : `${MONTH_NAMES[selectedMonth]}_${selectedYear}`;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `laporan_keuangan_${selectedBranch}_${periodStr}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nilai omzet bulanan tertinggi untuk skala visual bar
  const maxMonthRevenue = Math.max(...monthlyBreakdown.map((m) => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-maroon-700" />
            <span>Laporan Keuangan &amp; Analisis Omzet</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekapitulasi keuangan bulanan &amp; tahunan, klasifikasi metode pembayaran, dan rincian transaksi nota servis.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Laporan CSV ({selectedMonth === 'ALL' ? `Tahun ${selectedYear}` : MONTH_NAMES[selectedMonth]})</span>
        </button>
      </div>

      {/* FILTER BAR 1: Lokasi Cabang Bengkel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Filter Lokasi Cabang Laporan
            </div>
            <div className="text-[11px] text-slate-500">
              {canAccessAll
                ? 'Pilih cabang untuk memfilter omzet dan transaksi nota servis'
                : `Akses terkunci pada cabang penugasan akun Anda (${activeBranch})`}
            </div>
          </div>
        </div>

        {canAccessAll ? (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => setSelectedBranch('ALL')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                selectedBranch === 'ALL'
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>Semua Cabang</span>
              <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-black ${
                selectedBranch === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {allPaidInvoices.length}
              </span>
            </button>
            {(['MHS 1', 'MHS 2', 'MHS 3'] as BranchId[]).map((b) => {
              const count = allPaidInvoices.filter(
                (i) => getInvoiceBranch(i) === b
              ).length;
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBranch(b)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
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
        ) : (
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-[11px] font-bold text-slate-500">Cabang Anda:</span>
            <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-xs">{activeBranch}</span>
            <span className="text-[10.5px] text-slate-500 font-semibold">(Laporan khusus {activeBranch})</span>
          </div>
        )}
      </div>

      {/* FILTER BAR 2: Navigasi Tahun & Bulan */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Periode Laporan Keuangan
              </div>
              <div className="text-[11px] text-slate-500">
                Pilih tahun dan bulan untuk melihat analisis omzet spesifik atau akumulasi 1 tahun penuh
              </div>
            </div>
          </div>

          {/* Selector Tahun */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold bg-slate-100 border border-slate-300 text-slate-900 px-3 py-1.5 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-maroon-600/20"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Pemilihan Bulan (Semua Bulan / Jan - Des) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
          <button
            onClick={() => setSelectedMonth('ALL')}
            className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
              selectedMonth === 'ALL'
                ? 'bg-maroon-800 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Semua Bulan (1 Tahun Penuh)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedMonth === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {yearPaidInvoices.length}
            </span>
          </button>

          {MONTH_NAMES.map((name, idx) => {
            const count = monthlyBreakdown[idx]?.count || 0;
            const isSelected = selectedMonth === idx;
            return (
              <button
                key={name}
                onClick={() => setSelectedMonth(idx)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-maroon-700 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{MONTH_SHORT[idx]}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Ringkasan Finansial Periode Aktif */}
      <div className="space-y-2">
        <div className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <span>
            Ringkasan Finansial — {selectedMonth === 'ALL' ? `Total 1 Tahun Penuh (${selectedYear})` : `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Omzet */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {selectedMonth === 'ALL' ? 'Total Omzet 1 Tahun' : `Omzet Bulan ${MONTH_SHORT[selectedMonth]}`}
              </span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-2">
              {formatCurrency(activeRevenue)}
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              Dari {activePeriodInvoices.length} transaksi pembayaran servis lunas
            </p>
          </div>

          {/* Card 2: Estimasi Laba Kotor */}
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
              {formatCurrency(activeProfit)}
            </div>
            <p className="text-[11px] text-blue-700 font-bold mt-1">
              Margin: {activeMarginPercent}% dari omzet
            </p>
          </div>

          {/* Card 3: Modal Part (HPP) */}
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
              {formatCurrency(activeCost)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Biaya modal pembelian suku cadang terpakai
            </p>
          </div>

          {/* Card 4: Rata-rata Transaksi / Bulanan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {selectedMonth === 'ALL' ? 'Rata-rata Omzet / Bulan' : 'Rata-rata Nilai Nota (Ticket)'}
              </span>
              <div className="p-2 rounded-xl bg-maroon-100 text-maroon-800">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-maroon-900 font-mono mt-2">
              {selectedMonth === 'ALL' ? formatCurrency(yearSummary.averageMonthly) : formatCurrency(activeAverageTicket)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {selectedMonth === 'ALL' ? 'Rata-rata pendapatan per bulan di tahun ini' : 'Rata-rata nilai transaksi per kendaraan'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION: REKAPITULASI KEUANGAN 12 BULAN (JANUARI - DESEMBER) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-maroon-700" />
              <span>Rekapitulasi Keuangan Bulanan Tahun {selectedYear}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian omzet, modal, estimasi laba kotor, dan metode pembayaran per bulan hingga total 1 tahun penuh.
            </p>
          </div>
          {selectedMonth !== 'ALL' && (
            <button
              onClick={() => setSelectedMonth('ALL')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-maroon-700 hover:text-maroon-900 bg-maroon-50 px-3 py-1.5 rounded-xl border border-maroon-200 cursor-pointer"
            >
              <span>Tampilkan Semua Bulan (1 Tahun)</span>
            </button>
          )}
        </div>

        {/* Tabel Rekapitulasi 12 Bulan */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <th className="p-3">Bulan</th>
                <th className="p-3 text-center">Nota Lunas</th>
                <th className="p-3 text-right">Omzet Bruto</th>
                <th className="p-3 text-right">Modal Part (HPP)</th>
                <th className="p-3 text-right">Laba Kotor</th>
                <th className="p-3 text-center">Margin</th>
                <th className="p-3 text-right">Tunai (Cash)</th>
                <th className="p-3 text-right">Transfer BCA</th>
                <th className="p-3 text-right">Transfer BRI</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyBreakdown.map((row) => {
                const isSelected = selectedMonth === row.monthIndex;
                const isZero = row.count === 0 && row.revenue === 0;

                return (
                  <tr
                    key={row.monthIndex}
                    className={`transition ${
                      isSelected
                        ? 'bg-maroon-50/70 font-semibold'
                        : isZero
                        ? 'text-slate-400 hover:bg-slate-50/60'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {/* Nama Bulan & Bar Mini Visual */}
                    <td className="p-3 font-bold whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span>{row.monthName}</span>
                        {isSelected && (
                          <span className="text-[9.5px] bg-maroon-800 text-white px-1.5 py-0.2 rounded font-black">
                            Aktif
                          </span>
                        )}
                      </div>
                      {/* Mini Revenue Bar */}
                      <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${row.revenue > 0 ? 'bg-emerald-600' : 'bg-transparent'}`}
                          style={{ width: `${(row.revenue / maxMonthRevenue) * 100}%` }}
                        />
                      </div>
                    </td>

                    {/* Jumlah Nota */}
                    <td className="p-3 text-center font-bold">
                      {row.count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono">
                          {row.count} unit
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Omzet Bruto */}
                    <td className={`p-3 text-right font-mono font-black ${row.revenue > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
                      {formatCurrency(row.revenue)}
                    </td>

                    {/* Modal Part */}
                    <td className={`p-3 text-right font-mono ${row.cost > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {formatCurrency(row.cost)}
                    </td>

                    {/* Laba Kotor */}
                    <td className={`p-3 text-right font-mono font-bold ${row.profit > 0 ? 'text-blue-700' : 'text-slate-300'}`}>
                      {formatCurrency(row.profit)}
                    </td>

                    {/* Margin */}
                    <td className="p-3 text-center font-bold">
                      {row.revenue > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] ${
                          Number(row.margin) >= 30 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {row.margin}%
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Tunai */}
                    <td className="p-3 text-right font-mono text-slate-600">
                      {row.cash > 0 ? formatCurrency(row.cash) : <span className="text-slate-300">-</span>}
                    </td>

                    {/* BCA */}
                    <td className="p-3 text-right font-mono text-slate-600">
                      {row.bca > 0 ? formatCurrency(row.bca) : <span className="text-slate-300">-</span>}
                    </td>

                    {/* BRI */}
                    <td className="p-3 text-right font-mono text-slate-600">
                      {row.bri > 0 ? formatCurrency(row.bri) : <span className="text-slate-300">-</span>}
                    </td>

                    {/* Aksi: Filter ke Bulan ini */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedMonth(row.monthIndex)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          isSelected
                            ? 'bg-maroon-700 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={`Lihat rincian transaksi bulan ${row.monthName}`}
                      >
                        {isSelected ? 'Terpilih' : 'Lihat Detail'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Row: TOTAL 1 TAHUN PENUH */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                <td className="p-3.5 font-black uppercase tracking-wider">
                  TOTAL 1 TAHUN ({selectedYear})
                </td>
                <td className="p-3.5 text-center font-mono font-black text-amber-300">
                  {yearSummary.totalCount} unit
                </td>
                <td className="p-3.5 text-right font-mono font-black text-emerald-400 text-sm">
                  {formatCurrency(yearSummary.totalRevenue)}
                </td>
                <td className="p-3.5 text-right font-mono text-slate-300">
                  {formatCurrency(yearSummary.totalCost)}
                </td>
                <td className="p-3.5 text-right font-mono font-black text-blue-300 text-sm">
                  {formatCurrency(yearSummary.totalProfit)}
                </td>
                <td className="p-3.5 text-center font-bold text-amber-300">
                  {yearSummary.margin}%
                </td>
                <td className="p-3.5 text-right font-mono text-slate-300">
                  {formatCurrency(yearSummary.totalCash)}
                </td>
                <td className="p-3.5 text-right font-mono text-slate-300">
                  {formatCurrency(yearSummary.totalBca)}
                </td>
                <td className="p-3.5 text-right font-mono text-slate-300">
                  {formatCurrency(yearSummary.totalBri)}
                </td>
                <td className="p-3.5 text-center text-[10.5px] text-slate-400 font-normal">
                  12 Bulan
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION: Kategori Pembayaran Servis yang Masuk Omzet */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-maroon-700" />
              <span>Metode Pembayaran ({selectedMonth === 'ALL' ? `Tahun ${selectedYear}` : MONTH_NAMES[selectedMonth]})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik salah satu kategori di bawah untuk memfilter daftar transaksi nota sesuai metode pembayaran.
            </p>
          </div>
          <div className="text-xs font-black text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Total Masuk: {activePeriodInvoices.length} Nota Lunas
          </div>
        </div>

        {/* 3 Cards Kategori Pembayaran */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <span className="text-xs font-black uppercase text-emerald-950 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Tunai (Cash)</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                {activeCashInvoices.length} Transaksi
              </span>
            </div>
            <div className="text-xl font-black text-emerald-900 font-mono mt-3">
              {formatCurrency(activeCashTotal)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium mt-1">
              <span>{activeCashPercent}% dari omzet aktif</span>
              {paymentCategoryFilter === 'cash' && (
                <span className="font-bold text-emerald-800 underline">Filter Aktif</span>
              )}
            </div>
          </div>

          {/* 2. Transfer BCA */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'transfer_bca' ? 'ALL' : 'transfer_bca')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'transfer_bca'
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                : 'bg-blue-50/40 border-blue-200/80 hover:bg-blue-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-blue-950 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Transfer Bank BCA</span>
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                {activeBcaInvoices.length} Transaksi
              </span>
            </div>
            <div className="text-xl font-black text-blue-900 font-mono mt-3">
              {formatCurrency(activeBcaTotal)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-blue-700 font-medium mt-1">
              <span>{activeBcaPercent}% dari omzet aktif</span>
              {paymentCategoryFilter === 'transfer_bca' && (
                <span className="font-bold text-blue-800 underline">Filter Aktif</span>
              )}
            </div>
          </div>

          {/* 3. Transfer BRI */}
          <div
            onClick={() => setPaymentCategoryFilter(paymentCategoryFilter === 'transfer_bri' ? 'ALL' : 'transfer_bri')}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              paymentCategoryFilter === 'transfer_bri'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-950 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                <span>Transfer Bank BRI</span>
              </span>
              <span className="text-[11px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                {activeBriInvoices.length} Transaksi
              </span>
            </div>
            <div className="text-xl font-black text-amber-900 font-mono mt-3">
              {formatCurrency(activeBriTotal)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-800 font-medium mt-1">
              <span>{activeBriPercent}% dari omzet aktif</span>
              {paymentCategoryFilter === 'transfer_bri' && (
                <span className="font-bold text-amber-900 underline">Filter Aktif</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: TABEL RINCIAN TRANSAKSI NOTA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-maroon-700" />
              <span>
                Daftar Transaksi Nota Servis — {selectedMonth === 'ALL' ? `Tahun ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredTransactions.length} nota pembayaran servis lunas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nota, plat, nama, mobil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 font-medium"
              />
            </div>

            {/* Reset Kategori Filter if active */}
            {paymentCategoryFilter !== 'ALL' && (
              <button
                onClick={() => setPaymentCategoryFilter('ALL')}
                className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <span>Reset Kategori ({paymentCategoryFilter})</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <th className="p-3.5">No Nota &amp; Tanggal</th>
                <th className="p-3.5">Kendaraan &amp; Pelanggan</th>
                <th className="p-3.5">Kategori Pembayaran</th>
                <th className="p-3.5">Cabang</th>
                <th className="p-3.5 text-right">Subtotal</th>
                <th className="p-3.5 text-right">Diskon</th>
                <th className="p-3.5 text-right">Total Masuk Omzet</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">Tidak ada transaksi yang cocok dengan filter</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba sesuaikan pilihan bulan, tahun, cabang, atau kata kunci pencarian Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((inv) => {
                  const vehicle = inv.vehicle;
                  const cat = getPaymentCategory(inv.payment_method);
                  const branchName = getInvoiceBranch(inv);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      {/* No Nota & Tanggal */}
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-slate-900">
                          {inv.invoice_number}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {inv.paid_at ? formatDateTime(inv.paid_at) : formatDateTime(inv.created_at)}
                        </div>
                      </td>

                      {/* Kendaraan & Pelanggan */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800 border border-slate-200">
                            {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                          </span>
                          <span>{vehicle?.customer_name || 'Pelanggan'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}
                        </div>
                      </td>

                      {/* Kategori Pembayaran */}
                      <td className="p-3.5">
                        {cat === 'cash' ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Tunai (Cash)</span>
                          </span>
                        ) : cat === 'transfer_bca' ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span>Transfer Bank BCA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Transfer Bank BRI</span>
                          </span>
                        )}
                      </td>

                      {/* Cabang */}
                      <td className="p-3.5">
                        <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {branchName}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="p-3.5 text-right font-mono text-slate-600">
                        {formatCurrency(inv.subtotal)}
                      </td>

                      {/* Diskon */}
                      <td className="p-3.5 text-right font-mono text-rose-600">
                        {inv.discount_amount && inv.discount_amount > 0 ? `-${formatCurrency(inv.discount_amount)}` : '-'}
                      </td>

                      {/* Total Omzet */}
                      <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-sm">
                        {formatCurrency(inv.total_amount)}
                      </td>

                      {/* Aksi */}
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        {currentRole === 'owner' && (
                          <Link
                            href={`/kasir?invoiceId=${inv.id}&mode=owner_edit`}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                            title="Koreksi Nota & Pembayaran Ulang Kasir (Khusus Owner)"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-700" />
                            <span>Koreksi / Ulang Bayar</span>
                          </Link>
                        )}
                        <Link
                          href={`/riwayat?search=${vehicle?.license_plate || inv.invoice_number || ''}`}
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-700 hover:text-maroon-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
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

      {/* Global Audit Trail (Khusus Owner & Admin) */}
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
