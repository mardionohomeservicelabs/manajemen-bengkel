'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  crmLogs: CRMLog[];
  allCrmLogs: CRMLog[];
  vehicles: VehicleCustomer[];
  checkups: CheckupRecord[];
  refreshData: () => void;
  syncWithSupabase: () => Promise<void>;
  saveVehicleAsync: (vehicle: Omit<VehicleCustomer, 'id'> & { id?: string }) => Promise<VehicleCustomer>;
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
  updateVehiclePlateAsync: (vehicleId: string, newPlate: string) => Promise<boolean>;
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
  const [crmLogs, setCrmLogs] = useState<CRMLog[]>([]);
  const [allCrmLogs, setAllCrmLogs] = useState<CRMLog[]>([]);
  const [vehicles, setVehicles] = useState<VehicleCustomer[]>([]);
  const [checkups, setCheckups] = useState<CheckupRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(isSupabaseConfigured);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Role diambil langsung dari user yang login
  const currentRole: UserRole = currentUser?.role ?? 'sa';

  const refreshData = useCallback(() => {
    DBService.init(activeBranch);
    setSettings(DBService.getSettings(activeBranch));
    setWorkOrders(DBService.getWorkOrders(activeBranch));
    setAllWorkOrders(DBService.getAllWorkOrders());
    setInventory(DBService.getInventory(activeBranch));
    setInvoices(DBService.getInvoices(activeBranch));
    setCrmLogs(DBService.getCRMLogs(activeBranch));
    setAllCrmLogs(DBService.getAllCRMLogs());
    setVehicles(DBService.getVehicles(activeBranch));
    setCheckups(DBService.getCheckups(activeBranch));
  }, [activeBranch]);

  const syncWithSupabase = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setIsSyncing(true);
    try {
      // Flush offline queue dulu sebelum sync dari cloud
      const flushed = await DBService.flushOfflineQueue();
      if (flushed > 0) {
        console.info(`[Sync] Flushed ${flushed} offline queue entries`);
      }
      const ok = await DBService.syncFromSupabase(activeBranch);
      if (ok) {
        setIsSupabaseOnline(true);
        refreshData();
      }
    } catch {
      setIsSupabaseOnline(false);
    } finally {
      setIsSyncing(false);
      // Update jumlah pending setelah sync
      setPendingCount(DBService.getOfflineQueueCount());
    }
  }, [activeBranch, refreshData]);

  useEffect(() => {
    DBService.init(activeBranch);
    refreshData();
    syncWithSupabase();
    setPendingCount(DBService.getOfflineQueueCount());

    // 1. Sync ketika browser/HP dibuka kembali (visibility / focus)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncWithSupabase();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 2. Auto-flush queue saat koneksi internet kembali
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

    // 3. Background sync setiap 60 detik (dikurangi dari 15 detik)
    // 60 detik cukup untuk menghindari overwrite data yang sedang diedit
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncWithSupabase();
      }
    }, 60000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [activeBranch, refreshData, syncWithSupabase]);

  const updateSettings = (newSettings: Partial<WorkshopSettings>) => {
    const updated = DBService.updateSettings(newSettings, activeBranch);
    setSettings(updated);
    showToast(`Pengaturan bengkel (${activeBranch}) berhasil disimpan`, 'success');
  };

  const saveVehicleAsync = async (vehicle: Omit<VehicleCustomer, 'id'> & { id?: string }): Promise<VehicleCustomer> => {
    const saved = await DBService.saveVehicleAsync(vehicle, activeBranch);
    refreshData();
    return saved;
  };

  const saveWorkOrderAsync = async (
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string }
  ): Promise<WorkOrder> => {
    const targetBranch = (workOrder.received_at_branch as any) || activeBranch;
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

  const updateVehiclePlateAsync = async (vehicleId: string, newPlate: string): Promise<boolean> => {
    const ok = await DBService.updateVehiclePlateAsync(vehicleId, newPlate, activeBranch);
    refreshData();
    if (ok) {
      showToast(`Plat nomor berhasil diperbarui menjadi ${newPlate.toUpperCase()}`, 'success');
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
        crmLogs,
        allCrmLogs,
        vehicles,
        checkups,
        refreshData,
        syncWithSupabase,
        saveVehicleAsync,
        saveWorkOrderAsync,
        saveCheckupAsync,
        deleteCheckupAsync,
        saveInvoiceAsync,
        approveEstimationSignatureAsync,
        updateWorkOrderStatusAsync,
        unlockWorkOrderAsync,
        updateVehiclePlateAsync,
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
