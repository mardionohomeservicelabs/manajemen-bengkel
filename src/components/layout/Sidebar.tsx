'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { BRANCHES, BranchId, ROLE_LABELS } from '@/lib/auth/users';
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
  LogOut,
  Building2,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw,
  UploadCloud,
  CloudOff,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: ('sa' | 'admin' | 'owner' | 'mekanik' | 'estimator')[];
  badge?: number | string;
  badgeColor?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, workOrders, inventory, crmLogs, isSupabaseOnline, isSyncing, pendingCount, flushOfflineQueue, syncWithSupabase } = useApp();
  const { currentUser, activeBranch, setActiveBranch, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

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
      roles: ['sa', 'admin', 'owner', 'estimator'],
    },
    {
      name: 'SPK & Intake Baru',
      href: '/spk',
      icon: <ClipboardList className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner', 'estimator'],
    },
    {
      name: 'Checklist Quality Control (Tune Up & AC)',
      href: '/checkup',
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />,
      roles: ['sa', 'admin', 'owner', 'mekanik', 'estimator'],
      badge: checkupsCount > 0 ? checkupsCount : undefined,
      badgeColor: 'bg-red-600 text-white',
    },
    {
      name: 'Antrean Servis',
      href: '/antrean',
      icon: <Kanban className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner', 'estimator'],
      badge: activeQueuesCount > 0 ? activeQueuesCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      name: 'Estimasi Biaya',
      href: '/estimasi',
      icon: <Calculator className="w-4 h-4" />,
      roles: ['admin', 'owner', 'estimator'],
    },
    {
      name: 'Kasir & Nota Servis',
      href: '/kasir',
      icon: <Receipt className="w-4 h-4" />,
      roles: ['admin', 'owner', 'estimator'],
    },
    {
      name: 'Inventaris & Sparepart',
      href: '/inventaris',
      icon: <Package className="w-4 h-4" />,
      roles: ['admin', 'owner', 'estimator'],
      badge: lowStockCount > 0 ? `${lowStockCount} tipis` : undefined,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      name: 'Arsip & Riwayat',
      href: '/riwayat',
      icon: <History className="w-4 h-4" />,
      roles: ['sa', 'admin', 'owner', 'estimator'],
    },
    {
      name: 'CRM & Reminder',
      href: '/crm',
      icon: <MessageSquare className="w-4 h-4" />,
      roles: ['admin', 'owner', 'estimator'],
      badge: pendingCrmCount > 0 ? pendingCrmCount : undefined,
      badgeColor: 'bg-maroon-700 text-white',
    },
    {
      name: 'Laporan & Keuangan',
      href: '/laporan',
      icon: <BarChart3 className="w-4 h-4" />,
      roles: ['owner', 'estimator'],
    },
    {
      name: 'Pengaturan',
      href: '/pengaturan',
      icon: <Settings className="w-4 h-4" />,
      roles: ['admin', 'owner'],
    },
  ];

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const brandHeader = (
    <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-gradient-to-br from-maroon-950 via-maroon-900 to-slate-950">
      {/* Logo Perisai */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-shield.png"
        alt="Mardiono Home Service"
        width={44}
        height={44}
        className="flex-shrink-0 drop-shadow-lg"
        style={{
          width: '44px',
          height: '44px',
          objectFit: 'contain',
          objectPosition: 'center',
          mixBlendMode: 'screen',
        }}
      />
      <div className="overflow-hidden">
        <h1 className="font-black text-white text-sm tracking-tight truncate uppercase">
          MARDIONO
        </h1>
        <div className="text-[11px] text-white font-black uppercase tracking-wider -mt-0.5">
          Home Service
        </div>
        <div className="text-[9px] text-slate-300 font-medium truncate">
          Engine • AC • Understeel
        </div>
      </div>
    </div>
  );

  // Filter menu navigasi sesuai role user
  const displayedNavItems =
    currentRole === 'mekanik'
      ? navItems.filter((item) => item.roles.includes('mekanik'))
      : navItems;

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
        {/* Brand Header — selalu muncul termasuk di mobile */}
        {brandHeader}

        {/* Cabang Selector (Owner only) */}
        {currentUser?.canAccessAllBranches && (
          <div className="px-3 py-2 border-b border-slate-800">
            <button
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-maroon-700 transition text-xs font-bold text-white"
            >
              <div className="flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Cabang: <span className="text-amber-300">{activeBranch}</span></span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBranchDropdownOpen && (
              <div className="mt-1.5 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                {BRANCHES.map((branch: BranchId) => (
                  <button
                    key={branch}
                    onClick={() => {
                      setActiveBranch(branch);
                      setIsBranchDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold transition ${
                      activeBranch === branch
                        ? 'bg-maroon-900 text-amber-300 border-l-2 border-amber-400'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pb-1">
            {currentRole === 'mekanik' ? 'Modul Mekanik' : 'Menu Operasional'}
          </div>

          {displayedNavItems.map((item) => {
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
                    <span className="leading-tight">{item.name}</span>
                  </div>
                  <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
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
                <div className="flex items-center space-x-3 min-w-0">
                  <span
                    className={`${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-maroon-400'
                    } transition-colors flex-shrink-0`}
                  >
                    {item.icon}
                  </span>
                  <span className="leading-tight truncate">{item.name}</span>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
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

        {/* User Role Card + Cabang Info + Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
          {/* User Info */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-maroon-900 border border-maroon-700 flex items-center justify-center text-amber-300 font-black text-xs flex-shrink-0">
                {currentRole === 'owner' ? 'OW' : currentRole === 'admin' ? 'AD' : currentRole === 'estimator' ? 'VR' : currentRole === 'mekanik' ? 'MK' : 'SA'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser?.full_name || 'Pengguna'}
                </div>
                <div className="text-[10px] text-maroon-400 uppercase tracking-wider font-extrabold">
                  {ROLE_LABELS[currentRole]} • {activeBranch}
                </div>
              </div>
            </div>
            <Shield className="w-4 h-4 text-maroon-500 flex-shrink-0" />
          </div>

          {/* Sync Status Indicator */}
          <div
            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              !isSupabaseOnline
                ? 'bg-red-950/50 border-red-800/60 text-red-400'
                : pendingCount > 0
                ? 'bg-amber-950/50 border-amber-700/60 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {!isSupabaseOnline ? (
                <><CloudOff className="w-3.5 h-3.5" /><span>Offline</span></>
              ) : pendingCount > 0 ? (
                <><UploadCloud className="w-3.5 h-3.5" /><span>{pendingCount} pending</span></>
              ) : (
                <><Wifi className="w-3.5 h-3.5" /><span>Tersinkron</span></>
              )}
            </div>
            <button
              onClick={async () => {
                if (isFlushing || isSyncing) return;
                setIsFlushing(true);
                try {
                  if (pendingCount > 0) {
                    await flushOfflineQueue();
                  } else {
                    await syncWithSupabase();
                  }
                } finally {
                  setIsFlushing(false);
                }
              }}
              title={pendingCount > 0 ? 'Kirim data pending ke server' : 'Sync ulang dari server'}
              className="hover:text-white transition-colors disabled:opacity-40"
              disabled={isFlushing || isSyncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(isFlushing || isSyncing) ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 text-xs font-bold transition group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:text-red-400" />
            <span>Keluar / Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
