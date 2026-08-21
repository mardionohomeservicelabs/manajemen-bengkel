import {
  VehicleCustomer,
  InventoryItem,
  WorkOrder,
  Invoice,
  CRMLog,
  WorkshopSettings,
  StockMovement,
  AuditLog,
  CheckupRecord,
  WorkOrderStatus,
  UserRole,
} from '../types/database';
import {
  initialVehicles,
  initialInventory,
  initialWorkOrders,
  initialInvoices,
  initialCRMLogs,
  initialSettings,
  initialStockMovements,
  initialAuditLogs,
  initialCheckups,
} from '../data/mock-data';

const STORAGE_KEYS = {
  VEHICLES: 'acwms_vehicles',
  INVENTORY: 'acwms_inventory',
  WORK_ORDERS: 'acwms_work_orders',
  INVOICES: 'acwms_invoices',
  CRM_LOGS: 'acwms_crm_logs',
  SETTINGS: 'acwms_settings',
  MOVEMENTS: 'acwms_stock_movements',
  AUDIT: 'acwms_audit_logs',
  CHECKUPS: 'acwms_checkups',
};

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e);
  }
}

export class DBService {
  static init(): void {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
      setLocal(STORAGE_KEYS.VEHICLES, initialVehicles);
    }
    if (!localStorage.getItem(STORAGE_KEYS.INVENTORY)) {
      setLocal(STORAGE_KEYS.INVENTORY, initialInventory);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WORK_ORDERS)) {
      setLocal(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders);
    }
    if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) {
      setLocal(STORAGE_KEYS.INVOICES, initialInvoices);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CRM_LOGS)) {
      setLocal(STORAGE_KEYS.CRM_LOGS, initialCRMLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      setLocal(STORAGE_KEYS.SETTINGS, initialSettings);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
      setLocal(STORAGE_KEYS.MOVEMENTS, initialStockMovements);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      setLocal(STORAGE_KEYS.AUDIT, initialAuditLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHECKUPS)) {
      setLocal(STORAGE_KEYS.CHECKUPS, initialCheckups);
    }
  }

  // --- SETTINGS ---
  static getSettings(): WorkshopSettings {
    const settings = getLocal<WorkshopSettings>(STORAGE_KEYS.SETTINGS, initialSettings);
    if (!settings.name || settings.name.toLowerCase().includes('autocare') || !settings.phone.includes('3076')) {
      const updated = {
        ...settings,
        name: 'MARDIONO HOME SERVICE',
        tagline: 'Engine - Tune Up - AC Mobil - Understeel - Electrical',
        phone: '0812-3076-2930',
        email: 'mardionoohomeservice@gmail.com',
        address: 'Jl. Perum Beringin Indah No.D - 19, Bringin Kulon, Bringinbendo, Taman, Sidoarjo',
        city: 'Sidoarjo',
        logo_url: '/header-banner.png',
      };
      setLocal(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    }
    return settings;
  }

  static updateSettings(settings: Partial<WorkshopSettings>): WorkshopSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };
    setLocal(STORAGE_KEYS.SETTINGS, updated);
    this.logAudit('Admin/Owner', 'owner', 'UPDATE_SETTINGS', 'workshop_settings', updated.id, updated);
    return updated;
  }

  // --- VEHICLES & CUSTOMERS ---
  static getVehicles(): VehicleCustomer[] {
    return getLocal<VehicleCustomer[]>(STORAGE_KEYS.VEHICLES, initialVehicles);
  }

  static getVehicleById(id: string): VehicleCustomer | undefined {
    return this.getVehicles().find((v) => v.id === id);
  }

  static getVehicleByPlate(plate: string): VehicleCustomer | undefined {
    const cleanPlate = plate.toUpperCase().replace(/\s+/g, '');
    return this.getVehicles().find(
      (v) => v.license_plate.toUpperCase().replace(/\s+/g, '') === cleanPlate
    );
  }

  static saveVehicle(vehicle: Omit<VehicleCustomer, 'id'> & { id?: string }): VehicleCustomer {
    const vehicles = this.getVehicles();
    let saved: VehicleCustomer;

    if (vehicle.id) {
      const idx = vehicles.findIndex((v) => v.id === vehicle.id);
      if (idx !== -1) {
        saved = { ...vehicles[idx], ...vehicle, updated_at: new Date().toISOString() };
        vehicles[idx] = saved;
      } else {
        saved = { ...vehicle, id: vehicle.id, created_at: new Date().toISOString() } as VehicleCustomer;
        vehicles.unshift(saved);
      }
    } else {
      const existing = this.getVehicleByPlate(vehicle.license_plate);
      if (existing) {
        saved = { ...existing, ...vehicle, updated_at: new Date().toISOString() };
        const idx = vehicles.findIndex((v) => v.id === existing.id);
        vehicles[idx] = saved;
      } else {
        saved = {
          ...vehicle,
          id: `veh-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as VehicleCustomer;
        vehicles.unshift(saved);
      }
    }

    setLocal(STORAGE_KEYS.VEHICLES, vehicles);
    return saved;
  }

  // --- INVENTORY & SPAREPARTS ---
  static getInventory(): InventoryItem[] {
    return getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, initialInventory);
  }

  static getInventoryById(id: string): InventoryItem | undefined {
    return this.getInventory().find((i) => i.id === id);
  }

  static saveInventoryItem(
    item: Omit<InventoryItem, 'id'> & { id?: string },
    userRole: UserRole = 'owner'
  ): InventoryItem {
    const inventory = this.getInventory();
    let saved: InventoryItem;

    if (item.id) {
      const idx = inventory.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        const oldItem = inventory[idx];
        saved = { ...oldItem, ...item, updated_at: new Date().toISOString() };
        inventory[idx] = saved;
      } else {
        saved = { ...item, id: item.id, created_at: new Date().toISOString() } as InventoryItem;
        inventory.unshift(saved);
      }
    } else {
      saved = {
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as InventoryItem;
      inventory.unshift(saved);
    }

    setLocal(STORAGE_KEYS.INVENTORY, inventory);
    return saved;
  }

  static adjustStock(
    itemId: string,
    qtyChange: number,
    movementType: StockMovement['movement_type'],
    referenceNumber?: string,
    notes?: string,
    userRole: UserRole = 'owner'
  ): boolean {
    const inventory = this.getInventory();
    const idx = inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item = inventory[idx];
    const stockBefore = item.stock_qty;
    const stockAfter = Math.max(0, stockBefore + qtyChange);

    item.stock_qty = stockAfter;
    item.updated_at = new Date().toISOString();
    inventory[idx] = item;
    setLocal(STORAGE_KEYS.INVENTORY, inventory);

    this.recordMovement({
      item_id: itemId,
      item_name: item.name,
      movement_type: movementType,
      qty_change: qtyChange,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reference_number: referenceNumber,
      notes: notes || '',
      created_at: new Date().toISOString(),
    });

    return true;
  }

  // --- STOCK MOVEMENTS ---
  static getStockMovements(): StockMovement[] {
    return getLocal<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, initialStockMovements);
  }

  static recordMovement(movement: Omit<StockMovement, 'id'>): StockMovement {
    const movements = this.getStockMovements();
    const saved: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    movements.unshift(saved);
    setLocal(STORAGE_KEYS.MOVEMENTS, movements);
    return saved;
  }

  // --- WORK ORDERS (SPK) ---
  static getWorkOrders(): WorkOrder[] {
    const orders = getLocal<WorkOrder[]>(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders);
    const vehicles = this.getVehicles();

    return orders.map((order) => ({
      ...order,
      vehicle: vehicles.find((v) => v.id === order.vehicle_id),
    }));
  }

  static getWorkOrderById(id: string): WorkOrder | undefined {
    return this.getWorkOrders().find((w) => w.id === id);
  }

  static saveWorkOrder(
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string }
  ): WorkOrder {
    const orders = getLocal<WorkOrder[]>(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders);
    let saved: WorkOrder;

    if (workOrder.id) {
      const idx = orders.findIndex((o) => o.id === workOrder.id);
      if (idx !== -1) {
        saved = {
          ...orders[idx],
          ...workOrder,
          updated_at: new Date().toISOString(),
        } as WorkOrder;
        orders[idx] = saved;
      } else {
        saved = {
          ...workOrder,
          id: workOrder.id,
          spk_number: workOrder.spk_number || `SPK-${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as WorkOrder;
        orders.unshift(saved);
      }
    } else {
      saved = {
        ...workOrder,
        id: `spk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        spk_number:
          workOrder.spk_number ||
          `SPK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
            100 + Math.random() * 900
          )}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as WorkOrder;
      orders.unshift(saved);
    }

    setLocal(STORAGE_KEYS.WORK_ORDERS, orders);
    return this.getWorkOrderById(saved.id) || saved;
  }

  static updateWorkOrderStatus(id: string, status: WorkOrderStatus, userRole: UserRole = 'sa'): boolean {
    const orders = getLocal<WorkOrder[]>(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;

    orders[idx].status = status;
    orders[idx].updated_at = new Date().toISOString();
    if (status === 'completed') {
      orders[idx].finish_date = new Date().toISOString();
    }
    setLocal(STORAGE_KEYS.WORK_ORDERS, orders);
    return true;
  }

  // --- GENERAL CHECKUPS (NEW CORE MODULE) ---
  static getCheckups(): CheckupRecord[] {
    return getLocal<CheckupRecord[]>(STORAGE_KEYS.CHECKUPS, initialCheckups);
  }

  static getCheckupById(id: string): CheckupRecord | undefined {
    return this.getCheckups().find((c) => c.id === id);
  }

  static saveCheckup(checkup: Omit<CheckupRecord, 'id'> & { id?: string }): CheckupRecord {
    const checkups = this.getCheckups();
    let saved: CheckupRecord;

    if (checkup.id) {
      const idx = checkups.findIndex((c) => c.id === checkup.id);
      if (idx !== -1) {
        saved = { ...checkups[idx], ...checkup, updated_at: new Date().toISOString() };
        checkups[idx] = saved;
      } else {
        saved = { ...checkup, id: checkup.id, created_at: new Date().toISOString() } as CheckupRecord;
        checkups.unshift(saved);
      }
    } else {
      saved = {
        ...checkup,
        id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CheckupRecord;
      checkups.unshift(saved);
    }

    setLocal(STORAGE_KEYS.CHECKUPS, checkups);
    return saved;
  }

  static deleteCheckup(id: string): boolean {
    const checkups = this.getCheckups();
    const filtered = checkups.filter((c) => c.id !== id);
    setLocal(STORAGE_KEYS.CHECKUPS, filtered);
    return true;
  }

  // --- INVOICES & ESTIMATIONS ---
  static getInvoices(): Invoice[] {
    const invoices = getLocal<Invoice[]>(STORAGE_KEYS.INVOICES, initialInvoices);
    const vehicles = this.getVehicles();
    const workOrders = this.getWorkOrders();

    return invoices.map((inv) => ({
      ...inv,
      vehicle: vehicles.find((v) => v.id === inv.vehicle_id),
      work_order: workOrders.find((w) => w.id === inv.work_order_id),
    }));
  }

  static getInvoiceById(id: string): Invoice | undefined {
    return this.getInvoices().find((i) => i.id === id);
  }

  static saveInvoice(invoice: Omit<Invoice, 'id'> & { id?: string }): Invoice {
    const invoices = getLocal<Invoice[]>(STORAGE_KEYS.INVOICES, initialInvoices);
    let saved: Invoice;

    if (invoice.id) {
      const idx = invoices.findIndex((i) => i.id === invoice.id);
      if (idx !== -1) {
        saved = { ...invoices[idx], ...invoice, updated_at: new Date().toISOString() };
        invoices[idx] = saved;
      } else {
        saved = { ...invoice, id: invoice.id, created_at: new Date().toISOString() } as Invoice;
        invoices.unshift(saved);
      }
    } else {
      saved = {
        ...invoice,
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Invoice;
      invoices.unshift(saved);
    }

    setLocal(STORAGE_KEYS.INVOICES, invoices);

    if (saved.type === 'invoice' && saved.payment_status === 'paid') {
      saved.items.forEach((item) => {
        if (!item.is_service && item.item_id) {
          this.adjustStock(
            item.item_id,
            -item.qty,
            'out_work_order',
            saved.invoice_number,
            `Penjualan via ${saved.invoice_number}`
          );
        }
      });

      if (saved.work_order_id) {
        this.updateWorkOrderStatus(saved.work_order_id, 'completed');
      }
    }

    return this.getInvoiceById(saved.id) || saved;
  }

  // --- CRM & SERVICE REMINDERS ---
  static getCRMLogs(): CRMLog[] {
    const logs = getLocal<CRMLog[]>(STORAGE_KEYS.CRM_LOGS, initialCRMLogs);
    const vehicles = this.getVehicles();
    return logs.map((log) => ({
      ...log,
      vehicle: vehicles.find((v) => v.id === log.vehicle_id),
    }));
  }

  static updateCRMStatus(id: string, status: CRMLog['status'], notes?: string): boolean {
    const logs = getLocal<CRMLog[]>(STORAGE_KEYS.CRM_LOGS, initialCRMLogs);
    const idx = logs.findIndex((l) => l.id === id);
    if (idx === -1) return false;

    logs[idx].status = status;
    logs[idx].contacted_at = new Date().toISOString();
    if (notes !== undefined) logs[idx].notes = notes;
    logs[idx].updated_at = new Date().toISOString();

    setLocal(STORAGE_KEYS.CRM_LOGS, logs);
    return true;
  }

  // --- AUDIT LOGS ---
  static getAuditLogs(): AuditLog[] {
    return getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT, initialAuditLogs);
  }

  static logAudit(
    userName: string,
    userRole: UserRole,
    action: string,
    targetTable: string,
    targetId?: string,
    details?: Record<string, any>
  ): void {
    const logs = this.getAuditLogs();
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_name: userName,
      user_role: userRole,
      action,
      target_table: targetTable,
      target_id: targetId,
      details,
      created_at: new Date().toISOString(),
    };
    logs.unshift(entry);
    setLocal(STORAGE_KEYS.AUDIT, logs.slice(0, 200));
  }

  static resetToDefault(): void {
    if (typeof window === 'undefined') return;
    setLocal(STORAGE_KEYS.VEHICLES, initialVehicles);
    setLocal(STORAGE_KEYS.INVENTORY, initialInventory);
    setLocal(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders);
    setLocal(STORAGE_KEYS.INVOICES, initialInvoices);
    setLocal(STORAGE_KEYS.CRM_LOGS, initialCRMLogs);
    setLocal(STORAGE_KEYS.SETTINGS, initialSettings);
    setLocal(STORAGE_KEYS.MOVEMENTS, initialStockMovements);
    setLocal(STORAGE_KEYS.AUDIT, initialAuditLogs);
    setLocal(STORAGE_KEYS.CHECKUPS, initialCheckups);
  }
}
