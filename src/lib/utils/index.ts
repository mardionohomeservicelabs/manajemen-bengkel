import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function generateSpkNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `SPK-${dateStr}-${randomSuffix}`;
}

export function generateInvoiceNumber(type: 'invoice' | 'estimation' = 'invoice'): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = type === 'estimation' ? 'EST' : 'INV';
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${dateStr}-${randomSuffix}`;
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

