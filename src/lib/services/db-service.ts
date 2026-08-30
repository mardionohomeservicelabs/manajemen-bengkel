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
  CheckupType,
  WorkOrderStatus,
  UserRole,
} from '../types/database';
import { BranchId } from '../auth/users';
import {
  initialSettingsMHS1,
  initialSettingsMHS2,
  initialSettingsMHS3,
} from '../data/mock-data';
import { supabase, isSupabaseConfigured } from '../supabase/client';

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
  OFFLINE_QUEUE: 'acwms_offline_queue',
};

// ─── OFFLINE QUEUE TYPES ────────────────────────────────────────────────────
type OfflineQueueEntry = {
  id: string;
  type: 'work_order' | 'invoice' | 'checkup' | 'vehicle';
  payload: any;
  branch: string;
  createdAt: string;
  retries: number;
};

// ─── SMART MERGE HELPER ──────────────────────────────────────────────────────
/**
 * Gabungkan array cloud (dari Supabase) dengan array lokal.
 * Aturan: item dengan `updated_at` lebih baru yang menang.
 * Data lokal yang belum ada di cloud (belum pernah tersync) tetap dipertahankan.
 */
function smartMergeById<T extends { id: string; updated_at?: string }>(
  cloudItems: T[],
  localItems: T[],
  idField: keyof T = 'id'
): T[] {
  const merged = new Map<string, T>();

  // Masukkan semua item lokal dulu
  localItems.forEach((item) => {
    const key = String(item[idField]);
    merged.set(key, item);
  });

  // Gabungkan dengan cloud: cloud menang hanya jika updated_at lebih baru atau sama
  cloudItems.forEach((cloudItem) => {
    const key = String(cloudItem[idField]);
    const localItem = merged.get(key);
    if (!localItem) {
      // Item baru dari cloud, langsung tambahkan
      merged.set(key, cloudItem);
    } else {
      // Bandingkan waktu update — cloud menang jika lebih baru
      const cloudTime = cloudItem.updated_at ? new Date(cloudItem.updated_at).getTime() : 0;
      const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
      if (cloudTime >= localTime) {
        merged.set(key, cloudItem);
      }
      // Jika lokal lebih baru, pertahankan lokal (sedang dalam proses save)
    }
  });

  return Array.from(merged.values());
}

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

  // ─── OFFLINE QUEUE MANAGEMENT ────────────────────────────────────────────────

  /** Ambil semua entri offline queue */
  static getOfflineQueue(): OfflineQueueEntry[] {
    return getLocal<OfflineQueueEntry[]>(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  /** Tambahkan operasi yang gagal ke offline queue */
  static addToOfflineQueue(
    type: OfflineQueueEntry['type'],
    payload: any,
    branch?: BranchId
  ): void {
    if (typeof window === 'undefined') return;
    const queue = this.getOfflineQueue();
    const entry: OfflineQueueEntry = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      branch: branch || this.getActiveBranch(),
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    queue.push(entry);
    // Batasi ukuran queue maksimal 200 entri agar tidak membebani localStorage
    setLocal(BASE_STORAGE_KEYS.OFFLINE_QUEUE, queue.slice(-200));
  }

  /** Jumlah entri yang belum tersync */
  static getOfflineQueueCount(): number {
    return this.getOfflineQueue().length;
  }

  /**
   * Flush offline queue — coba simpan semua entri yang tertunda ke Supabase.
   * Dipanggil saat koneksi tersedia atau saat user klik "Sync Sekarang".
   * Mengembalikan jumlah entri yang berhasil di-flush.
   */
  static async flushOfflineQueue(): Promise<number> {
    if (!supabase || !isSupabaseConfigured) return 0;
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return 0;

    const failed: OfflineQueueEntry[] = [];
    let successCount = 0;

    for (const entry of queue) {
      try {
        let ok = false;
        if (entry.type === 'work_order') {
          const result = await this.saveWorkOrderAsync(entry.payload, entry.branch as BranchId);
          ok = Boolean(result?.id);
        } else if (entry.type === 'invoice') {
          const result = await this.saveInvoiceAsync(entry.payload, entry.branch as BranchId);
          ok = Boolean(result?.id);
        } else if (entry.type === 'checkup') {
          const result = await this.saveCheckupAsync(entry.payload, entry.branch as BranchId);
          ok = Boolean(result?.id);
        } else if (entry.type === 'vehicle') {
          const result = await this.saveVehicleAsync(entry.payload, entry.branch as BranchId);
          ok = Boolean(result?.id);
        }
        if (ok) successCount++;
        else failed.push({ ...entry, retries: entry.retries + 1 });
      } catch {
        // Jika masih gagal, kembalikan ke antrian (max 5 kali retry)
        if (entry.retries < 5) {
          failed.push({ ...entry, retries: entry.retries + 1 });
        }
        // Setelah 5 kali retry, hapus dari queue (data sudah tersimpan lokal)
      }
    }

    setLocal(BASE_STORAGE_KEYS.OFFLINE_QUEUE, failed);
    return successCount;
  }

  /**
   * Inisialisasi data per cabang dengan isolasi penuh
   */
  static init(targetBranch?: BranchId): void {
    if (typeof window === 'undefined') return;

    // Pastikan data MHS 1 bersih dan kosong dari data dummy/mock bawaan
    const CLEAN_MHS1_FLAG = 'acwms_mhs1_cleared_v4';
    if (!localStorage.getItem(CLEAN_MHS1_FLAG)) {
      const mhs1Branch: BranchId = 'MHS 1';
      setLocal(getBranchKey(BASE_STORAGE_KEYS.VEHICLES, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.INVENTORY, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.INVOICES, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.AUDIT, mhs1Branch), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, mhs1Branch), []);

      // Hapus data storage legacy lama (tanpa suffix) agar tidak tertinggal
      localStorage.removeItem(BASE_STORAGE_KEYS.VEHICLES);
      localStorage.removeItem(BASE_STORAGE_KEYS.INVENTORY);
      localStorage.removeItem(BASE_STORAGE_KEYS.WORK_ORDERS);
      localStorage.removeItem(BASE_STORAGE_KEYS.INVOICES);
      localStorage.removeItem(BASE_STORAGE_KEYS.CRM_LOGS);
      localStorage.removeItem(BASE_STORAGE_KEYS.MOVEMENTS);
      localStorage.removeItem(BASE_STORAGE_KEYS.AUDIT);
      localStorage.removeItem(BASE_STORAGE_KEYS.CHECKUPS);

      localStorage.setItem(CLEAN_MHS1_FLAG, 'true');
    }

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

      // Inisialisasi Settings resmi per cabang
      if (!localStorage.getItem(keySettings)) {
        const defaultBranchSettings =
          branch === 'MHS 1'
            ? initialSettingsMHS1
            : branch === 'MHS 2'
            ? initialSettingsMHS2
            : initialSettingsMHS3;
        setLocal(keySettings, defaultBranchSettings);
      }

      // Inisialisasi Vehicles / Customer (Kosong secara default)
      if (!localStorage.getItem(keyVehicles)) {
        setLocal(keyVehicles, []);
      }

      // Inisialisasi Inventory per cabang (Kosong secara default)
      if (!localStorage.getItem(keyInventory)) {
        setLocal(keyInventory, []);
      }

      // Inisialisasi Work Orders (SPK) per cabang (Kosong secara default)
      if (!localStorage.getItem(keyWorkOrders)) {
        setLocal(keyWorkOrders, []);
      }

      // Inisialisasi Invoices & Estimasi per cabang (Kosong secara default)
      if (!localStorage.getItem(keyInvoices)) {
        setLocal(keyInvoices, []);
      }

      // Inisialisasi CRM per cabang (Kosong secara default)
      if (!localStorage.getItem(keyCrm)) {
        setLocal(keyCrm, []);
      }

      // Inisialisasi Stock Movements per cabang (Kosong secara default)
      if (!localStorage.getItem(keyMovements)) {
        setLocal(keyMovements, []);
      }

      // Inisialisasi Audit Logs per cabang (Kosong secara default)
      if (!localStorage.getItem(keyAudit)) {
        setLocal(keyAudit, []);
      }

      // Inisialisasi Checkups per cabang (Kosong secara default)
      if (!localStorage.getItem(keyCheckups)) {
        setLocal(keyCheckups, []);
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

  /**
   * Simpan atau update data Kendaraan langsung ke database Supabase
   */
  static async saveVehicleAsync(
    vehicle: Omit<VehicleCustomer, 'id'> & { id?: string },
    branch?: BranchId
  ): Promise<VehicleCustomer> {
    const formattedPlate = vehicle.license_plate.toUpperCase().trim();
    const localSaved = this.saveVehicle({ ...vehicle, license_plate: formattedPlate }, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {
          customer_name: vehicle.customer_name,
          phone_number: vehicle.phone_number,
          email: vehicle.email || null,
          address: vehicle.address || null,
          license_plate: formattedPlate,
          car_brand: vehicle.car_brand,
          car_model: vehicle.car_model || 'Standar',
          car_year: vehicle.car_year ? Number(vehicle.car_year) : null,
          engine_number: vehicle.engine_number || null,
          chassis_number: vehicle.chassis_number || null,
          current_mileage: vehicle.current_mileage ? Number(vehicle.current_mileage) : 0,
        };

        const { data, error } = await supabase
          .from('vehicles_customers')
          .upsert(payload, { onConflict: 'license_plate' })
          .select();

        if (error) {
          console.warn('Supabase saveVehicle error:', error.message);
        } else if (data && data[0]) {
          const remoteSaved = data[0] as VehicleCustomer;
          const key = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, branch);
          const vehicles = this.getVehicles(branch);
          const idx = vehicles.findIndex((v) => v.license_plate === formattedPlate);
          if (idx !== -1) {
            vehicles[idx] = { ...vehicles[idx], id: remoteSaved.id };
            setLocal(key, vehicles);
          }
          return { ...localSaved, id: remoteSaved.id };
        }
      } catch (err) {
        console.warn('Supabase saveVehicle exception:', err);
      }
    }

    return localSaved;
  }

  /**
   * Update Plat Nomor Kendaraan di seluruh sistem (Vehicles, SPK, Checkups, Invoices)
   * Tetap dapat diubah meskipun status SPK sudah 'completed' (terkunci).
   */
  static updateVehiclePlate(
    vehicleId: string,
    newPlate: string,
    branch?: BranchId
  ): boolean {
    const formattedPlate = newPlate.toUpperCase().trim();
    if (!formattedPlate) return false;

    // 1. Update Vehicles
    const keyVehicles = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, branch);
    const vehicles = getLocal<VehicleCustomer[]>(keyVehicles, []);
    const vIdx = vehicles.findIndex((v) => v.id === vehicleId);
    let oldPlate = '';
    if (vIdx !== -1) {
      oldPlate = vehicles[vIdx].license_plate;
      vehicles[vIdx].license_plate = formattedPlate;
      vehicles[vIdx].updated_at = new Date().toISOString();
      setLocal(keyVehicles, vehicles);
    }

    // 2. Update Work Orders
    const keyOrders = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(keyOrders, []);
    let ordersUpdated = false;
    orders.forEach((o) => {
      if (
        o.vehicle_id === vehicleId ||
        (o.vehicle && o.vehicle.id === vehicleId) ||
        (oldPlate && o.vehicle?.license_plate === oldPlate)
      ) {
        if (o.vehicle) {
          o.vehicle.license_plate = formattedPlate;
        }
        o.updated_at = new Date().toISOString();
        ordersUpdated = true;
      }
    });
    if (ordersUpdated) {
      setLocal(keyOrders, orders);
    }

    // 3. Update Checkups
    const keyCheckups = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);
    const checkups = getLocal<CheckupRecord[]>(keyCheckups, []);
    let checkupsUpdated = false;
    checkups.forEach((c) => {
      if (c.vehicle_id === vehicleId || (oldPlate && c.license_plate === oldPlate)) {
        c.license_plate = formattedPlate;
        if (c.qc_data) c.qc_data.license_plate = formattedPlate;
        if (c.ac_data) c.ac_data.license_plate = formattedPlate;
        if (c.understeel_data) c.understeel_data.license_plate = formattedPlate;
        c.updated_at = new Date().toISOString();
        checkupsUpdated = true;
      }
    });
    if (checkupsUpdated) {
      setLocal(keyCheckups, checkups);
    }

    // 4. Update Invoices / Estimations
    const keyInvoices = getBranchKey(BASE_STORAGE_KEYS.INVOICES, branch);
    const invoices = getLocal<Invoice[]>(keyInvoices, []);
    let invoicesUpdated = false;
    invoices.forEach((inv) => {
      if (
        inv.vehicle_id === vehicleId ||
        (inv.vehicle && inv.vehicle.id === vehicleId) ||
        (oldPlate && inv.vehicle?.license_plate === oldPlate)
      ) {
        if (inv.vehicle) {
          inv.vehicle.license_plate = formattedPlate;
        }
        invoicesUpdated = true;
      }
    });
    if (invoicesUpdated) {
      setLocal(keyInvoices, invoices);
    }

    return true;
  }

  static async updateVehiclePlateAsync(
    vehicleId: string,
    newPlate: string,
    branch?: BranchId
  ): Promise<boolean> {
    const formattedPlate = newPlate.toUpperCase().trim();
    if (!formattedPlate) return false;

    this.updateVehiclePlate(vehicleId, formattedPlate, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('vehicles_customers')
          .update({
            license_plate: formattedPlate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vehicleId);
      } catch (err) {
        console.warn('Supabase updateVehiclePlate exception:', err);
      }
    }

    return true;
  }

  // --- INVENTORY & SPAREPARTS (PER CABANG) ---
  static getInventory(branch?: BranchId): InventoryItem[] {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
    return getLocal<InventoryItem[]>(key, []);
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

  /**
   * Simpan atau update Surat Perintah Kerja (SPK) langsung ke Supabase
   */
  static async saveWorkOrderAsync(
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string },
    branch?: BranchId
  ): Promise<WorkOrder> {
    const localSaved = this.saveWorkOrder(workOrder, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        const mergedChecklist: Record<string, any> = {
          ...((localSaved as any).checklist_data || {}),
          ...((workOrder as any).checklist_data || {}),
          source_info: workOrder.source_info || (localSaved as any).source_info || 'REFERENSI',
          vehicle_status: workOrder.vehicle_status || (localSaved as any).vehicle_status || 'Ditunggu',
          received_at_branch: workOrder.received_at_branch || (localSaved as any).received_at_branch || branch || DBService.getActiveBranch(),
          signature_customer_url: workOrder.signature_customer_url || (localSaved as any).signature_customer_url || null,
          signature_mechanic_url: workOrder.signature_mechanic_url || (localSaved as any).signature_mechanic_url || null,
          signature_sa_url: workOrder.signature_sa_url || (localSaved as any).signature_sa_url || null,
        };

        const payload: Record<string, any> = {
          spk_number: localSaved.spk_number,
          vehicle_id: workOrder.vehicle_id,
          mechanic_name: workOrder.mechanic_name || null,
          entry_date: workOrder.entry_date || new Date().toISOString(),
          finish_date: workOrder.finish_date || null,
          complaints: workOrder.complaints || 'Pemeriksaan / Servis Berkala',
          fuel_level: workOrder.fuel_level !== undefined ? Number(workOrder.fuel_level) : 50,
          status: workOrder.status || 'queue',
          notes: workOrder.notes || null,
          checklist_data: mergedChecklist,
        };

        const { data, error } = await supabase
          .from('work_orders')
          .upsert(payload, { onConflict: 'spk_number' })
          .select('*, vehicle:vehicles_customers(*)');

        if (error) {
          console.warn('Supabase saveWorkOrder error:', error.message);
        } else if (data && data[0]) {
          const remoteSaved = data[0];
          const fullWo: WorkOrder = {
            id: remoteSaved.id,
            spk_number: remoteSaved.spk_number,
            vehicle_id: remoteSaved.vehicle_id,
            mechanic_name: remoteSaved.mechanic_name,
            entry_date: remoteSaved.entry_date,
            finish_date: remoteSaved.finish_date,
            complaints: remoteSaved.complaints,
            fuel_level: remoteSaved.fuel_level,
            status: remoteSaved.status,
            notes: remoteSaved.notes,
            source_info: remoteSaved.checklist_data?.source_info,
            vehicle_status: remoteSaved.checklist_data?.vehicle_status,
            received_at_branch: remoteSaved.checklist_data?.received_at_branch,
            signature_customer_url: remoteSaved.checklist_data?.signature_customer_url,
            signature_mechanic_url: remoteSaved.checklist_data?.signature_mechanic_url,
            signature_sa_url: remoteSaved.checklist_data?.signature_sa_url,
            checklist_data: remoteSaved.checklist_data || mergedChecklist,
            created_at: remoteSaved.created_at,
            updated_at: remoteSaved.updated_at,
            vehicle: remoteSaved.vehicle || localSaved.vehicle,
          };

          const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
          const orders = getLocal<WorkOrder[]>(key, []);
          const idx = orders.findIndex((o) => o.spk_number === localSaved.spk_number);
          if (idx !== -1) {
            orders[idx] = fullWo;
            setLocal(key, orders);
          }

          return fullWo;
        }
      } catch (err) {
        console.warn('Supabase saveWorkOrder exception:', err);
        // Tambahkan ke offline queue untuk retry saat koneksi tersedia
        this.addToOfflineQueue('work_order', workOrder, branch);
      }
    } else if (isSupabaseConfigured) {
      // Supabase dikonfigurasi tapi client null — offline, tambahkan ke queue
      this.addToOfflineQueue('work_order', workOrder, branch);
    }

    return localSaved;
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

  static async updateWorkOrderStatusAsync(
    id: string,
    status: WorkOrderStatus,
    userRole: UserRole = 'sa',
    branch?: BranchId
  ): Promise<boolean> {
    this.updateWorkOrderStatus(id, status, userRole, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        const updatePayload: Record<string, any> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (status === 'completed') {
          updatePayload.finish_date = new Date().toISOString();
        }
        await supabase.from('work_orders').update(updatePayload).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateWorkOrderStatus exception:', err);
      }
    }

    return true;
  }

  /**
   * Buka kunci pekerjaan / SPK yang telah berstatus completed (Khusus Owner)
   */
  static async unlockWorkOrderAsync(
    id: string,
    targetStatus: WorkOrderStatus = 'servicing',
    userRole: UserRole = 'owner',
    branch?: BranchId
  ): Promise<boolean> {
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(key, []);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;

    orders[idx].status = targetStatus;
    orders[idx].updated_at = new Date().toISOString();
    setLocal(key, orders);

    this.logAudit(
      'Owner',
      userRole,
      'UPDATE_STATUS',
      'work_orders',
      id,
      { action: 'UNLOCK_WORK_ORDER', new_status: targetStatus },
      branch
    );

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('work_orders')
          .update({
            status: targetStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase unlockWorkOrderAsync exception:', err);
      }
    }

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

  /**
   * Simpan atau update Lembar General Checkup / AC Specialist langsung ke Supabase
   */
  static async saveCheckupAsync(
    checkup: Omit<CheckupRecord, 'id'> & { id?: string },
    branch?: BranchId
  ): Promise<CheckupRecord> {
    const localSaved = this.saveCheckup(checkup, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        // 1. Pastikan data kendaraan tersimpan/terdaftar di Supabase
        let vehicleId = checkup.vehicle_id;
        if (!vehicleId && checkup.license_plate) {
          const veh = await this.saveVehicleAsync({
            customer_name: checkup.customer_name,
            phone_number: '0812-3076-2930',
            license_plate: checkup.license_plate,
            car_brand: 'Mobil',
            car_model: checkup.car_model || 'Standar',
            current_mileage: checkup.qc_data?.mileage || checkup.ac_data?.mileage || 40000,
          }, branch);
          vehicleId = veh.id;
        }

        // 2. Apabila terhubung dengan SPK aktif, update checklist_data di work_orders
        if (checkup.work_order_id) {
          const { data: woData } = await supabase
            .from('work_orders')
            .select('checklist_data')
            .eq('id', checkup.work_order_id)
            .single();

          const existingChecklist = woData?.checklist_data || {};
          const updatedChecklist = {
            ...existingChecklist,
            checkup_record: localSaved,
            checkup_type: checkup.type,
            qc_data: checkup.qc_data || null,
            ac_data: checkup.ac_data || null,
            understeel_data: checkup.understeel_data || null,
          };

          await supabase
            .from('work_orders')
            .update({ checklist_data: updatedChecklist })
            .eq('id', checkup.work_order_id);
        } else if (vehicleId) {
          // 3. Standalone Checkup (tanpa SPK) -> Simpan ke work_orders dengan spk_number = document_number
          const checklistPayload: Record<string, any> = {
            checkup_record: localSaved,
            checkup_type: checkup.type,
            qc_data: checkup.qc_data || null,
            ac_data: checkup.ac_data || null,
            understeel_data: checkup.understeel_data || null,
            received_at_branch: branch || DBService.getActiveBranch(),
          };

          await supabase
            .from('work_orders')
            .upsert({
              spk_number: checkup.document_number,
              vehicle_id: vehicleId,
              mechanic_name: checkup.technician_name || 'Mekanik',
              entry_date: checkup.check_date ? new Date(checkup.check_date).toISOString() : new Date().toISOString(),
              finish_date: new Date().toISOString(),
              complaints: checkup.type === 'qc_general' ? 'QC General Checkup & Tune Up' : (checkup.type === 'understeel' ? 'Form Keluhan Understeel (Kaki-Kaki)' : 'Pemeriksaan Spesialis AC'),
              fuel_level: 50,
              status: 'completed',
              notes: 'Lembar QC/AC/Understeel Checkup Resmi',
              checklist_data: checklistPayload,
            }, { onConflict: 'spk_number' });
        }

        // 4. Catat riwayat audit log permanen
        await supabase.from('audit_logs').insert({
          user_name: checkup.technician_name || 'Mekanik',
          user_role: 'mekanik',
          action: 'SAVE_CHECKUP',
          target_table: 'checkups',
          target_id: checkup.document_number,
          details: {
            type: checkup.type,
            license_plate: checkup.license_plate,
            customer_name: checkup.customer_name,
          },
        });
      } catch (err) {
        console.warn('Supabase saveCheckup exception:', err);
        // Tambahkan ke offline queue untuk retry saat koneksi tersedia
        this.addToOfflineQueue('checkup', checkup, branch);
      }
    } else if (isSupabaseConfigured) {
      this.addToOfflineQueue('checkup', checkup, branch);
    }

    return localSaved;
  }

  static deleteCheckup(id: string, branch?: BranchId): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, branch);
    const checkups = this.getCheckups(branch);
    const filtered = checkups.filter((c) => c.id !== id);
    setLocal(key, filtered);
    return true;
  }

  static async deleteCheckupAsync(id: string, branch?: BranchId): Promise<boolean> {
    const checkup = this.getCheckupById(id, branch);
    this.deleteCheckup(id, branch);

    if (supabase && isSupabaseConfigured && checkup) {
      try {
        if (checkup.work_order_id) {
          const { data: woData } = await supabase
            .from('work_orders')
            .select('checklist_data')
            .eq('id', checkup.work_order_id)
            .single();

          if (woData?.checklist_data) {
            const updated = { ...woData.checklist_data };
            delete updated.checkup_record;
            delete updated.qc_data;
            delete updated.ac_data;
            await supabase.from('work_orders').update({ checklist_data: updated }).eq('id', checkup.work_order_id);
          }
        } else {
          await supabase.from('work_orders').delete().eq('spk_number', checkup.document_number);
        }
      } catch (err) {
        console.warn('Supabase deleteCheckup exception:', err);
      }
    }

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

  static async saveInvoiceAsync(invoice: Omit<Invoice, 'id'> & { id?: string }, branch?: BranchId): Promise<Invoice> {
    const localSaved = this.saveInvoice(invoice, branch);

    if (supabase && isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {
          id: localSaved.id.startsWith('inv-') ? undefined : localSaved.id,
          invoice_number: localSaved.invoice_number,
          type: localSaved.type,
          work_order_id: localSaved.work_order_id || null,
          vehicle_id: localSaved.vehicle_id,
          items: localSaved.items,
          subtotal: localSaved.subtotal,
          discount_amount: localSaved.discount_amount || 0,
          tax_percent: localSaved.tax_percent || 0,
          tax_amount: localSaved.tax_amount || 0,
          total_amount: localSaved.total_amount,
          down_payment: localSaved.down_payment || 0,
          balance_due: localSaved.balance_due || 0,
          payment_status: localSaved.payment_status,
          payment_method: localSaved.payment_method || null,
          admin_notes: localSaved.admin_notes || null,
          signature_customer_url: localSaved.signature_customer_url || localSaved.customer_signature || null,
          signature_admin_url: localSaved.signature_admin_url || (localSaved as any).estimator_signature || null,
        };

        const { data, error } = await supabase
          .from('invoices')
          .upsert(payload, { onConflict: 'invoice_number' })
          .select('*, vehicle:vehicles_customers(*), work_order:work_orders(*)');

        // Jika ini adalah estimasi yang terkait SPK, update juga checklist_data di Supabase
        if (localSaved.work_order_id) {
          try {
            const { data: woData } = await supabase
              .from('work_orders')
              .select('checklist_data')
              .eq('id', localSaved.work_order_id)
              .single();

            const existingChecklist = woData?.checklist_data || {};
            const tabKey = (localSaved as any).tab_id || localSaved.estimation_tab || 'tab_1';
            const updatedChecklist = {
              ...existingChecklist,
              estimation: localSaved,
              [`estimation_${tabKey}`]: localSaved,
            };

            await supabase
              .from('work_orders')
              .update({
                checklist_data: updatedChecklist,
                status: 'estimating',
              })
              .eq('id', localSaved.work_order_id);
          } catch (woErr) {
            console.warn('Failed to update work_order checklist_data with estimation:', woErr);
          }
        }

        if (!error && data && data[0]) {
          return {
            ...localSaved,
            ...data[0],
            vehicle: data[0].vehicle || localSaved.vehicle,
            work_order: data[0].work_order || localSaved.work_order,
          };
        }
      } catch (err) {
        console.warn('Supabase saveInvoice exception:', err);
        // Tambahkan ke offline queue untuk retry saat koneksi tersedia
        this.addToOfflineQueue('invoice', invoice, branch);
      }
    } else if (isSupabaseConfigured) {
      this.addToOfflineQueue('invoice', invoice, branch);
    }

    return localSaved;
  }

  /**
  /**
   * Menemukan estimasi berdasarkan ID atau Token publik lintas semua cabang (Cache Lokal)
   */
  static findEstimationByIdOrToken(idOrToken: string): { estimation: Invoice; branch: BranchId } | null {
    const branches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
    for (const b of branches) {
      const invs = this.getInvoices(b);
      const found = invs.find(
        (i) =>
          i.id === idOrToken ||
          i.invoice_number === idOrToken ||
          i.ttd_token === idOrToken ||
          i.work_order_id === idOrToken
      );
      if (found) {
        return { estimation: found, branch: b };
      }
    }
    return null;
  }

  /**
   * Menemukan estimasi secara asinkron dari Cache Lokal maupun Cloud Supabase
   */
  static async findEstimationByIdOrTokenAsync(
    idOrToken: string
  ): Promise<{ estimation: Invoice; branch: BranchId } | null> {
    // 1. Coba cari di cache lokal terlebih dahulu
    const localTarget = this.findEstimationByIdOrToken(idOrToken);
    if (localTarget) {
      return localTarget;
    }

    // 2. Jika tidak ada di lokal (misal customer membuka link di HP pribadi), query langsung ke Supabase
    if (supabase && isSupabaseConfigured) {
      try {
        // Cari di tabel invoices dengan join work_order dan vehicle
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select('*, vehicle:vehicles_customers(*), work_order:work_orders(*)')
          .or(`id.eq.${idOrToken},invoice_number.eq.${idOrToken},work_order_id.eq.${idOrToken}`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!invErr && invData && invData.length > 0) {
          const row = invData[0];
          const branch: BranchId = (row.work_order?.checklist_data?.received_at_branch as BranchId) || 'MHS 1';
          const checklist = row.work_order?.checklist_data || {};
          
          // Cari nested estimation di dalam checklist_data yang paling cocok
          let nestedEst: any = checklist.estimation || null;
          if (!nestedEst) {
            for (const k of Object.keys(checklist)) {
              if (k.startsWith('estimation') && checklist[k]?.invoice_number === row.invoice_number) {
                nestedEst = checklist[k];
                break;
              }
            }
          }
          if (!nestedEst) {
            for (const k of Object.keys(checklist)) {
              if (k.startsWith('estimation') && checklist[k]?.items) {
                nestedEst = checklist[k];
                break;
              }
            }
          }

          const rawItems = nestedEst?.items || (Array.isArray(row.items) ? row.items : []);
          const hasOpsi2 = nestedEst?.has_opsi2 !== undefined 
            ? nestedEst.has_opsi2 
            : true;

          const inv: Invoice = {
            id: row.id,
            invoice_number: row.invoice_number,
            type: row.type || 'estimation',
            work_order_id: row.work_order_id || row.work_order?.id || undefined,
            vehicle_id: row.vehicle_id,
            items: rawItems,
            subtotal: Number(nestedEst?.subtotal || row.subtotal) || 0,
            discount_amount: Number(nestedEst?.discount_amount || row.discount_amount) || 0,
            tax_percent: Number(nestedEst?.tax_percent || row.tax_percent) || 0,
            tax_amount: Number(nestedEst?.tax_amount || row.tax_amount) || 0,
            total_amount: Number(nestedEst?.total_amount || row.total_amount) || 0,
            down_payment: Number(nestedEst?.down_payment || row.down_payment) || 0,
            balance_due: Number(nestedEst?.balance_due || row.balance_due) || 0,
            payment_status: row.payment_status || 'pending',
            payment_method: row.payment_method || undefined,
            admin_notes: nestedEst?.admin_notes || row.admin_notes || undefined,
            signature_customer_url: nestedEst?.signature_customer_url || nestedEst?.customer_signature || row.work_order?.signature_url || undefined,
            signature_admin_url: nestedEst?.signature_admin_url || nestedEst?.estimator_signature || undefined,
            created_at: nestedEst?.created_at || row.created_at,
            updated_at: nestedEst?.updated_at || row.updated_at,
            estimation_type: nestedEst?.estimation_type || undefined,
            estimation_tab: nestedEst?.estimation_tab || nestedEst?.tab_id || undefined,
            estimation_date: nestedEst?.estimation_date || undefined,
            estimation_time: nestedEst?.estimation_time || undefined,
            vehicle_status: nestedEst?.vehicle_status || undefined,
            payment_plan: nestedEst?.payment_plan || undefined,
            estimator_name: nestedEst?.estimator_name || undefined,
            estimator_signature: nestedEst?.estimator_signature || nestedEst?.signature_admin_url || undefined,
            estimated_duration: nestedEst?.estimated_duration || undefined,
            customer_response: nestedEst?.customer_response || undefined,
            customer_response_note: nestedEst?.customer_response_note || undefined,
            has_discount: nestedEst?.has_discount !== undefined ? nestedEst.has_discount : (Number(row.discount_amount) > 0),
            has_opsi2: hasOpsi2,
            has_tax: nestedEst?.has_tax !== undefined ? nestedEst.has_tax : (Number(row.tax_percent) > 0),
            has_range_price: nestedEst?.has_range_price || false,
            total_opsi1: nestedEst?.total_opsi1 !== undefined ? nestedEst.total_opsi1 : Number(row.subtotal || row.total_amount),
            total_opsi1_max: nestedEst?.total_opsi1_max,
            total_opsi2: nestedEst?.total_opsi2 !== undefined ? nestedEst.total_opsi2 : Number(row.total_amount),
            total_opsi2_max: nestedEst?.total_opsi2_max,
            ttd_status: nestedEst?.ttd_status || (nestedEst?.customer_signature ? 'signed' : 'pending'),
            customer_signature: nestedEst?.customer_signature || nestedEst?.signature_customer_url || row.work_order?.signature_url || undefined,
            customer_signed_at: nestedEst?.customer_signed_at || undefined,
            customer_signed_name: nestedEst?.customer_signed_name || undefined,
            customer_approved_option: nestedEst?.customer_approved_option || undefined,
            vehicle: row.vehicle || undefined,
            work_order: row.work_order || undefined,
          };
          return { estimation: inv, branch };
        }

        // 3. Jika tidak ada di tabel invoices, cari langsung di tabel work_orders
        const { data: woData, error: woErr } = await supabase
          .from('work_orders')
          .select('*, vehicle:vehicles_customers(*)')
          .or(`id.eq.${idOrToken},spk_number.eq.${idOrToken}`)
          .limit(1);

        if (!woErr && woData && woData.length > 0) {
          const wo = woData[0];
          const checklist = wo.checklist_data || {};
          const branch: BranchId = (checklist.received_at_branch as BranchId) || 'MHS 1';
          
          let estData: any = checklist.estimation || null;
          if (!estData) {
            for (const k of Object.keys(checklist)) {
              if (k.startsWith('estimation') && checklist[k]?.items) {
                estData = checklist[k];
                break;
              }
            }
          }

          if (estData) {
            const inv: Invoice = {
              ...estData,
              has_opsi2: estData.has_opsi2 !== undefined ? estData.has_opsi2 : true,
              work_order_id: wo.id,
              vehicle: wo.vehicle || undefined,
              work_order: wo,
            };
            return { estimation: inv, branch };
          }
        }
      } catch (err) {
        console.warn('Supabase findEstimationByIdOrTokenAsync exception:', err);
      }
    }

    return null;
  }

  /**
   * Menyimpan tanda tangan digital pelanggan dan status persetujuan opsi estimasi
   */
  static async approveEstimationSignature(
    idOrToken: string,
    signatureDataUrl: string,
    customerName: string,
    approvedOption: 'opsi1' | 'opsi2',
    branch?: BranchId
  ): Promise<Invoice | null> {
    const target = await this.findEstimationByIdOrTokenAsync(idOrToken);
    const activeBranch = branch || (target ? target.branch : this.getActiveBranch());
    const now = new Date().toISOString();

    let targetInvoice: Invoice | null = target ? target.estimation : null;

    if (targetInvoice) {
      targetInvoice = {
        ...targetInvoice,
        customer_signature: signatureDataUrl,
        signature_customer_url: signatureDataUrl,
        customer_signed_name: customerName,
        customer_signed_at: now,
        customer_approved_option: approvedOption,
        customer_response: approvedOption,
        ttd_status: 'signed',
        updated_at: now,
      };
    }

    // 1. Update cache lokal Invoices
    const key = getBranchKey(BASE_STORAGE_KEYS.INVOICES, activeBranch);
    const invoices = getLocal<Invoice[]>(key, []);
    const idx = invoices.findIndex(
      (i) => i.id === idOrToken || i.invoice_number === idOrToken || (targetInvoice && i.id === targetInvoice.id)
    );
    if (idx !== -1 && targetInvoice) {
      invoices[idx] = targetInvoice;
      setLocal(key, invoices);
    } else if (targetInvoice) {
      invoices.unshift(targetInvoice);
      setLocal(key, invoices);
    }

    // 2. Update cache lokal Work Orders
    const woId = targetInvoice?.work_order_id || idOrToken;
    if (woId) {
      const woKey = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, activeBranch);
      const workOrders = getLocal<WorkOrder[]>(woKey, []);
      const woIdx = workOrders.findIndex((w) => w.id === woId || w.spk_number === woId);
      if (woIdx !== -1 && targetInvoice) {
        const tabKey = (targetInvoice as any).tab_id || targetInvoice.estimation_tab || 'tab_1';
        workOrders[woIdx] = {
          ...workOrders[woIdx],
          status: workOrders[woIdx].status === 'completed' ? 'completed' : 'approved',
          signature_customer_url: signatureDataUrl,
          checklist_data: {
            ...(workOrders[woIdx].checklist_data || {}),
            estimation: targetInvoice,
            [`estimation_${tabKey}`]: targetInvoice,
            signature_customer_url: signatureDataUrl,
          },
          updated_at: now,
        };
        setLocal(woKey, workOrders);
      }
    }

    // 3. Update Cloud Supabase (Work Orders & Invoices)
    if (supabase && isSupabaseConfigured && targetInvoice) {
      try {
        const targetWoId = targetInvoice.work_order_id || idOrToken;

        // Ambil data work_orders terbaru dari Supabase
        const { data: woData } = await supabase
          .from('work_orders')
          .select('*')
          .or(`id.eq.${targetWoId},spk_number.eq.${targetWoId}`)
          .limit(1);

        if (woData && woData[0]) {
          const remoteWo = woData[0];
          const existingChecklist = remoteWo.checklist_data || {};
          const tabKey = (targetInvoice as any).tab_id || targetInvoice.estimation_tab || 'tab_1';

          await supabase
            .from('work_orders')
            .update({
              status: remoteWo.status === 'completed' ? 'completed' : 'approved',
              signature_url: signatureDataUrl,
              checklist_data: {
                ...existingChecklist,
                estimation: targetInvoice,
                [`estimation_${tabKey}`]: targetInvoice,
                signature_customer_url: signatureDataUrl,
                customer_signed_name: customerName,
                customer_signed_at: now,
                customer_approved_option: approvedOption,
              },
              updated_at: now,
            })
            .eq('id', remoteWo.id);
        }

        // Update invoices tanpa kolom yang tidak ada di schema
        await supabase
          .from('invoices')
          .update({
            payment_status: targetInvoice.payment_status || 'pending',
            updated_at: now,
          })
          .or(`id.eq.${targetInvoice.id},invoice_number.eq.${targetInvoice.invoice_number}`);
      } catch (err) {
        console.warn('Supabase approveEstimationSignature error:', err);
      }
    }

    if (targetInvoice?.work_order_id) {
      this.updateWorkOrderStatus(targetInvoice.work_order_id, 'approved', 'sa', activeBranch);
    }

    // Log audit
    this.logAudit(
      customerName || 'Customer via Link TTD',
      'sa',
      'CUSTOMER_SIGN_ESTIMATION',
      'invoices',
      targetInvoice?.invoice_number || idOrToken,
      { approvedOption, invoice_number: targetInvoice?.invoice_number },
      activeBranch
    );

    return targetInvoice;
  }

  // Save customer "pending" response (no signature needed)
  static async savePendingResponse(
    idOrToken: string,
    customerName: string,
    branch?: BranchId
  ): Promise<Invoice | null> {
    const target = await this.findEstimationByIdOrTokenAsync(idOrToken);
    const activeBranch = branch || (target ? target.branch : this.getActiveBranch());
    const now = new Date().toISOString();

    let targetInvoice: Invoice | null = target ? target.estimation : null;
    if (targetInvoice) {
      targetInvoice = {
        ...targetInvoice,
        customer_response: 'pending',
        ttd_status: 'pending',
        customer_signed_name: customerName,
        customer_signed_at: now,
        updated_at: now,
      };
    }

    // 1. Update cache lokal Invoices
    const key = getBranchKey(BASE_STORAGE_KEYS.INVOICES, activeBranch);
    const invoices = getLocal<Invoice[]>(key, []);
    const idx = invoices.findIndex(
      (i) => i.id === idOrToken || i.invoice_number === idOrToken || (targetInvoice && i.id === targetInvoice.id)
    );
    if (idx !== -1 && targetInvoice) {
      invoices[idx] = targetInvoice;
      setLocal(key, invoices);
    } else if (targetInvoice) {
      invoices.unshift(targetInvoice);
      setLocal(key, invoices);
    }

    // 2. Update cache lokal Work Orders
    const woId = targetInvoice?.work_order_id || idOrToken;
    if (woId) {
      const woKey = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, activeBranch);
      const workOrders = getLocal<WorkOrder[]>(woKey, []);
      const woIdx = workOrders.findIndex((w) => w.id === woId || w.spk_number === woId);
      if (woIdx !== -1 && targetInvoice) {
        const tabKey = (targetInvoice as any).tab_id || targetInvoice.estimation_tab || 'tab_1';
        workOrders[woIdx] = {
          ...workOrders[woIdx],
          checklist_data: {
            ...(workOrders[woIdx].checklist_data || {}),
            estimation: targetInvoice,
            [`estimation_${tabKey}`]: targetInvoice,
            customer_response: 'pending',
          },
          updated_at: now,
        };
        setLocal(woKey, workOrders);
      }
    }

    // 3. Update Cloud Supabase
    if (supabase && isSupabaseConfigured && targetInvoice) {
      try {
        const targetWoId = targetInvoice.work_order_id || idOrToken;
        const { data: woData } = await supabase
          .from('work_orders')
          .select('*')
          .or(`id.eq.${targetWoId},spk_number.eq.${targetWoId}`)
          .limit(1);

        if (woData && woData[0]) {
          const remoteWo = woData[0];
          const existingChecklist = remoteWo.checklist_data || {};
          const tabKey = (targetInvoice as any).tab_id || targetInvoice.estimation_tab || 'tab_1';

          await supabase
            .from('work_orders')
            .update({
              checklist_data: {
                ...existingChecklist,
                estimation: targetInvoice,
                [`estimation_${tabKey}`]: targetInvoice,
                customer_response: 'pending',
              },
              updated_at: now,
            })
            .eq('id', remoteWo.id);
        }
      } catch (err) {
        console.warn('Supabase savePendingResponse error:', err);
      }
    }

    return targetInvoice;
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

  /**
   * Mengambil data terbaru langsung dari database Supabase dan mengupdate local storage untuk semua cabang
   */
  static async syncFromSupabase(branch?: BranchId): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    const allBranches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];

    try {
      // 1. Fetch Vehicles (lintas semua cabang) — SMART MERGE
      const { data: vData, error: vErr } = await supabase
        .from('vehicles_customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!vErr && vData) {
        const cloudVehicles: VehicleCustomer[] = vData.map((v) => ({
          id: v.id,
          customer_name: v.customer_name,
          phone_number: v.phone_number,
          email: v.email || undefined,
          address: v.address || undefined,
          license_plate: v.license_plate,
          car_brand: v.car_brand,
          car_model: v.car_model,
          car_year: v.car_year || undefined,
          engine_number: v.engine_number || undefined,
          chassis_number: v.chassis_number || undefined,
          current_mileage: v.current_mileage || 0,
          last_service_date: v.last_service_date || undefined,
          next_service_due_date: v.next_service_due_date || undefined,
          created_at: v.created_at,
          updated_at: v.updated_at,
        }));

        // Smart merge: gabungkan cloud dengan lokal, yang lebih baru menang
        allBranches.forEach((b) => {
          const localVehicles = getLocal<VehicleCustomer[]>(getBranchKey(BASE_STORAGE_KEYS.VEHICLES, b), []);
          const merged = smartMergeById(cloudVehicles, localVehicles);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.VEHICLES, b), merged);
        });
      }

      // 2. Fetch Work Orders & Checkups — SMART MERGE
      const { data: woData, error: woErr } = await supabase
        .from('work_orders')
        .select('*, vehicle:vehicles_customers(*)')
        .order('created_at', { ascending: false });

      const extraInvoicesFromWO: Invoice[] = [];

      if (!woErr && woData) {
        const cloudWorkOrders: Record<string, WorkOrder[]> = {
          'MHS 1': [],
          'MHS 2': [],
          'MHS 3': [],
        };
        const cloudCheckups: Record<string, CheckupRecord[]> = {
          'MHS 1': [],
          'MHS 2': [],
          'MHS 3': [],
        };

        woData.forEach((row: any) => {
          const targetBranch: string = row.checklist_data?.received_at_branch || 'MHS 1';
          const branchKey = cloudWorkOrders[targetBranch] ? targetBranch : 'MHS 1';

          const vehicle: VehicleCustomer | undefined = row.vehicle ? {
            id: row.vehicle.id,
            customer_name: row.vehicle.customer_name,
            phone_number: row.vehicle.phone_number,
            license_plate: row.vehicle.license_plate,
            car_brand: row.vehicle.car_brand,
            car_model: row.vehicle.car_model,
            current_mileage: row.vehicle.current_mileage || 0,
          } : undefined;

          const isStandaloneCheckup =
            row.spk_number.startsWith('QC-') ||
            row.spk_number.startsWith('AC-') ||
            row.spk_number.startsWith('UND-');

          const checklist = row.checklist_data || {};

          if (!isStandaloneCheckup) {
            const wo: WorkOrder = {
              id: row.id,
              spk_number: row.spk_number,
              vehicle_id: row.vehicle_id,
              sa_id: row.sa_id || undefined,
              mechanic_name: row.mechanic_name || undefined,
              entry_date: row.entry_date,
              finish_date: row.finish_date || undefined,
              complaints: row.complaints,
              fuel_level: row.fuel_level,
              notes: row.notes || undefined,
              source_info: checklist.source_info,
              vehicle_status: checklist.vehicle_status,
              received_at_branch: checklist.received_at_branch || (branchKey as BranchId),
              signature_customer_url: checklist.signature_customer_url,
              signature_mechanic_url: checklist.signature_mechanic_url,
              signature_sa_url: checklist.signature_sa_url,
              checklist_data: checklist,
              status: row.status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              vehicle,
            };
            cloudWorkOrders[branchKey].push(wo);

            // FIX: Extract estimasi dari semua format tab ID
            // Mendukung: estimation, estimation_tab_1, estimation_tab_{timestamp}
            Object.keys(checklist).forEach((k) => {
              if (k === 'estimation' && checklist[k]) {
                const est = checklist[k];
                if (est.invoice_number) {
                  extraInvoicesFromWO.push({ ...est, work_order_id: row.id, vehicle });
                }
              } else if (k.startsWith('estimation_') && k !== 'estimation' && checklist[k]) {
                // Matches: estimation_tab_1, estimation_tab_1234567890, estimation_tab_{id}
                const est = checklist[k];
                if (est && est.invoice_number) {
                  extraInvoicesFromWO.push({ ...est, work_order_id: row.id, vehicle });
                }
              }
            });
          }

          // Extract checkup records
          if (checklist.checkup_record) {
            cloudCheckups[branchKey].push(checklist.checkup_record);
          } else if (isStandaloneCheckup) {
            const checkupType: CheckupType = row.spk_number.startsWith('AC-')
              ? 'ac_specialist'
              : (row.spk_number.startsWith('UND-') ? 'understeel' : 'qc_general');
            const rec: CheckupRecord = {
              id: row.id,
              type: checklist.checkup_type || checkupType,
              document_number: row.spk_number,
              vehicle_id: row.vehicle_id,
              customer_name: vehicle?.customer_name || 'Pelanggan',
              license_plate: vehicle?.license_plate || 'W 0000 XX',
              car_model: vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil',
              technician_name: row.mechanic_name || 'Mekanik',
              check_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
              qc_data: checklist.qc_data || undefined,
              ac_data: checklist.ac_data || undefined,
              understeel_data: checklist.understeel_data || undefined,
              created_at: row.created_at,
              updated_at: row.updated_at,
            };
            cloudCheckups[branchKey].push(rec);
          }
        });

        // SMART MERGE: gabungkan work orders cloud dengan lokal (bukan overwrite brutal)
        allBranches.forEach((b) => {
          const localWOs = getLocal<WorkOrder[]>(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), []);
          const mergedWOs = smartMergeById<WorkOrder>(cloudWorkOrders[b] || [], localWOs, 'id');
          setLocal(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), mergedWOs);

          const localCheckups = getLocal<CheckupRecord[]>(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b), []);
          const mergedCheckups = smartMergeById<CheckupRecord>(cloudCheckups[b] || [], localCheckups, 'id');
          setLocal(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b), mergedCheckups);
        });
      }

      // 3. Fetch Invoices & Estimations — SMART MERGE
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!invErr && invData) {
        const cloudInvoicesMap = new Map<string, Invoice>();

        invData.forEach((row: any) => {
          const inv: Invoice = {
            id: row.id,
            invoice_number: row.invoice_number,
            type: row.type || (row.invoice_number?.startsWith('EST-') ? 'estimation' : 'invoice'),
            work_order_id: row.work_order_id || undefined,
            vehicle_id: row.vehicle_id,
            items: Array.isArray(row.items) ? row.items : [],
            subtotal: Number(row.subtotal) || 0,
            discount_amount: Number(row.discount_amount) || 0,
            tax_percent: Number(row.tax_percent) || 0,
            tax_amount: Number(row.tax_amount) || 0,
            total_amount: Number(row.total_amount) || 0,
            down_payment: Number(row.down_payment) || 0,
            balance_due: Number(row.balance_due) || 0,
            payment_status: row.payment_status || 'pending',
            payment_method: row.payment_method || undefined,
            admin_notes: row.admin_notes || undefined,
            signature_customer_url: row.signature_customer_url || undefined,
            signature_admin_url: row.signature_admin_url || undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
            estimation_type: row.estimation_type || undefined,
            estimation_tab: row.estimation_tab || undefined,
            estimation_date: row.estimation_date || undefined,
            estimation_time: row.estimation_time || undefined,
            vehicle_status: row.vehicle_status || undefined,
            payment_plan: row.payment_plan || undefined,
            estimator_name: row.estimator_name || undefined,
            estimator_signature: row.estimator_signature || row.signature_admin_url || undefined,
            estimated_duration: row.estimated_duration || undefined,
            customer_response: row.customer_response || undefined,
            customer_response_note: row.customer_response_note || undefined,
            has_discount: row.has_discount,
            has_opsi2: row.has_opsi2,
            has_tax: row.has_tax,
            total_opsi1: row.total_opsi1,
            total_opsi2: row.total_opsi2,
            ttd_status: row.ttd_status,
            customer_signature: row.signature_customer_url || row.customer_signature,
            customer_signed_at: row.customer_signed_at,
            customer_signed_name: row.customer_signed_name,
            customer_approved_option: row.customer_approved_option,
          };
          cloudInvoicesMap.set(inv.invoice_number || inv.id, inv);
        });

        // Tambahkan estimasi yang ditemukan di dalam checklist_data work_orders
        extraInvoicesFromWO.forEach((ext) => {
          const key = ext.invoice_number || ext.id;
          if (key && !cloudInvoicesMap.has(key)) {
            cloudInvoicesMap.set(key, ext);
          }
        });

        const cloudInvoices = Array.from(cloudInvoicesMap.values());

        // SMART MERGE: gabungkan invoices cloud dengan lokal per cabang
        allBranches.forEach((b) => {
          const localInvs = getLocal<Invoice[]>(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), []);
          // Gunakan invoice_number sebagai key merge karena lebih reliable dari id
          const merged = new Map<string, Invoice>();

          // Masukkan lokal dulu
          localInvs.forEach((inv) => {
            merged.set(inv.invoice_number || inv.id, inv);
          });

          // Cloud menang jika updated_at lebih baru
          cloudInvoices.forEach((cloudInv) => {
            const key = cloudInv.invoice_number || cloudInv.id;
            const localInv = merged.get(key);
            if (!localInv) {
              merged.set(key, cloudInv);
            } else {
              const cloudTime = cloudInv.updated_at ? new Date(cloudInv.updated_at).getTime() : 0;
              const localTime = localInv.updated_at ? new Date(localInv.updated_at).getTime() : 0;
              if (cloudTime >= localTime) {
                merged.set(key, cloudInv);
              }
            }
          });

          setLocal(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), Array.from(merged.values()));
        });
      }

      return true;
    } catch (err) {
      console.warn('Supabase syncFromSupabase exception:', err);
      return false;
    }
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

    setLocal(keyVehicles, []);
    setLocal(keyInventory, []);
    setLocal(keyWorkOrders, []);
    setLocal(keyInvoices, []);
    setLocal(keyCrm, []);
    setLocal(keySettings, defaultBranchSettings);
    setLocal(keyMovements, []);
    setLocal(keyAudit, []);
    setLocal(keyCheckups, []);
  }
}
