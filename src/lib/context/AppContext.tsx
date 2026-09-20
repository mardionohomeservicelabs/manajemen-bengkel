'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  UserRole,
  WorkshopSettings,
  WorkOrder,
  InventoryItem,
  Invoice,
  CRMLog,
  VehicleCustomer,
  CheckupRecord,
  WorkOrderStatus,
} from '../types/database';
import { DBService } from '../services/db-service';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { useAuth } from './AuthContext';
import { BranchId } from '../auth/users';
import { resolveWorkOrderBranch } from '../utils';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface AppContextType {
  currentRole: UserRole;
  settings: WorkshopSettings;
  updateSettings: (newSettings: Partial<WorkshopSettings>) => void;
  workOrders: WorkOrder[];
  allWorkOrders: WorkOrder[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  allInvoices: Invoice[];
  crmLogs: CRMLog[];
  allCrmLogs: CRMLog[];
  vehicles: VehicleCustomer[];
  checkups: CheckupRecord[];
  refreshData: () => void;
  syncWithSupabase: (force?: boolean) => Promise<void>;
  generateUniqueSpkNumberAsync: (branch?: BranchId | string) => Promise<string>;
  generateUniqueInvoiceNumberAsync: (type?: 'invoice' | 'estimation', branch?: BranchId | string) => Promise<string>;
  saveVehicleAsync: (vehicle: Omit<VehicleCustomer, 'id'> & { id?: string }, branch?: BranchId) => Promise<VehicleCustomer>;
  saveWorkOrderAsync: (workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string }) => Promise<WorkOrder>;
  saveCheckupAsync: (checkup: Omit<CheckupRecord, 'id'> & { id?: string }) => Promise<CheckupRecord>;
  deleteCheckupAsync: (id: string) => Promise<boolean>;
  saveInvoiceAsync: (invoice: Omit<Invoice, 'id'> & { id?: string }) => Promise<Invoice>;
  approveEstimationSignatureAsync: (
    idOrToken: string,
    signatureDataUrl: string,
    customerName: string,
    approvedOption: 'opsi1' | 'opsi2'
  ) => Promise<Invoice | null>;
  updateWorkOrderStatusAsync: (id: string, status: WorkOrderStatus) => Promise<boolean>;
  unlockWorkOrderAsync: (id: string, targetStatus?: WorkOrderStatus) => Promise<boolean>;
  deleteWorkOrderAsync: (id: string) => Promise<boolean>;
  deleteInvoiceAsync: (invoiceId: string) => Promise<boolean>;
  deleteVehicleArchiveAsync: (params: {
    workOrderId?: string;
    invoiceId?: string;
    spkNumber?: string;
    licensePlate?: string;
    customerName?: string;
  }) => Promise<boolean>;
  updateVehiclePlateAsync: (vehicleId: string, newPlate: string) => Promise<boolean>;
  deleteInventoryItem: (id: string) => boolean;
  clearBranchInventory: () => boolean;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type'], title?: string) => void;
  removeToast: (id: string) => void;
  isSupabaseOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  flushOfflineQueue: () => Promise<number>;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeBranch } = useAuth();
  const [settings, setSettings] = useState<WorkshopSettings>(DBService.getSettings(activeBranch));
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [crmLogs, setCrmLogs] = useState<CRMLog[]>([]);
  const [allCrmLogs, setAllCrmLogs] = useState<CRMLog[]>([]);
  const [vehicles, setVehicles] = useState<VehicleCustomer[]>([]);
  const [checkups, setCheckups] = useState<CheckupRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(isSupabaseConfigured);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Ref untuk channel Realtime aktif (supaya bisa di-cleanup saat cabang berubah)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Role diambil langsung dari user yang login
  const currentRole: UserRole = currentUser?.role ?? 'sa';

  const refreshData = useCallback(() => {
    DBService.init(activeBranch);
    setSettings(DBService.getSettings(activeBranch));
    setWorkOrders(DBService.getWorkOrders(activeBranch));
    setAllWorkOrders(DBService.getAllWorkOrders());
    setInventory(DBService.getInventory(activeBranch));
    setInvoices(DBService.getInvoices(activeBranch));
    setAllInvoices(DBService.getAllInvoices());
    setCrmLogs(DBService.getCRMLogs(activeBranch));
    setAllCrmLogs(DBService.getAllCRMLogs());
    setVehicles(DBService.getVehicles(activeBranch));
    setCheckups(DBService.getCheckups(activeBranch));
  }, [activeBranch]);

  const lastSyncTimestampRef = useRef<Record<string, number>>({});

  const syncWithSupabase = useCallback(async (force = false) => {
    if (!supabase || !isSupabaseConfigured) return;
    const now = Date.now();
    const lastSync = lastSyncTimestampRef.current[activeBranch] || 0;
    // Jeda 10 detik antar-sync untuk cabang yang sama kecuali jika force atau cabang baru dibuka
    if (!force && now - lastSync < 10000) {
      return;
    }
    lastSyncTimestampRef.current[activeBranch] = now;

    setIsSyncing(true);
    try {
      // Flush offline queue dulu sebelum sync dari cloud
      const flushed = await DBService.flushOfflineQueue();
      if (flushed > 0) {
        console.info(`[Sync] Flushed ${flushed} offline queue entries`);
      }
      const ok = await DBService.syncFromSupabase(activeBranch, force);
      if (ok) {
        setIsSupabaseOnline(true);
        refreshData();
      }
    } catch {
      setIsSupabaseOnline(false);
    } finally {
      setIsSyncing(false);
      setPendingCount(DBService.getOfflineQueueCount());
    }
  }, [activeBranch, refreshData]);

  // ─── SUPABASE REALTIME WEBSOCKET ──────────────────────────────────────────
  // Berlangganan perubahan data secara instan dari perangkat lain via WebSocket.
  // Setiap event INSERT / UPDATE / DELETE dari Supabase akan langsung diproses
  // dan menyinkronkan localStorage serta state React tanpa polling.
  // PENTING: Debounce digunakan agar Realtime event dari device SENDIRI tidak
  // menciptakan race condition dengan operasi save lokal yang baru saja dilakukan.
  const lastLocalSaveRef = useRef<number>(0);
  const realtimeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: jadwalkan sync dari Supabase dengan debounce 1.5 detik
  // Ini memastikan bahwa jika device ini baru saja menyimpan data lokal (dalam 3 detik terakhir),
  // Realtime event dari device sendiri tidak langsung menimpa data lokal yang fresh.
  const scheduleDebouncedSync = useCallback((
    tables: ('work_orders' | 'invoices' | 'vehicles' | 'all')[]
  ) => {
    // Kurangi jeda debounce menjadi sangat responsif (80ms - 300ms)
    const timeSinceLastSave = Date.now() - lastLocalSaveRef.current;
    const delay = timeSinceLastSave < 1000 ? 300 : 80;

    if (realtimeSyncTimerRef.current) {
      clearTimeout(realtimeSyncTimerRef.current);
    }
    realtimeSyncTimerRef.current = setTimeout(async () => {
      await DBService.syncFromSupabase(activeBranch);
      refreshData();
    }, delay);
  }, [activeBranch, refreshData]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    // Non-null narrowing: supabase sudah dipastikan not-null di atas
    const supabaseClient = supabase;

    // Tutup channel lama jika sudah ada (misalnya saat cabang berganti)
    if (realtimeChannelRef.current) {
      supabaseClient.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channelName = `acwms-realtime-${activeBranch.replace(/\s/g, '_')}-${Date.now()}`;

    const channel = supabaseClient
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      // ── 1. WORK ORDERS (SPK) — INSTANT REALTIME (0ms delay, 0 Egress) ────
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const row: any = event === 'DELETE' ? payload.old : payload.new;
          console.info(`[Realtime] work_orders ${event}:`, row?.spk_number || row?.id, row?.status);
          DBService.applyRealtimeWorkOrderUpdate(event, row);
          refreshData();
        }
      )
      // ── 2. INVOICES & ESTIMASI — INSTANT REALTIME (0ms delay, 0 Egress) ──
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const row: any = event === 'DELETE' ? payload.old : payload.new;
          console.info(`[Realtime] invoices ${event}:`, row?.invoice_number || row?.id, row?.payment_status);
          DBService.applyRealtimeInvoiceUpdate(event, row);
          refreshData();
        }
      )
      // ── 3. VEHICLES & CUSTOMERS ────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles_customers' },
        (payload) => {
          console.info('[Realtime] vehicles_customers change:', payload.eventType, (payload.new as any)?.license_plate);
          refreshData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info(`[Realtime] ✅ Channel "${channelName}" terhubung. Sinkronisasi real-time aktif.`);
          setIsSupabaseOnline(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[Realtime] ⚠️ Channel "${channelName}" status: ${status}. Menjadwalkan reconnect...`);
          setIsSupabaseOnline(false);
          setTimeout(() => {
            if (supabaseClient && realtimeChannelRef.current) {
              realtimeChannelRef.current.subscribe();
            }
          }, 3000);
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeSyncTimerRef.current) clearTimeout(realtimeSyncTimerRef.current);
      if (realtimeChannelRef.current) {
        supabaseClient.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
        console.info(`[Realtime] Channel "${channelName}" dibersihkan.`);
      }
    };
  }, [activeBranch, refreshData]);

  // ─── SYNC TAMBAHAN & FALLBACK ─────────────────────────────────────────────
  useEffect(() => {
    DBService.init(activeBranch);
    refreshData();
    // Initial sync sekali saat aplikasi pertama dibuka (force fresh cloud data)
    syncWithSupabase(true);
    setPendingCount(DBService.getOfflineQueueCount());

    // Auto-flush queue saat koneksi internet kembali online
    const handleOnline = async () => {
      setIsSupabaseOnline(true);
      console.info('[Network] Kembali online — flushing offline queue...');
      const flushed = await DBService.flushOfflineQueue();
      setPendingCount(DBService.getOfflineQueueCount());
      if (flushed > 0) {
        refreshData();
      }
    };
    const handleOffline = () => {
      setIsSupabaseOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeBranch, refreshData, syncWithSupabase]);

  const updateSettings = (newSettings: Partial<WorkshopSettings>) => {
    const updated = DBService.updateSettings(newSettings, activeBranch);
    setSettings(updated);
    showToast(`Pengaturan bengkel (${activeBranch}) berhasil disimpan`, 'success');
  };

  const saveVehicleAsync = async (
    vehicle: Omit<VehicleCustomer, 'id'> & { id?: string },
    branch?: BranchId
  ): Promise<VehicleCustomer> => {
    const targetBranch = branch || activeBranch;
    const saved = await DBService.saveVehicleAsync(vehicle, targetBranch);
    refreshData();
    return saved;
  };

  const generateUniqueSpkNumberAsync = useCallback(async (branch?: BranchId | string): Promise<string> => {
    return await DBService.generateUniqueSpkNumberAsync(branch || activeBranch);
  }, [activeBranch]);

  const generateUniqueInvoiceNumberAsync = useCallback(async (type?: 'invoice' | 'estimation', branch?: BranchId | string): Promise<string> => {
    return await DBService.generateUniqueInvoiceNumberAsync(type || 'invoice', branch || activeBranch);
  }, [activeBranch]);

  const saveWorkOrderAsync = async (
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string }
  ): Promise<WorkOrder> => {
    const targetBranch = resolveWorkOrderBranch(workOrder, (workOrder.received_at_branch as any) || activeBranch);
    const saved = await DBService.saveWorkOrderAsync(workOrder, targetBranch);
    refreshData();
    return saved;
  };

  const saveCheckupAsync = async (checkup: Omit<CheckupRecord, 'id'> & { id?: string }): Promise<CheckupRecord> => {
    const saved = await DBService.saveCheckupAsync(checkup, activeBranch);
    refreshData();
    return saved;
  };

  const deleteCheckupAsync = async (id: string): Promise<boolean> => {
    const ok = await DBService.deleteCheckupAsync(id, activeBranch);
    refreshData();
    return ok;
  };

  const saveInvoiceAsync = async (invoice: Omit<Invoice, 'id'> & { id?: string }): Promise<Invoice> => {
    const saved = await DBService.saveInvoiceAsync(invoice, activeBranch);
    refreshData();
    return saved;
  };

  const approveEstimationSignatureAsync = async (
    idOrToken: string,
    signatureDataUrl: string,
    customerName: string,
    approvedOption: 'opsi1' | 'opsi2'
  ): Promise<Invoice | null> => {
    const updated = await DBService.approveEstimationSignature(
      idOrToken,
      signatureDataUrl,
      customerName,
      approvedOption,
      activeBranch
    );
    refreshData();
    return updated;
  };

  const updateWorkOrderStatusAsync = async (id: string, status: WorkOrderStatus): Promise<boolean> => {
    const ok = await DBService.updateWorkOrderStatusAsync(id, status, currentRole, activeBranch);
    refreshData();
    return ok;
  };

  const unlockWorkOrderAsync = async (id: string, targetStatus: WorkOrderStatus = 'servicing'): Promise<boolean> => {
    const ok = await DBService.unlockWorkOrderAsync(id, targetStatus, currentRole, activeBranch);
    refreshData();
    if (ok) {
      showToast('Kunci pekerjaan SPK berhasil dibuka oleh Owner!', 'success');
    }
    return ok;
  };

  const deleteWorkOrderAsync = async (id: string): Promise<boolean> => {
    const ok = await DBService.deleteWorkOrderAsync(id, currentRole, activeBranch);
    refreshData();
    if (ok) {
      showToast('SPK berhasil dihapus dari sistem oleh Owner!', 'success');
    }
    return ok;
  };

  const deleteInvoiceAsync = async (invoiceId: string): Promise<boolean> => {
    if (currentRole !== 'owner') {
      showToast('Akses ditolak: Hanya peran Owner yang berhak menghapus nota/invoice.', 'error');
      return false;
    }
    const ok = await DBService.deleteInvoiceAsync(invoiceId, currentRole, activeBranch);
    refreshData();
    if (ok) {
      showToast('Nota transaksi berhasil dihapus oleh Owner!', 'success');
    }
    return ok;
  };

  const deleteVehicleArchiveAsync = async (params: {
    workOrderId?: string;
    invoiceId?: string;
    spkNumber?: string;
    licensePlate?: string;
    customerName?: string;
  }): Promise<boolean> => {
    if (currentRole !== 'owner') {
      showToast('Akses ditolak: Hanya peran Owner yang berhak menghapus data dari arsip.', 'error');
      return false;
    }
    const ok = await DBService.deleteVehicleArchiveAsync({
      ...params,
      userRole: currentRole,
      branch: activeBranch,
    });
    refreshData();
    if (ok) {
      showToast('Data mobil dan seluruh berkas arsip berhasil dihapus permanen oleh Owner!', 'success');
    } else {
      showToast('Gagal menghapus data arsip mobil.', 'error');
    }
    return ok;
  };

  const updateVehiclePlateAsync = async (vehicleId: string, newPlate: string): Promise<boolean> => {
    const ok = await DBService.updateVehiclePlateAsync(vehicleId, newPlate, activeBranch);
    refreshData();
    if (ok) {
      showToast(`Plat nomor berhasil diperbarui menjadi ${newPlate.toUpperCase()}`, 'success');
    }
    return ok;
  };

  const deleteInventoryItem = (id: string): boolean => {
    const ok = DBService.deleteInventoryItem(id, currentRole, activeBranch);
    if (ok) {
      refreshData();
      showToast('Item suku cadang berhasil dihapus', 'success');
    }
    return ok;
  };

  const clearBranchInventory = (): boolean => {
    const ok = DBService.clearBranchInventory(activeBranch, currentRole);
    if (ok) {
      refreshData();
      showToast(`Seluruh item inventaris ${activeBranch} berhasil dikosongkan`, 'success');
    }
    return ok;
  };

  const showToast = (message: string, type: ToastMessage['type'] = 'info', title?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastMessage = { id, message, type, title };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const flushOfflineQueue = async (): Promise<number> => {
    const count = await DBService.flushOfflineQueue();
    setPendingCount(DBService.getOfflineQueueCount());
    if (count > 0) {
      refreshData();
      showToast(`${count} data berhasil disinkronkan ke server`, 'success');
    }
    return count;
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        settings,
        updateSettings,
        workOrders,
        allWorkOrders,
        inventory,
        invoices,
        allInvoices,
        crmLogs,
        allCrmLogs,
        vehicles,
        checkups,
        refreshData,
        syncWithSupabase,
        generateUniqueSpkNumberAsync,
        generateUniqueInvoiceNumberAsync,
        saveVehicleAsync,
        saveWorkOrderAsync,
        saveCheckupAsync,
        deleteCheckupAsync,
        saveInvoiceAsync,
        approveEstimationSignatureAsync,
        updateWorkOrderStatusAsync,
        unlockWorkOrderAsync,
        deleteWorkOrderAsync,
        deleteInvoiceAsync,
        deleteVehicleArchiveAsync,
        updateVehiclePlateAsync,
        deleteInventoryItem,
        clearBranchInventory,
        toasts,
        showToast,
        removeToast,
        isSupabaseOnline,
        isSyncing,
        pendingCount,
        flushOfflineQueue,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
