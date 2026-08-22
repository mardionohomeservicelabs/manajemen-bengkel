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
import { BranchId } from '../auth/users';
import {
  initialVehicles,
  initialInventory,
  initialWorkOrders,
  initialInvoices,
  initialCRMLogs,
  initialSettingsMHS1,
  initialSettingsMHS2,
  initialSettingsMHS3,
  initialStockMovements,
  initialAuditLogs,
  initialCheckups,
} from '../data/mock-data';

const BASE_STORAGE_KEYS = {
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

function getBranchKey(baseKey: string, branch?: BranchId): string {
  const activeBranch = branch || DBService.getActiveBranch();
  const normalized = activeBranch.replace(/\s+/g, '_');
  return `${baseKey}_${normalized}`;
}

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
  /**
   * Mengambil cabang aktif dari sesi login saat ini di localStorage
   */
  static getActiveBranch(): BranchId {
    if (typeof window === 'undefined') return 'MHS 1';
    try {
      const stored = localStorage.getItem('acwms_auth_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.activeBranch) return parsed.activeBranch as BranchId;
      }
    } catch {
      // fallback
    }
    return 'MHS 1';
  }

  /**
   * Inisialisasi data per cabang dengan isolasi penuh
   */
  static init(targetBranch?: BranchId): void {
    if (typeof window === 'undefined') return;

    const branches: BranchId[] = targetBranch ? [targetBranch] : ['MHS 1', 'MHS 2', 'MHS 3'];

    branches.forEach((branch) => {
      const keyVehicles = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, branch);
      const keyInventory = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
      const keyWorkOrders = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
      const keyInvoices = getBranchKey(BASE_STORAGE_KEYS.INVOICES, branch);
      const keyCrm = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, branch);
      const keySettings = getBranchKey(BASE_STORAGE_KEYS.SETTINGS, branch);
      const keyMovements = getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, branch);
      const keyAudit = getBranchKey(BASE_STORAGE_KEYS.AUDIT, branch);
      const keyCheckups = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);

      // Auto-migration dari storage lama tanpa suffix ke MHS 1
      if (branch === 'MHS 1') {
        if (!localStorage.getItem(keyInventory) && localStorage.getItem(BASE_STORAGE_KEYS.INVENTORY)) {
          localStorage.setItem(keyInventory, localStorage.getItem(BASE_STORAGE_KEYS.INVENTORY)!);
        }
        if (!localStorage.getItem(keyWorkOrders) && localStorage.getItem(BASE_STORAGE_KEYS.WORK_ORDERS)) {
          localStorage.setItem(keyWorkOrders, localStorage.getItem(BASE_STORAGE_KEYS.WORK_ORDERS)!);
        }
        if (!localStorage.getItem(keyInvoices) && localStorage.getItem(BASE_STORAGE_KEYS.INVOICES)) {
          localStorage.setItem(keyInvoices, localStorage.getItem(BASE_STORAGE_KEYS.INVOICES)!);
        }
        if (!localStorage.getItem(keyVehicles) && localStorage.getItem(BASE_STORAGE_KEYS.VEHICLES)) {
          localStorage.setItem(keyVehicles, localStorage.getItem(BASE_STORAGE_KEYS.VEHICLES)!);
        }
        if (!localStorage.getItem(keyCheckups) && localStorage.getItem(BASE_STORAGE_KEYS.CHECKUPS)) {
          localStorage.setItem(keyCheckups, localStorage.getItem(BASE_STORAGE_KEYS.CHECKUPS)!);
        }
      }

      // Inisialisasi Settings per cabang
      if (!localStorage.getItem(keySettings)) {
        const defaultBranchSettings =
          branch === 'MHS 1'
            ? initialSettingsMHS1
            : branch === 'MHS 2'
            ? initialSettingsMHS2
            : initialSettingsMHS3;
        setLocal(keySettings, defaultBranchSettings);
      }

      // Inisialisasi Vehicles / Customer
      if (!localStorage.getItem(keyVehicles)) {
        setLocal(keyVehicles, branch === 'MHS 1' ? initialVehicles : []);
      }

      // Inisialisasi Inventory per cabang
      if (!localStorage.getItem(keyInventory)) {
        setLocal(keyInventory, initialInventory);
      }

      // Inisialisasi Work Orders (SPK) per cabang
      if (!localStorage.getItem(keyWorkOrders)) {
        setLocal(keyWorkOrders, branch === 'MHS 1' ? initialWorkOrders : []);
      }

      // Inisialisasi Invoices & Estimasi per cabang
      if (!localStorage.getItem(keyInvoices)) {
        setLocal(keyInvoices, branch === 'MHS 1' ? initialInvoices : []);
      }

      // Inisialisasi CRM per cabang
      if (!localStorage.getItem(keyCrm)) {
        setLocal(keyCrm, branch === 'MHS 1' ? initialCRMLogs : []);
      }

      // Inisialisasi Stock Movements per cabang
      if (!localStorage.getItem(keyMovements)) {
        setLocal(keyMovements, branch === 'MHS 1' ? initialStockMovements : []);
      }

      // Inisialisasi Audit Logs per cabang
      if (!localStorage.getItem(keyAudit)) {
        setLocal(keyAudit, branch === 'MHS 1' ? initialAuditLogs : []);
      }

      // Inisialisasi Checkups per cabang
      if (!localStorage.getItem(keyCheckups)) {
        setLocal(keyCheckups, branch === 'MHS 1' ? initialCheckups : []);
      }
    });
  }

  // --- SETTINGS (PER CABANG) ---
  static getSettings(branch?: BranchId): WorkshopSettings {
    const key = getBranchKey(BASE_STORAGE_KEYS.SETTINGS, branch);
    const activeBranch = branch || this.getActiveBranch();
    const fallback =
      activeBranch === 'MHS 1'
        ? initialSettingsMHS1
        : activeBranch === 'MHS 2'
        ? initialSettingsMHS2
        : initialSettingsMHS3;
    return getLocal<WorkshopSettings>(key, fallback);
  }

  static updateSettings(settings: Partial<WorkshopSettings>, branch?: BranchId): WorkshopSettings {
    const key = getBranchKey(BASE_STORAGE_KEYS.SETTINGS, branch);
    const current = this.getSettings(branch);
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };
    setLocal(key, updated);
    this.logAudit('Admin/Owner', 'owner', 'UPDATE_SETTINGS', 'workshop_settings', updated.id, updated, branch);
    return updated;
  }

  // --- VEHICLES & CUSTOMERS (PER CABANG) ---
  static getVehicles(branch?: BranchId): VehicleCustomer[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, branch);
    return getLocal<VehicleCustomer[]>(key, []);
  }

  static getVehicleById(id: string, branch?: BranchId): VehicleCustomer | undefined {
    return this.getVehicles(branch).find((v) => v.id === id);
  }

  static getVehicleByPlate(plate: string, branch?: BranchId): VehicleCustomer | undefined {
    const cleanPlate = plate.toUpperCase().replace(/\s+/g, '');
    return this.getVehicles(branch).find(
      (v) => v.license_plate.toUpperCase().replace(/\s+/g, '') === cleanPlate
    );
  }

  static saveVehicle(vehicle: Omit<VehicleCustomer, 'id'> & { id?: string }, branch?: BranchId): VehicleCustomer {
    const key = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, branch);
    const vehicles = this.getVehicles(branch);
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
      const existing = this.getVehicleByPlate(vehicle.license_plate, branch);
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

    setLocal(key, vehicles);
    return saved;
  }

  // --- INVENTORY & SPAREPARTS (PER CABANG) ---
  static getInventory(branch?: BranchId): InventoryItem[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
    return getLocal<InventoryItem[]>(key, initialInventory);
  }

  static getInventoryById(id: string, branch?: BranchId): InventoryItem | undefined {
    return this.getInventory(branch).find((i) => i.id === id);
  }

  static saveInventoryItem(
    item: Omit<InventoryItem, 'id'> & { id?: string },
    userRole: UserRole = 'owner',
    branch?: BranchId
  ): InventoryItem {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
    const inventory = this.getInventory(branch);
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

    setLocal(key, inventory);
    return saved;
  }

  static adjustStock(
    itemId: string,
    qtyChange: number,
    movementType: StockMovement['movement_type'],
    referenceNumber?: string,
    notes?: string,
    userRole: UserRole = 'owner',
    branch?: BranchId
  ): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
    const inventory = this.getInventory(branch);
    const idx = inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item = inventory[idx];
    const stockBefore = item.stock_qty;
    const stockAfter = Math.max(0, stockBefore + qtyChange);

    item.stock_qty = stockAfter;
    item.updated_at = new Date().toISOString();
    inventory[idx] = item;
    setLocal(key, inventory);

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
    }, branch);

    return true;
  }

  // --- STOCK MOVEMENTS (PER CABANG) ---
  static getStockMovements(branch?: BranchId): StockMovement[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, branch);
    return getLocal<StockMovement[]>(key, []);
  }

  static recordMovement(movement: Omit<StockMovement, 'id'>, branch?: BranchId): StockMovement {
    const key = getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, branch);
    const movements = this.getStockMovements(branch);
    const saved: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    movements.unshift(saved);
    setLocal(key, movements);
    return saved;
  }

  // --- WORK ORDERS / SPK (PER CABANG) ---
  static getWorkOrders(branch?: BranchId): WorkOrder[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(key, []);
    const vehicles = this.getVehicles(branch);

    return orders.map((order) => ({
      ...order,
      vehicle: vehicles.find((v) => v.id === order.vehicle_id),
    }));
  }

  static getWorkOrderById(id: string, branch?: BranchId): WorkOrder | undefined {
    return this.getWorkOrders(branch).find((w) => w.id === id);
  }

  static saveWorkOrder(
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string },
    branch?: BranchId
  ): WorkOrder {
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(key, []);
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

    setLocal(key, orders);
    return this.getWorkOrderById(saved.id, branch) || saved;
  }

  static updateWorkOrderStatus(id: string, status: WorkOrderStatus, userRole: UserRole = 'sa', branch?: BranchId): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(key, []);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;

    orders[idx].status = status;
    orders[idx].updated_at = new Date().toISOString();
    if (status === 'completed') {
      orders[idx].finish_date = new Date().toISOString();
    }
    setLocal(key, orders);
    return true;
  }

  // --- GENERAL CHECKUPS (PER CABANG) ---
  static getCheckups(branch?: BranchId): CheckupRecord[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);
    return getLocal<CheckupRecord[]>(key, []);
  }

  static getCheckupById(id: string, branch?: BranchId): CheckupRecord | undefined {
    return this.getCheckups(branch).find((c) => c.id === id);
  }

  static saveCheckup(checkup: Omit<CheckupRecord, 'id'> & { id?: string }, branch?: BranchId): CheckupRecord {
    const key = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);
    const checkups = this.getCheckups(branch);
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

    setLocal(key, checkups);
    return saved;
  }

  static deleteCheckup(id: string, branch?: BranchId): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);
    const checkups = this.getCheckups(branch);
    const filtered = checkups.filter((c) => c.id !== id);
    setLocal(key, filtered);
    return true;
  }

  // --- INVOICES & ESTIMATIONS (PER CABANG) ---
  static getInvoices(branch?: BranchId): Invoice[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVOICES, branch);
    const invoices = getLocal<Invoice[]>(key, []);
    const vehicles = this.getVehicles(branch);
    const workOrders = this.getWorkOrders(branch);

    return invoices.map((inv) => ({
      ...inv,
      vehicle: vehicles.find((v) => v.id === inv.vehicle_id),
      work_order: workOrders.find((w) => w.id === inv.work_order_id),
    }));
  }

  static getInvoiceById(id: string, branch?: BranchId): Invoice | undefined {
    return this.getInvoices(branch).find((i) => i.id === id);
  }

  static saveInvoice(invoice: Omit<Invoice, 'id'> & { id?: string }, branch?: BranchId): Invoice {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVOICES, branch);
    const invoices = getLocal<Invoice[]>(key, []);
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

    setLocal(key, invoices);

    if (saved.type === 'invoice' && saved.payment_status === 'paid') {
      saved.items.forEach((item) => {
        if (!item.is_service && item.item_id) {
          const numericQty = typeof item.qty === 'number' ? item.qty : 1;
          this.adjustStock(
            item.item_id,
            -numericQty,
            'out_work_order',
            saved.invoice_number,
            `Penjualan via ${saved.invoice_number}`,
            'owner',
            branch
          );
        }
      });

      if (saved.work_order_id) {
        this.updateWorkOrderStatus(saved.work_order_id, 'completed', 'admin', branch);
      }
    }

    return this.getInvoiceById(saved.id, branch) || saved;
  }

  // --- CRM & SERVICE REMINDERS (PER CABANG) ---
  static getCRMLogs(branch?: BranchId): CRMLog[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, branch);
    const logs = getLocal<CRMLog[]>(key, []);
    const vehicles = this.getVehicles(branch);
    return logs.map((log) => ({
      ...log,
      vehicle: vehicles.find((v) => v.id === log.vehicle_id),
    }));
  }

  static updateCRMStatus(id: string, status: CRMLog['status'], notes?: string, branch?: BranchId): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, branch);
    const logs = getLocal<CRMLog[]>(key, []);
    const idx = logs.findIndex((l) => l.id === id);
    if (idx === -1) return false;

    logs[idx].status = status;
    logs[idx].contacted_at = new Date().toISOString();
    if (notes !== undefined) logs[idx].notes = notes;
    logs[idx].updated_at = new Date().toISOString();

    setLocal(key, logs);
    return true;
  }

  // --- AUDIT LOGS (PER CABANG) ---
  static getAuditLogs(branch?: BranchId): AuditLog[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.AUDIT, branch);
    return getLocal<AuditLog[]>(key, []);
  }

  static logAudit(
    userName: string,
    userRole: UserRole,
    action: string,
    targetTable: string,
    targetId?: string,
    details?: Record<string, any>,
    branch?: BranchId
  ): void {
    const key = getBranchKey(BASE_STORAGE_KEYS.AUDIT, branch);
    const logs = this.getAuditLogs(branch);
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
    setLocal(key, logs.slice(0, 200));
  }

  static resetToDefault(branch?: BranchId): void {
    if (typeof window === 'undefined') return;
    const activeBranch = branch || this.getActiveBranch();
    const keyVehicles = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, activeBranch);
    const keyInventory = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, activeBranch);
    const keyWorkOrders = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, activeBranch);
    const keyInvoices = getBranchKey(BASE_STORAGE_KEYS.INVOICES, activeBranch);
    const keyCrm = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, activeBranch);
    const keySettings = getBranchKey(BASE_STORAGE_KEYS.SETTINGS, activeBranch);
    const keyMovements = getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, activeBranch);
    const keyAudit = getBranchKey(BASE_STORAGE_KEYS.AUDIT, activeBranch);
    const keyCheckups = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, activeBranch);

    const defaultBranchSettings =
      activeBranch === 'MHS 1'
        ? initialSettingsMHS1
        : activeBranch === 'MHS 2'
        ? initialSettingsMHS2
        : initialSettingsMHS3;

    setLocal(keyVehicles, activeBranch === 'MHS 1' ? initialVehicles : []);
    setLocal(keyInventory, initialInventory);
    setLocal(keyWorkOrders, activeBranch === 'MHS 1' ? initialWorkOrders : []);
    setLocal(keyInvoices, activeBranch === 'MHS 1' ? initialInvoices : []);
    setLocal(keyCrm, activeBranch === 'MHS 1' ? initialCRMLogs : []);
    setLocal(keySettings, defaultBranchSettings);
    setLocal(keyMovements, activeBranch === 'MHS 1' ? initialStockMovements : []);
    setLocal(keyAudit, activeBranch === 'MHS 1' ? initialAuditLogs : []);
    setLocal(keyCheckups, activeBranch === 'MHS 1' ? initialCheckups : []);
  }
}
