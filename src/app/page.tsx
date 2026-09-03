'use client';

import React from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
} from '@/lib/utils';
import {
  Car,
  ClipboardList,
  Receipt,
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Sparkles,
  Shield,
  MessageSquare,
  Wrench,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentRole, workOrders, inventory, invoices, crmLogs, settings } = useApp();
  const checkups = DBService.getCheckups();

  // Metrics
  const activeQueues = workOrders.filter(
    (w) => w.status !== 'completed' && w.status !== 'cancelled'
  );
  const completedToday = workOrders.filter((w) => w.status === 'completed');

  const paidInvoices = invoices.filter((i) => i.type === 'invoice' && i.payment_status === 'paid');
  const totalRevenue = paidInvoices.reduce((acc, i) => acc + (i.total_amount || 0), 0);

  // Profit calculation (Owner only)
  const totalCost = paidInvoices.reduce((acc, inv) => {
    const invCost = inv.items.reduce((sum, item) => {
      const buyPrice = item.buy_price || 0;
      return sum + buyPrice * item.qty;
    }, 0);
    return acc + invCost;
  }, 0);
  const grossProfit = totalRevenue - totalCost;

  const lowStockItems = inventory.filter(
    (i) => !i.is_service && i.stock_qty <= i.min_stock_alert
  );

  const pendingCrm = crmLogs.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Card with Prominent Maroon & User Motto */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-800 text-white p-6 sm:p-8 shadow-elevated border border-maroon-700">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="inline-flex items-center space-x-2 bg-black/30 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Mode Aktif:{' '}
                <strong className="text-white uppercase font-black">
                  {currentRole === 'owner'
                    ? 'Owner (Akses Penuh)'
                    : currentRole === 'admin'
                    ? 'Admin Kasir & Operasional'
                    : currentRole === 'estimator'
                    ? 'Estimator & Operasional'
                    : currentRole === 'mekanik'
                    ? 'Mekanik Servis'
                    : 'Service Advisor (SA)'}
                </strong>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase drop-shadow-sm">
                {settings.name}
              </h1>
              <p className="text-xs font-bold tracking-widest text-amber-300 uppercase mt-0.5">
                {settings.tagline || 'Engine • Tune Up • AC Mobil • Understeel • Electrical'}
              </p>
            </div>

            {/* User Requested Motto */}
            <div className="p-3 bg-black/20 rounded-xl border border-white/10 max-w-2xl">
              <p className="text-xs sm:text-sm font-semibold text-slate-100 italic leading-relaxed">
                "Setiap pekerjaan yang selesai adalah langkah menuju pelanggan yang lebih puas dan bengkel yang lebih berkembang."
              </p>
            </div>
          </div>

          {/* Quick Action CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/spk/new"
              className="inline-flex items-center justify-center space-x-2 bg-white text-maroon-950 hover:bg-slate-100 font-black text-xs px-4 py-3 rounded-xl shadow-lg transition transform active:scale-95 border border-white"
            >
              <PlusCircle className="w-4 h-4 text-maroon-700" />
              <span>+ Intake SPK Baru</span>
            </Link>
            <Link
              href="/checkup/new"
              className="inline-flex items-center justify-center space-x-2 bg-amber-400 hover:bg-amber-300 text-maroon-950 font-black text-xs px-4 py-3 rounded-xl shadow-lg transition transform active:scale-95 border border-amber-300"
            >
              <ShieldCheck className="w-4 h-4 text-maroon-900" />
              <span>+ General Checkup</span>
            </Link>
          </div>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-1/2 w-48 h-48 bg-maroon-600/30 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Antrean Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Antrean Servis Aktif
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">{activeQueues.length} Kendaraan</div>
            <p className="text-[11px] text-slate-500 font-semibold flex items-center space-x-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>{completedToday.length} unit selesai</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Car className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Total Pendapatan / Billing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {currentRole === 'owner' ? 'Total Omzet (Lunas)' : 'Transaksi Selesai'}
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {currentRole === 'sa'
                ? `${paidInvoices.length} Nota`
                : formatCurrency(totalRevenue)}
            </div>
            <p className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{paidInvoices.length} transaksi lunas</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Sparepart Tipis */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Peringatan Stok Tipis
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {lowStockItems.length} Item
            </div>
            <p className="text-[11px] text-slate-500 font-bold">
              {lowStockItems.length > 0 ? (
                <span className="text-red-700 font-black">Perlu segera restock</span>
              ) : (
                <span className="text-emerald-700">Stok inventaris aman</span>
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: General Checkup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              General Checkup
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {checkups.length} Dokumen
            </div>
            <p className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-maroon-700" />
              <span>QC & AC Specialist</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-maroon-50 text-maroon-800 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Owner Specific Financial Summary (If Owner) */}
      {currentRole === 'owner' && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-maroon-700" />
              <h3 className="font-black text-sm text-slate-900">
                Ringkasan Laba & Performa Keuangan (Khusus Owner)
              </h3>
            </div>
            <Link
              href="/laporan"
              className="text-xs font-bold text-maroon-700 hover:text-maroon-900 flex items-center space-x-1"
            >
              <span>Lihat Laporan Lengkap</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Total Pendapatan (Omzet)</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-1">
                {formatCurrency(totalRevenue)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Estimasi HPP (Modal Part)</span>
              <div className="text-xl font-black text-slate-700 font-mono mt-1">
                {formatCurrency(totalCost)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-800 font-bold">Estimasi Laba Kotor (Gross Profit)</span>
              <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                {formatCurrency(grossProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Work Orders */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-4 h-4 text-maroon-700" />
                <h3 className="font-black text-sm text-slate-900">
                  Daftar SPK & Pengerjaan Terkini
                </h3>
              </div>
              <Link
                href="/spk"
                className="text-xs font-bold text-maroon-700 hover:text-maroon-900 flex items-center space-x-1"
              >
                <span>Semua SPK</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {workOrders.slice(0, 5).map((order) => {
                const vehicle = order.vehicle;
                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-xs font-mono text-maroon-900 bg-maroon-100/70 px-2 py-0.5 rounded border border-maroon-200">
                          {order.spk_number}
                        </span>
                        <span className="font-black text-xs text-slate-900">
                          {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-bold text-slate-800">
                          {vehicle?.car_brand} {vehicle?.car_model}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                        <strong>Keluhan:</strong> {order.complaints}
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-medium">
                        <span>Pelanggan: {vehicle?.customer_name}</span>
                        <span>•</span>
                        <span>Mekanik: {order.mechanic_name || '-'}</span>
                        <span>•</span>
                        <span>{formatDateTime(order.entry_date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      <Link
                        href={`/spk?id=${order.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-maroon-50 hover:bg-maroon-100 text-maroon-800 text-xs font-bold transition border border-maroon-200"
                      >
                        <span>Cetak SPK</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Shortcuts */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-3 mb-3 border-b border-slate-100">
              Akses Cepat Modul
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/spk/new"
                className="p-3 rounded-xl bg-slate-50 hover:bg-maroon-50 border border-slate-200 hover:border-maroon-300 transition group text-left"
              >
                <PlusCircle className="w-5 h-5 text-maroon-700 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-maroon-900">Intake SPK</div>
                <div className="text-[10px] text-slate-500 font-medium">Input & 3 TTD Digital</div>
              </Link>

              <Link
                href="/checkup"
                className="p-3 rounded-xl bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 transition group text-left"
              >
                <ShieldCheck className="w-5 h-5 text-red-600 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-red-900">Checkup QC/AC</div>
                <div className="text-[10px] text-slate-500 font-medium">Formulir 23 Titik & AC</div>
              </Link>

              <Link
                href="/antrean"
                className="p-3 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 transition group text-left"
              >
                <Car className="w-5 h-5 text-amber-600 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-amber-900">Antrean Servis</div>
                <div className="text-[10px] text-slate-500 font-medium">Board Pengerjaan</div>
              </Link>

              <Link
                href="/estimasi"
                className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition group text-left"
              >
                <TrendingUp className="w-5 h-5 text-blue-600 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-blue-900">Estimasi Biaya</div>
                <div className="text-[10px] text-slate-500 font-medium">+ Jasa/Part Kustom</div>
              </Link>

              <Link
                href="/kasir"
                className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition group text-left"
              >
                <Receipt className="w-5 h-5 text-emerald-600 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-emerald-900">Kasir & Nota</div>
                <div className="text-[10px] text-slate-500 font-medium">A4 & Struk Thermal</div>
              </Link>

              <Link
                href="/crm"
                className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 transition group text-left"
              >
                <MessageSquare className="w-5 h-5 text-purple-600 mb-1.5" />
                <div className="font-black text-xs text-slate-900 group-hover:text-purple-900">CRM Reminder</div>
                <div className="text-[10px] text-slate-500 font-medium">WhatsApp 1-Klik</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
