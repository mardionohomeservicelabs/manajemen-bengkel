'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserRole,
  WorkshopSettings,
  WorkOrder,
  InventoryItem,
  Invoice,
  CRMLog,
  VehicleCustomer,
} from '../types/database';
import { DBService } from '../services/db-service';
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
  refreshData: () => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type'], title?: string) => void;
  removeToast: (id: string) => void;
  isSupabaseOnline: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<WorkshopSettings>(DBService.getSettings());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [crmLogs, setCrmLogs] = useState<CRMLog[]>([]);
  const [vehicles, setVehicles] = useState<VehicleCustomer[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseOnline] = useState<boolean>(false);

  // Role diambil langsung dari user yang login
  const currentRole: UserRole = currentUser?.role ?? 'sa';

  const refreshData = () => {
    DBService.init();
    setSettings(DBService.getSettings());
    setWorkOrders(DBService.getWorkOrders());
    setInventory(DBService.getInventory());
    setInvoices(DBService.getInvoices());
    setCrmLogs(DBService.getCRMLogs());
    setVehicles(DBService.getVehicles());
  };

  useEffect(() => {
    DBService.init();
    refreshData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = (newSettings: Partial<WorkshopSettings>) => {
    const updated = DBService.updateSettings(newSettings);
    setSettings(updated);
    showToast('Pengaturan bengkel berhasil disimpan', 'success');
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
        refreshData,
        toasts,
        showToast,
        removeToast,
        isSupabaseOnline,
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
