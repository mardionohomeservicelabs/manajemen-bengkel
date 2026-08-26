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
  inventory: InventoryItem[];
  invoices: Invoice[];
  crmLogs: CRMLog[];
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
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type'], title?: string) => void;
  removeToast: (id: string) => void;
  isSupabaseOnline: boolean;
  isSyncing: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeBranch } = useAuth();
  const [settings, setSettings] = useState<WorkshopSettings>(DBService.getSettings(activeBranch));
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [crmLogs, setCrmLogs] = useState<CRMLog[]>([]);
  const [vehicles, setVehicles] = useState<VehicleCustomer[]>([]);
  const [checkups, setCheckups] = useState<CheckupRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(isSupabaseConfigured);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Role diambil langsung dari user yang login
  const currentRole: UserRole = currentUser?.role ?? 'sa';

  const refreshData = useCallback(() => {
    DBService.init(activeBranch);
    setSettings(DBService.getSettings(activeBranch));
    setWorkOrders(DBService.getWorkOrders(activeBranch));
    setInventory(DBService.getInventory(activeBranch));
    setInvoices(DBService.getInvoices(activeBranch));
    setCrmLogs(DBService.getCRMLogs(activeBranch));
    setVehicles(DBService.getVehicles(activeBranch));
    setCheckups(DBService.getCheckups(activeBranch));
  }, [activeBranch]);

  const syncWithSupabase = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setIsSyncing(true);
    try {
      const ok = await DBService.syncFromSupabase(activeBranch);
      if (ok) {
        setIsSupabaseOnline(true);
        refreshData();
      }
    } catch {
      setIsSupabaseOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, [activeBranch, refreshData]);

  useEffect(() => {
    DBService.init(activeBranch);
    refreshData();
    syncWithSupabase();
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
    const saved = await DBService.saveWorkOrderAsync(workOrder, activeBranch);
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

  return (
    <AppContext.Provider
      value={{
        currentRole,
        settings,
        updateSettings,
        workOrders,
        inventory,
        invoices,
        crmLogs,
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
        toasts,
        showToast,
        removeToast,
        isSupabaseOnline,
        isSyncing,
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
