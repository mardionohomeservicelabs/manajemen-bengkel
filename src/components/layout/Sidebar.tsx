'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import {
  LayoutDashboard,
  ClipboardList,
  Kanban,
  Calculator,
  Receipt,
  Package,
  History,
  MessageSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronRight,
  Shield,
  Menu,
  X,
  Lock,
  Wrench,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: ('sa' | 'admin' | 'owner')[];
  badge?: number | string;
  badgeColor?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, workOrders, inventory, crmLogs, settings } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const checkupsCount = DBService.getCheckups().length;

  const activeQueuesCount = workOrders.filter(
    (w) => w.status !== 'completed' && w.status !== 'cancelled'
  ).length;

  const lowStockCount = inventory.filter(
    (i) => !i.is_service && i.stock_qty <= i.min_stock_alert
  ).length;

  const pendingCrmCount = crmLogs.filter((c) => c.status === 'pending').length;

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner'],
    },
    {
      name: 'SPK & Intake Baru',
      href: '/spk',
      icon: <ClipboardList className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner'],
    },
    {
      name: 'General Checkup (QC & AC)',
      href: '/checkup',
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />,
      roles: ['sa', 'admin', 'owner'],
      badge: checkupsCount > 0 ? checkupsCount : undefined,
      badgeColor: 'bg-red-600 text-white',
    },
    {
      name: 'Antrean Servis',
      href: '/antrean',
      icon: <Kanban className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner'],
      badge: activeQueuesCount > 0 ? activeQueuesCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      name: 'Estimasi Biaya',
      href: '/estimasi',
      icon: <Calculator className="w-4 h-4" />,
      roles: ['admin', 'owner'],
    },
    {
      name: 'Kasir & Nota Servis',
      href: '/kasir',
      icon: <Receipt className="w-4 h-4" />,
      roles: ['admin', 'owner'],
    },
    {
      name: 'Inventaris & Sparepart',
      href: '/inventaris',
      icon: <Package className="w-4 h-4" />,
      roles: ['admin', 'owner'],
      badge: lowStockCount > 0 ? `${lowStockCount} tipis` : undefined,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      name: 'Arsip & Riwayat',
      href: '/riwayat',
      icon: <History className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner'],
    },
    {
      name: 'CRM & Reminder',
      href: '/crm',
      icon: <MessageSquare className="w-4 h-4" />,
      roles: ['admin', 'owner'],
      badge: pendingCrmCount > 0 ? pendingCrmCount : undefined,
      badgeColor: 'bg-maroon-700 text-white',
    },
    {
      name: 'Laporan & Keuangan',
      href: '/laporan',
      icon: <BarChart3 className="w-4 h-4" />,
      roles: ['owner'],
    },
    {
      name: 'Pengaturan',
      href: '/pengaturan',
      icon: <Settings className="w-4 h-4" />,
      roles: ['admin', 'owner'],
    },
  ];

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <div className="lg:hidden fixed top-3 left-3 z-40 no-print">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2.5 rounded-xl bg-maroon-900 text-white shadow-lg focus:outline-none border border-maroon-700"
          aria-label="Toggle Menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-30 lg:hidden backdrop-blur-sm transition-opacity no-print"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-30 w-64 bg-slate-950 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-gradient-to-br from-maroon-950 via-maroon-900 to-slate-950">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-maroon-700 to-maroon-950 flex flex-col items-center justify-center text-white shadow-glow border-2 border-amber-400 flex-shrink-0">
            <span className="font-black text-xl tracking-tighter text-amber-300">M</span>
            <span className="text-[6px] font-black uppercase tracking-widest text-white -mt-1">
              HOME
            </span>
          </div>
          <div className="overflow-hidden">
            <h1 className="font-black text-white text-sm tracking-tight truncate uppercase">
              MARDIONO
            </h1>
            <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider -mt-0.5">
              Home Service
            </div>
            <div className="text-[9px] text-slate-400 font-medium truncate">
              Engine • AC • Understeel
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pb-1">
            Menu Operasional
          </div>

          {navItems.map((item) => {
            const isAccessible = item.roles.includes(currentRole);
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            if (!isAccessible) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed opacity-50 bg-slate-900/40"
                  title={`Khusus role: ${item.roles.join(', ').toUpperCase()}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-600">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <Lock className="w-3 h-3 text-slate-500" />
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 group ${
                  isActive
                    ? 'bg-maroon-700 text-white shadow-md border border-maroon-600'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-maroon-400'
                    } transition-colors`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        item.badgeColor || 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-300" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Role Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-maroon-900 border border-maroon-700 flex items-center justify-center text-amber-300 font-black text-xs flex-shrink-0">
                {currentRole === 'owner' ? 'OW' : currentRole === 'admin' ? 'AD' : 'SA'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {currentRole === 'owner'
                    ? 'Budi Santoso'
                    : currentRole === 'admin'
                    ? 'Siti Rahmawati'
                    : 'Eko Prasetyo'}
                </div>
                <div className="text-[10px] text-maroon-400 uppercase tracking-wider font-extrabold">
                  Role: {currentRole.toUpperCase()}
                </div>
              </div>
            </div>
            <Shield className="w-4 h-4 text-maroon-500 flex-shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
}
