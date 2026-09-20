import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BranchId } from '../auth/users';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined || amount === null || amount === '') return 'Rp 0';
  if (typeof amount === 'string') {
    if (/[a-zA-Z]/.test(amount)) {
      return amount;
    }
    if (/[-\u2012\u2013\u2014\u2212~]/.test(amount)) {
      const parts = amount.split(/[-\u2012\u2013\u2014\u2212~]/);
      if (parts.length >= 2) {
        const p1 = parseInt(parts[0].replace(/\D/g, ''), 10);
        const p2 = parseInt(parts[1].replace(/\D/g, ''), 10);
        if (!isNaN(p1) && !isNaN(p2) && p2 > 0) {
          return `${formatCurrency(p1)} – ${formatCurrency(p2)}`;
        }
        if (!isNaN(p1)) {
          return `${formatCurrency(p1)} –`;
        }
      }
      return amount;
    }
    const num = Number(amount.replace(/[^0-9]/g, ''));
    if (isNaN(num)) return amount;
    amount = num;
  }
  if (isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumberOrText(val: number | string | undefined): string {
  if (val === undefined || val === null || val === '') return '0';
  if (typeof val === 'string') {
    if (/[a-zA-Z]/.test(val)) return val.toUpperCase();
    if (val.includes('-') || val.includes('–')) {
      const parts = val.split(/[-\u2013]/);
      if (parts.length >= 2) {
        const p1 = parseInt(parts[0].replace(/\D/g, ''), 10);
        const p2 = parseInt(parts[1].replace(/\D/g, ''), 10);
        if (!isNaN(p1) && !isNaN(p2) && p2 > 0) {
          return `${new Intl.NumberFormat('id-ID').format(p1)} – ${new Intl.NumberFormat('id-ID').format(p2)}`;
        }
        if (!isNaN(p1)) {
          return `${new Intl.NumberFormat('id-ID').format(p1)} –`;
        }
      }
      return val;
    }
    const num = Number(val.replace(/[^0-9]/g, ''));
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('id-ID').format(num);
  }
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('id-ID').format(val);
}

export function parseNumericPrice(val: number | string | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    if (/[a-zA-Z]/.test(val)) return 0;
    const cleaned = val.replace(/[^0-9.-]/g, '');
    if (cleaned.length === 0) return 0;
    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function parseRangePrice(val: any): { min: number; max: number } {
  if (typeof val === 'number') return { min: isNaN(val) ? 0 : val, max: isNaN(val) ? 0 : val };
  if (!val) return { min: 0, max: 0 };
  const str = String(val).replace(/[Rp\s]/g, '');
  const parts = str.split(/[-\u2012\u2013\u2014\u2212~]/);
  if (parts.length >= 2) {
    const minVal = parseInt(parts[0].replace(/\D/g, ''), 10) || 0;
    const maxVal = parseInt(parts[1].replace(/\D/g, ''), 10) || minVal;
    return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
  }
  const single = parseInt(str.replace(/\D/g, ''), 10) || 0;
  return { min: single, max: single };
}

export function formatDate(dateString?: string | Date): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString?: string | Date): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPlate(plate: string): string {
  return plate
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPhoneForWA(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function createWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWA(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
}

export function getBranchCode(branch?: string): string {
  if (!branch) return 'M1';
  const clean = branch.toUpperCase();
  if (clean.includes('2')) return 'M2';
  if (clean.includes('3')) return 'M3';
  return 'M1';
}

export function generateSpkNumber(branch?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const branchCode = getBranchCode(branch);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `SPK-${dateStr}-${branchCode}-${randomSuffix}`;
}

export function generateInvoiceNumber(type: 'invoice' | 'estimation' = 'invoice', branch?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = type === 'estimation' ? 'EST' : 'INV';
  const branchCode = getBranchCode(branch);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${branchCode}-${randomSuffix}`;
}

/**
 * Menentukan cabang asal sebuah Surat Perintah Kerja (SPK) / Work Order secara akurat dan definitif.
 * Mencegah kebocoran data SPK MHS 2 ke MHS 1 dan memastikan antrean langsung sinkron ke cabang yang tepat.
 */
export function resolveWorkOrderBranch(wo?: any, defaultBranch?: BranchId): BranchId {
  if (!wo) return defaultBranch || 'MHS 1';

  // 1. Cek kode cabang langsung pada nomor SPK / nomor dokumen / ID (paling eksplisit dan definitif)
  // Format standar: SPK-20260920-M2-2589, QC-20260920-M2-001, AC-20260920-M2-001, UND-20260920-M2-001
  const spk = String(wo.spk_number || wo.document_number || wo.id || '').toUpperCase();
  if (spk.includes('-M2-') || spk.includes('-M2') || spk.includes('MHS2') || spk.includes('MHS 2') || spk.startsWith('M2-')) {
    return 'MHS 2';
  }
  if (spk.includes('-M3-') || spk.includes('-M3') || spk.includes('MHS3') || spk.includes('MHS 3') || spk.startsWith('M3-')) {
    return 'MHS 3';
  }
  if (spk.includes('-M1-') || spk.includes('-M1') || spk.includes('MHS1') || spk.includes('MHS 1') || spk.startsWith('M1-')) {
    return 'MHS 1';
  }

  // 2. Cek checklist_data jika ada (bisa berupa objek atau string JSON dari Supabase Realtime WebSocket)
  let checklist = wo.checklist_data;
  if (typeof checklist === 'string') {
    try {
      checklist = JSON.parse(checklist);
    } catch {
      checklist = {};
    }
  }
  if (checklist && typeof checklist === 'object') {
    const rawChecklistBranch = checklist.received_at_branch || checklist.branch;
    if (rawChecklistBranch) {
      const u = String(rawChecklistBranch).toUpperCase();
      if (u.includes('2') || u.includes('TROSOBO')) return 'MHS 2';
      if (u.includes('3') || u.includes('SURABAYA')) return 'MHS 3';
      if (u.includes('1') || u.includes('RUNGKUT')) return 'MHS 1';
    }

    // Cek nomor SPK tersimpan di dalam checklist_data
    const innerSpk = String(checklist.spk_number || checklist.document_number || '').toUpperCase();
    if (innerSpk.includes('-M2-') || innerSpk.includes('-M2') || innerSpk.includes('MHS2')) return 'MHS 2';
    if (innerSpk.includes('-M3-') || innerSpk.includes('-M3') || innerSpk.includes('MHS3')) return 'MHS 3';
    if (innerSpk.includes('-M1-') || innerSpk.includes('-M1') || innerSpk.includes('MHS1')) return 'MHS 1';
  }

  // 3. Cek properti received_at_branch atau branch langsung pada objek
  const directBranch = wo.received_at_branch || wo.branch;
  if (directBranch) {
    const u = String(directBranch).toUpperCase();
    if (u.includes('2') || u.includes('TROSOBO')) return 'MHS 2';
    if (u.includes('3') || u.includes('SURABAYA')) return 'MHS 3';
    if (u.includes('1') || u.includes('RUNGKUT')) return 'MHS 1';
  }

  // 4. Cek penanggung jawab / petugas / SA / mekanik
  // (Mey Wulandari dan Kaka bertugas di MHS 2 Trosobo; Arida dan Dito Ade bertugas di MHS 1)
  const staff = String(
    wo.petugas_name ||
    checklist?.petugas_name ||
    wo.mechanic_name ||
    wo.sa_name ||
    wo.created_by ||
    ''
  ).toLowerCase();
  if (staff.includes('mey')) return 'MHS 2';
  if (staff.includes('trosobo')) return 'MHS 2';
  if (staff.includes('kaka') && !staff.includes('arida')) return 'MHS 2';
  if (staff.includes('arida')) return 'MHS 1';
  if (staff.includes('dito')) return 'MHS 1';

  return defaultBranch || 'MHS 1';
}

/**
 * Menentukan cabang asal sebuah invoice/estimasi secara akurat.
 * Menghindari kesalahan pengkategorian pendapatan MHS 2 masuk ke MHS 1.
 */
export function resolveInvoiceBranch(inv?: any, allWorkOrders?: any[]): BranchId {
  if (!inv) return 'MHS 1';

  // 1. Cek kode cabang langsung pada nomor nota (paling eksplisit dan definitif)
  // Format standar: INV-20260917-M2-8648 atau EST-20260917-M2-7752
  const num = String(inv.invoice_number || '').toUpperCase();
  if (num.includes('-M2-') || num.includes('-M2') || num.includes('MHS2') || num.includes('MHS 2')) {
    return 'MHS 2';
  }
  if (num.includes('-M3-') || num.includes('-M3') || num.includes('MHS3') || num.includes('MHS 3')) {
    return 'MHS 3';
  }
  if (num.includes('-M1-') || num.includes('-M1') || num.includes('MHS1') || num.includes('MHS 1')) {
    return 'MHS 1';
  }

  // 2. Cek properti work_order yang sudah ter-attach dengan resolveWorkOrderBranch
  const wo = inv.work_order;
  if (wo) {
    const b = resolveWorkOrderBranch(wo);
    if (b) return b;
  }

  // 3. Cek properti branch langsung pada invoice jika ada
  if (inv.branch) {
    const b = String(inv.branch).toUpperCase();
    if (b.includes('2') || b.includes('TROSOBO')) return 'MHS 2';
    if (b.includes('3') || b.includes('SURABAYA')) return 'MHS 3';
    if (b.includes('1') || b.includes('RUNGKUT')) return 'MHS 1';
  }

  // 4. Cari dari allWorkOrders jika work_order_id tersedia
  const woId = inv.work_order_id;
  if (woId && Array.isArray(allWorkOrders)) {
    const matched = allWorkOrders.find((w) => w.id === woId || w.spk_number === woId);
    if (matched) {
      return resolveWorkOrderBranch(matched);
    }
  }

  // 5. Cek work_order_id jika berbentuk nomor SPK langsung (misal SPK-20260917-M2-xxxx)
  if (typeof woId === 'string') {
    const upperWoId = woId.toUpperCase();
    if (upperWoId.includes('-M2-') || upperWoId.includes('-M2') || upperWoId.includes('MHS2')) return 'MHS 2';
    if (upperWoId.includes('-M3-') || upperWoId.includes('-M3') || upperWoId.includes('MHS3')) return 'MHS 3';
    if (upperWoId.includes('-M1-') || upperWoId.includes('-M1') || upperWoId.includes('MHS1')) return 'MHS 1';
  }

  // 6. Cek penanggung jawab (Mey Wulandari selalu MHS 2)
  const creator = String(inv.created_by || inv.estimator_name || inv.admin_notes || '').toLowerCase();
  if (creator.includes('mey')) return 'MHS 2';
  if (creator.includes('trosobo')) return 'MHS 2';
  if (creator.includes('arida')) return 'MHS 1';
  if (creator.includes('dito')) return 'MHS 1';

  return 'MHS 1';
}

/**
 * Format angka kilometer / odometer menjadi format ribuan Indonesia
 * Contoh: 35000 -> "35.000 KM" (jika withUnit = true) atau "35.000" (jika withUnit = false)
 */
export function formatKM(val: number | string | undefined | null, withUnit: boolean = true): string {
  if (val === undefined || val === null || val === '') return withUnit ? '- KM' : '-';
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const cleaned = String(val).replace(/[^0-9]/g, '');
    if (!cleaned) return withUnit ? '- KM' : '-';
    num = parseInt(cleaned, 10);
  }
  if (isNaN(num)) return withUnit ? '- KM' : '-';
  const formatted = new Intl.NumberFormat('id-ID').format(num);
  return withUnit ? `${formatted} KM` : formatted;
}

/**
 * Parse string kilometer yang mungkin memiliki titik / koma / teks menjadi angka integer
 */
export function parseKM(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.floor(val);
  const cleaned = String(val).replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Memeriksa apakah teks notes/keluhan merupakan teks boilerplate bawaan umum sistem
 */
export function isSPKGenericBoilerplate(text?: string | null): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  const boilerplates = [
    'pemeriksaan menyeluruh, tune-up, servis berkala, dan uji fungsi sistem kendaraan.',
    'ganti oli mesin, filter, tune-up berkala, dan uji fungsi sistem.',
    'lembar qc/ac/understeel checkup resmi',
    'perawatan berkala / servis rutin',
    'perawatan berkala',
  ];
  return boilerplates.some((b) => clean === b || clean.includes(b));
}

/**
 * Memformat teks Keluhan untuk kolom Estimasi (hanya keluhan customer, tanpa uraian pekerjaan)
 */
export function formatComplaintsAndDiagnosis(
  complaint?: string | null,
  _notes?: string | null,
  customText?: string | null
): {
  displayText: string;
  hasBoth: boolean;
  complaintPart: string;
  diagnosisPart: string;
} {
  const custom = customText?.trim();
  const comp = complaint?.trim() || '';

  if (custom && custom !== comp) {
    // Jika customText dari data lama berisi penggabungan "Keluhan: ... | Diagnosa Awal: ...", ambil keluhannya saja
    let cleanCustom = custom;
    if (cleanCustom.includes('| Diagnosa Awal:')) {
      cleanCustom = cleanCustom.split('| Diagnosa Awal:')[0].replace(/^Keluhan:\s*/i, '').trim();
    } else if (cleanCustom.includes('| Uraian:')) {
      cleanCustom = cleanCustom.split('| Uraian:')[0].replace(/^Keluhan:\s*/i, '').trim();
    } else if (cleanCustom.includes('| Uraian SPK:')) {
      cleanCustom = cleanCustom.split('| Uraian SPK:')[0].replace(/^Keluhan:\s*/i, '').trim();
    }
    const upperCustom = cleanCustom.toUpperCase();
    return {
      displayText: upperCustom,
      hasBoth: false,
      complaintPart: upperCustom,
      diagnosisPart: '',
    };
  }

  const isCompBoilerplate = isSPKGenericBoilerplate(comp);
  const validComp = comp && !isCompBoilerplate ? comp : (comp || 'PERAWATAN BERKALA / SERVIS RUTIN');
  const upperComp = validComp.toUpperCase();

  return {
    displayText: upperComp,
    hasBoth: false,
    complaintPart: upperComp,
    diagnosisPart: '',
  };
}


