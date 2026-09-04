import {
  VehicleCustomer,
  InventoryItem,
  WorkOrder,
  Invoice,
  CRMLog,
  CRMReminderPeriod,
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

export const SYSTEM_DATA_EPOCH = '2026-09-05T06:40:00.000Z';

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

// ─── SMART MERGE & RELATIONAL DATA INTEGRITY HELPERS ─────────────────────────

function normalizeBranch(b?: string): BranchId {
  if (!b) return 'MHS 1';
  const upper = b.toUpperCase().trim();
  if (upper.includes('2') || upper.includes('TROSOBO')) return 'MHS 2';
  if (upper.includes('3') || upper.includes('SURABAYA')) return 'MHS 3';
  return 'MHS 1';
}

/**
 * Sanitasi checklist_data dari circular nesting (misal invoice menyimpan work_order di dalamnya).
 * Menghapus duplikasi object besar agar payload storage dan database tetap ringan (< 50 KB).
 */
export function sanitizeChecklistData(checklist: any): any {
  if (!checklist || typeof checklist !== 'object' || Array.isArray(checklist)) {
    return checklist || {};
  }
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(checklist)) {
    if (key === 'estimation' || key.startsWith('estimation_')) {
      if (value && typeof value === 'object') {
        const est = { ...(value as any) };
        delete est.work_order;
        delete est.vehicle;
        clean[key] = est;
      } else {
        clean[key] = value;
      }
    } else if (key === 'work_order' || key === 'workOrders' || key === 'allWorkOrders') {
      continue;
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Smart merge WorkOrders dengan rekonsiliasi SPK Number & UUID
 * Memperbarui ID invoice & checkup lokal jika ID SPK berganti dari temporary ke UUID
 */
function smartMergeWorkOrders(
  cloudItems: WorkOrder[],
  localItems: WorkOrder[],
  branch: BranchId
): WorkOrder[] {
  const mergedMap = new Map<string, WorkOrder>();
  const idMap = new Map<string, string>(); // oldLocalId -> newCloudId

  // Ambil offline queue untuk memastikan item lokal yang belum terkirim tidak hilang
  const queue = typeof window !== 'undefined' ? getLocal<OfflineQueueEntry[]>(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []) : [];
  const pendingKeys = new Set(
    queue.filter((q) => q.type === 'work_order').map((q) => q.payload?.spk_number || q.payload?.id)
  );

  // Hanya masukkan item lokal jika memang pending di offline queue atau belum pernah terkirim ke cloud
  localItems.forEach((local) => {
    const key = local.spk_number || local.id;
    const isUnsynced = local.id?.startsWith('wo-') || pendingKeys.has(key);
    if (isUnsynced) {
      mergedMap.set(key, local);
    }
  });

  // Merge dengan cloud (cloud adalah otoritas utama)
  cloudItems.forEach((cloud) => {
    const key = cloud.spk_number || cloud.id;
    const local = mergedMap.get(key) || localItems.find((l) => l.id === cloud.id || l.spk_number === cloud.spk_number);

    if (!local) {
      mergedMap.set(key, cloud);
    } else {
      // Catat pemetaan jika ID lokal sementara digantikan UUID cloud
      if (local.id && cloud.id && local.id !== cloud.id) {
        idMap.set(local.id, cloud.id);
        if (local.spk_number) {
          idMap.set(local.spk_number, cloud.id);
        }
      }

      const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;

      if (cloudTime >= localTime) {
        // Cloud menang, tapi pertahankan tabs/estimasi di checklist_data lokal jika ada
        const mergedChecklist = sanitizeChecklistData({
          ...((local as any).checklist_data || {}),
          ...((cloud as any).checklist_data || {}),
        });
        mergedMap.set(key, { ...cloud, checklist_data: mergedChecklist });
      } else {
        // Lokal menang karena ada editan offline/lokal yang lebih baru, tapi adopsi UUID cloud
        const mergedChecklist = sanitizeChecklistData({
          ...((cloud as any).checklist_data || {}),
          ...((local as any).checklist_data || {}),
        });
        mergedMap.set(key, { ...local, id: cloud.id, checklist_data: mergedChecklist });
      }
    }
  });

  // Cascade update work_order_id ke Invoices & Checkups lokal jika ada id yang berganti ke UUID
  if (idMap.size > 0 && typeof window !== 'undefined') {
    ['MHS 1', 'MHS 2', 'MHS 3'].forEach((b) => {
      const invKey = getBranchKey(BASE_STORAGE_KEYS.INVOICES, b as BranchId);
      const invs = getLocal<Invoice[]>(invKey, []);
      let changed = false;
      invs.forEach((inv) => {
        if (inv.work_order_id && idMap.has(inv.work_order_id)) {
          inv.work_order_id = idMap.get(inv.work_order_id)!;
          changed = true;
        }
      });
      if (changed) setLocal(invKey, invs);

      const chkKey = getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b as BranchId);
      const chks = getLocal<CheckupRecord[]>(chkKey, []);
      let chkChanged = false;
      chks.forEach((chk) => {
        if (chk.work_order_id && idMap.has(chk.work_order_id)) {
          chk.work_order_id = idMap.get(chk.work_order_id)!;
          chkChanged = true;
        }
      });
      if (chkChanged) setLocal(chkKey, chks);
    });
  }

  return Array.from(mergedMap.values());
}

/**
 * Smart merge Invoices & Estimations dengan rekonsiliasi Invoice Number
 */
function smartMergeInvoices(cloudItems: Invoice[], localItems: Invoice[]): Invoice[] {
  const mergedMap = new Map<string, Invoice>();
  const queue = typeof window !== 'undefined' ? getLocal<OfflineQueueEntry[]>(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []) : [];
  const pendingKeys = new Set(
    queue.filter((q) => q.type === 'invoice').map((q) => q.payload?.invoice_number || q.payload?.id)
  );

  localItems.forEach((local) => {
    const key = local.invoice_number || local.id;
    const isUnsynced = local.id?.startsWith('inv-') || pendingKeys.has(key);
    if (isUnsynced) {
      mergedMap.set(key, local);
    }
  });

  cloudItems.forEach((cloud) => {
    const key = cloud.invoice_number || cloud.id;
    const local = mergedMap.get(key) || localItems.find((l) => l.id === cloud.id || l.invoice_number === cloud.invoice_number);

    if (!local) {
      mergedMap.set(key, cloud);
    } else {
      const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (cloudTime >= localTime) {
        mergedMap.set(key, cloud);
      } else {
        mergedMap.set(key, { ...local, id: cloud.id });
      }
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Smart merge Checkup Records dengan rekonsiliasi Document Number
 */
function smartMergeCheckups(cloudItems: CheckupRecord[], localItems: CheckupRecord[]): CheckupRecord[] {
  const mergedMap = new Map<string, CheckupRecord>();
  const queue = typeof window !== 'undefined' ? getLocal<OfflineQueueEntry[]>(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []) : [];
  const pendingKeys = new Set(
    queue.filter((q) => q.type === 'checkup').map((q) => q.payload?.document_number || q.payload?.id)
  );

  localItems.forEach((local) => {
    const key = local.document_number || local.id;
    const isUnsynced = local.id?.startsWith('chk-') || pendingKeys.has(key);
    if (isUnsynced) {
      mergedMap.set(key, local);
    }
  });

  cloudItems.forEach((cloud) => {
    const key = cloud.document_number || cloud.id;
    const local = mergedMap.get(key) || localItems.find((l) => l.id === cloud.id || l.document_number === cloud.document_number);

    if (!local) {
      mergedMap.set(key, cloud);
    } else {
      const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (cloudTime >= localTime) {
        mergedMap.set(key, cloud);
      } else {
        mergedMap.set(key, { ...local, id: cloud.id });
      }
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Smart merge Vehicles dengan rekonsiliasi Plat Nomor
 */
function smartMergeVehicles(cloudItems: VehicleCustomer[], localItems: VehicleCustomer[]): VehicleCustomer[] {
  const mergedMap = new Map<string, VehicleCustomer>();
  const queue = typeof window !== 'undefined' ? getLocal<OfflineQueueEntry[]>(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []) : [];
  const pendingKeys = new Set(
    queue.filter((q) => q.type === 'vehicle').map((q) => q.payload?.license_plate || q.payload?.id)
  );

  localItems.forEach((local) => {
    const key = local.license_plate ? local.license_plate.toUpperCase().replace(/\s+/g, '') : local.id;
    const isUnsynced = local.id?.startsWith('veh-') || pendingKeys.has(key);
    if (isUnsynced) {
      mergedMap.set(key, local);
    }
  });

  cloudItems.forEach((cloud) => {
    const key = cloud.license_plate ? cloud.license_plate.toUpperCase().replace(/\s+/g, '') : cloud.id;
    const local = mergedMap.get(key) || localItems.find((l) => l.id === cloud.id || (l.license_plate && l.license_plate.toUpperCase().replace(/\s+/g, '') === key));

    if (!local) {
      mergedMap.set(key, cloud);
    } else {
      const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (cloudTime >= localTime) {
        mergedMap.set(key, cloud);
      } else {
        mergedMap.set(key, { ...local, id: cloud.id });
      }
    }
  });

  return Array.from(mergedMap.values());
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
  } catch (e: any) {
    console.error(`Error saving ${key} to localStorage:`, e);
    // Jika quota storage browser penuh (QuotaExceededError)
    if (
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22 ||
      e?.code === 1014
    ) {
      try {
        console.warn('Storage quota exceeded! Membersihkan temporary cache & drafts...');
        Object.keys(localStorage).forEach((k) => {
          if (
            k.startsWith('mhs_est_draft_') ||
            k.startsWith('mhs_est_saved_') ||
            k.startsWith('mhs_est_tabs_')
          ) {
            localStorage.removeItem(k);
          }
        });
        localStorage.setItem(key, JSON.stringify(value));
        console.info(`Berhasil menyimpan ${key} setelah pembersihan cache.`);
      } catch (retryErr) {
        console.error('Storage masih penuh setelah pembersihan cache:', retryErr);
      }
    }
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
   * Pembersihan total data transaksi lokal jika terdeteksi versi reset baru (Clean Slate)
   */
  static checkAndApplyDataResetEpoch(): void {
    if (typeof window === 'undefined') return;
    try {
      const currentEpoch = localStorage.getItem('acwms_last_reset_epoch');
      if (!currentEpoch || new Date(currentEpoch).getTime() < new Date(SYSTEM_DATA_EPOCH).getTime()) {
        console.info('[DataEpoch] 🧹 Melakukan pembersihan data lokal untuk versi aplikasi baru...');
        const allBranches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
        allBranches.forEach((b) => {
          setLocal(getBranchKey(BASE_STORAGE_KEYS.VEHICLES, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.AUDIT, b), []);
        });
        setLocal(BASE_STORAGE_KEYS.OFFLINE_QUEUE, []);

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (
            k.startsWith('mhs_est_') ||
            k.startsWith('mhs_last_active_') ||
            k.startsWith('acwms_work_orders') ||
            k.startsWith('acwms_invoices') ||
            k.startsWith('acwms_checkups') ||
            k.startsWith('acwms_vehicles')
          )) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        allBranches.forEach((b) => {
          setLocal(getBranchKey(BASE_STORAGE_KEYS.VEHICLES, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), []);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b), []);
        });

        localStorage.setItem('acwms_last_reset_epoch', SYSTEM_DATA_EPOCH);
        console.info('[DataEpoch] ✅ Pembersihan data transaksi selesai. Aplikasi siap digunakan sebagai baru.');
      }
    } catch (e) {
      console.warn('[DataEpoch] Gagal membersihkan data lokal:', e);
    }
  }

  /**
   * Inisialisasi data per cabang dengan isolasi penuh
   */
  static init(targetBranch?: BranchId): void {
    if (typeof window === 'undefined') return;

    this.checkAndApplyDataResetEpoch();

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

    // Pastikan data inventaris MHS 2 dan MHS 3 bersih dan kosong dari data dummy/mock bawaan
    const CLEAN_MHS23_INVENTORY_FLAG = 'acwms_mhs23_inventory_cleared_v2';
    if (!localStorage.getItem(CLEAN_MHS23_INVENTORY_FLAG)) {
      setLocal(getBranchKey(BASE_STORAGE_KEYS.INVENTORY, 'MHS 2'), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.INVENTORY, 'MHS 3'), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, 'MHS 2'), []);
      setLocal(getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, 'MHS 3'), []);
      localStorage.setItem(CLEAN_MHS23_INVENTORY_FLAG, 'true');
    }

    // Pastikan storage lokal bersih dari data circular legacy yang melebihi kuota 5MB browser
    const STORAGE_CLEANUP_FLAG = 'acwms_quota_fix_v5';
    if (!localStorage.getItem(STORAGE_CLEANUP_FLAG)) {
      Object.keys(localStorage).forEach((k) => {
        if (
          k.startsWith('mhs_est_draft_') ||
          k.startsWith('mhs_est_saved_') ||
          k.startsWith('mhs_est_tabs_')
        ) {
          localStorage.removeItem(k);
        }
      });
      ['MHS 1', 'MHS 2', 'MHS 3'].forEach((b) => {
        localStorage.removeItem(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b as BranchId));
        localStorage.removeItem(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b as BranchId));
      });
      localStorage.setItem(STORAGE_CLEANUP_FLAG, 'true');
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

  static getAllVehicles(): VehicleCustomer[] {
    const branches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
    const map = new Map<string, VehicleCustomer>();
    branches.forEach((b) => {
      this.getVehicles(b).forEach((v) => {
        if (!map.has(v.id)) {
          map.set(v.id, v);
        }
      });
    });
    return Array.from(map.values());
  }

  static getVehicleById(id: string, branch?: BranchId): VehicleCustomer | undefined {
    if (branch) {
      const found = this.getVehicles(branch).find((v) => v.id === id);
      if (found) return found;
    }
    return this.getAllVehicles().find((v) => v.id === id);
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

  static deleteInventoryItem(
    id: string,
    userRole: UserRole = 'owner',
    branch?: BranchId
  ): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, branch);
    const inventory = this.getInventory(branch);
    const itemToDelete = inventory.find((i) => i.id === id);
    if (!itemToDelete) return false;

    const filtered = inventory.filter((i) => i.id !== id);
    setLocal(key, filtered);

    this.logAudit(
      'User',
      userRole,
      'DELETE_ITEM',
      'inventory',
      id,
      { item_code: itemToDelete.item_code, name: itemToDelete.name },
      branch
    );

    return true;
  }

  static clearBranchInventory(
    branch?: BranchId,
    userRole: UserRole = 'owner'
  ): boolean {
    const targetBranch = branch || this.getActiveBranch();
    const keyInv = getBranchKey(BASE_STORAGE_KEYS.INVENTORY, targetBranch);
    const keyMov = getBranchKey(BASE_STORAGE_KEYS.MOVEMENTS, targetBranch);
    setLocal(keyInv, []);
    setLocal(keyMov, []);
    this.logAudit(
      'User',
      userRole,
      'CLEAR_INVENTORY',
      'inventory',
      targetBranch,
      { action: 'CLEAR_ALL_BRANCH_INVENTORY', branch: targetBranch },
      targetBranch
    );
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

    return orders
      .map((order) => ({
        ...order,
        vehicle: vehicles.find((v) => v.id === order.vehicle_id) || order.vehicle,
      }))
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.entry_date || 0).getTime() || 0;
        const timeB = new Date(b.created_at || b.entry_date || 0).getTime() || 0;
        return timeB - timeA;
      });
  }

  static getAllWorkOrders(): WorkOrder[] {
    const branches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
    const map = new Map<string, WorkOrder>();
    branches.forEach((b) => {
      this.getWorkOrders(b).forEach((wo) => {
        const key = wo.spk_number || wo.id;
        if (!map.has(key)) {
          map.set(key, { ...wo, received_at_branch: wo.received_at_branch || b });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.created_at || a.entry_date || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.entry_date || 0).getTime() || 0;
      return timeB - timeA;
    });
  }

  static getWorkOrderById(id: string, branch?: BranchId): WorkOrder | undefined {
    if (branch) {
      const found = this.getWorkOrders(branch).find((w) => w.id === id || w.spk_number === id);
      if (found) return found;
    }
    return this.getAllWorkOrders().find((w) => w.id === id || w.spk_number === id);
  }

  static saveWorkOrder(
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string },
    branch?: BranchId
  ): WorkOrder {
    const targetBranch: BranchId = normalizeBranch(workOrder.received_at_branch || branch || this.getActiveBranch());
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, targetBranch);
    const orders = getLocal<WorkOrder[]>(key, []);
    let saved: WorkOrder;

    if (workOrder.id) {
      const idx = orders.findIndex((o) => o.id === workOrder.id);
      if (idx !== -1) {
        saved = {
          ...orders[idx],
          ...workOrder,
          checklist_data: sanitizeChecklistData(workOrder.checklist_data || orders[idx].checklist_data),
          updated_at: new Date().toISOString(),
        } as WorkOrder;
        orders[idx] = saved;
      } else {
        saved = {
          ...workOrder,
          id: workOrder.id,
          spk_number: workOrder.spk_number || `SPK-${Date.now().toString().slice(-6)}`,
          checklist_data: sanitizeChecklistData(workOrder.checklist_data),
          created_at: workOrder.created_at || new Date().toISOString(),
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
        checklist_data: sanitizeChecklistData(workOrder.checklist_data),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as WorkOrder;
      orders.unshift(saved);
    }

    orders.sort((a, b) => {
      const timeA = new Date(a.created_at || a.entry_date || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.entry_date || 0).getTime() || 0;
      return timeB - timeA;
    });

    setLocal(key, orders);
    return this.getWorkOrderById(saved.id, targetBranch) || saved;
  }

  /**
   * Simpan atau update Surat Perintah Kerja (SPK) langsung ke Supabase
   */
  static async saveWorkOrderAsync(
    workOrder: Omit<WorkOrder, 'id' | 'spk_number'> & { id?: string; spk_number?: string },
    branch?: BranchId
  ): Promise<WorkOrder> {
    const targetBranch: BranchId = normalizeBranch(workOrder.received_at_branch || branch || this.getActiveBranch());
    const localSaved = this.saveWorkOrder(workOrder, targetBranch);

    if (supabase && isSupabaseConfigured) {
      try {
        const mergedChecklist: Record<string, any> = sanitizeChecklistData({
          ...((localSaved as any).checklist_data || {}),
          ...((workOrder as any).checklist_data || {}),
          source_info: workOrder.source_info || (localSaved as any).source_info || 'REFERENSI',
          vehicle_status: workOrder.vehicle_status || (localSaved as any).vehicle_status || 'Ditunggu',
          received_at_branch: workOrder.received_at_branch || (localSaved as any).received_at_branch || targetBranch,
          signature_customer_url: workOrder.signature_customer_url || (localSaved as any).signature_customer_url || null,
          signature_mechanic_url: workOrder.signature_mechanic_url || (localSaved as any).signature_mechanic_url || null,
          signature_sa_url: workOrder.signature_sa_url || (localSaved as any).signature_sa_url || null,
        });

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

          const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, targetBranch);
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
        this.addToOfflineQueue('work_order', workOrder, targetBranch);
      }
    } else if (isSupabaseConfigured) {
      // Supabase dikonfigurasi tapi client null — offline, tambahkan ke queue
      this.addToOfflineQueue('work_order', workOrder, targetBranch);
    }

    return localSaved;
  }

  static updateWorkOrderStatus(id: string, status: WorkOrderStatus, userRole: UserRole = 'sa', branch?: BranchId): boolean {
    const key = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
    const orders = getLocal<WorkOrder[]>(key, []);
    let idx = orders.findIndex((o) => o.id === id);

    if (idx !== -1) {
      orders[idx].status = status;
      orders[idx].updated_at = new Date().toISOString();
      if (status === 'completed') {
        orders[idx].finish_date = new Date().toISOString();
      }
      setLocal(key, orders);
      return true;
    }

    // Jika tidak ditemukan di cabang yang diminta, cari di semua cabang
    const allBranches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
    for (const b of allBranches) {
      if (b === branch) continue;
      const bKey = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b);
      const bOrders = getLocal<WorkOrder[]>(bKey, []);
      const bIdx = bOrders.findIndex((o) => o.id === id);
      if (bIdx !== -1) {
        bOrders[bIdx].status = status;
        bOrders[bIdx].updated_at = new Date().toISOString();
        if (status === 'completed') {
          bOrders[bIdx].finish_date = new Date().toISOString();
        }
        setLocal(bKey, bOrders);
        return true;
      }
    }

    return false;
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
    if (userRole !== 'owner') {
      console.warn('Akses ditolak: Hanya peran Owner yang berwenang membuka kunci data SPK.');
      return false;
    }
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
    const checkups = getLocal<CheckupRecord[]>(key, []);
    const vehicles = this.getVehicles(branch);
    const workOrders = this.getWorkOrders(branch);

    return checkups
      .map((rec) => {
        const cleanPlate = rec.license_plate?.toUpperCase().replace(/\s+/g, '');
        const vehicle = vehicles.find(
          (v) =>
            v.id === rec.vehicle_id ||
            (cleanPlate && v.license_plate.toUpperCase().replace(/\s+/g, '') === cleanPlate)
        );
        const workOrder = workOrders.find(
          (w) =>
            w.id === rec.work_order_id ||
            w.spk_number === rec.document_number ||
            (rec.work_order_id && w.spk_number === rec.work_order_id)
        );
        return {
          ...rec,
          vehicle,
          work_order: workOrder,
        };
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.check_date || 0).getTime() || 0;
        const timeB = new Date(b.created_at || b.check_date || 0).getTime() || 0;
        return timeB - timeA;
      });
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
        saved = { ...checkup, id: checkup.id, created_at: checkup.created_at || new Date().toISOString() } as CheckupRecord;
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

    checkups.sort((a, b) => {
      const timeA = new Date(a.created_at || a.check_date || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.check_date || 0).getTime() || 0;
      return timeB - timeA;
    });

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
          const existingRecords = existingChecklist.checkup_records || {};
          const updatedRecords = {
            ...existingRecords,
            [localSaved.id]: localSaved,
            [checkup.type]: localSaved,
          };

          const updatedChecklist = {
            ...existingChecklist,
            checkup_record: localSaved,
            checkup_records: updatedRecords,
            checkup_type: checkup.type,
            qc_data: checkup.qc_data || existingChecklist.qc_data || null,
            ac_data: checkup.ac_data || existingChecklist.ac_data || null,
            understeel_data: checkup.understeel_data || existingChecklist.understeel_data || null,
          };

          await supabase
            .from('work_orders')
            .update({ checklist_data: updatedChecklist })
            .eq('id', checkup.work_order_id);

          // Update work_orders lokal juga langsung
          const woKey = getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, branch);
          const localWOs = getLocal<WorkOrder[]>(woKey, []);
          const woIdx = localWOs.findIndex((w) => w.id === checkup.work_order_id);
          if (woIdx !== -1) {
            localWOs[woIdx] = {
              ...localWOs[woIdx],
              checklist_data: updatedChecklist,
            };
            setLocal(woKey, localWOs);
          }
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

    return invoices.map((inv) => {
      const cleanPlate = inv.vehicle?.license_plate?.toUpperCase().replace(/\s+/g, '');
      const vehicle = vehicles.find(
        (v) =>
          v.id === inv.vehicle_id ||
          (cleanPlate && v.license_plate.toUpperCase().replace(/\s+/g, '') === cleanPlate)
      ) || inv.vehicle;

      const workOrder = workOrders.find(
        (w) =>
          w.id === inv.work_order_id ||
          w.spk_number === inv.work_order_id ||
          (inv.work_order?.spk_number && w.spk_number === inv.work_order.spk_number) ||
          (w.spk_number && inv.invoice_number && inv.invoice_number.includes(w.spk_number))
      ) || inv.work_order;

      return {
        ...inv,
        vehicle,
        work_order: workOrder,
      };
    });
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
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let validVehicleId = localSaved.vehicle_id;
        if (!validVehicleId || !uuidRegex.test(validVehicleId)) {
          const plate = (invoice as any).vehicle?.license_plate || (localSaved as any).vehicle?.license_plate;
          if (plate) {
            const { data: vRow } = await supabase
              .from('vehicles_customers')
              .select('id')
              .eq('license_plate', plate.toUpperCase().trim())
              .maybeSingle();
            if (vRow?.id) validVehicleId = vRow.id;
          }
        }

        let validWorkOrderId = localSaved.work_order_id || null;
        if (validWorkOrderId && !uuidRegex.test(validWorkOrderId)) {
          const { data: woRow } = await supabase
            .from('work_orders')
            .select('id')
            .eq('spk_number', validWorkOrderId)
            .maybeSingle();
          if (woRow?.id) validWorkOrderId = woRow.id;
          else validWorkOrderId = null;
        }

        const payload: Record<string, any> = {
          id: localSaved.id.startsWith('inv-') ? undefined : localSaved.id,
          invoice_number: localSaved.invoice_number,
          type: localSaved.type,
          work_order_id: validWorkOrderId,
          vehicle_id: validVehicleId,
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

        const client = supabase;
        if (!client) return localSaved;

        const syncToCloud = async (): Promise<Invoice> => {
          const { data, error } = await client
            .from('invoices')
            .upsert(payload, { onConflict: 'invoice_number' })
            .select('*');

          if (error) {
            console.warn('Supabase saveInvoice upsert warning:', error.message);
          }

          // Perbarui status work_order di cloud
          if (validWorkOrderId) {
            try {
              const nextStatus = (localSaved.type === 'invoice' && localSaved.payment_status === 'paid')
                ? 'completed'
                : (localSaved.type === 'estimation' ? 'estimating' : undefined);
              if (nextStatus) {
                await client
                  .from('work_orders')
                  .update({ status: nextStatus })
                  .eq('id', validWorkOrderId);
              }
            } catch (woErr) {
              console.warn('Failed to update work_order status with invoice:', woErr);
            }
          }

          if (data && data[0]) {
            return {
              ...localSaved,
              ...data[0],
              vehicle: localSaved.vehicle,
              work_order: localSaved.work_order,
            };
          }
          return localSaved;
        };

        const timeoutPromise = new Promise<Invoice>((_, reject) =>
          setTimeout(() => reject(new Error('Cloud sync timeout (4s)')), 4000)
        );

        return await Promise.race([syncToCloud(), timeoutPromise]);
      } catch (err) {
        console.warn('Supabase saveInvoice non-blocking exception / timeout:', err);
        // Tambahkan ke antrean offline untuk disinkronkan saat koneksi optimal
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
   * Menyimpan tanda tangan digital pelanggan dan status persetujuan opsi estimasi (opsi1, opsi2, atau batal)
   */
  static async approveEstimationSignature(
    idOrToken: string,
    signatureDataUrl: string,
    customerName: string,
    approvedOption: 'opsi1' | 'opsi2' | 'batal',
    branch?: BranchId
  ): Promise<Invoice | null> {
    const target = await this.findEstimationByIdOrTokenAsync(idOrToken);
    const activeBranch = branch || (target ? target.branch : this.getActiveBranch());
    const now = new Date().toISOString();
    const isBatal = approvedOption === 'batal';
    const newTtdStatus = isBatal ? 'rejected' : 'signed';
    const newWoStatus = isBatal ? 'cancelled' : 'approved';

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
        ttd_status: newTtdStatus,
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
        const sanitizedTarget = { ...targetInvoice };
        delete (sanitizedTarget as any).work_order;
        delete (sanitizedTarget as any).vehicle;

        workOrders[woIdx] = {
          ...workOrders[woIdx],
          status: workOrders[woIdx].status === 'completed' ? 'completed' : newWoStatus,
          signature_customer_url: signatureDataUrl,
          checklist_data: sanitizeChecklistData({
            ...(workOrders[woIdx].checklist_data || {}),
            estimation: sanitizedTarget,
            [`estimation_${tabKey}`]: sanitizedTarget,
            signature_customer_url: signatureDataUrl,
            customer_signed_name: customerName,
            customer_signed_at: now,
            customer_approved_option: approvedOption,
            customer_response: approvedOption,
          }),
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
              status: remoteWo.status === 'completed' ? 'completed' : newWoStatus,
              signature_url: signatureDataUrl,
              checklist_data: {
                ...existingChecklist,
                estimation: targetInvoice,
                [`estimation_${tabKey}`]: targetInvoice,
                signature_customer_url: signatureDataUrl,
                customer_signed_name: customerName,
                customer_signed_at: now,
                customer_approved_option: approvedOption,
                customer_response: approvedOption,
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
      this.updateWorkOrderStatus(targetInvoice.work_order_id, newWoStatus, 'sa', activeBranch);
    }

    // Log audit
    this.logAudit(
      customerName || 'Customer via Link TTD',
      'sa',
      isBatal ? 'CUSTOMER_REJECT_ESTIMATION' : 'CUSTOMER_SIGN_ESTIMATION',
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
    const manualLogs = getLocal<CRMLog[]>(key, []);
    const vehicles = this.getVehicles(branch);
    const workOrders = this.getWorkOrders(branch).filter((w) => w.status === 'completed');

    // Buat map log manual/tersimpan agar status update (contacted/scheduled/notes) tidak hilang
    const logsMap = new Map<string, CRMLog>();
    manualLogs.forEach((l) => {
      logsMap.set(l.id, l);
    });

    // Otomatis generate 4 milestone follow-up untuk setiap SPK yang sudah selesai
    workOrders.forEach((wo) => {
      const v = wo.vehicle || vehicles.find((veh) => veh.id === wo.vehicle_id) || this.getVehicleById(wo.vehicle_id);
      const finishDateStr = wo.finish_date || wo.updated_at || wo.entry_date || new Date().toISOString();
      const finishTime = new Date(finishDateStr).getTime();

      const milestones: { period: CRMReminderPeriod; days: number }[] = [
        { period: '1_week', days: 7 },
        { period: '2_weeks', days: 14 },
        { period: '1_month', days: 30 },
        { period: '3_months', days: 90 },
      ];

      milestones.forEach(({ period, days }) => {
        const logId = `crm-${wo.id}-${period}`;
        const dueDate = new Date(finishTime + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        if (!logsMap.has(logId)) {
          const newLog: CRMLog = {
            id: logId,
            vehicle_id: wo.vehicle_id,
            work_order_id: wo.id,
            spk_number: wo.spk_number,
            branch: wo.received_at_branch || branch || 'MHS 1',
            service_date: finishDateStr,
            due_date: dueDate,
            reminder_type: period,
            status: 'pending',
            created_at: wo.created_at || new Date().toISOString(),
            updated_at: wo.updated_at || new Date().toISOString(),
          };
          logsMap.set(logId, newLog);
        } else {
          const existing = logsMap.get(logId)!;
          // PERBAIKAN KRITIS: Selalu pulihkan field data pelanggan jika sebelumnya kosong / ter-overwrite
          if (!existing.vehicle_id || existing.vehicle_id === '') existing.vehicle_id = wo.vehicle_id;
          if (!existing.reminder_type || existing.reminder_type === 'custom') existing.reminder_type = period;
          if (!existing.spk_number) existing.spk_number = wo.spk_number;
          if (!existing.work_order_id) existing.work_order_id = wo.id;
          if (!existing.service_date) existing.service_date = finishDateStr;
          if (!existing.due_date || existing.reminder_type === 'custom') existing.due_date = dueDate;
          if (!existing.branch) existing.branch = wo.received_at_branch || branch || 'MHS 1';
        }
      });
    });

    // Simpan kembali manualLogs yang sudah diperbaiki ke storage
    const updatedManualLogs = manualLogs.map((l) => logsMap.get(l.id) || l);
    setLocal(key, updatedManualLogs);

    const allLogs = Array.from(logsMap.values()).map((log) => {
      const wo = workOrders.find((w) => w.id === log.work_order_id || w.spk_number === log.spk_number) || this.getWorkOrderById(log.work_order_id || '');
      const vehicle = vehicles.find((v) => v.id === log.vehicle_id) || wo?.vehicle || this.getVehicleById(log.vehicle_id);

      return {
        ...log,
        vehicle,
        work_order: wo,
        branch: log.branch || wo?.received_at_branch || branch || 'MHS 1',
      };
    });

    // Urutkan berdasarkan due_date (yang paling dekat/overdue di paling atas)
    return allLogs.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  static getAllCRMLogs(): CRMLog[] {
    const branches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
    const map = new Map<string, CRMLog>();
    branches.forEach((b) => {
      this.getCRMLogs(b).forEach((log) => {
        if (!map.has(log.id)) {
          map.set(log.id, { ...log, branch: log.branch || b });
        }
      });
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
  }

  static updateCRMStatus(
    id: string,
    status: CRMLog['status'],
    notes?: string,
    scheduledDate?: string,
    branch?: BranchId,
    logContext?: Partial<CRMLog>
  ): boolean {
    const targetBranch = normalizeBranch(logContext?.branch || branch || this.getActiveBranch());
    const key = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, targetBranch);
    const logs = getLocal<CRMLog[]>(key, []);
    let idx = logs.findIndex((l) => l.id === id);

    // Cari juga di cabang lain jika tidak ditemukan di branch target
    let actualKey = key;
    let actualLogs = logs;
    let actualIdx = idx;

    if (actualIdx === -1) {
      const allBranches: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];
      for (const b of allBranches) {
        if (b === targetBranch) continue;
        const bKey = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, b);
        const bLogs = getLocal<CRMLog[]>(bKey, []);
        const bIdx = bLogs.findIndex((l) => l.id === id);
        if (bIdx !== -1) {
          actualKey = bKey;
          actualLogs = bLogs;
          actualIdx = bIdx;
          break;
        }
      }
    }

    if (actualIdx !== -1) {
      actualLogs[actualIdx].status = status;
      actualLogs[actualIdx].contacted_at = new Date().toISOString();
      if (notes !== undefined) actualLogs[actualIdx].notes = notes;
      if (scheduledDate !== undefined) actualLogs[actualIdx].scheduled_date = scheduledDate;
      // Pulihkan field jika kosong
      if (logContext?.vehicle_id && (!actualLogs[actualIdx].vehicle_id || actualLogs[actualIdx].vehicle_id === '')) {
        actualLogs[actualIdx].vehicle_id = logContext.vehicle_id;
      }
      if (logContext?.reminder_type && (actualLogs[actualIdx].reminder_type === 'custom' || !actualLogs[actualIdx].reminder_type)) {
        actualLogs[actualIdx].reminder_type = logContext.reminder_type;
      }
      if (logContext?.spk_number && !actualLogs[actualIdx].spk_number) {
        actualLogs[actualIdx].spk_number = logContext.spk_number;
      }
      if (logContext?.service_date && !actualLogs[actualIdx].service_date) {
        actualLogs[actualIdx].service_date = logContext.service_date;
      }
      if (logContext?.due_date && (!actualLogs[actualIdx].due_date || actualLogs[actualIdx].reminder_type === 'custom')) {
        actualLogs[actualIdx].due_date = logContext.due_date;
      }
      if (logContext?.branch && !actualLogs[actualIdx].branch) {
        actualLogs[actualIdx].branch = logContext.branch;
      }
      actualLogs[actualIdx].updated_at = new Date().toISOString();
      setLocal(actualKey, actualLogs);
      return true;
    }

    // Jika first time update untuk auto-generated milestone log
    let vehicleId = logContext?.vehicle_id || '';
    let woId = logContext?.work_order_id || '';
    let spkNumber = logContext?.spk_number || '';
    let reminderType = logContext?.reminder_type || 'custom';
    let serviceDate = logContext?.service_date || '';
    let dueDate = logContext?.due_date || new Date().toISOString().slice(0, 10);
    let itemBranch = logContext?.branch || targetBranch;

    if (id.startsWith('crm-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        woId = woId || parts[1];
        const period = parts.slice(2).join('-') as CRMReminderPeriod;
        if (['1_week', '2_weeks', '1_month', '3_months'].includes(period)) {
          reminderType = period;
        }
        const wo = this.getWorkOrderById(woId, targetBranch);
        if (wo) {
          vehicleId = vehicleId || wo.vehicle_id;
          spkNumber = spkNumber || wo.spk_number;
          itemBranch = wo.received_at_branch || itemBranch;
          const finishDateStr = wo.finish_date || wo.updated_at || wo.entry_date || new Date().toISOString();
          serviceDate = serviceDate || finishDateStr;
          const finishTime = new Date(finishDateStr).getTime();
          const daysMap: Record<string, number> = { '1_week': 7, '2_weeks': 14, '1_month': 30, '3_months': 90 };
          const days = daysMap[period] || 7;
          dueDate = logContext?.due_date || new Date(finishTime + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        }
      }
    }

    const newEntry: CRMLog = {
      id,
      vehicle_id: vehicleId,
      work_order_id: woId,
      spk_number: spkNumber,
      branch: itemBranch,
      service_date: serviceDate,
      due_date: dueDate,
      reminder_type: reminderType as CRMReminderPeriod,
      status,
      contacted_at: new Date().toISOString(),
      notes,
      scheduled_date: scheduledDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const finalBranch = normalizeBranch(itemBranch);
    const finalKey = getBranchKey(BASE_STORAGE_KEYS.CRM_LOGS, finalBranch);
    const branchLogs = getLocal<CRMLog[]>(finalKey, []);
    branchLogs.push(newEntry);
    setLocal(finalKey, branchLogs);
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

    this.checkAndApplyDataResetEpoch();

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
          const merged = smartMergeVehicles(cloudVehicles, localVehicles);
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
          const rawBranch = row.checklist_data?.received_at_branch || row.received_at_branch || (row as any).branch || 'MHS 1';
          const targetBranch = normalizeBranch(rawBranch);
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

          const checklist = sanitizeChecklistData(row.checklist_data || {});

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

            // Extract estimasi dari seluruh format tab
            Object.keys(checklist).forEach((k) => {
              if (k === 'estimation' && checklist[k]) {
                const est = checklist[k];
                if (est.invoice_number) {
                  extraInvoicesFromWO.push({ ...est, work_order_id: row.id, vehicle });
                }
              } else if (k.startsWith('estimation_') && k !== 'estimation' && checklist[k]) {
                const est = checklist[k];
                if (est && est.invoice_number) {
                  extraInvoicesFromWO.push({ ...est, work_order_id: row.id, vehicle });
                }
              }
            });
          }

          // Extract checkup records dari semua sumber (baik standalone maupun yang terhubung dengan SPK)
          const helperAddCheckup = (rec: CheckupRecord) => {
            if (!rec || !rec.document_number) return;
            const existingIdx = cloudCheckups[branchKey].findIndex(
              (c) => c.id === rec.id || c.document_number === rec.document_number
            );
            if (existingIdx !== -1) {
              cloudCheckups[branchKey][existingIdx] = { ...cloudCheckups[branchKey][existingIdx], ...rec };
            } else {
              cloudCheckups[branchKey].push(rec);
            }
          };

          if (isStandaloneCheckup) {
            const checkupType: CheckupType = row.spk_number.startsWith('AC-')
              ? 'ac_specialist'
              : (row.spk_number.startsWith('UND-') ? 'understeel' : 'qc_general');
            // Jika ada checkup_record tersimpan di checklist_data, gunakan itu
            if (checklist.checkup_record) {
              const stored = checklist.checkup_record;
              const docNum = stored.document_number || row.spk_number;
              const isValidCheckup = docNum.startsWith('QC-') || docNum.startsWith('AC-') || docNum.startsWith('UND-');
              if (isValidCheckup) {
                helperAddCheckup({ ...stored, id: stored.id || row.id });
              }
            } else {
              // Buat CheckupRecord dari data baris work_orders langsung
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
              helperAddCheckup(rec);
            }
          } else {
            // SPK biasa (prefix SPK-): ekstrak seluruh formulir checkup yang tersimpan di checklist_data
            // 1. Dari checkup_records (map/objek multiple records)
            if (checklist.checkup_records && typeof checklist.checkup_records === 'object') {
              Object.values(checklist.checkup_records).forEach((r: any) => {
                if (r && typeof r === 'object' && r.document_number) {
                  const doc = String(r.document_number);
                  if (doc.startsWith('QC-') || doc.startsWith('AC-') || doc.startsWith('UND-')) {
                    helperAddCheckup({ ...r, work_order_id: row.id, vehicle_id: row.vehicle_id, vehicle });
                  }
                }
              });
            }
            // 2. Dari checkup_record tunggal
            if (checklist.checkup_record && typeof checklist.checkup_record === 'object') {
              const stored = checklist.checkup_record;
              const docNum = String(stored.document_number || '');
              if (docNum.startsWith('QC-') || docNum.startsWith('AC-') || docNum.startsWith('UND-')) {
                helperAddCheckup({ ...stored, work_order_id: row.id, vehicle_id: row.vehicle_id, vehicle });
              }
            }
            // 3. Fallback: jika ada qc_data langsung tapi belum tercatat di checkup record
            if (checklist.qc_data && !cloudCheckups[branchKey].some((c) => c.work_order_id === row.id && c.type === 'qc_general')) {
              helperAddCheckup({
                id: `qc-${row.id}`,
                type: 'qc_general',
                document_number: checklist.qc_data.document_number || `QC-${(row.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
                work_order_id: row.id,
                vehicle_id: row.vehicle_id,
                customer_name: vehicle?.customer_name || 'Pelanggan',
                license_plate: vehicle?.license_plate || 'W 0000 XX',
                car_model: vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil',
                technician_name: row.mechanic_name || 'Mekanik',
                check_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                qc_data: checklist.qc_data,
                created_at: row.created_at || new Date().toISOString(),
                updated_at: row.updated_at,
              });
            }
            // 4. Fallback: jika ada ac_data langsung
            if (checklist.ac_data && !cloudCheckups[branchKey].some((c) => c.work_order_id === row.id && c.type === 'ac_specialist')) {
              helperAddCheckup({
                id: `ac-${row.id}`,
                type: 'ac_specialist',
                document_number: checklist.ac_data.document_number || `AC-${(row.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
                work_order_id: row.id,
                vehicle_id: row.vehicle_id,
                customer_name: vehicle?.customer_name || 'Pelanggan',
                license_plate: vehicle?.license_plate || 'W 0000 XX',
                car_model: vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil',
                technician_name: row.mechanic_name || 'Mekanik',
                check_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                ac_data: checklist.ac_data,
                created_at: row.created_at || new Date().toISOString(),
                updated_at: row.updated_at,
              });
            }
            // 5. Fallback: jika ada understeel_data langsung
            if (checklist.understeel_data && !cloudCheckups[branchKey].some((c) => c.work_order_id === row.id && c.type === 'understeel')) {
              helperAddCheckup({
                id: `und-${row.id}`,
                type: 'understeel',
                document_number: checklist.understeel_data.document_number || `UND-${(row.entry_date || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-001`,
                work_order_id: row.id,
                vehicle_id: row.vehicle_id,
                customer_name: vehicle?.customer_name || 'Pelanggan',
                license_plate: vehicle?.license_plate || 'W 0000 XX',
                car_model: vehicle ? `${vehicle.car_brand} ${vehicle.car_model}` : 'Mobil',
                technician_name: checklist.understeel_data.technician_name || row.mechanic_name || 'Mekanik',
                check_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                understeel_data: checklist.understeel_data,
                created_at: row.created_at || new Date().toISOString(),
                updated_at: row.updated_at,
              });
            }
          }
        });

        // SMART MERGE: gabungkan work orders cloud dengan lokal dengan rekonsiliasi SPK number & UUID
        allBranches.forEach((b) => {
          const localWOs = getLocal<WorkOrder[]>(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), []);
          const mergedWOs = smartMergeWorkOrders(cloudWorkOrders[b] || [], localWOs, b).sort((x, y) => {
            const timeX = new Date(x.created_at || x.entry_date || 0).getTime() || 0;
            const timeY = new Date(y.created_at || y.entry_date || 0).getTime() || 0;
            return timeY - timeX;
          });
          setLocal(getBranchKey(BASE_STORAGE_KEYS.WORK_ORDERS, b), mergedWOs);

          const localCheckups = getLocal<CheckupRecord[]>(getBranchKey(BASE_STORAGE_KEYS.CHECKUPS, b), []);
          const mergedCheckups = smartMergeCheckups(cloudCheckups[b] || [], localCheckups).sort((x, y) => {
            const timeX = new Date(x.created_at || x.check_date || 0).getTime() || 0;
            const timeY = new Date(y.created_at || y.check_date || 0).getTime() || 0;
            return timeY - timeX;
          });
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

        // SMART MERGE: gabungkan invoices cloud dengan lokal per cabang dengan smartMergeInvoices
        allBranches.forEach((b) => {
          const localInvs = getLocal<Invoice[]>(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), []);
          const mergedInvs = smartMergeInvoices(cloudInvoices, localInvs);
          setLocal(getBranchKey(BASE_STORAGE_KEYS.INVOICES, b), mergedInvs);
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
