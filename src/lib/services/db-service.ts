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
        const checklistPayload: Record<string, any> = {
          source_info: workOrder.source_info || 'REFERENSI',
          vehicle_status: workOrder.vehicle_status || 'Ditunggu',
          received_at_branch: workOrder.received_at_branch || branch || DBService.getActiveBranch(),
          signature_customer_url: workOrder.signature_customer_url || null,
          signature_mechanic_url: workOrder.signature_mechanic_url || null,
          signature_sa_url: workOrder.signature_sa_url || null,
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
          checklist_data: checklistPayload,
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
      }
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
            received_at_branch: branch || DBService.getActiveBranch(),
          };

          await supabase
            .from('work_orders')
            .upsert({
              spk_number: checkup.document_number,
              vehicle_id: vehicleId,
              mechanic_name: checkup.technician_name || 'Agus Susanto',
              entry_date: checkup.check_date ? new Date(checkup.check_date).toISOString() : new Date().toISOString(),
              finish_date: new Date().toISOString(),
              complaints: checkup.type === 'qc_general' ? 'QC General Checkup & Tune Up' : 'Pemeriksaan Spesialis AC',
              fuel_level: 50,
              status: 'completed',
              notes: 'Lembar QC/AC Checkup Resmi',
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
      }
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
   * Mengambil data terbaru langsung dari database Supabase dan mengupdate local storage
   */
  static async syncFromSupabase(branch?: BranchId): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    const activeBranch = branch || this.getActiveBranch();

    try {
      // 1. Fetch Vehicles
      const { data: vData, error: vErr } = await supabase
        .from('vehicles_customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!vErr && vData) {
        const vehicles: VehicleCustomer[] = vData.map((v) => ({
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

        const keyVehicles = getBranchKey(BASE_STORAGE_KEYS.VEHICLES, activeBranch);
        setLocal(keyVehicles, vehicles);
      }

      // 2. Fetch Work Orders & Checkups
      const { data: woData, error: woErr } = await supabase
        .from('work_orders')
        .select('*, vehicle:vehicles_customers(*)')
        .order('created_at', { ascending: false });

      if (!woErr && woData) {
        const workOrders: WorkOrder[] = [];
        const checkups: CheckupRecord[] = [];

        woData.forEach((row: any) => {
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
            row.spk_number.startsWith('AC-');

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
              received_at_branch: checklist.received_at_branch,
              signature_customer_url: checklist.signature_customer_url,
              signature_mechanic_url: checklist.signature_mechanic_url,
              signature_sa_url: checklist.signature_sa_url,
              status: row.status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              vehicle,
            };
            workOrders.push(wo);
          }

          // Extract checkup records
          if (checklist.checkup_record) {
            checkups.push(checklist.checkup_record);
          } else if (isStandaloneCheckup) {
            const checkupType: CheckupType = row.spk_number.startsWith('AC-') ? 'ac_specialist' : 'qc_general';
            const rec: CheckupRecord = {
              id: row.id,
              type: checklist.checkup_type || checkupType,
              document_number: row.spk_number,
              vehicle_id: row.vehicle_id,
              customer_name: vehicle?.customer_name || 'Pelanggan',
              license_plate: vehicle?.license_plate || 'W 0000 XX',
              car_model: vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil',
              technician_name: row.mechanic_name || 'Agus Susanto',
              check_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
              qc_data: checklist.qc_data || undefined,
              ac_data: checklist.ac_data || undefined,
              created_at: row.created_at,
              updated_at: row.updated_at,
            };
            checkups.push(rec);
          }
        });

        const keyWorkOrders = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, activeBranch);
        setLocal(keyWorkOrders, workOrders);

        const keyCheckups = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, activeBranch);
        setLocal(keyCheckups, checkups);
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
