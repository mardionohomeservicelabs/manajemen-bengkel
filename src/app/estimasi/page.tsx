'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import { Invoice, InvoiceItem, InventoryItem, WorkOrder } from '@/lib/types/database';
import { formatCurrency, formatPlate, generateInvoiceNumber, createWhatsAppLink } from '@/lib/utils';
import {
  Calculator,
  Plus,
  Trash2,
  FileCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Share2,
  Copy,
  ExternalLink,
  QrCode,
  Printer,
  Hourglass,
  PenTool,
  Check,
  X,
  Menu,
  LogOut,
  FolderPlus,
  PackageCheck,
  ChevronDown,
  Car,
  Lock,
  Unlock,
  ShieldCheck,
  ChevronUp,
  ArrowUpDown,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';
import { EditSPKModal } from '@/components/ui/EditSPKModal';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { formatNumberOrText, formatComplaintsAndDiagnosis } from '@/lib/utils';

// Satuan item options (Sesuai permintaan: SET, PCS, JASA)
const UNIT_OPTIONS = ['SET', 'PCS', 'JASA'] as const;

// Helper: parse price field yang bisa berupa kisaran "150000 - 160000" atau angka biasa
const parseRangePrice = (val: any): { min: number; max: number } => {
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
};

// Helper: parse numeric, range, or text price
const parseNumericPriceValue = (val: any): { isText: boolean; isRange: boolean; num: number; min: number; max: number; text: string } => {
  if (val === undefined || val === null || val === '') {
    return { isText: false, isRange: false, num: 0, min: 0, max: 0, text: '' };
  }
  if (typeof val === 'number') {
    const n = isNaN(val) ? 0 : val;
    return { isText: false, isRange: false, num: n, min: n, max: n, text: String(n) };
  }
  const str = String(val).trim();
  if (/[a-zA-Z]/.test(str)) {
    return { isText: true, isRange: false, num: 0, min: 0, max: 0, text: str.toUpperCase() };
  }
  if (/[-\u2012\u2013\u2014\u2212~]/.test(str)) {
    const { min, max } = parseRangePrice(str);
    return { isText: false, isRange: true, num: min, min, max, text: str };
  }
  const clean = str.replace(/[^0-9]/g, '');
  const n = parseInt(clean, 10) || 0;
  return { isText: false, isRange: false, num: n, min: n, max: n, text: str };
};

// Helper: Temukan dan pulihkan seluruh tab estimasi untuk SPK dari semua sumber (localStorage, checklist_data, invoices)
const discoverTabsForSpk = (found: WorkOrder, allInvoices: Invoice[]): EstimationTab[] => {
  const tabsMap = new Map<string, EstimationTab>();

  // 1. Cek localStorage tabs (baik dengan spk_number maupun id)
  if (typeof window !== 'undefined') {
    try {
      const tabsRaw =
        (found.spk_number && localStorage.getItem(`mhs_est_tabs_${found.spk_number}`)) ||
        localStorage.getItem(`mhs_est_tabs_${found.id}`);
      if (tabsRaw) {
        const parsed: EstimationTab[] = JSON.parse(tabsRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((t) => {
            if (t && t.id) tabsMap.set(t.id, { id: t.id, name: t.name || 'Estimasi' });
          });
        }
      }
    } catch {}
  }

  // 2. Cek work_order.checklist_data.tabs
  const clData = found.checklist_data as any;
  if (clData?.tabs && Array.isArray(clData.tabs)) {
    clData.tabs.forEach((t: EstimationTab) => {
      if (t && t.id) {
        if (!tabsMap.has(t.id)) {
          tabsMap.set(t.id, { id: t.id, name: t.name || 'Estimasi' });
        } else {
          const existing = tabsMap.get(t.id)!;
          if ((!existing.name || existing.name.startsWith('Estimasi ')) && t.name && !t.name.startsWith('Estimasi ')) {
            existing.name = t.name;
          }
        }
      }
    });
  }

  // 3. Cek invoices (database Supabase / local) untuk SPK ini secara STRICT
  const spkInvoices = allInvoices.filter(
    (inv) =>
      inv.type === 'estimation' &&
      (inv.work_order_id === found.id ||
        (found.spk_number && inv.work_order_id === found.spk_number) ||
        (inv.work_order?.spk_number && found.spk_number && inv.work_order.spk_number === found.spk_number))
  );
  spkInvoices.forEach((inv: any, idx) => {
    const tabId = inv.tab_id || inv.estimation_tab || (idx === 0 ? 'tab_1' : `tab_inv_${inv.id}`);
    const tabName = inv.estimation_type || (tabId === 'tab_1' ? 'Estimasi 1' : `Estimasi ${idx + 1}`);
    if (!tabsMap.has(tabId)) {
      tabsMap.set(tabId, { id: tabId, name: tabName });
    } else {
      const current = tabsMap.get(tabId)!;
      if ((!current.name || current.name.startsWith('Estimasi ')) && inv.estimation_type) {
        current.name = inv.estimation_type;
      }
    }
  });

  // 4. Cek checklist_data format (estimation_tab_*, estimation)
  if (clData) {
    Object.keys(clData).forEach((key) => {
      if (key.startsWith('estimation_tab_')) {
        const tabId = key.replace('estimation_', '');
        const estData = clData[key];
        const tabName = estData?.estimation_type || 'Estimasi';
        if (!tabsMap.has(tabId)) {
          tabsMap.set(tabId, { id: tabId, name: tabName });
        }
      } else if (key === 'estimation' && !tabsMap.has('tab_1')) {
        const estData = clData[key];
        const tabName = estData?.estimation_type || 'Estimasi 1';
        tabsMap.set('tab_1', { id: 'tab_1', name: tabName });
      }
    });
  }

  // 5. Cek localStorage draft keys (spk_number dan id)
  if (typeof window !== 'undefined') {
    try {
      const idPrefix = `mhs_est_draft_${found.id}_`;
      const numPrefix = found.spk_number ? `mhs_est_draft_${found.spk_number}_` : '';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(idPrefix) || (numPrefix && k.startsWith(numPrefix)))) {
          const tabId = numPrefix && k.startsWith(numPrefix) ? k.replace(numPrefix, '') : k.replace(idPrefix, '');
          if (!tabsMap.has(tabId)) {
            try {
              const draft = JSON.parse(localStorage.getItem(k) || '{}');
              tabsMap.set(tabId, { id: tabId, name: draft.estimation_type || 'Estimasi' });
            } catch {
              tabsMap.set(tabId, { id: tabId, name: 'Estimasi' });
            }
          }
        }
      }
    } catch {}
  }

  // Default jika belum ada tab sama sekali
  if (tabsMap.size === 0) {
    tabsMap.set('tab_1', { id: 'tab_1', name: 'Estimasi 1' });
  }

  return Array.from(tabsMap.values());
};

// Estimasi baru selalu mulai kosong (1 baris kosong)
const EMPTY_ESTIMATION_ROW: InvoiceItem[] = [
  { name: '', is_service: false, qty: 1, unit: 'PCS', price_opsi1: 0, total_opsi1: 0, price_opsi2: 0, total_opsi2: 0, price: 0, subtotal: 0 },
];

// Tab estimasi berbentuk {id, name} agar bisa rename bebas
interface EstimationTab {
  id: string;
  name: string;
}

function EstimationBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');
  const {
    workOrders,
    allWorkOrders,
    inventory,
    invoices,
    refreshData,
    showToast,
    settings,
    currentRole,
    saveInvoiceAsync,
    syncWithSupabase,
    unlockWorkOrderAsync,
    updateWorkOrderStatusAsync,
    generateUniqueInvoiceNumberAsync,
  } = useApp();

  // Sinkronkan data saat halaman dibuka
  useEffect(() => {
    refreshData();
    syncWithSupabase();
  }, [refreshData, syncWithSupabase]);

  // Sumber work orders yang mencakup seluruh cabang (MHS 1, MHS 2, MHS 3)
  const availableOrders = (allWorkOrders && allWorkOrders.length > 0) ? allWorkOrders : workOrders;

  // Selected SPK & Tab (tab berbentuk {id, name} agar bisa rename bebas)
  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);
  const [tabList, setTabList] = useState<EstimationTab[]>([{ id: 'tab_1', name: 'Estimasi 1' }]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  // Meta Form Fields
  const [estimationType, setEstimationType] = useState<string>('Estimasi 1');
  const [estimationDate, setEstimationDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [estimationTime, setEstimationTime] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  });
  const [vehicleStatus, setVehicleStatus] = useState<string>('Di Tinggal');
  const [paymentPlan, setPaymentPlan] = useState<string>('Transfer');

  const { currentUser } = useAuth();

  // Estimator/SA name, signature & estimated work duration (baru)
  const [estimatorName, setEstimatorName] = useState<string>(() => {
    if (currentUser?.full_name) return currentUser.full_name;
    if (currentRole === 'estimator') return 'Via Rizkiana';
    return '';
  });
  const [estimatorSignature, setEstimatorSignature] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');

  useEffect(() => {
    if (!estimatorName) {
      if (currentUser?.full_name) {
        setEstimatorName(currentUser.full_name);
      } else if (currentRole === 'estimator') {
        setEstimatorName('Via Rizkiana');
      }
    }
  }, [currentUser, currentRole, estimatorName]);

  // Customer signature & signed name directly on estimation form
  const [customerSignature, setCustomerSignature] = useState<string>('');
  const [customerSignedName, setCustomerSignedName] = useState<string>('');

  // Customer response (baru)
  const [customerResponse, setCustomerResponse] = useState<string>('');
  const [customerResponseNote, setCustomerResponseNote] = useState<string>('');

  // Switch Toggles (Default tidak menyala / off saat awal buka atau estimasi baru)
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [showOpsi2, setShowOpsi2] = useState<boolean>(false);
  const [showTax, setShowTax] = useState<boolean>(false);
  const [showRangePrice, setShowRangePrice] = useState<boolean>(false);

  // Double Estimasi (Tabel 1 + Slice Divider + Tabel 2)
  const [hasSecondTable, setHasSecondTable] = useState<boolean>(false);
  const [table1Title, setTable1Title] = useState<string>('BAGIAN 1');
  const [table2Title, setTable2Title] = useState<string>('BAGIAN REM');
  const [itemsTable2, setItemsTable2] = useState<InvoiceItem[]>(EMPTY_ESTIMATION_ROW);
  const [catalogTargetTable, setCatalogTargetTable] = useState<1 | 2>(1);

  // Items & Values
  const [items, setItems] = useState<InvoiceItem[]>(EMPTY_ESTIMATION_ROW);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Customer signature status & Save timestamp indicator
  const [currentEstimationRecord, setCurrentEstimationRecord] = useState<Invoice | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Catalog picker modal
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [pickerCategory, setPickerCategory] = useState<string>('all');

  // Customer TTD Link modal & Printable preview
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [savedEstimation, setSavedEstimation] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEditPlateModal, setShowEditPlateModal] = useState<boolean>(false);
  const [showEditSpkModal, setShowEditSpkModal] = useState<boolean>(false);
  const [estimationComplaints, setEstimationComplaints] = useState<string>('');

  // Live real-time clock
  const [currentClock, setCurrentClock] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const lastLoadedSpkId = useRef<string>('');
  const loadedFormSpkIdRef = useRef<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
      setCurrentClock(timeStr);
      setCurrentDateStr(dateStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check whether work order is completed and locked (Owner can always edit / unlock)
  const isCompleted = selectedSpk?.status === 'completed';
  const isLocked = isCompleted && currentRole !== 'owner';

  // Helper: load estimasi for a specific tab from saved/draft
  const loadTabData = useCallback((spkOrWo: WorkOrder | string, tabId: string, allInvoices: Invoice[]) => {
    const spkId = typeof spkOrWo === 'string' ? spkOrWo : spkOrWo.id;
    const woObj = typeof spkOrWo === 'object' ? spkOrWo : workOrders.find((w) => w.id === spkId || w.spk_number === spkId);
    const spkNumber = typeof spkOrWo === 'object' ? spkOrWo.spk_number : woObj?.spk_number;

    // 1. Cek invoices state (sudah tersimpan di server/Supabase) - STRICT MATCHING
    let existingEst = allInvoices.find(
      (inv) =>
        inv.type === 'estimation' &&
        (inv.work_order_id === spkId ||
          (spkNumber && inv.work_order_id === spkNumber) ||
          (inv.work_order?.spk_number && spkNumber && inv.work_order.spk_number === spkNumber)) &&
        ((inv as any).tab_id === tabId || inv.estimation_tab === tabId)
    );
    // Fallback: cari berdasarkan estimation_tab (untuk data lama tanpa tab_id)
    if (!existingEst && tabId === 'tab_1') {
      existingEst = allInvoices.find(
        (inv) =>
          inv.type === 'estimation' &&
          (inv.work_order_id === spkId ||
            (spkNumber && inv.work_order_id === spkNumber) ||
            (inv.work_order?.spk_number && spkNumber && inv.work_order.spk_number === spkNumber))
      );
    }

    // Fallback 2: cek dari work_order checklist_data yang tersinkronisasi dari Supabase
    if (!existingEst && woObj?.checklist_data) {
      const cl = woObj.checklist_data as any;
      const keyEst = cl[`estimation_${tabId}`] || (tabId === 'tab_1' ? cl.estimation : undefined);
      if (keyEst && keyEst.items && keyEst.items.length > 0) {
        existingEst = keyEst;
      }
    }

    // Jika existingEst ditemukan namun estimated_duration kosong, cari dari checklist_data WO
    if (existingEst && !existingEst.estimated_duration && woObj?.checklist_data) {
      const cl = woObj.checklist_data as any;
      const keyEst = cl[`estimation_${tabId}`] || (tabId === 'tab_1' ? cl.estimation : undefined);
      if (keyEst?.estimated_duration) {
        existingEst = {
          ...existingEst,
          estimated_duration: keyEst.estimated_duration,
        };
      }
    }

    // Pastikan relasi work_order dan complaints selalu terhubung ke existingEst
    const spkComplaintsFormatted = formatComplaintsAndDiagnosis(woObj?.complaints, woObj?.notes).displayText;

    if (existingEst && woObj) {
      existingEst = {
        ...existingEst,
        work_order: woObj,
        complaints: existingEst.complaints || spkComplaintsFormatted,
      };
    }

    // 2. Cek localStorage draft (hanya untuk ID atau nomor SPK yang sama persis)
    let draftData: any = null;
    if (typeof window !== 'undefined') {
      try {
        const d1 = localStorage.getItem(`mhs_est_draft_${spkId}_${tabId}`);
        const d2 = spkNumber ? localStorage.getItem(`mhs_est_draft_${spkNumber}_${tabId}`) : null;
        if (d1) draftData = JSON.parse(d1);
        else if (d2) draftData = JSON.parse(d2);
      } catch {}
    }

    // Validasi apakah draftData memiliki item yang terisi
    const isDraftValid =
      draftData &&
      Array.isArray(draftData.items) &&
      draftData.items.length > 0 &&
      draftData.items.some(
        (i: any) =>
          (i.name && i.name.trim()) ||
          (i.price_opsi1 !== undefined && i.price_opsi1 !== '' && i.price_opsi1 !== 0 && i.price_opsi1 !== '0') ||
          (i.price_opsi2 !== undefined && i.price_opsi2 !== '' && i.price_opsi2 !== 0 && i.price_opsi2 !== '0')
      );

    // Prioritas: Utamakan draftData terbaru agar data yang sedang diinputkan tidak hilang jika komputer mati atau direload
    let sourceData = existingEst;
    if (isDraftValid) {
      if (!existingEst) {
        sourceData = draftData;
      } else {
        sourceData = {
          ...existingEst,
          ...draftData,
          id: existingEst.id,
          invoice_number: existingEst.invoice_number,
          created_at: existingEst.created_at,
        };
      }
    }

    if (sourceData && woObj) {
      sourceData = {
        ...sourceData,
        work_order: woObj,
        complaints: sourceData.complaints || spkComplaintsFormatted,
        estimated_duration: sourceData.estimated_duration || existingEst?.estimated_duration || '',
      };
    }

    return { sourceData, existingEst };
  }, [workOrders]);

  // Helper function to load and populate estimation data for a work order (target tab)
  const loadEstimationForSpk = useCallback((found: WorkOrder) => {
    // Kunci loadedFormSpkIdRef agar auto-save tidak jalan selama proses pergantian state
    loadedFormSpkIdRef.current = '';

    const tabs = discoverTabsForSpk(found, invoices);
    setTabList(tabs);
    
    // Pulihkan tab aktif terakhir yang sedang dikerjakan untuk SPK ini
    let targetTabId = tabs[0].id;
    if (typeof window !== 'undefined') {
      try {
        const savedTabId = localStorage.getItem(`mhs_last_active_tab_${found.id}`);
        if (savedTabId && tabs.some((t) => t.id === savedTabId)) {
          targetTabId = savedTabId;
        } else {
          // Cari tab yang sudah disetujui jika ada
          const approvedTab = tabs.find((t) => {
            const { existingEst, sourceData } = loadTabData(found, t.id, invoices);
            const resp =
              existingEst?.customer_approved_option ||
              existingEst?.customer_response ||
              sourceData?.customer_response;
            return resp === 'opsi1' || resp === 'opsi2' || existingEst?.ttd_status === 'signed';
          });
          if (approvedTab) {
            targetTabId = approvedTab.id;
          }
        }
      } catch {}
    }
    setActiveTabId(targetTabId);

    // Load data untuk tab target dari found (SPK target)
    const { sourceData, existingEst } = loadTabData(found, targetTabId, invoices);

    if (existingEst) {
      setCurrentEstimationRecord(existingEst);
    } else {
      setCurrentEstimationRecord(null);
    }

    if (sourceData) {
      setEstimationType(sourceData.estimation_type || tabs[0].name || 'Estimasi 1');
      if (sourceData.estimation_date) setEstimationDate(sourceData.estimation_date);
      if (sourceData.estimation_time) setEstimationTime(sourceData.estimation_time);
      if (sourceData.vehicle_status) setVehicleStatus(sourceData.vehicle_status); else setVehicleStatus('Di Tinggal');
      if (sourceData.payment_plan) setPaymentPlan(sourceData.payment_plan);
      setEstimatorName(sourceData.estimator_name || currentUser?.full_name || (currentRole === 'estimator' ? 'Via Rizkiana' : ''));
      setEstimatorSignature(sourceData.estimator_signature || sourceData.signature_admin_url || '');
      setCustomerSignature(sourceData.customer_signature || sourceData.signature_customer_url || '');
      setCustomerSignedName(sourceData.customer_signed_name || found.vehicle?.customer_name || '');
      setEstimatedDuration(sourceData.estimated_duration || '');
      setCustomerResponse(sourceData.customer_response || '');
      setCustomerResponseNote(sourceData.customer_response_note || '');
      setShowDiscount(Boolean(sourceData.has_discount));
      setShowOpsi2(Boolean(sourceData.has_opsi2));
      setShowTax(Boolean(sourceData.has_tax));
      setShowRangePrice(Boolean(sourceData.has_range_price));
      setDiscountAmount(sourceData.discount_amount || 0);
      setTaxPercent(sourceData.tax_percent || 11);
      setAdminNotes(sourceData.admin_notes || '');
      const spkDefaultFormatted = formatComplaintsAndDiagnosis(found.complaints, found.notes).displayText;
      setEstimationComplaints(sourceData.complaints || spkDefaultFormatted);

      if (existingEst || sourceData.invoice_number || sourceData.updated_at) {
        const saveDate = sourceData.updated_at || existingEst?.created_at || sourceData.created_at;
        const timeFormatted = saveDate
          ? new Date(saveDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
          : 'Tersimpan';
        setLastSavedTime(timeFormatted);
      } else {
        setLastSavedTime(null);
      }

      const has2nd = Boolean(
        sourceData.has_second_table ||
        sourceData.checklist_data?.has_second_table ||
        (sourceData.items_table2 && sourceData.items_table2.length > 0) ||
        (sourceData.checklist_data?.items_table2 && sourceData.checklist_data.items_table2.length > 0) ||
        (sourceData.items && sourceData.items.some((it: any) => it.section === 2))
      );
      setHasSecondTable(has2nd);
      setTable1Title(sourceData.table1_title || sourceData.checklist_data?.table1_title || 'BAGIAN 1');
      setTable2Title(sourceData.table2_title || sourceData.checklist_data?.table2_title || 'BAGIAN REM');

      const normalizeEstItem = (it: any) => {
        const p1 = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
        const isP2ExplicitlyEmpty = it.price_opsi2 === '' || it.price_opsi2 === 0 || it.price_opsi2 === '0';
        const p2 = isP2ExplicitlyEmpty ? '' : (it.price_opsi2 !== undefined ? it.price_opsi2 : p1);
        const qty = it.qty || 1;
        const isP1Text = typeof p1 === 'string' && /[a-zA-Z]/.test(p1);
        const isP2Text = typeof p2 === 'string' && /[a-zA-Z]/.test(p2);
        const isP1Range = typeof p1 === 'string' && /[-\u2012\u2013\u2014\u2212~]/.test(p1);
        const isP2Range = typeof p2 === 'string' && /[-\u2012\u2013\u2014\u2212~]/.test(p2);
        const r1 = isP1Range ? parseRangePrice(p1) : null;
        const r2 = (isP2Range && !isP2ExplicitlyEmpty) ? parseRangePrice(p2) : null;
        const num1 = parseNumericPriceValue(p1).num;
        const num2 = parseNumericPriceValue(p2).num;
        const tot1 = isP1Text ? p1 : (r1 ? (r1.min === r1.max ? r1.min * qty : `${r1.min * qty} - ${r1.max * qty}`) : qty * num1);
        const tot2 = isP2ExplicitlyEmpty ? 0 : (isP2Text ? p2 : (r2 ? (r2.min === r2.max ? r2.min * qty : `${r2.min * qty} - ${r2.max * qty}`) : qty * num2));
        return {
          ...it,
          unit: it.unit || (it.is_service ? 'JASA' : 'PCS'),
          price_opsi1: p1,
          total_opsi1: tot1,
          price_opsi2: p2,
          total_opsi2: tot2,
          price: p1,
          subtotal: tot1,
        };
      };

      if (sourceData.items && sourceData.items.length > 0) {
        const mappedItems = sourceData.items.map(normalizeEstItem);
        if (has2nd) {
          if (mappedItems.some((it: any) => it.section === 2)) {
            setItems(mappedItems.filter((it: any) => it.section !== 2));
            setItemsTable2(mappedItems.filter((it: any) => it.section === 2));
          } else if (sourceData.items_table2 && sourceData.items_table2.length > 0) {
            setItems(mappedItems);
            setItemsTable2(sourceData.items_table2.map(normalizeEstItem));
          } else if (sourceData.checklist_data?.items_table2 && sourceData.checklist_data.items_table2.length > 0) {
            setItems(mappedItems);
            setItemsTable2(sourceData.checklist_data.items_table2.map(normalizeEstItem));
          } else {
            setItems(mappedItems);
            setItemsTable2(EMPTY_ESTIMATION_ROW);
          }
        } else {
          setItems(mappedItems);
          setItemsTable2(EMPTY_ESTIMATION_ROW);
        }
      } else {
        setItems(EMPTY_ESTIMATION_ROW);
        setItemsTable2(EMPTY_ESTIMATION_ROW);
      }
    } else {
      // SPK baru: MULAI DENGAN 1 BARIS KOSONG & RESET SEMUA STATE BERSIH
      setEstimationType(tabs[0]?.name || 'Estimasi 1');
      setItems(EMPTY_ESTIMATION_ROW);
      setHasSecondTable(false);
      setTable2Title('BAGIAN REM');
      setItemsTable2(EMPTY_ESTIMATION_ROW);
      setEstimatorName(currentUser?.full_name || (currentRole === 'estimator' ? 'Via Rizkiana' : ''));
      setEstimatorSignature('');
      setCustomerSignature('');
      setCustomerSignedName(found.vehicle?.customer_name || '');
      setEstimatedDuration('');
      setCustomerResponse('');
      setCustomerResponseNote('');
      setAdminNotes('');
      setEstimationComplaints(formatComplaintsAndDiagnosis(found.complaints, found.notes).displayText);
      setVehicleStatus('Di Tinggal');
      setShowDiscount(false);
      setShowOpsi2(false);
      setShowTax(false);
      setShowRangePrice(false);
      setDiscountAmount(0);
    }

    // Tandai form state ini valid milik SPK target
    loadedFormSpkIdRef.current = found.id;
  }, [invoices, loadTabData, currentUser, currentRole]);

  // Handler pergantian SPK dari dropdown dengan penyimpanan draft sebelumnya secara aman
  const handleSelectSpk = useCallback((newSpkId: string) => {
    if (!newSpkId) return;

    // 1. Simpan draft untuk SPK sebelumnya HANYA JIKA form memang milik SPK tersebut
    if (selectedSpkId && selectedSpk && !isLocked && loadedFormSpkIdRef.current === selectedSpk.id) {
      const prevDraftPayload = {
        items, estimation_type: estimationType, estimation_tab: activeTabId,
        estimation_date: estimationDate, estimation_time: estimationTime,
        vehicle_status: vehicleStatus, payment_plan: paymentPlan,
        estimator_name: estimatorName, estimator_signature: estimatorSignature,
        customer_signature: customerSignature, customer_signed_name: customerSignedName,
        estimated_duration: estimatedDuration,
        customer_response: customerResponse, customer_response_note: customerResponseNote,
        has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
        has_range_price: showRangePrice,
        has_second_table: hasSecondTable,
        table1_title: table1Title,
        table2_title: table2Title,
        items_table2: itemsTable2,
        discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
      };
      try {
        localStorage.setItem(`mhs_est_draft_${selectedSpk.id}_${activeTabId}`, JSON.stringify(prevDraftPayload));
        if (selectedSpk?.spk_number) {
          localStorage.setItem(`mhs_est_draft_${selectedSpk.spk_number}_${activeTabId}`, JSON.stringify(prevDraftPayload));
        }
        localStorage.setItem(`mhs_est_tabs_${selectedSpk.id}`, JSON.stringify(tabList));
        if (selectedSpk?.spk_number) {
          localStorage.setItem(`mhs_est_tabs_${selectedSpk.spk_number}`, JSON.stringify(tabList));
        }
      } catch {}
    }

    // 2. Kunci loadedFormSpkIdRef agar auto-save tidak jalan selama proses pergantian
    loadedFormSpkIdRef.current = '';

    const targetWo = availableOrders.find((w) => w.id === newSpkId || w.spk_number === newSpkId);
    if (!targetWo) return;

    // 3. Tandai SPK yang sedang dimuat
    lastLoadedSpkId.current = targetWo.id;
    setSelectedSpkId(targetWo.id);
    setSelectedSpk(targetWo);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mhs_last_active_estimation_spk_id', targetWo.id);
      } catch {}
    }

    // 4. Muat data estimasi SPK yang baru dipilih
    loadEstimationForSpk(targetWo);
  }, [
    selectedSpkId, selectedSpk, isLocked, items, estimationType, activeTabId,
    estimationDate, estimationTime, vehicleStatus, paymentPlan,
    estimatorName, estimatorSignature, customerSignature, customerSignedName,
    estimatedDuration, customerResponse, customerResponseNote,
    showDiscount, showOpsi2, showTax, showRangePrice, hasSecondTable, table2Title, itemsTable2,
    discountAmount, taxPercent, adminNotes, tabList,
    availableOrders, loadEstimationForSpk
  ]);

  // Initialize selected SPK and load estimation only on target SPK change
  useEffect(() => {
    if (availableOrders.length > 0) {
      const activeWorkOrders = availableOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled');
      let savedLastSpkId: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          savedLastSpkId = localStorage.getItem('mhs_last_active_estimation_spk_id');
        } catch {}
      }
      const targetId = spkIdParam || selectedSpkId || savedLastSpkId || activeWorkOrders[0]?.id || availableOrders[0]?.id;
      if (targetId) {
        const found = availableOrders.find((w) => w.id === targetId || w.spk_number === targetId);
        if (found) {
          if (lastLoadedSpkId.current !== found.id) {
            lastLoadedSpkId.current = found.id;
            setSelectedSpk(found);
            setSelectedSpkId(found.id);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('mhs_last_active_estimation_spk_id', found.id);
              } catch {}
            }
            loadEstimationForSpk(found);
          } else {
            // SPK sama tapi workOrders/invoices terupdate (misal perubahan dari perangkat lain / customer TTD / edit SPK)
            setSelectedSpk(found);
            const updatedTabs = discoverTabsForSpk(found, invoices);
            if (updatedTabs.length > 0 && JSON.stringify(updatedTabs) !== JSON.stringify(tabList)) {
              setTabList(updatedTabs);
            }

            const tabKey = activeTabId;
            const checklist = found.checklist_data || {};
            const estInChecklist = checklist[`estimation_${tabKey}`] || (tabKey === 'tab_1' ? checklist.estimation : null);
            const matchingInvoice = invoices.find(
              (i) => (i.work_order_id === found.id || i.id === found.id) &&
                     (i.estimation_tab === tabKey || (i as any).tab_id === tabKey)
            );

            const latestEst = estInChecklist || matchingInvoice;
            if (latestEst) {
              const isExternalUpdate =
                latestEst.updated_at &&
                currentEstimationRecord?.updated_at &&
                new Date(latestEst.updated_at).getTime() > new Date(currentEstimationRecord.updated_at).getTime();

              if (latestEst.customer_signature && latestEst.customer_signature !== customerSignature) {
                setCustomerSignature(latestEst.customer_signature);
                setCustomerSignedName(latestEst.customer_signed_name || found.vehicle?.customer_name || '');
                if (latestEst.customer_response) setCustomerResponse(latestEst.customer_response);
                if (latestEst.customer_approved_option) setCustomerResponse(latestEst.customer_approved_option);
                setCurrentEstimationRecord(latestEst);
              } else if (latestEst.customer_response && latestEst.customer_response !== customerResponse) {
                setCustomerResponse(latestEst.customer_response);
                setCurrentEstimationRecord(latestEst);
              }

              // Jika ada pembaruan data eksternal dari perangkat lain dan pengguna tidak sedang mengetik aktif di form
              const isUserTyping = typeof document !== 'undefined' && 
                document.activeElement && 
                (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

              if (isExternalUpdate && !isUserTyping) {
                setCurrentEstimationRecord(latestEst);
                if (latestEst.items && Array.isArray(latestEst.items) && latestEst.items.length > 0) {
                  setItems(latestEst.items);
                }
                if (latestEst.estimation_type) setEstimationType(latestEst.estimation_type);
                if (latestEst.has_discount !== undefined) setShowDiscount(Boolean(latestEst.has_discount));
                if (latestEst.has_opsi2 !== undefined) setShowOpsi2(Boolean(latestEst.has_opsi2));
                if (latestEst.has_tax !== undefined) setShowTax(Boolean(latestEst.has_tax));
                if (latestEst.has_range_price !== undefined) setShowRangePrice(Boolean(latestEst.has_range_price));
                if (latestEst.discount_amount !== undefined) setDiscountAmount(latestEst.discount_amount);
                if (latestEst.tax_percent !== undefined) setTaxPercent(latestEst.tax_percent);
                if (latestEst.admin_notes !== undefined) setAdminNotes(latestEst.admin_notes);
                if (latestEst.vehicle_status) setVehicleStatus(latestEst.vehicle_status);
                if (latestEst.payment_plan) setPaymentPlan(latestEst.payment_plan);
              }
            }
          }
        }
      }
    }
  }, [selectedSpkId, spkIdParam, availableOrders, invoices, activeTabId, customerSignature, customerResponse, tabList, currentEstimationRecord, loadEstimationForSpk]);

  // Polling sync real-time saat menunggu TTD customer dari link
  useEffect(() => {
    if (!selectedSpkId) return;
    // Jika belum ada TTD customer, lakukan sync cepat setiap 4 detik agar update langsung masuk
    const isWaitingTtd = !customerSignature || currentEstimationRecord?.ttd_status === 'pending';
    
    let interval: NodeJS.Timeout | null = null;
    if (isWaitingTtd) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          syncWithSupabase();
        }
      }, 4000);
    }

    // Listener jika TTD disimpan dari tab browser lain
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('acwms_invoices') || e.key?.startsWith('acwms_work_orders')) {
        refreshData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedSpkId, customerSignature, currentEstimationRecord, syncWithSupabase, refreshData]);

  // Handler: ganti tab aktif (save current, load next)
  const handleSwitchTab = useCallback((tab: EstimationTab) => {
    // Save current tab draft before switching
    if (selectedSpkId && !isLocked) {
      const draftPayload = {
        items, estimation_type: estimationType, estimation_tab: activeTabId,
        estimation_date: estimationDate, estimation_time: estimationTime,
        vehicle_status: vehicleStatus, payment_plan: paymentPlan,
        estimator_name: estimatorName, estimator_signature: estimatorSignature,
        customer_signature: customerSignature, customer_signed_name: customerSignedName,
        estimated_duration: estimatedDuration,
        customer_response: customerResponse, customer_response_note: customerResponseNote,
        has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
        has_range_price: showRangePrice,
        has_second_table: hasSecondTable,
        table1_title: table1Title,
        table2_title: table2Title,
        items_table2: itemsTable2,
        discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
      };
      try { localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${activeTabId}`, JSON.stringify(draftPayload)); } catch {}
    }
    setActiveTabId(tab.id);
    if (selectedSpkId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`mhs_last_active_tab_${selectedSpkId}`, tab.id);
      } catch {}
    }
    // Load data for the new tab
    const { sourceData, existingEst } = loadTabData(selectedSpkId, tab.id, invoices);
    setCurrentEstimationRecord(existingEst || null);

    const resolvedName = sourceData?.estimation_type || tab.name || 'Estimasi';
    setEstimationType(resolvedName);

    if (sourceData) {
      if (sourceData.estimation_date) setEstimationDate(sourceData.estimation_date);
      if (sourceData.estimation_time) setEstimationTime(sourceData.estimation_time);
      if (sourceData.vehicle_status) setVehicleStatus(sourceData.vehicle_status); else setVehicleStatus('Di Tinggal');
      if (sourceData.payment_plan) setPaymentPlan(sourceData.payment_plan);
      setEstimatorName(sourceData.estimator_name || '');
      setEstimatorSignature(sourceData.estimator_signature || sourceData.signature_admin_url || '');
      setCustomerSignature(sourceData.customer_signature || sourceData.signature_customer_url || '');
      setCustomerSignedName(sourceData.customer_signed_name || selectedSpk?.vehicle?.customer_name || '');
      setEstimatedDuration(sourceData.estimated_duration || '');
      setCustomerResponse(sourceData.customer_response || '');
      setCustomerResponseNote(sourceData.customer_response_note || '');
      setShowDiscount(Boolean(sourceData.has_discount));
      setShowOpsi2(Boolean(sourceData.has_opsi2));
      setShowTax(Boolean(sourceData.has_tax));
      setShowRangePrice(Boolean(sourceData.has_range_price));
      setDiscountAmount(sourceData.discount_amount || 0);
      setTaxPercent(sourceData.tax_percent || 11);
      setAdminNotes(sourceData.admin_notes || '');
      const spkDefaultTab = formatComplaintsAndDiagnosis(selectedSpk?.complaints, selectedSpk?.notes).displayText;
      setEstimationComplaints(sourceData.complaints || spkDefaultTab);

      const has2nd = Boolean(
        sourceData.has_second_table ||
        sourceData.checklist_data?.has_second_table ||
        (sourceData.items_table2 && sourceData.items_table2.length > 0) ||
        (sourceData.checklist_data?.items_table2 && sourceData.checklist_data.items_table2.length > 0) ||
        (sourceData.items && sourceData.items.some((it: any) => it.section === 2))
      );
      setHasSecondTable(has2nd);
      setTable1Title(sourceData.table1_title || sourceData.checklist_data?.table1_title || 'BAGIAN 1');
      setTable2Title(sourceData.table2_title || sourceData.checklist_data?.table2_title || 'BAGIAN REM');

      const normalizeEstItem = (i: any) => {
        const p1 =
          i.price_opsi1 !== undefined && i.price_opsi1 !== ''
            ? i.price_opsi1
            : i.price !== undefined
            ? i.price
            : 0;
        const isP2ExplicitlyEmpty =
          i.price_opsi2 === '' || i.price_opsi2 === 0 || i.price_opsi2 === '0';
        const p2 = isP2ExplicitlyEmpty
          ? ''
          : i.price_opsi2 !== undefined
          ? i.price_opsi2
          : p1;
        const tot1 =
          i.total_opsi1 !== undefined
            ? i.total_opsi1
            : i.subtotal !== undefined
            ? i.subtotal
            : 0;
        const tot2 = isP2ExplicitlyEmpty
          ? 0
          : i.total_opsi2 !== undefined
          ? i.total_opsi2
          : tot1;

        return {
          name: i.name || '',
          is_service: Boolean(i.is_service),
          qty: i.qty || 1,
          unit: i.unit || 'PCS',
          price_opsi1: p1,
          total_opsi1: tot1,
          price_opsi2: p2,
          total_opsi2: tot2,
          price: i.price !== undefined ? i.price : 0,
          subtotal: i.subtotal !== undefined ? i.subtotal : 0,
        };
      };

      if (sourceData.items && Array.isArray(sourceData.items) && sourceData.items.length > 0) {
        const mappedItems = sourceData.items.map(normalizeEstItem);
        if (has2nd) {
          if (mappedItems.some((it: any) => it.section === 2)) {
            setItems(mappedItems.filter((it: any) => it.section !== 2));
            setItemsTable2(mappedItems.filter((it: any) => it.section === 2));
          } else if (sourceData.items_table2 && sourceData.items_table2.length > 0) {
            setItems(mappedItems);
            setItemsTable2(sourceData.items_table2.map(normalizeEstItem));
          } else if (sourceData.checklist_data?.items_table2 && sourceData.checklist_data.items_table2.length > 0) {
            setItems(mappedItems);
            setItemsTable2(sourceData.checklist_data.items_table2.map(normalizeEstItem));
          } else {
            setItems(mappedItems);
            setItemsTable2([...EMPTY_ESTIMATION_ROW]);
          }
        } else {
          setItems(mappedItems);
          setItemsTable2([...EMPTY_ESTIMATION_ROW]);
        }
      } else {
        setItems([...EMPTY_ESTIMATION_ROW]);
        setItemsTable2([...EMPTY_ESTIMATION_ROW]);
      }
    } else {
      setItems([...EMPTY_ESTIMATION_ROW]);
      setHasSecondTable(false);
      setTable1Title('BAGIAN 1');
      setTable2Title('BAGIAN REM');
      setItemsTable2([...EMPTY_ESTIMATION_ROW]);
      setEstimatedDuration('');
      setCustomerResponse(''); setCustomerResponseNote('');
      setAdminNotes('');
      setEstimationComplaints(formatComplaintsAndDiagnosis(selectedSpk?.complaints, selectedSpk?.notes).displayText);
      setVehicleStatus('Di Tinggal');
      setShowDiscount(false); setShowOpsi2(false); setShowTax(false); setShowRangePrice(false); setDiscountAmount(0);
    }
  }, [selectedSpkId, selectedSpk, isLocked, activeTabId, items, estimationType, estimationDate, estimationTime,
      vehicleStatus, paymentPlan, estimatorName, estimatorSignature, customerSignature, customerSignedName,
      estimatedDuration, customerResponse, customerResponseNote,
      showDiscount, showOpsi2, showTax, showRangePrice, hasSecondTable, table1Title, table2Title, itemsTable2, discountAmount, taxPercent, adminNotes, loadTabData, invoices]);

  // Real-time auto-save ke LocalStorage dan pembaruan indikator tersimpan otomatis (anti mati lampu / reload)
  useEffect(() => {
    if (!selectedSpk || !selectedSpkId || isLocked) return;
    // Cegah draft bocor: HANYA simpan jika form memang milik selectedSpk yang aktif
    if (loadedFormSpkIdRef.current !== selectedSpk.id) return;
    if (lastLoadedSpkId.current !== selectedSpkId || selectedSpk.id !== selectedSpkId) return;

    const draftPayload = {
      items, estimation_type: estimationType, estimation_tab: activeTabId,
      estimation_date: estimationDate, estimation_time: estimationTime,
      vehicle_status: vehicleStatus, payment_plan: paymentPlan,
      estimator_name: estimatorName, estimator_signature: estimatorSignature,
      customer_signature: customerSignature, customer_signed_name: customerSignedName,
      estimated_duration: estimatedDuration,
      customer_response: customerResponse, customer_response_note: customerResponseNote,
      has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
      has_range_price: showRangePrice,
      has_second_table: hasSecondTable,
      table1_title: table1Title,
      table2_title: table2Title,
      items_table2: itemsTable2,
      discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
      complaints: estimationComplaints,
      updated_at: new Date().toISOString(),
    };

    // 1. Simpan LANGSUNG secara sinkron ke LocalStorage (< 1ms)
    try {
      localStorage.setItem(`mhs_est_draft_${selectedSpk.id}_${activeTabId}`, JSON.stringify(draftPayload));
      if (selectedSpk.spk_number) {
        localStorage.setItem(`mhs_est_draft_${selectedSpk.spk_number}_${activeTabId}`, JSON.stringify(draftPayload));
      }
      localStorage.setItem(`mhs_est_tabs_${selectedSpk.id}`, JSON.stringify(tabList));
      if (selectedSpk.spk_number) {
        localStorage.setItem(`mhs_est_tabs_${selectedSpk.spk_number}`, JSON.stringify(tabList));
      }
      localStorage.setItem('mhs_last_active_estimation_spk_id', selectedSpk.id);
      localStorage.setItem(`mhs_last_active_tab_${selectedSpk.id}`, activeTabId);
    } catch {}

    // 2. Debounced update status indikator tersimpan otomatis
    const hasFilledItems =
      (items.length > 0 && items.some((i) => (i.name && i.name.trim()) || (i.price_opsi1 !== undefined && i.price_opsi1 !== '' && i.price_opsi1 !== 0))) ||
      (hasSecondTable && itemsTable2.length > 0 && itemsTable2.some((i) => (i.name && i.name.trim()) || (i.price_opsi1 !== undefined && i.price_opsi1 !== '' && i.price_opsi1 !== 0)));
    if (!hasFilledItems) return;

    const timer = setTimeout(() => {
      try {
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        setLastSavedTime(`Otomatis ${timeNow}`);
      } catch {}
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    selectedSpk, selectedSpkId, isLocked, items, estimationType, activeTabId,
    estimationDate, estimationTime, vehicleStatus, paymentPlan,
    estimatorName, estimatorSignature, customerSignature, customerSignedName,
    estimatedDuration, customerResponse, customerResponseNote,
    showDiscount, showOpsi2, showTax, showRangePrice, hasSecondTable, table1Title, table2Title, itemsTable2, discountAmount, taxPercent, adminNotes, estimationComplaints, tabList,
  ]);

  // Calculations (handles string/text prices like CEK cleanly)
  const calculateSectionTotals = (itemList: InvoiceItem[]) => {
    let tot1Min = 0;
    let tot1Max = 0;
    let tot2Min = 0;
    let tot2Max = 0;

    itemList.forEach((it) => {
      const qty = it.qty || 1;
      const isP1Empty = it.price_opsi1 === '' || it.price_opsi1 === 0 || it.price_opsi1 === '0';
      const p1Raw = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
      const isP2Empty = it.price_opsi2 === '' || it.price_opsi2 === 0 || it.price_opsi2 === '0';
      const p2Raw = isP2Empty ? 0 : (it.price_opsi2 !== undefined && it.price_opsi2 !== '' ? it.price_opsi2 : p1Raw);

      if (showRangePrice) {
        const r1 = parseRangePrice(p1Raw);
        const r2 = parseRangePrice(p2Raw);
        if (!isP1Empty) {
          tot1Min += r1.min * qty;
          tot1Max += r1.max * qty;
        }
        if (!isP2Empty) {
          tot2Min += r2.min * qty;
          tot2Max += r2.max * qty;
        }
      } else {
        const parsed1 = parseNumericPriceValue(p1Raw);
        if (!isP1Empty && !parsed1.isText) {
          const t1 = typeof it.total_opsi1 === 'number' ? it.total_opsi1 : parsed1.num * qty;
          tot1Min += Number.isNaN(t1) ? 0 : t1;
          tot1Max += Number.isNaN(t1) ? 0 : t1;
        }
        const parsed2 = parseNumericPriceValue(p2Raw);
        if (!isP2Empty && !parsed2.isText) {
          const t2 = typeof it.total_opsi2 === 'number' && it.total_opsi2 > 0 ? it.total_opsi2 : parsed2.num * qty;
          tot2Min += Number.isNaN(t2) ? 0 : t2;
          tot2Max += Number.isNaN(t2) ? 0 : t2;
        }
      }
    });

    return { tot1Min, tot1Max, tot2Min, tot2Max };
  };

  const t1Totals = calculateSectionTotals(items);
  const t2Totals = calculateSectionTotals(hasSecondTable ? itemsTable2 : []);

  const subtotalOpsi1Min = t1Totals.tot1Min + (hasSecondTable ? t2Totals.tot1Min : 0);
  const subtotalOpsi1Max = t1Totals.tot1Max + (hasSecondTable ? t2Totals.tot1Max : 0);
  const subtotalOpsi1 = subtotalOpsi1Min; // backward compat

  const subtotalOpsi2Min = t1Totals.tot2Min + (hasSecondTable ? t2Totals.tot2Min : 0);
  const subtotalOpsi2Max = t1Totals.tot2Max + (hasSecondTable ? t2Totals.tot2Max : 0);
  const subtotalOpsi2 = subtotalOpsi2Min; // backward compat

  const effectiveDiscount = showDiscount ? discountAmount : 0;
  const taxAmountOpsi1 = showTax ? ((subtotalOpsi1 - effectiveDiscount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi1Max = showTax ? ((subtotalOpsi1Max - effectiveDiscount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi2 = showTax ? ((subtotalOpsi2 - effectiveDiscount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi2Max = showTax ? ((subtotalOpsi2Max - effectiveDiscount) * (taxPercent / 100)) : 0;

  const totalFinalOpsi1 = Math.max(0, subtotalOpsi1Min - effectiveDiscount + taxAmountOpsi1);
  const totalFinalOpsi1Max = Math.max(0, subtotalOpsi1Max - effectiveDiscount + taxAmountOpsi1Max);
  const totalFinalOpsi2 = Math.max(0, subtotalOpsi2Min - effectiveDiscount + taxAmountOpsi2);
  const totalFinalOpsi2Max = Math.max(0, subtotalOpsi2Max - effectiveDiscount + taxAmountOpsi2Max);

  // Row update handlers (otomatis langsung hitung ulang total saat QTY atau Harga berubah)
  const handleUpdateItemField = (
    index: number,
    field: keyof InvoiceItem,
    value: any,
    targetTable: 1 | 2 = 1
  ) => {
    if (isLocked) return;
    const currentList = targetTable === 1 ? items : itemsTable2;
    const setList = targetTable === 1 ? setItems : setItemsTable2;
    const updated = [...currentList];
    const row = { ...updated[index] };

    if (field === 'qty') {
      const qty = Math.max(1, Number(value) || 1);
      row.qty = qty;

      const parsed1 = parseNumericPriceValue(row.price_opsi1);
      if (parsed1.isText) {
        row.total_opsi1 = parsed1.text;
      } else if (parsed1.isRange) {
        row.total_opsi1 = parsed1.min === parsed1.max ? parsed1.min * qty : `${parsed1.min * qty} - ${parsed1.max * qty}`;
      } else {
        row.total_opsi1 = parsed1.num * qty;
      }
      row.subtotal = row.total_opsi1;

      // Jika harga Opsi 2 kosong/0, total Opsi 2 tetap 0
      if (row.price_opsi2 === '' || row.price_opsi2 === 0 || row.price_opsi2 === '0') {
        row.total_opsi2 = 0;
      } else {
        const p2Val = row.price_opsi2 !== undefined ? row.price_opsi2 : row.price_opsi1;
        const parsed2 = parseNumericPriceValue(p2Val);
        if (parsed2.isText) {
          row.total_opsi2 = parsed2.text;
        } else if (parsed2.isRange) {
          row.total_opsi2 = parsed2.min === parsed2.max ? parsed2.min * qty : `${parsed2.min * qty} - ${parsed2.max * qty}`;
        } else {
          row.total_opsi2 = parsed2.num * qty;
        }
      }
    } else if (field === 'price_opsi1') {
      const valStr = String(value);
      const qty = row.qty || 1;
      const parsed = parseNumericPriceValue(valStr);

      if (parsed.isText) {
        row.price_opsi1 = parsed.text;
        row.total_opsi1 = parsed.text;
        row.price = parsed.text;
        row.subtotal = parsed.text;
      } else if (parsed.isRange) {
        row.price_opsi1 = valStr;
        row.total_opsi1 = parsed.min === parsed.max ? parsed.min * qty : `${parsed.min * qty} - ${parsed.max * qty}`;
        row.price = valStr;
        row.subtotal = row.total_opsi1;
      } else {
        if (valStr.trim() === '') {
          row.price_opsi1 = '';
          row.total_opsi1 = 0;
          row.price = 0;
          row.subtotal = 0;
        } else {
          row.price_opsi1 = parsed.num > 0 ? new Intl.NumberFormat('id-ID').format(parsed.num) : valStr;
          row.total_opsi1 = parsed.num * qty;
          row.price = parsed.num;
          row.subtotal = row.total_opsi1;
        }
      }
      if (row.price_opsi2 === undefined) {
        row.price_opsi2 = 0;
        row.total_opsi2 = 0;
      }
    } else if (field === 'price_opsi2') {
      const valStr = String(value);
      const qty = row.qty || 1;
      const parsed = parseNumericPriceValue(valStr);

      if (parsed.isText) {
        row.price_opsi2 = parsed.text;
        row.total_opsi2 = parsed.text;
      } else if (parsed.isRange) {
        row.price_opsi2 = valStr;
        row.total_opsi2 = parsed.min === parsed.max ? parsed.min * qty : `${parsed.min * qty} - ${parsed.max * qty}`;
      } else {
        if (valStr.trim() === '' || valStr.trim() === '0') {
          row.price_opsi2 = '';
          row.total_opsi2 = 0;
        } else {
          row.price_opsi2 = parsed.num > 0 ? new Intl.NumberFormat('id-ID').format(parsed.num) : valStr;
          row.total_opsi2 = parsed.num * qty;
        }
      }
    } else if (field === 'name') {
      row.name = String(value);
    } else if (field === 'unit') {
      row.unit = String(value).toUpperCase();
    }

    updated[index] = row;
    setList(updated);
  };

  const handleAddEmptyRow = (targetTable: 1 | 2 = 1) => {
    if (isLocked) return;
    const newRow: InvoiceItem = {
      name: '',
      is_service: true,
      qty: 1,
      unit: 'PCS',
      price_opsi1: 0,
      total_opsi1: 0,
      price_opsi2: 0,
      total_opsi2: 0,
      price: 0,
      subtotal: 0,
      section: targetTable,
    };
    if (targetTable === 1) {
      setItems([...items, newRow]);
    } else {
      setItemsTable2([...itemsTable2, newRow]);
    }
  };

  const handleRemoveRow = (index: number, targetTable: 1 | 2 = 1) => {
    if (isLocked) return;
    if (targetTable === 1) {
      if (items.length <= 1) {
        showToast('Minimal harus ada 1 baris di Tabel 1.', 'warning');
        return;
      }
      setItems(items.filter((_, i) => i !== index));
    } else {
      if (itemsTable2.length <= 1) {
        showToast('Minimal harus ada 1 baris di Tabel 2.', 'warning');
        return;
      }
      setItemsTable2(itemsTable2.filter((_, i) => i !== index));
    }
  };

  const handleMoveRowUp = (index: number, targetTable: 1 | 2 = 1) => {
    if (isLocked || index === 0) return;
    if (targetTable === 1) {
      const updated = [...items];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      setItems(updated);
    } else {
      const updated = [...itemsTable2];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      setItemsTable2(updated);
    }
  };

  const handleMoveRowDown = (index: number, targetTable: 1 | 2 = 1) => {
    if (isLocked) return;
    if (targetTable === 1) {
      if (index === items.length - 1) return;
      const updated = [...items];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      setItems(updated);
    } else {
      if (index === itemsTable2.length - 1) return;
      const updated = [...itemsTable2];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      setItemsTable2(updated);
    }
  };

  const handleAddFromCatalog = (inventoryItem: InventoryItem) => {
    if (isLocked) return;
    const p = inventoryItem.sell_price;
    const target = catalogTargetTable;
    const newRow: InvoiceItem = {
      item_id: inventoryItem.id,
      code: inventoryItem.item_code,
      name: inventoryItem.name,
      is_service: inventoryItem.is_service,
      is_custom: false,
      qty: 1,
      unit: inventoryItem.unit ? inventoryItem.unit.toUpperCase() : (inventoryItem.is_service ? 'JASA' : 'PCS'),
      price_opsi1: p,
      total_opsi1: p,
      price_opsi2: p,
      total_opsi2: p,
      price: p,
      subtotal: p,
      section: target,
    };
    if (target === 1) {
      setItems([...items, newRow]);
    } else {
      setItemsTable2([...itemsTable2, newRow]);
    }
    showToast(`Ditambahkan ke ${target === 1 ? (table1Title || 'Tabel 1') : (table2Title || 'Tabel 2')}: ${inventoryItem.name}`, 'info');
    setShowCatalogModal(false);
  };

  // Salin seluruh item harga Opsi 1 ke Opsi 2 secara instan
  const handleCopyAllFromOpsi1 = () => {
    if (isLocked) return;
    const copyFn = (it: InvoiceItem) => {
      const p1 = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : 0;
      const tot1 = it.total_opsi1 !== undefined ? it.total_opsi1 : 0;
      return {
        ...it,
        price_opsi2: p1,
        total_opsi2: tot1,
      };
    };
    setItems((prev) => prev.map(copyFn));
    if (hasSecondTable) {
      setItemsTable2((prev) => prev.map(copyFn));
    }
    showToast('Seluruh harga Opsi 2 berhasil diselaraskan persis dari Opsi 1!', 'success');
  };

  // Kosongkan / hilangkan seluruh harga Opsi 2
  const handleClearAllOpsi2 = () => {
    if (isLocked) return;
    const clearFn = (it: InvoiceItem) => ({
      ...it,
      price_opsi2: '',
      total_opsi2: 0,
    });
    setItems((prev) => prev.map(clearFn));
    if (hasSecondTable) {
      setItemsTable2((prev) => prev.map(clearFn));
    }
    showToast('Seluruh harga Opsi 2 berhasil dikosongkan.', 'info');
  };

  // Add new estimate tab with unique id
  const handleAddNewTab = () => {
    if (isLocked) return;
    const nextNum = tabList.length + 1;
    const newTabId = `tab_${Date.now()}`;
    const tabName = `Estimasi ${nextNum}`;
    const newTab: EstimationTab = { id: newTabId, name: tabName };
    
    // Save current tab before switching
    if (selectedSpkId) {
      const draftPayload = {
        items, estimation_type: estimationType, estimation_tab: activeTabId,
        estimation_date: estimationDate, estimation_time: estimationTime,
        vehicle_status: vehicleStatus, payment_plan: paymentPlan,
        estimator_name: estimatorName, estimator_signature: estimatorSignature,
        customer_signature: customerSignature, customer_signed_name: customerSignedName,
        estimated_duration: estimatedDuration,
        customer_response: customerResponse, customer_response_note: customerResponseNote,
        has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
        has_range_price: showRangePrice,
        has_second_table: hasSecondTable,
        table1_title: table1Title,
        table2_title: table2Title,
        items_table2: itemsTable2,
        discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
      };
      try { localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${activeTabId}`, JSON.stringify(draftPayload)); } catch {}
    }
    
    const newTabs = [...tabList, newTab];
    setTabList(newTabs);
    setActiveTabId(newTabId);
    setEstimationType(tabName);
    setItems(EMPTY_ESTIMATION_ROW);
    setHasSecondTable(false);
    setTable1Title('BAGIAN 1');
    setTable2Title('BAGIAN REM');
    setItemsTable2(EMPTY_ESTIMATION_ROW);
    setLastSavedTime(null);
    setEstimatorName(''); setEstimatorSignature('');
    setCustomerSignature(''); setCustomerSignedName(selectedSpk?.vehicle?.customer_name || '');
    setEstimatedDuration('');
    setCustomerResponse(''); setCustomerResponseNote('');
    setAdminNotes(''); setCurrentEstimationRecord(null);
    setShowDiscount(false); setShowOpsi2(false); setShowTax(false); setShowRangePrice(false); setDiscountAmount(0);
    
    if (selectedSpkId) {
      try {
        localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(newTabs));
        const initDraft = {
          items: EMPTY_ESTIMATION_ROW, estimation_type: tabName, estimation_tab: newTabId,
          has_discount: false, has_opsi2: false, has_tax: false, has_range_price: false,
          has_second_table: false, table1_title: 'BAGIAN 1', table2_title: 'BAGIAN REM', items_table2: EMPTY_ESTIMATION_ROW,
        };
        localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${newTabId}`, JSON.stringify(initDraft));
      } catch {}
    }
    showToast(`Tab '${tabName}' dibuat.`, 'info');
  };

  // Rename tab inline
  const handleStartRename = (tab: EstimationTab) => {
    if (isLocked) return;
    setRenamingTabId(tab.id);
    setRenameValue(tab.name);
  };

  const handleCommitRename = () => {
    if (!renamingTabId) return;
    const trimmed = renameValue.trim() || 'Estimasi';
    const newTabs = tabList.map((t) => t.id === renamingTabId ? { ...t, name: trimmed } : t);
    setTabList(newTabs);
    if (renamingTabId === activeTabId) {
      setEstimationType(trimmed);
    }
    if (selectedSpkId) {
      try { localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(newTabs)); } catch {}
    }
    setRenamingTabId(null);
    showToast(`Tab diganti menjadi "${trimmed}"`, 'success');
  };

  // Remove extra tab
  const handleRemoveTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || tabList.length <= 1) return;
    const tabToRemove = tabList.find((t) => t.id === tabId);
    if (!window.confirm(`Hapus tab estimasi "${tabToRemove?.name || 'ini'}"?`)) return;

    const newTabs = tabList.filter((t) => t.id !== tabId);
    setTabList(newTabs);
    if (selectedSpkId) {
      try {
        localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(newTabs));
        localStorage.removeItem(`mhs_est_draft_${selectedSpkId}_${tabId}`);
      } catch {}
    }
    if (activeTabId === tabId) {
      handleSwitchTab(newTabs[0]);
    }
    showToast(`Tab "${tabToRemove?.name}" dihapus.`, 'info');
  };

  // Save Estimation (untuk tab aktif)
  const handleSaveEstimation = async () => {
    if (!selectedSpk) {
      showToast('Pilih SPK kendaraan terlebih dahulu.', 'error');
      return;
    }
    if (isLocked) {
      showToast('Data estimasi terkunci karena pekerjaan SPK ini telah berstatus Selesai.', 'warning');
      return null;
    }
    if (items.length === 0 || !items.some((i) => i.name.trim())) {
      showToast('Tambahkan minimal 1 item estimasi.', 'error');
      return;
    }

    setIsSaving(true);
    showToast('Menyimpan estimasi ke database cloud...', 'info');

    try {
      // Cari estimasi existing untuk tab ini
      const existingEst = invoices.find(
        (inv) => inv.type === 'estimation' && inv.work_order_id === selectedSpk.id
          && ((inv as any).tab_id === activeTabId || (!((inv as any).tab_id) && activeTabId === 'tab_1'))
      );
      const targetBranch = (selectedSpk.received_at_branch as any) || DBService.getActiveBranch();
      const estNumber = existingEst ? existingEst.invoice_number : await generateUniqueInvoiceNumberAsync('estimation', targetBranch);
      const activeTabObj = tabList.find((t) => t.id === activeTabId) || tabList[0];
      const activeName = (estimationType || '').trim() || activeTabObj?.name || 'Estimasi';

      // Pastikan nama di tabList dan state tersinkronisasi
      const updatedTabList = tabList.map((t) => t.id === activeTabId ? { ...t, name: activeName } : t);
      setTabList(updatedTabList);

      const allInvoiceItems: InvoiceItem[] = hasSecondTable
        ? [
            ...items.map((it) => ({ ...it, section: 1 })),
            ...itemsTable2.map((it) => ({ ...it, section: 2 })),
          ]
        : items.map((it) => ({ ...it, section: 1 }));

      const invoicePayload: Omit<Invoice, 'id'> & { id?: string; tab_id?: string; tabs?: any } = {
        id: existingEst?.id,
        invoice_number: estNumber,
        type: 'estimation',
        work_order_id: selectedSpk.id,
        vehicle_id: selectedSpk.vehicle_id,
        items: allInvoiceItems,
        has_second_table: hasSecondTable,
        table1_title: table1Title,
        table2_title: table2Title,
        items_table2: hasSecondTable ? itemsTable2 : [],
        subtotal_table1_opsi1: t1Totals.tot1Min,
        subtotal_table1_opsi2: t1Totals.tot2Min,
        subtotal_table2_opsi1: hasSecondTable ? t2Totals.tot1Min : 0,
        subtotal_table2_opsi2: hasSecondTable ? t2Totals.tot2Min : 0,
        subtotal: subtotalOpsi1,
        discount_amount: effectiveDiscount,
        tax_percent: showTax ? taxPercent : 0,
        tax_amount: taxAmountOpsi1,
        total_amount: totalFinalOpsi1,
        down_payment: 0,
        balance_due: totalFinalOpsi1,
        payment_status: 'pending',
        admin_notes: adminNotes,
        created_at: existingEst?.created_at || new Date().toISOString(),

        // Metadata
        estimation_type: activeName,
        estimation_tab: activeTabId,
        estimation_date: estimationDate,
        estimation_time: estimationTime,
        vehicle_status: vehicleStatus,
        payment_plan: paymentPlan,
        estimator_name: estimatorName,
        estimator_signature: estimatorSignature,
        signature_admin_url: estimatorSignature,
        estimated_duration: estimatedDuration,
        complaints: estimationComplaints.trim() || formatComplaintsAndDiagnosis(selectedSpk.complaints, selectedSpk.notes).displayText,
        customer_response: customerResponse as any,
        customer_response_note: customerResponseNote,
        has_discount: showDiscount,
        has_opsi2: showOpsi2,
        has_tax: showTax,
        has_range_price: showRangePrice,
        total_opsi1: totalFinalOpsi1,
        total_opsi1_max: totalFinalOpsi1Max,
        total_opsi2: totalFinalOpsi2,
        total_opsi2_max: totalFinalOpsi2Max,
        tab_id: activeTabId,
        tabs: updatedTabList,
        ttd_status: customerSignature ? (customerResponse === 'batal' ? 'rejected' : 'signed') : (currentEstimationRecord?.ttd_status || 'pending'),
        customer_signature: customerSignature || currentEstimationRecord?.customer_signature,
        signature_customer_url: customerSignature || currentEstimationRecord?.signature_customer_url,
        customer_signed_at: customerSignature ? (currentEstimationRecord?.customer_signed_at || new Date().toISOString()) : undefined,
        customer_signed_name: customerSignedName || currentEstimationRecord?.customer_signed_name || selectedSpk?.vehicle?.customer_name,
        customer_approved_option: (customerResponse === 'opsi1' || customerResponse === 'opsi2' || customerResponse === 'batal') ? customerResponse : currentEstimationRecord?.customer_approved_option,
      } as any;

      // 1. Simpan ke Supabase Cloud (WAJIB ditunggu dan diverifikasi berhasil sebelum menampilkan pesan sukses)
      const savedInvoice = await saveInvoiceAsync(invoicePayload as any);

      // PENTING: Bersihkan nested work_order & vehicle dari invoice agar tidak terjadi circular reference pembengkak memori
      const sanitizedSaved = { ...savedInvoice };
      delete (sanitizedSaved as any).work_order;
      delete (sanitizedSaved as any).vehicle;

      // Tentukan activeMainEst: jangan timpa estimasi yang sudah disetujui jika tab yang sedang disimpan ini dibatalkan
      const currentMainEst = selectedSpk.checklist_data?.estimation;
      const isCurrentMainApproved =
        currentMainEst &&
        ((currentMainEst as any).customer_approved_option === 'opsi1' ||
          (currentMainEst as any).customer_approved_option === 'opsi2' ||
          (currentMainEst as any).customer_response === 'opsi1' ||
          (currentMainEst as any).customer_response === 'opsi2' ||
          (currentMainEst as any).ttd_status === 'signed');
      const isThisEstBatal = customerResponse === 'batal';
      const mainEstToKeep = isThisEstBatal && isCurrentMainApproved ? currentMainEst : sanitizedSaved;

      // 2. Perbarui SPK di Supabase Cloud & Local
      const updatedWorkOrder: WorkOrder = {
        ...selectedSpk,
        status: selectedSpk.status === 'queue' ? 'estimating' : selectedSpk.status,
        checklist_data: {
          ...(selectedSpk.checklist_data || {}),
          tabs: updatedTabList,
          estimation: mainEstToKeep,
          [`estimation_${activeTabId}`]: sanitizedSaved,
        } as any,
      };
      await DBService.saveWorkOrderAsync(updatedWorkOrder, targetBranch);

      // 3. Backup ke LocalStorage browser & hapus draft
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mhs_est_saved_${selectedSpk.id}_${activeTabId}`, JSON.stringify(savedInvoice));
        localStorage.setItem(`mhs_est_saved_${selectedSpk.spk_number}_${activeTabId}`, JSON.stringify(savedInvoice));
        localStorage.removeItem(`mhs_est_draft_${selectedSpk.id}_${activeTabId}`);
        localStorage.removeItem(`mhs_est_draft_${selectedSpk.spk_number}_${activeTabId}`);
        localStorage.setItem(`mhs_est_tabs_${selectedSpk.id}`, JSON.stringify(updatedTabList));
        localStorage.setItem(`mhs_est_tabs_${selectedSpk.spk_number}`, JSON.stringify(updatedTabList));
      }

      // 4. Ambil ulang data authoritative terbaru dari Supabase database
      await syncWithSupabase();
      refreshData();

      // 5. Update state tampilan & indikator tersimpan
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
      setLastSavedTime(timeNow);
      setCurrentEstimationRecord(savedInvoice);

      showToast(`Tersimpan! Estimasi "${activeName}" (${savedInvoice.invoice_number}) berhasil disimpan ke database cloud.`, 'success');

      return savedInvoice;
    } catch (err: any) {
      console.error('Error saving estimation:', err);
      showToast(`Gagal disimpan: ${err?.message || 'Gagal menyimpan estimasi ke database.'}`, 'error');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenShareModal = async () => {
    let current = currentEstimationRecord;
    if (!current) {
      current = await handleSaveEstimation() || null;
    }
    if (current) {
      setShowShareModal(true);
    }
  };

  const handleApproveAndProceedToServicing = async () => {
    if (!selectedSpk) return;
    await updateWorkOrderStatusAsync(selectedSpk.id, 'servicing');
    refreshData();
    showToast('Estimasi disetujui! Status SPK dipindahkan ke Dalam Pengerjaan.', 'success');
    router.push('/antrean');
  };

  // Generate public TTD URL
  const getPublicTtdUrl = () => {
    if (typeof window === 'undefined') return '';
    // Utamakan nomor invoice (EST-...) atau SPK number yang terindeks dan tersimpan di database Supabase
    const estToken =
      currentEstimationRecord?.invoice_number ||
      currentEstimationRecord?.id ||
      selectedSpk?.spk_number ||
      selectedSpk?.id ||
      'demo';

    let baseOrigin = window.location.origin;
    if (
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      process.env.NEXT_PUBLIC_APP_URL
    ) {
      baseOrigin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    }

    return `${baseOrigin}/estimasi/ttd/${encodeURIComponent(estToken)}`;
  };

  const handleCopyLink = () => {
    const url = getPublicTtdUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Tautan TTD Customer berhasil disalin!', 'success');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const getWhatsAppShareUrl = () => {
    const customerPhone = selectedSpk?.vehicle?.phone_number || '';
    const customerName = selectedSpk?.vehicle?.customer_name || 'Pelanggan';
    const plate = selectedSpk?.vehicle?.license_plate || '';
    const car = `${selectedSpk?.vehicle?.car_brand || ''} ${selectedSpk?.vehicle?.car_model || ''}`;
    const ttdLink = getPublicTtdUrl();

    const msg =
      `Halo Bpk/Ibu *${customerName}*,\n\n` +
      `Berikut adalah rincian *Surat Estimasi Biaya Perbaikan* dari *${settings.name}* untuk kendaraan Anda:\n\n` +
      `🚗 Kendaraan: *${car}* (${plate})\n` +
      `📄 No. Estimasi: *${currentEstimationRecord?.invoice_number || 'EST-OFFICIAL'}*\n` +
      `💰 Total Opsi 1: *${formatCurrency(totalFinalOpsi1)}*\n` +
      (showOpsi2 ? `💰 Total Opsi 2: *${formatCurrency(totalFinalOpsi2)}*\n\n` : `\n`) +
      `Silakan klik tautan resmi di bawah ini untuk meninjau rincian pekerjaan, memilih opsi, dan membubuhkan tanda tangan persetujuan digital secara langsung:\n\n` +
      `🔗 *Link Persetujuan & TTD:* ${ttdLink}\n\n` +
      `Terima kasih atas kepercayaan Anda kepada ${settings.name}.`;

    return customerPhone ? createWhatsAppLink(customerPhone, msg) : '#';
  };

  const currentInventoryPool = (selectedSpk?.received_at_branch && selectedSpk.received_at_branch !== DBService.getActiveBranch())
    ? DBService.getInventory(selectedSpk.received_at_branch as any)
    : inventory;

  const filteredInventory = currentInventoryPool.filter((item) => {
    const matchesCat = pickerCategory === 'all' || item.category === pickerCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      item.item_code.toLowerCase().includes(pickerSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* 1. TOP BAR HEADER (Matching Screenshot "Detail PKB" with Clock & SA Avatar) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Menu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Detail PKB</h1>
              {selectedSpk && (
                <div className="relative inline-block">
                  <select
                    value={selectedSpkId}
                    onChange={(e) => handleSelectSpk(e.target.value)}
                    className="text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg border border-slate-300 outline-none cursor-pointer"
                  >
                    {availableOrders.filter((wo) => wo.status !== 'completed' && wo.status !== 'cancelled').length === 0 ? (
                      <option value="">(Tidak ada mobil aktif yang perlu diestimasi)</option>
                    ) : (
                      availableOrders
                        .filter((wo) => wo.status !== 'completed' && wo.status !== 'cancelled')
                        .map((wo) => (
                          <option key={wo.id} value={wo.id}>
                            [{wo.received_at_branch || 'MHS 1'}] {wo.spk_number} - {wo.vehicle?.customer_name} ({wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''})
                          </option>
                        ))
                    )}
                  </select>
                </div>
              )}
              {isLocked && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>TERKUNCI (SELESAI)</span>
                </span>
              )}
              {selectedSpk?.vehicle && (
                <button
                  type="button"
                  onClick={() => setShowEditPlateModal(true)}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  title="Ubah Plat Nomor Kendaraan"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Ganti Plat ({selectedSpk.vehicle.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : ''})</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {selectedSpk ? `${selectedSpk.spk_number} • ${selectedSpk.vehicle?.car_brand} ${selectedSpk.vehicle?.car_model}` : 'L-001-21082026-LONTAR'}
            </p>
          </div>
        </div>

        {/* Real-time Clock & Avatar */}
        <div className="flex items-center space-x-4 self-end sm:self-auto">
          <div className="text-right font-mono">
            <div className="text-sm font-black text-slate-900 tracking-wider">{currentClock || '23:19:39'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{currentDateStr || 'Rabu, 26 Agu 2026'}</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-black text-sm shadow-sm">
              {currentRole ? currentRole.toUpperCase() : 'SA'}
            </div>
            <button
              onClick={() => router.push('/antrean')}
              title="Kembali ke Antrean"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <LogOut className="w-5 h-5 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN ESTIMASI CARD (100% Faithful to Reference Screenshot) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-5">
        {/* Card Header & Blue CTA Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🧮</span>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Estimasi Biaya <span className="text-slate-400 font-normal text-xs sm:text-sm">— bisa banyak estimasi per PKB</span>
            </h2>
          </div>

          <button
            onClick={handleOpenShareModal}
            className="inline-flex items-center justify-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <PenTool className="w-4 h-4" />
            <span>Kirim Link TTD Customer</span>
          </button>
        </div>

        {/* PROMINENT BANNER STATUS RESPON CUSTOMER DARI LINK ONLINE */}
        {customerResponse === 'opsi1' && (
          <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs font-black text-lg">
                ✓
              </div>
              <div>
                <h4 className="font-black text-sm text-emerald-950 flex items-center space-x-2">
                  <span>STATUS: DISETUJUI CUSTOMER — OPSI 1</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">Online TTD</span>
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Pelanggan <strong>{customerSignedName || selectedSpk?.vehicle?.customer_name || 'Customer'}</strong> telah menyetujui dan menandatangani estimasi <strong>Opsi 1</strong> secara digital.
                </p>
              </div>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={handleApproveAndProceedToServicing}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex-shrink-0"
              >
                <span>Mulai Pengerjaan Servis →</span>
              </button>
            )}
          </div>
        )}

        {customerResponse === 'opsi2' && (
          <div className="bg-blue-50 border-2 border-blue-400 text-blue-950 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs font-black text-lg">
                ✓
              </div>
              <div>
                <h4 className="font-black text-sm text-blue-950 flex items-center space-x-2">
                  <span>STATUS: DISETUJUI CUSTOMER — OPSI 2</span>
                  <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">Online TTD</span>
                </h4>
                <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                  Pelanggan <strong>{customerSignedName || selectedSpk?.vehicle?.customer_name || 'Customer'}</strong> telah menyetujui dan menandatangani estimasi <strong>Opsi 2</strong> secara digital.
                </p>
              </div>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={handleApproveAndProceedToServicing}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex-shrink-0"
              >
                <span>Mulai Pengerjaan Servis →</span>
              </button>
            )}
          </div>
        )}

        {customerResponse === 'batal' && (
          <div className="bg-rose-50 border-2 border-rose-400 text-rose-950 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs font-black text-lg">
                ✕
              </div>
              <div>
                <h4 className="font-black text-sm text-rose-950 flex items-center space-x-2">
                  <span>STATUS: ESTIMASI TAB INI DIBATALKAN / DITOLAK CUSTOMER</span>
                  <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-bold">Online TTD</span>
                </h4>
                <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                  Pelanggan <strong>{customerSignedName || selectedSpk?.vehicle?.customer_name || 'Customer'}</strong> menandatangani penolakan / pembatalan pada opsi estimasi tab ini.
                  {tabList.length > 1 && (
                    <span className="block mt-1 font-semibold text-slate-700">
                      ℹ️ Jika ada tab estimasi lain yang disetujui, pengerjaan servis SPK ini tetap berjalan menggunakan estimasi yang disetujui.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PROMINENT LOCKING BANNER WHEN JOB IS COMPLETED */}
        {isCompleted && currentRole === 'owner' && (
          <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-emerald-950 flex items-center space-x-1.5">
                  <span>Akses Penuh Owner — Data Dibuka untuk Pengeditan</span>
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Pekerjaan untuk SPK <strong>{selectedSpk?.spk_number}</strong> telah berstatus Selesai, namun sebagai <strong>Owner</strong> Anda dapat merevisi estimasi secara langsung atau membuka kunci status pekerjaan.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  if (selectedSpk) {
                    await unlockWorkOrderAsync(selectedSpk.id, 'servicing');
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Buka status SPK kembali ke Sedang Dikerjakan"
              >
                <Unlock className="w-4 h-4" />
                <span>Buka Kunci SPK (Pindah ke Dikerjakan)</span>
              </button>
              {selectedSpk?.vehicle && (
                <button
                  type="button"
                  onClick={() => setShowEditPlateModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Car className="w-4 h-4 text-blue-600" />
                  <span>Ubah Plat</span>
                </button>
              )}
            </div>
          </div>
        )}

        {isCompleted && currentRole !== 'owner' && (
          <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-amber-950 flex items-center space-x-1.5">
                  <span>Data Estimasi Terkunci (Pekerjaan Selesai)</span>
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Pekerjaan untuk SPK <strong>{selectedSpk?.spk_number}</strong> telah diselesaikan. Rincian item, jasa, harga, dan opsi telah terkunci permanen. <em>Kunci data ini dapat dibuka oleh peran Owner.</em>
                </p>
              </div>
            </div>
            {selectedSpk?.vehicle && (
              <button
                type="button"
                onClick={() => setShowEditPlateModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 rounded-xl text-xs font-bold transition shadow-xs flex-shrink-0 cursor-pointer"
              >
                <Car className="w-4 h-4 text-blue-600" />
                <span>Ubah Plat Nomor</span>
              </button>
            )}
          </div>
        )}

        {/* Banner Rincian SPK Sah (Keluhan Customer & Uraian Pekerjaan / Diagnosa Awal) */}
        {selectedSpk && (
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-950 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-xs">
                  📋
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black uppercase tracking-wider text-[11px] text-amber-950">
                      Rincian SPK Sah — Intake Bengkel ({selectedSpk.spk_number})
                    </span>
                    <span className="text-[9.5px] bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Data Sah Intake
                    </span>
                  </div>
                  <span className="text-[10.5px] text-amber-800 font-medium">
                    {selectedSpk.vehicle?.car_brand} {selectedSpk.vehicle?.car_model} ({selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : '-'}) • Mekanik: {selectedSpk.mechanic_name || '-'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditSpkModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-amber-100/60 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Edit rincian data SPK, keluhan, teknisi, dll."
              >
                <Pencil className="w-3.5 h-3.5 text-amber-700" />
                <span>Edit Isi SPK</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
              <div className="bg-white/90 p-3 rounded-xl border border-amber-100 space-y-1">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                  1. Keluhan Customer (SPK):
                </span>
                <p className="font-semibold text-slate-900 text-xs leading-relaxed break-words whitespace-pre-wrap">
                  {selectedSpk.complaints || 'Perawatan berkala / Servis rutin'}
                </p>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-amber-100 space-y-1">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">
                  2. Uraian Pekerjaan / Diagnosa Awal (SPK):
                </span>
                <p className="font-semibold text-slate-900 text-xs leading-relaxed break-words whitespace-pre-wrap">
                  {selectedSpk.notes || 'Pemeriksaan menyeluruh, tune-up berkala, dan uji fungsi sistem kendaraan.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Bar — multi estimasi dengan rename inline */}
        <div className="flex items-center flex-wrap gap-2 pt-1 border-b border-slate-100 pb-3">
          {tabList.map((tab) => {
            const tabInv = invoices.find(
              (inv) =>
                inv.type === 'estimation' &&
                (inv.work_order_id === selectedSpk?.id ||
                  (selectedSpk?.spk_number && inv.work_order_id === selectedSpk.spk_number)) &&
                ((inv as any).tab_id === tab.id || (inv as any).estimation_tab === tab.id)
            );
            const tabResp = tabInv?.customer_approved_option || tabInv?.customer_response;
            const isTabApproved =
              tabResp === 'opsi1' || tabResp === 'opsi2' || tabInv?.ttd_status === 'signed';
            const isTabBatal = tabResp === 'batal' || tabInv?.ttd_status === 'rejected';
            const isTabPending = !isTabApproved && !isTabBatal && tabInv?.ttd_status === 'pending';

            return (
              <div
                key={tab.id}
                className={`relative flex items-center rounded-xl transition ${
                  activeTabId === tab.id
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {renamingTabId === tab.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitRename();
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    className="text-xs font-black px-3 py-1.5 rounded-xl bg-white text-slate-900 border-2 border-blue-500 outline-none w-36"
                  />
                ) : (
                  <button
                    onClick={() => handleSwitchTab(tab)}
                    onDoubleClick={() => handleStartRename(tab)}
                    title="Klik untuk aktif • Double-klik untuk rename"
                    className="px-3.5 py-1.5 text-xs font-black cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>{tab.name}</span>
                    {isTabApproved && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-emerald-500 text-white shadow-2xs">
                        ✓ {tabResp === 'opsi2' ? 'Opsi 2' : 'Opsi 1'}
                      </span>
                    )}
                    {isTabBatal && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-rose-500 text-white shadow-2xs">
                        ✕ Batal
                      </span>
                    )}
                    {isTabPending && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-amber-500 text-white shadow-2xs">
                        ⏳ Menunggu
                      </span>
                    )}
                  </button>
                )}
                {/* Rename icon */}
                {!isLocked && activeTabId === tab.id && renamingTabId !== tab.id && (
                  <button
                    onClick={() => handleStartRename(tab)}
                    title="Rename tab"
                    className="pr-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <span className="text-[9px]">✏</span>
                  </button>
                )}
                {/* Delete tab icon if more than 1 tab */}
                {!isLocked && tabList.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTab(tab.id, e)}
                    title="Hapus tab estimasi ini"
                    className={`pr-2 text-xs font-bold transition cursor-pointer ${
                      activeTabId === tab.id
                        ? 'text-slate-400 hover:text-red-400'
                        : 'text-slate-400 hover:text-red-600'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {!isLocked && (
            <button
              onClick={handleAddNewTab}
              className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Estimasi Baru</span>
            </button>
          )}
        </div>

        {/* Status Alert Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs font-bold shadow-2xs transition-all bg-white border-slate-200">
          <div className="flex items-center space-x-2.5">
            {currentEstimationRecord?.customer_signature ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-emerald-950">
                  Sudah disetujui &amp; ditandatangani oleh <strong>{currentEstimationRecord.customer_signed_name || selectedSpk?.vehicle?.customer_name}</strong> ({currentEstimationRecord.customer_approved_option === 'opsi2' ? 'Pilihan: OPSI 2' : 'Pilihan: OPSI 1'})
                  {currentEstimationRecord.customer_signed_at && ` pada ${new Date(currentEstimationRecord.customer_signed_at).toLocaleString('id-ID')}`}.
                </span>
              </>
            ) : (
              <>
                <Hourglass className="w-4 h-4 text-[#D97706] flex-shrink-0" />
                <span className="text-[#92400E]">Belum ditandatangani customer (dapat dikirim via link TTD).</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Indikator Status Penyimpanan */}
            {lastSavedTime ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-black shadow-2xs animate-in fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tersimpan {lastSavedTime}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Draft Belum Disimpan</span>
              </div>
            )}

            {currentEstimationRecord?.customer_signature && (
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex-shrink-0"
              >
                Lihat TTD Digital
              </button>
            )}
          </div>
        </div>

        {/* Form Fields: Row 1 (Tipe, Tanggal, Jam) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              TIPE / KRITERIA ESTIMASI
            </label>
            <input
              type="text"
              disabled={isLocked}
              value={estimationType}
              onChange={(e) => {
                const val = e.target.value;
                setEstimationType(val);
                setTabList((prev) => {
                  const nextTabs = prev.map((t) => (t.id === activeTabId ? { ...t, name: val || 'Estimasi' } : t));
                  if (selectedSpkId) {
                    try { localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(nextTabs)); } catch {}
                  }
                  return nextTabs;
                });
              }}
              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              placeholder="Contoh: Umum, Understeel, AC, Mesin..."
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              TANGGAL
            </label>
            <div className="relative">
              <input
                type="date"
                disabled={isLocked}
                value={estimationDate}
                onChange={(e) => setEstimationDate(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              JAM
            </label>
            <div className="relative">
              <input
                type="time"
                disabled={isLocked}
                value={estimationTime}
                onChange={(e) => setEstimationTime(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Form Fields: Row 2 (Status Mobil) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              STATUS MOBIL
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['Di Tunggu', 'Di Tinggal', 'Rawat Inap'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setVehicleStatus(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition cursor-pointer disabled:cursor-not-allowed ${
                    vehicleStatus === s
                      ? s === 'Di Tunggu' ? 'bg-blue-600 text-white border-blue-600'
                        : s === 'Di Tinggal' ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {s === 'Di Tunggu' ? '⏳ Di Tunggu' : s === 'Di Tinggal' ? '🚗 Di Tinggal' : '🏥 Rawat Inap'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Switch Toggles Row (Diskon, Opsi 2, Pajak, Kisaran Harga) */}
        <div className="flex flex-wrap items-center gap-4 pt-2 pb-2">
          {/* Toggle Diskon */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => { if (!isLocked) setShowDiscount(!showDiscount); }}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                showDiscount ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                  showDiscount ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-xs font-bold text-slate-700">Diskon</span>
          </label>

          {/* Toggle Opsi 2 (2 Estimasi dalam 1 Lembar) */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => {
                if (!isLocked) {
                  setShowOpsi2(!showOpsi2);
                }
              }}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                showOpsi2 ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                  showOpsi2 ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black text-slate-800">2 Estimasi dalam 1 Lembar (Opsi 1 &amp; Opsi 2)</span>
              {showOpsi2 && (
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  8 Kolom Aktif
                </span>
              )}
            </div>
          </label>

          {/* Toggle Pajak */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => { if (!isLocked) setShowTax(!showTax); }}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                showTax ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                  showTax ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-xs font-bold text-slate-700">Pajak (PPN 11%)</span>
          </label>

          {/* Toggle Kisaran Harga */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => { if (!isLocked) setShowRangePrice(!showRangePrice); }}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                showRangePrice ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                  showRangePrice ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-xs font-bold text-slate-700">Kisaran Harga</span>
            {showRangePrice && (
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                ~Min – Max
              </span>
            )}
          </label>

          {/* Toggle Double Estimasi (Tabel 1 + Slice + Tabel 2) */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => {
                if (!isLocked) {
                  if (hasSecondTable) {
                    if (itemsTable2.some((it) => it.name.trim() || it.price_opsi1)) {
                      if (!confirm('Yakin ingin menutup Tabel 2? Item pada Tabel 2 tidak akan dimasukkan ke estimasi saat dimatikan.')) {
                        return;
                      }
                    }
                    setHasSecondTable(false);
                  } else {
                    setHasSecondTable(true);
                  }
                }
              }}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                hasSecondTable ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                  hasSecondTable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black text-slate-800">Double Estimasi (2 Tabel &amp; Subtotal Terpisah)</span>
              {hasSecondTable && (
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  Aktif ({table1Title} &amp; {table2Title})
                </span>
              )}
            </div>
          </label>
        </div>

        {/* Info banner when range mode is active */}
        {showRangePrice && !isLocked && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-slate-800">
            <ArrowUpDown className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-blue-900">Mode Kisaran Harga Aktif — </span>
              <span className="text-slate-700">
                Masukkan harga dalam format <strong>150000 - 160000</strong> (min – maks) atau angka tetap.
                Kotak harga dan total harga otomatis memanjang horizontal tanpa bertumpuk ke bawah.
              </span>
            </div>
          </div>
        )}

        {/* 2. ITEMS ESTIMASI TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-300 text-slate-800 font-black text-[10.5px] uppercase">
                <th className="p-3 w-10 text-center border-r border-slate-200">No</th>
                <th className="p-3 border-r border-slate-200">Saran/Perbaikan/Ganti Sparepart</th>
                <th className="p-3 w-16 text-center border-r border-slate-200">QTY</th>
                <th className="p-3 w-24 text-center border-r border-slate-200">Satuan</th>
                <th className={`p-3 text-center border-r border-slate-200 ${showRangePrice ? 'w-56' : 'w-36'}`}>
                  {showRangePrice ? 'Harga (Min – Maks)' : 'Hrg Sat (Rp)'}
                </th>
                <th className={`p-3 text-right border-r border-slate-200 ${showRangePrice ? 'w-56' : 'w-36'}`}>
                  {showRangePrice ? 'Total Opsi 1 (Kisaran)' : 'Total Opsi 1'}
                </th>
                {showOpsi2 && (
                  <>
                    <th className={`p-3 text-center border-r border-slate-200 bg-blue-50/40 text-blue-950 ${showRangePrice ? 'w-56' : 'w-56'}`}>
                      <div className="flex items-center justify-center space-x-1.5">
                        <span>{showRangePrice ? 'Harga Opsi 2 (Min – Maks)' : 'Hrg Opsi 2 (Rp)'}</span>
                        {!isLocked && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={handleCopyAllFromOpsi1}
                              className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold transition flex items-center space-x-0.5 shadow-2xs cursor-pointer select-none"
                              title="Salin seluruh harga Opsi 1 ke Opsi 2"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Samakan</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleClearAllOpsi2}
                              className="text-[9px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold transition flex items-center space-x-0.5 shadow-2xs cursor-pointer select-none border border-rose-200"
                              title="Kosongkan / hilangkan semua harga Opsi 2"
                            >
                              <X className="w-2.5 h-2.5" />
                              <span>Kosongkan</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-right bg-blue-50/40 text-blue-950 ${showRangePrice ? 'w-52' : 'w-36'}`}>
                      {showRangePrice ? 'Total Opsi 2 (Kisaran)' : 'Total Opsi 2'}
                    </th>
                  </>
                )}
                {!isLocked && <th className="p-3 w-20 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Table 1 Slice Divider / Title Banner */}
              {hasSecondTable && (
                <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                  <td
                    colSpan={showOpsi2 ? (!isLocked ? 9 : 8) : (!isLocked ? 7 : 6)}
                    className="py-2.5 px-4 text-center"
                  >
                    <div className="flex items-center justify-center space-x-2.5">
                      <span className="text-slate-600 font-bold text-xs uppercase tracking-wider select-none">
                        Bagian / Section 1:
                      </span>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={table1Title}
                        onChange={(e) => setTable1Title(e.target.value)}
                        placeholder="BAGIAN 1"
                        className="bg-white text-slate-900 font-extrabold text-xs uppercase px-3 py-1.5 rounded-xl border border-slate-300 text-center tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64 shadow-2xs"
                      />
                    </div>
                  </td>
                </tr>
              )}

              {/* Table 1 Items */}
              {items.map((item, idx) => {
                const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof item.price_opsi1 === 'number' ? (item.qty || 1) * item.price_opsi1 : 0);
                
                // Status apakah Opsi 2 sengaja dikosongkan/dihilangkan/0
                const isP2Empty = item.price_opsi2 === '' || item.price_opsi2 === 0 || item.price_opsi2 === '0';
                const hasP2Val = item.price_opsi2 !== undefined && !isP2Empty;
                const tot2 = isP2Empty
                  ? 0
                  : (hasP2Val && item.total_opsi2 !== undefined
                    ? item.total_opsi2
                    : (hasP2Val && typeof item.price_opsi2 === 'number'
                      ? (item.qty || 1) * item.price_opsi2
                      : (item.price_opsi2 ? parseNumericPriceValue(item.price_opsi2).num * (item.qty || 1) : 0)));

                // Range calculations per row
                const rowRange1 = showRangePrice ? parseRangePrice(item.price_opsi1 !== undefined ? item.price_opsi1 : 0) : null;
                const rowRange2 = (showRangePrice && hasP2Val) ? parseRangePrice(item.price_opsi2) : null;
                const rowTot1Min = rowRange1 ? rowRange1.min * (item.qty || 1) : 0;
                const rowTot1Max = rowRange1 ? rowRange1.max * (item.qty || 1) : 0;
                const rowTot2Min = rowRange2 ? rowRange2.min * (item.qty || 1) : 0;
                const rowTot2Max = rowRange2 ? rowRange2.max * (item.qty || 1) : 0;

                const isP1Text = (typeof item.price_opsi1 === 'string' && /[a-zA-Z]/.test(item.price_opsi1.trim())) ||
                                 (typeof item.total_opsi1 === 'string' && /[a-zA-Z]/.test(item.total_opsi1.trim()));
                const p1TextVal = (typeof item.price_opsi1 === 'string' && /[a-zA-Z]/.test(item.price_opsi1.trim()))
                  ? item.price_opsi1.trim().toUpperCase()
                  : (typeof item.total_opsi1 === 'string' && /[a-zA-Z]/.test(item.total_opsi1.trim()))
                  ? item.total_opsi1.trim().toUpperCase()
                  : 'CEK';

                const isP2Text = !isP2Empty && ((typeof item.price_opsi2 === 'string' && /[a-zA-Z]/.test(item.price_opsi2.trim())) ||
                                               (typeof item.total_opsi2 === 'string' && /[a-zA-Z]/.test(item.total_opsi2.trim())));
                const p2TextVal = (typeof item.price_opsi2 === 'string' && /[a-zA-Z]/.test(item.price_opsi2.trim()))
                  ? item.price_opsi2.trim().toUpperCase()
                  : (typeof item.total_opsi2 === 'string' && /[a-zA-Z]/.test(item.total_opsi2.trim()))
                  ? item.total_opsi2.trim().toUpperCase()
                  : 'CEK';

                return (
                  <tr key={`t1-${idx}`} className="hover:bg-slate-50/70 transition-colors group/row">
                    {/* Index */}
                    <td className="p-3 text-center text-slate-500 font-bold border-r border-slate-200 align-middle">{idx + 1}</td>

                    {/* Saran/Perbaikan/Ganti Sparepart */}
                    <td className="p-2 border-r border-slate-200 align-middle">
                      <textarea
                        rows={Math.max(1, Math.ceil((item.name?.length || 0) / 30))}
                        disabled={isLocked}
                        value={item.name}
                        onChange={(e) => handleUpdateItemField(idx, 'name', e.target.value, 1)}
                        placeholder="Nama Saran / Sparepart / Jasa..."
                        className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 placeholder:text-slate-300 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed resize-none overflow-hidden break-words whitespace-pre-wrap leading-tight"
                      />
                    </td>

                    {/* QTY */}
                    <td className="p-2 text-center border-r border-slate-200 align-middle">
                      <input
                        type="number"
                        min="1"
                        disabled={isLocked}
                        value={item.qty}
                        onChange={(e) => handleUpdateItemField(idx, 'qty', e.target.value, 1)}
                        className="w-14 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Satuan */}
                    <td className="p-2 text-center border-r border-slate-200 align-middle">
                      <select
                        disabled={isLocked}
                        value={item.unit || 'PCS'}
                        onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value, 1)}
                        className="w-20 text-xs font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Hrg Sat / Harga Kisaran (Harga Opsi 1) */}
                    <td className="p-2 text-center border-r border-slate-200 align-middle">
                      <div className="relative flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-400 mr-1 select-none">Rp</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={item.price_opsi1 !== undefined ? item.price_opsi1 : ''}
                          onChange={(e) => handleUpdateItemField(idx, 'price_opsi1', e.target.value, 1)}
                          placeholder={showRangePrice ? '150000 - 160000' : '0 / CEK'}
                          className={`text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed ${
                            showRangePrice ? 'w-48' : 'w-28'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Total Opsi 1 */}
                    <td className="p-3 text-right border-r border-slate-200 align-middle">
                      {isP1Text ? (
                        <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                          {p1TextVal}
                        </span>
                      ) : showRangePrice ? (
                        <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                          {rowTot1Min === rowTot1Max
                            ? formatCurrency(rowTot1Min)
                            : `${formatCurrency(rowTot1Min)} – ${formatCurrency(rowTot1Max)}`}
                        </span>
                      ) : (
                        <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                          {formatCurrency(tot1)}
                        </span>
                      )}
                    </td>

                    {/* Opsi 2 (if enabled) */}
                    {showOpsi2 && (
                      <>
                        <td className="p-2 text-center border-r border-slate-200 align-middle bg-blue-50/20">
                          <div className="relative flex items-center justify-center">
                            <span className="text-[10px] font-bold text-blue-400 mr-1 select-none">Rp</span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={item.price_opsi2 !== undefined ? item.price_opsi2 : ''}
                              onChange={(e) => handleUpdateItemField(idx, 'price_opsi2', e.target.value, 1)}
                              placeholder={
                                item.price_opsi1 !== undefined && item.price_opsi1 !== '' && item.price_opsi1 !== 0
                                  ? String(item.price_opsi1)
                                  : (showRangePrice ? '150000 - 160000' : '0 (Kosong)')
                              }
                              className={`text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed ${
                                showRangePrice ? 'w-48' : 'w-28'
                              }`}
                            />
                            {!isLocked && item.price_opsi2 !== undefined && item.price_opsi2 !== '' && item.price_opsi2 !== 0 && item.price_opsi2 !== '0' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateItemField(idx, 'price_opsi2', '', 1)}
                                className="ml-1 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer select-none"
                                title="Hilangkan / kosongkan harga Opsi 2 untuk baris ini"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right align-middle bg-blue-50/20">
                          {isP2Text ? (
                            <span className="font-mono font-black text-sm text-blue-950 whitespace-nowrap">
                              {p2TextVal}
                            </span>
                          ) : showRangePrice ? (
                            <span className="font-mono font-black text-sm text-blue-950 whitespace-nowrap">
                              {isP2Empty ? (
                                <span className="text-slate-400 font-normal">Rp 0</span>
                              ) : rowTot2Min === rowTot2Max ? (
                                formatCurrency(rowTot2Min)
                              ) : (
                                `${formatCurrency(rowTot2Min)} – ${formatCurrency(rowTot2Max)}`
                              )}
                            </span>
                          ) : (
                            <span className={`font-mono font-black text-sm whitespace-nowrap ${isP2Empty ? 'text-slate-400 font-normal' : 'text-slate-900'}`}>
                              {isP2Empty ? 'Rp 0' : formatCurrency(tot2)}
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Aksi: Move Up, Move Down, Delete */}
                    {!isLocked && (
                      <td className="p-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveRowUp(idx, 1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRowDown(idx, 1)}
                            disabled={idx === items.length - 1}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx, 1)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Hapus Baris"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* If Double Table is Enabled: Render Subtotal Table 1, Slice Divider, Table 2 Items, and Subtotal Table 2 */}
              {hasSecondTable && (
                <>
                  {/* Subtotal Row Table 1 */}
                  <tr className="bg-slate-100/90 text-slate-800 font-bold border-y border-slate-200 text-xs">
                    <td colSpan={5} className="p-2.5 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[11px]">
                      TOTAL {table1Title ? `(${table1Title.toUpperCase()})` : 'TABEL 1'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      {showRangePrice ? (
                        t1Totals.tot1Min === t1Totals.tot1Max
                          ? formatCurrency(t1Totals.tot1Min)
                          : `${formatCurrency(t1Totals.tot1Min)} – ${formatCurrency(t1Totals.tot1Max)}`
                      ) : (
                        formatCurrency(t1Totals.tot1Min)
                      )}
                    </td>
                    {showOpsi2 && (
                      <>
                        <td className="p-2.5 bg-blue-50/20 border-r border-slate-200"></td>
                        <td className="p-2.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 whitespace-nowrap">
                          {showRangePrice ? (
                            t1Totals.tot2Min === t1Totals.tot2Max
                              ? formatCurrency(t1Totals.tot2Min)
                              : `${formatCurrency(t1Totals.tot2Min)} – ${formatCurrency(t1Totals.tot2Max)}`
                          ) : (
                            formatCurrency(t1Totals.tot2Min)
                          )}
                        </td>
                      </>
                    )}
                    {!isLocked && <td className="p-2.5 bg-slate-100/90"></td>}
                  </tr>

                  {/* Slice Divider */}
                  <tr className="bg-slate-100/90 border-y-2 border-slate-300">
                    <td
                      colSpan={showOpsi2 ? (!isLocked ? 9 : 8) : (!isLocked ? 7 : 6)}
                      className="py-2.5 px-4 text-center"
                    >
                      <div className="flex items-center justify-center space-x-2.5">
                        <span className="text-slate-600 font-bold text-xs uppercase tracking-wider select-none">
                          Bagian / Section 2:
                        </span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={table2Title}
                          onChange={(e) => setTable2Title(e.target.value)}
                          placeholder="BAGIAN REM"
                          className="bg-white text-slate-900 font-extrabold text-xs uppercase px-3 py-1.5 rounded-xl border border-slate-300 text-center tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64 shadow-2xs"
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Yakin ingin menghapus Tabel 2? Item pada Tabel 2 akan dihapus.')) {
                                setHasSecondTable(false);
                              }
                            }}
                            className="text-rose-700 hover:text-rose-800 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer select-none"
                            title="Hapus Tabel 2"
                          >
                            ✕ Hapus Tabel 2
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Table 2 Items (Continuous sequential numbering) */}
                  {itemsTable2.map((item, idx) => {
                    const displayNum = items.length + idx + 1;
                    const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof item.price_opsi1 === 'number' ? (item.qty || 1) * item.price_opsi1 : 0);
                    
                    const isP2Empty = item.price_opsi2 === '' || item.price_opsi2 === 0 || item.price_opsi2 === '0';
                    const hasP2Val = item.price_opsi2 !== undefined && !isP2Empty;
                    const tot2 = isP2Empty
                      ? 0
                      : (hasP2Val && item.total_opsi2 !== undefined
                        ? item.total_opsi2
                        : (hasP2Val && typeof item.price_opsi2 === 'number'
                          ? (item.qty || 1) * item.price_opsi2
                          : (item.price_opsi2 ? parseNumericPriceValue(item.price_opsi2).num * (item.qty || 1) : 0)));

                    const rowRange1 = showRangePrice ? parseRangePrice(item.price_opsi1 !== undefined ? item.price_opsi1 : 0) : null;
                    const rowRange2 = (showRangePrice && hasP2Val) ? parseRangePrice(item.price_opsi2) : null;
                    const rowTot1Min = rowRange1 ? rowRange1.min * (item.qty || 1) : 0;
                    const rowTot1Max = rowRange1 ? rowRange1.max * (item.qty || 1) : 0;
                    const rowTot2Min = rowRange2 ? rowRange2.min * (item.qty || 1) : 0;
                    const rowTot2Max = rowRange2 ? rowRange2.max * (item.qty || 1) : 0;

                    const isP1Text = (typeof item.price_opsi1 === 'string' && /[a-zA-Z]/.test(item.price_opsi1.trim())) ||
                                     (typeof item.total_opsi1 === 'string' && /[a-zA-Z]/.test(item.total_opsi1.trim()));
                    const p1TextVal = (typeof item.price_opsi1 === 'string' && /[a-zA-Z]/.test(item.price_opsi1.trim()))
                      ? item.price_opsi1.trim().toUpperCase()
                      : (typeof item.total_opsi1 === 'string' && /[a-zA-Z]/.test(item.total_opsi1.trim()))
                      ? item.total_opsi1.trim().toUpperCase()
                      : 'CEK';

                    const isP2Text = !isP2Empty && ((typeof item.price_opsi2 === 'string' && /[a-zA-Z]/.test(item.price_opsi2.trim())) ||
                                                   (typeof item.total_opsi2 === 'string' && /[a-zA-Z]/.test(item.total_opsi2.trim())));
                    const p2TextVal = (typeof item.price_opsi2 === 'string' && /[a-zA-Z]/.test(item.price_opsi2.trim()))
                      ? item.price_opsi2.trim().toUpperCase()
                      : (typeof item.total_opsi2 === 'string' && /[a-zA-Z]/.test(item.total_opsi2.trim()))
                      ? item.total_opsi2.trim().toUpperCase()
                      : 'CEK';

                    return (
                      <tr key={`t2-${idx}`} className="hover:bg-slate-50 transition-colors group/row">
                        {/* Index */}
                        <td className="p-3 text-center text-slate-600 font-bold border-r border-slate-200 align-middle bg-slate-50/30">{displayNum}</td>

                        {/* Saran/Perbaikan/Ganti Sparepart */}
                        <td className="p-2 border-r border-slate-200 align-middle">
                          <textarea
                            rows={Math.max(1, Math.ceil((item.name?.length || 0) / 30))}
                            disabled={isLocked}
                            value={item.name}
                            onChange={(e) => handleUpdateItemField(idx, 'name', e.target.value, 2)}
                            placeholder={`Nama Saran / Sparepart (${table2Title || 'Tabel 2'})...`}
                            className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 placeholder:text-slate-300 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed resize-none overflow-hidden break-words whitespace-pre-wrap leading-tight"
                          />
                        </td>

                        {/* QTY */}
                        <td className="p-2 text-center border-r border-slate-200 align-middle">
                          <input
                            type="number"
                            min="1"
                            disabled={isLocked}
                            value={item.qty}
                            onChange={(e) => handleUpdateItemField(idx, 'qty', e.target.value, 2)}
                            className="w-14 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Satuan */}
                        <td className="p-2 text-center border-r border-slate-200 align-middle">
                          <select
                            disabled={isLocked}
                            value={item.unit || 'PCS'}
                            onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value, 2)}
                            className="w-20 text-xs font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Hrg Sat / Harga Kisaran (Harga Opsi 1) */}
                        <td className="p-2 text-center border-r border-slate-200 align-middle">
                          <div className="relative flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-400 mr-1 select-none">Rp</span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={item.price_opsi1 !== undefined ? item.price_opsi1 : ''}
                              onChange={(e) => handleUpdateItemField(idx, 'price_opsi1', e.target.value, 2)}
                              placeholder={showRangePrice ? '150000 - 160000' : '0 / CEK'}
                              className={`text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed ${
                                showRangePrice ? 'w-48' : 'w-28'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Total Opsi 1 */}
                        <td className="p-3 text-right border-r border-slate-200 align-middle">
                          {isP1Text ? (
                            <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                              {p1TextVal}
                            </span>
                          ) : showRangePrice ? (
                            <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                              {rowTot1Min === rowTot1Max
                                ? formatCurrency(rowTot1Min)
                                : `${formatCurrency(rowTot1Min)} – ${formatCurrency(rowTot1Max)}`}
                            </span>
                          ) : (
                            <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                              {formatCurrency(tot1)}
                            </span>
                          )}
                        </td>

                        {/* Opsi 2 (if enabled) */}
                        {showOpsi2 && (
                          <>
                            <td className="p-2 text-center border-r border-slate-200 align-middle bg-blue-50/20">
                              <div className="relative flex items-center justify-center">
                                <span className="text-[10px] font-bold text-blue-400 mr-1 select-none">Rp</span>
                                <input
                                  type="text"
                                  disabled={isLocked}
                                  value={item.price_opsi2 !== undefined ? item.price_opsi2 : ''}
                                  onChange={(e) => handleUpdateItemField(idx, 'price_opsi2', e.target.value, 2)}
                                  placeholder={
                                    item.price_opsi1 !== undefined && item.price_opsi1 !== '' && item.price_opsi1 !== 0
                                      ? String(item.price_opsi1)
                                      : (showRangePrice ? '150000 - 160000' : '0 (Kosong)')
                                  }
                                  className={`text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed ${
                                    showRangePrice ? 'w-48' : 'w-28'
                                  }`}
                                />
                                {!isLocked && item.price_opsi2 !== undefined && item.price_opsi2 !== '' && item.price_opsi2 !== 0 && item.price_opsi2 !== '0' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemField(idx, 'price_opsi2', '', 2)}
                                    className="ml-1 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer select-none"
                                    title="Hilangkan / kosongkan harga Opsi 2 untuk baris ini"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right align-middle bg-blue-50/20">
                              {isP2Text ? (
                                <span className="font-mono font-black text-sm text-blue-950 whitespace-nowrap">
                                  {p2TextVal}
                                </span>
                              ) : showRangePrice ? (
                                <span className="font-mono font-black text-sm text-blue-950 whitespace-nowrap">
                                  {isP2Empty ? (
                                    <span className="text-slate-400 font-normal">Rp 0</span>
                                  ) : rowTot2Min === rowTot2Max ? (
                                    formatCurrency(rowTot2Min)
                                  ) : (
                                    `${formatCurrency(rowTot2Min)} – ${formatCurrency(rowTot2Max)}`
                                  )}
                                </span>
                              ) : (
                                <span className={`font-mono font-black text-sm whitespace-nowrap ${isP2Empty ? 'text-slate-400 font-normal' : 'text-slate-900'}`}>
                                  {isP2Empty ? 'Rp 0' : formatCurrency(tot2)}
                                </span>
                              )}
                            </td>
                          </>
                        )}

                        {/* Aksi: Move Up, Move Down, Delete */}
                        {!isLocked && (
                          <td className="p-2 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveRowUp(idx, 2)}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                title="Pindah ke Atas"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveRowDown(idx, 2)}
                                disabled={idx === itemsTable2.length - 1}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                title="Pindah ke Bawah"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx, 2)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                title="Hapus Baris"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {/* Subtotal Row Table 2 */}
                  <tr className="bg-slate-100/90 text-slate-800 font-bold border-y border-slate-200 text-xs">
                    <td colSpan={5} className="p-2.5 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[11px]">
                      TOTAL {table2Title ? `(${table2Title.toUpperCase()})` : 'TABEL 2'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      {showRangePrice ? (
                        t2Totals.tot1Min === t2Totals.tot1Max
                          ? formatCurrency(t2Totals.tot1Min)
                          : `${formatCurrency(t2Totals.tot1Min)} – ${formatCurrency(t2Totals.tot1Max)}`
                      ) : (
                        formatCurrency(t2Totals.tot1Min)
                      )}
                    </td>
                    {showOpsi2 && (
                      <>
                        <td className="p-2.5 bg-blue-50/20 border-r border-slate-200"></td>
                        <td className="p-2.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 whitespace-nowrap">
                          {showRangePrice ? (
                            t2Totals.tot2Min === t2Totals.tot2Max
                              ? formatCurrency(t2Totals.tot2Min)
                              : `${formatCurrency(t2Totals.tot2Min)} – ${formatCurrency(t2Totals.tot2Max)}`
                          ) : (
                            formatCurrency(t2Totals.tot2Min)
                          )}
                        </td>
                      </>
                    )}
                    {!isLocked && <td className="p-2.5 bg-slate-100/90"></td>}
                  </tr>
                </>
              )}
            </tbody>
            {/* Table Summary Footer: JUMLAH KESELURUHAN (Clean styling matching previous version) */}
            <tfoot>
              <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300">
                <td colSpan={5} className="p-3 text-center uppercase tracking-wider text-slate-800 text-xs">
                  JUMLAH KESELURUHAN
                </td>
                <td className="p-3 text-right font-mono font-black border-r border-slate-200">
                  {showRangePrice ? (
                    <span className="text-sm text-slate-950 whitespace-nowrap">
                      {totalFinalOpsi1 === totalFinalOpsi1Max
                        ? formatCurrency(totalFinalOpsi1)
                        : `${formatCurrency(totalFinalOpsi1)} – ${formatCurrency(totalFinalOpsi1Max)}`}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-950 whitespace-nowrap">{formatCurrency(totalFinalOpsi1)}</span>
                  )}
                </td>
                {showOpsi2 && (
                  <>
                    <td className="p-3 bg-blue-50/20 border-r border-slate-200"></td>
                    <td className="p-3 text-right font-mono font-black text-blue-950 bg-blue-50/20">
                      {showRangePrice ? (
                        <span className="text-sm whitespace-nowrap">
                          {totalFinalOpsi2 === totalFinalOpsi2Max
                            ? formatCurrency(totalFinalOpsi2)
                            : `${formatCurrency(totalFinalOpsi2)} – ${formatCurrency(totalFinalOpsi2Max)}`}
                        </span>
                      ) : (
                        <span className="text-sm whitespace-nowrap">{formatCurrency(totalFinalOpsi2)}</span>
                      )}
                    </td>
                  </>
                )}
                {!isLocked && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Row Addition Buttons */}
        {!isLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-black text-slate-500 uppercase">{table1Title || 'Tabel 1'}:</span>
              <button
                type="button"
                onClick={() => handleAddEmptyRow(1)}
                className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Baris ({table1Title || 'Tabel 1'})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCatalogTargetTable(1);
                  setShowCatalogModal(true);
                }}
                className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-blue-200 transition cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Katalog ({table1Title || 'Tabel 1'})</span>
              </button>
            </div>

            {hasSecondTable ? (
              <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
                <span className="text-xs font-black text-slate-700 uppercase pl-2">{table2Title || 'Tabel 2'}:</span>
                <button
                  type="button"
                  onClick={() => handleAddEmptyRow(2)}
                  className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Baris ({table2Title || 'Tabel 2'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCatalogTargetTable(2);
                    setShowCatalogModal(true);
                  }}
                  className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-blue-200 transition cursor-pointer shadow-2xs"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Katalog ({table2Title || 'Tabel 2'})</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setHasSecondTable(true)}
                className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer border border-slate-300"
              >
                <span>➕</span>
                <span>Tambah Slice / Tabel 2 (Double Estimasi)</span>
              </button>
            )}
          </div>
        )}

        {/* 3. SUMMARY & CALCULATION CARDS */}
        <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/90 space-y-3">
          {showDiscount && (
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-200 pb-2">
              <span>Diskon Estimasi (Rp):</span>
              <input
                type="number"
                min="0"
                disabled={isLocked}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                className="w-32 text-right p-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white text-emerald-800 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          )}

          {showTax && (
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-200 pb-2">
              <span>Pajak PPN (%):</span>
              <span className="font-mono text-slate-800">11% (+ {formatCurrency(taxAmountOpsi1)})</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-blue-900">
                TOTAL AKHIR OPSI 1{showRangePrice && ' (KISARAN)'}
              </div>
              {showRangePrice ? (
                <div className="font-mono font-black text-xl text-slate-900 whitespace-nowrap">
                  {totalFinalOpsi1 === totalFinalOpsi1Max
                    ? formatCurrency(totalFinalOpsi1)
                    : `${formatCurrency(totalFinalOpsi1)} – ${formatCurrency(totalFinalOpsi1Max)}`}
                </div>
              ) : (
                <div className="font-mono font-black text-xl text-slate-900 whitespace-nowrap">
                  {formatCurrency(totalFinalOpsi1)}
                </div>
              )}
              <p className="text-[10px] text-slate-400">Rekomendasi pengerjaan utama / standar</p>
            </div>

            {showOpsi2 && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-black uppercase tracking-wider text-purple-900">
                  TOTAL AKHIR OPSI 2{showRangePrice && ' (KISARAN)'}
                </div>
                {showRangePrice ? (
                  <div className="font-mono font-black text-xl text-blue-950 whitespace-nowrap">
                    {totalFinalOpsi2 === totalFinalOpsi2Max
                      ? formatCurrency(totalFinalOpsi2)
                      : `${formatCurrency(totalFinalOpsi2)} – ${formatCurrency(totalFinalOpsi2Max)}`}
                  </div>
                ) : (
                  <div className="font-mono font-black text-xl text-slate-900 whitespace-nowrap">
                    {formatCurrency(totalFinalOpsi2)}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">Pilihan alternatif suku cadang / penanganan</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. ESTIMATOR, DURASI, RESPON & TANDA TANGAN (Diletakkan di Bagian Bawah) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
            4. Persetujuan, Estimator &amp; Tanda Tangan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                ESTIMASI LAMA PEKERJAAN
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="cth: 2 Hari, 3 Jam, 1 Minggu..."
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                ESTIMATOR / SERVICE ADVISOR
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={estimatorName}
                onChange={(e) => setEstimatorName(e.target.value)}
                placeholder="Nama SA / Estimator..."
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* RESPON CUSTOMER */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-600">Respon Customer:</span>
              {customerResponse && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                  customerResponse === 'opsi1' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : customerResponse === 'opsi2' ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : (customerResponse === 'batal' || customerResponse === 'pending') ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
                }`}>
                  {customerResponse === 'opsi1' ? '✅ Disetujui Opsi 1' : customerResponse === 'opsi2' ? '✅ Disetujui Opsi 2' : (customerResponse === 'batal' || customerResponse === 'pending') ? '❌ Batal / Tidak Setuju' : '📝 Lain-lainnya'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'opsi1', label: '✅ Setuju Opsi 1', cls: customerResponse === 'opsi1' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400' },
                { value: 'opsi2', label: '✅ Setuju Opsi 2', cls: customerResponse === 'opsi2' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400' },
                { value: 'batal', label: '❌ Batal / Menolak', cls: (customerResponse === 'batal' || customerResponse === 'pending') ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400' },
                { value: 'lain_lain', label: '📝 Lain-lainnya', cls: customerResponse === 'lain_lain' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setCustomerResponse(customerResponse === opt.value ? '' : opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition cursor-pointer disabled:cursor-not-allowed ${opt.cls}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {customerResponse === 'lain_lain' && (
              <input
                type="text"
                disabled={isLocked}
                value={customerResponseNote}
                onChange={(e) => setCustomerResponseNote(e.target.value)}
                placeholder="Tulis keterangan respon customer..."
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 bg-white focus:border-purple-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            )}
          </div>

          {/* BOX TANDA TANGAN (DUAL: ESTIMATOR & CUSTOMER) DI BAGIAN BAWAH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Kolom 1: Estimator / SA */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PenTool className="w-4 h-4 text-blue-600" />
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                    Tanda Tangan Estimator / SA:
                  </label>
                </div>
                {estimatorSignature ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ✓ TTD Estimator
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    Estimator
                  </span>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SignatureCanvas
                  key={`${selectedSpkId}_${activeTabId}_estimator_${estimatorSignature ? 'has_sig' : 'empty'}`}
                  initialDataUrl={estimatorSignature}
                  onSave={(dataUrl) => setEstimatorSignature(dataUrl)}
                  readOnly={isLocked}
                />
              </div>
              <div className="text-[11px] text-slate-500 font-bold text-center">
                {estimatorName || 'Estimator / Service Advisor'}
              </div>
            </div>

            {/* Kolom 2: Customer / Pelanggan */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                    Tanda Tangan Pelanggan:
                  </label>
                </div>
                {customerSignature ? (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    customerResponse === 'batal'
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : customerResponse === 'opsi2'
                      ? 'text-blue-700 bg-blue-50 border-blue-200'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}>
                    {customerResponse === 'batal'
                      ? '✕ TTD Pembatalan'
                      : customerResponse === 'opsi2'
                      ? '✓ TTD Setuju Opsi 2'
                      : customerResponse === 'opsi1'
                      ? '✓ TTD Setuju Opsi 1'
                      : '✓ TTD Pelanggan Ada'}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-medium">
                    Belum ditandatangani
                  </span>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SignatureCanvas
                  key={`${selectedSpkId}_${activeTabId}_customer_${customerSignature ? 'has_sig' : 'empty'}`}
                  initialDataUrl={customerSignature}
                  onSave={(dataUrl) => setCustomerSignature(dataUrl)}
                  readOnly={isLocked}
                />
              </div>

              <div>
                <input
                  type="text"
                  disabled={isLocked}
                  value={customerSignedName}
                  onChange={(e) => setCustomerSignedName(e.target.value)}
                  placeholder="Nama Penanda Tangan / Pelanggan..."
                  className="w-full text-xs font-bold p-2 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. NOTES & ACTION CONTROLS */}
        <div className="space-y-4 pt-2">
          {/* Keluhan / Diagnosa Awal untuk Lembar Estimasi & TTD Customer */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800">
                Keluhan / Diagnosa Awal (Tampil pada Surat Estimasi &amp; TTD Customer):
              </label>
              {selectedSpk && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const spkDefault = formatComplaintsAndDiagnosis(selectedSpk.complaints, selectedSpk.notes).displayText;
                    setEstimationComplaints(spkDefault);
                    showToast('Keluhan / Diagnosa Awal berhasil di-reset sesuai isi SPK.', 'info');
                  }}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                  title="Tarik ulang teks keluhan dan diagnosa awal asli dari SPK"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Sesuai SPK</span>
                </button>
              )}
            </div>
            <textarea
              rows={2}
              disabled={isLocked}
              value={estimationComplaints}
              onChange={(e) => setEstimationComplaints(e.target.value)}
              placeholder="Keluhan customer dan diagnosa awal perbaikan..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white resize-none outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />
            <p className="text-[10.5px] text-slate-500">
              💡 Otomatis menyinkronkan keluhan &amp; diagnosa dari SPK intake. Anda dapat menambahkan catatan diagnosa teknis khusus untuk tab estimasi ini bila diperlukan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional):</label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan khusus teknisi / estimasi ini..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 resize-none outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const mapItemForLive = (it: InvoiceItem, sec: number): InvoiceItem => {
                    const isP1Text = (typeof it.price_opsi1 === 'string' && /[a-zA-Z]/.test(it.price_opsi1)) ||
                                     (typeof it.price === 'string' && /[a-zA-Z]/.test(String(it.price))) ||
                                     (typeof it.total_opsi1 === 'string' && /[a-zA-Z]/.test(it.total_opsi1));
                    const isP2Text = (typeof it.price_opsi2 === 'string' && /[a-zA-Z]/.test(it.price_opsi2)) ||
                                     (typeof it.total_opsi2 === 'string' && /[a-zA-Z]/.test(it.total_opsi2));
                    const p1Text = (it.price_opsi1 || it.price || it.total_opsi1 || 'CEK').toString().trim().toUpperCase();
                    const p2Text = (it.price_opsi2 || it.total_opsi2 || 'CEK').toString().trim().toUpperCase();
                    const p1Val = isP1Text ? p1Text : it.price_opsi1;
                    const p2Val = isP2Text ? p2Text : it.price_opsi2;

                    const finalPrice: string | number = isP1Text
                      ? p1Text
                      : (it.price !== undefined ? it.price : (it.price_opsi1 !== undefined ? it.price_opsi1 : 0));
                    const finalSubtotal: string | number = isP1Text
                      ? p1Text
                      : (it.subtotal !== undefined ? it.subtotal : (it.total_opsi1 !== undefined ? it.total_opsi1 : 0));

                    return {
                      ...it,
                      section: sec,
                      price_opsi1: p1Val,
                      total_opsi1: isP1Text ? p1Text : it.total_opsi1,
                      price: finalPrice,
                      subtotal: finalSubtotal,
                      price_opsi2: p2Val,
                      total_opsi2: isP2Text ? p2Text : it.total_opsi2,
                    };
                  };

                  const combinedItems: InvoiceItem[] = hasSecondTable
                    ? [
                        ...items.map(it => mapItemForLive(it, 1)),
                        ...itemsTable2.map(it => mapItemForLive(it, 2))
                      ]
                    : items.map(it => mapItemForLive(it, 1));

                  const currentTabObj = tabList.find(t => t.id === activeTabId);
                  const activeTabTitle = currentTabObj?.name || estimationType || 'Umum';

                  const livePreview: Invoice = {
                    ...(currentEstimationRecord || {}),
                    id: currentEstimationRecord?.id || 'preview-temp-id',
                    invoice_number: currentEstimationRecord?.invoice_number || `EST-${selectedSpk?.spk_number || 'DRAFT'}`,
                    type: 'estimation',
                    work_order_id: selectedSpkId,
                    vehicle_id: selectedSpk?.vehicle_id || '',
                    tab_id: activeTabId,
                    estimation_tab: activeTabId,
                    estimation_type: activeTabTitle,
                    estimation_date: estimationDate,
                    estimation_time: estimationTime,
                    items: combinedItems,
                    subtotal: (subtotalOpsi1Min || 0),
                    discount_amount: discountAmount,
                    tax_percent: showTax ? taxPercent : 0,
                    tax_amount: 0,
                    total_amount: (subtotalOpsi1Min || 0) - (discountAmount || 0),
                    down_payment: 0,
                    balance_due: (subtotalOpsi1Min || 0) - (discountAmount || 0),
                    payment_status: 'pending',
                    admin_notes: adminNotes,
                    estimator_name: estimatorName || currentEstimationRecord?.estimator_name || '',
                    estimator_signature: estimatorSignature || currentEstimationRecord?.estimator_signature,
                    customer_signature: customerSignature || currentEstimationRecord?.customer_signature,
                    customer_signed_name: customerSignedName || currentEstimationRecord?.customer_signed_name || selectedSpk?.vehicle?.customer_name || '',
                    customer_response: customerResponse as any,
                    customer_response_note: customerResponseNote || undefined,
                    has_second_table: hasSecondTable,
                    table1_title: table1Title,
                    table2_title: table2Title,
                    items_table2: hasSecondTable ? itemsTable2.map(it => mapItemForLive(it, 2)) : undefined,
                    created_at: currentEstimationRecord?.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    vehicle: selectedSpk?.vehicle,
                    work_order: selectedSpk || undefined,
                    estimated_duration: estimatedDuration || currentEstimationRecord?.estimated_duration || '',
                    complaints: estimationComplaints.trim() || formatComplaintsAndDiagnosis(selectedSpk?.complaints, selectedSpk?.notes).displayText,
                  } as Invoice;
                  setSavedEstimation(livePreview);
                }}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleOpenShareModal}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim Link TTD Customer</span>
              </button>
            </div>

            <div className="flex items-center space-x-2.5">
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Kosongkan semua baris dan bersihkan draft estimasi untuk mobil ini?')) {
                      setItems(EMPTY_ESTIMATION_ROW);
                      setDiscountAmount(0);
                      setShowDiscount(false);
                      setShowOpsi2(false);
                      setShowTax(false);
                      setShowRangePrice(false);
                      setAdminNotes('');
                      setEstimationComplaints(formatComplaintsAndDiagnosis(selectedSpk?.complaints, selectedSpk?.notes).displayText);
                      setEstimatedDuration('');
                      setCustomerResponse('');
                      setCustomerResponseNote('');
                      setCustomerSignature('');
                      if (selectedSpk) {
                        try {
                          localStorage.removeItem(`mhs_est_draft_${selectedSpk.id}_${activeTabId}`);
                          if (selectedSpk.spk_number) {
                            localStorage.removeItem(`mhs_est_draft_${selectedSpk.spk_number}_${activeTabId}`);
                          }
                        } catch {}
                      }
                      showToast('Form estimasi dibersihkan.', 'info');
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300 transition cursor-pointer"
                  title="Bersihkan baris dan draft estimasi"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Form</span>
                </button>
              )}

              {/* Indikator Tersimpan di Bar Aksi Bawah */}
              {lastSavedTime && (
                <div className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-black shadow-2xs animate-in fade-in">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Tersimpan ({lastSavedTime})</span>
                </div>
              )}

              {isLocked ? (
                <div className="inline-flex items-center space-x-1.5 bg-slate-200 text-slate-600 font-bold text-xs px-5 py-2.5 rounded-xl cursor-not-allowed border border-slate-300">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Estimasi Terkunci (Pekerjaan Selesai)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveEstimation}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-black text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Estimasi'}</span>
                </button>
              )}

              {selectedSpk && !isLocked && (
                <button
                  type="button"
                  onClick={handleApproveAndProceedToServicing}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pelanggan Setuju - Mulai Pengerjaan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. MODAL: KIRIM LINK TTD CUSTOMER & QR CODE */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Kirim Link TTD Customer</h3>
                  <p className="text-xs text-slate-500">Persetujuan &amp; Tanda Tangan Digital Online</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Link Box */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Tautan Persetujuan Publik (Tanpa Login):
              </label>
              <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-300">
                <input
                  type="text"
                  readOnly
                  value={getPublicTtdUrl()}
                  className="w-full text-xs font-mono bg-transparent text-slate-800 outline-none select-all font-medium"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition flex-shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions (WA, Open Tablet) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={getWhatsAppShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black p-3 rounded-xl flex items-center justify-center space-x-2 shadow-xs transition"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim via WhatsApp</span>
              </a>

              <a
                href={getPublicTtdUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black p-3 rounded-xl flex items-center justify-center space-x-2 shadow-xs transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka di Layar / Tablet</span>
              </a>
            </div>

            {/* QR Code Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
              <div className="flex items-center justify-center space-x-1.5 text-xs font-black text-slate-800 uppercase tracking-wide">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Scan QR Code dari HP Customer</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Arahkan kamera smartphone customer ke QR code di bawah untuk membuka lembar tanda tangan.
              </p>
              <div className="bg-white p-3 rounded-xl border border-slate-300 inline-block shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getPublicTtdUrl())}`}
                  alt="QR Code TTD Customer"
                  className="w-36 h-36 mx-auto"
                />
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: KATALOG INVENTARIS PICKER */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900">Katalog Spare Part &amp; Jasa</h3>
                  {hasSecondTable && (
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-500 font-semibold">Tujuan Tambah:</span>
                      <button
                        type="button"
                        onClick={() => setCatalogTargetTable(1)}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md transition cursor-pointer ${
                          catalogTargetTable === 1
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tabel 1 ({table1Title || 'Bagian 1'})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatalogTargetTable(2)}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md transition cursor-pointer ${
                          catalogTargetTable === 2
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tabel 2 ({table2Title || 'Bagian 2'})
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Cari nama barang atau kode suku cadang..."
              className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
            />

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'jasa', label: 'Jasa Servis' },
                { id: 'oli_cairan', label: 'Oli & Cairan' },
                { id: 'ac_parts', label: 'Part AC' },
                { id: 'filter', label: 'Filter' },
                { id: 'rem', label: 'Rem' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPickerCategory(c.id)}
                  className={`text-[11px] px-3 py-1 rounded-lg font-bold transition ${
                    pickerCategory === c.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[220px]">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-bold">
                  Tidak ada item ditemukan.
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddFromCatalog(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/40 transition cursor-pointer group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-blue-900">{item.name}</div>
                      <div className="text-[10.5px] text-slate-400 font-mono">
                        {item.item_code} • {item.is_service ? 'Jasa' : `Stok: ${item.stock_qty} ${item.unit || 'Pcs'}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono font-black text-xs text-slate-900">{formatCurrency(item.sell_price)}</span>
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. PRINTABLE MODAL PREVIEW */}
      {savedEstimation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableEstimation
              estimation={savedEstimation}
              settings={settings}
              onClose={() => setSavedEstimation(null)}
            />
          </div>
        </div>
      )}

      {/* 9. MODAL EDIT PLAT NOMOR (Tetap dapat diubah meski SPK Selesai & Terkunci) */}
      {showEditPlateModal && selectedSpk?.vehicle && (
        <EditLicensePlateModal
          vehicleId={selectedSpk.vehicle.id}
          currentPlate={selectedSpk.vehicle.license_plate}
          customerName={selectedSpk.vehicle.customer_name}
          carModel={`${selectedSpk.vehicle.car_brand} ${selectedSpk.vehicle.car_model}`}
          onClose={() => setShowEditPlateModal(false)}
          onSuccess={(newPlate) => {
            if (selectedSpk.vehicle) {
              selectedSpk.vehicle.license_plate = newPlate;
            }
          }}
        />
      )}

      {/* 10. MODAL EDIT ISI SPK RESMI */}
      {showEditSpkModal && selectedSpk && (
        <EditSPKModal
          workOrder={selectedSpk}
          onClose={() => setShowEditSpkModal(false)}
          onSuccess={(updatedWo) => {
            setSelectedSpk(updatedWo);
            const freshDefault = formatComplaintsAndDiagnosis(updatedWo.complaints, updatedWo.notes).displayText;
            setEstimationComplaints(freshDefault);
            refreshData();
          }}
        />
      )}
    </div>
  );
}

export default function EstimationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat modul estimasi...</div>}>
      <EstimationBuilderContent />
    </Suspense>
  );
}