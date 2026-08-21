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

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
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
  const [currentRole, setCurrentRoleState] = useState<UserRole>('owner');
  const [settings, setSettings] = useState<WorkshopSettings>(DBService.getSettings());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [crmLogs, setCrmLogs] = useState<CRMLog[]>([]);
  const [vehicles, setVehicles] = useState<VehicleCustomer[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(false);

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
    // Initial mount
    DBService.init();
    const savedRole = localStorage.getItem('acwms_role') as UserRole;
    if (savedRole && ['owner', 'admin', 'sa'].includes(savedRole)) {
      setCurrentRoleState(savedRole);
    }
    refreshData();
  }, []);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('acwms_role', role);
    }
    const roleLabels = {
      owner: 'Owner (Akses Penuh)',
      admin: 'Admin Kasir & Estimasi',
      sa: 'Service Advisor (SA)',
    };
    showToast(`Beralih ke peran: ${roleLabels[role]}`, 'info');
  };

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
        setCurrentRole,
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
