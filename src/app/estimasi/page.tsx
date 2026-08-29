'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
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
} from 'lucide-react';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';
import { EditLicensePlateModal } from '@/components/ui/EditLicensePlateModal';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { formatNumberOrText } from '@/lib/utils';

// Satuan item options (Sesuai permintaan: SET, PCS, JASA)
const UNIT_OPTIONS = ['SET', 'PCS', 'JASA'] as const;

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
  const { workOrders, inventory, invoices, refreshData, showToast, settings, currentRole, saveInvoiceAsync } = useApp();

  // Selected SPK & Tab (tab berbentuk {id, name} agar bisa rename bebas)
  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [tabList, setTabList] = useState<EstimationTab[]>([{ id: 'tab_1', name: 'Estimasi 1' }]);
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

  // Estimator/SA name, signature & estimated work duration (baru)
  const [estimatorName, setEstimatorName] = useState<string>('');
  const [estimatorSignature, setEstimatorSignature] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');

  // Customer response (baru)
  const [customerResponse, setCustomerResponse] = useState<string>('');
  const [customerResponseNote, setCustomerResponseNote] = useState<string>('');

  // Switch Toggles
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [showOpsi2, setShowOpsi2] = useState<boolean>(true);
  const [showTax, setShowTax] = useState<boolean>(false);

  // Items & Values
  const [items, setItems] = useState<InvoiceItem[]>(EMPTY_ESTIMATION_ROW);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Customer signature status
  const [currentEstimationRecord, setCurrentEstimationRecord] = useState<Invoice | null>(null);

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

  // Live real-time clock
  const [currentClock, setCurrentClock] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const lastLoadedSpkId = useRef<string>('');

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

  // Helper: load estimasi for a specific tab from saved/draft
  const loadTabData = useCallback((spkId: string, tabId: string, allInvoices: Invoice[]) => {
    // 1. Cek invoices state (sudah tersimpan di server/Supabase)
    let existingEst = allInvoices.find(
      (inv) => inv.type === 'estimation' && inv.work_order_id === spkId && ((inv as any).tab_id === tabId || inv.estimation_tab === tabId)
    );
    // Fallback: cari berdasarkan estimation_tab (untuk data lama tanpa tab_id)
    if (!existingEst && tabId === 'tab_1') {
      existingEst = allInvoices.find(
        (inv) => inv.type === 'estimation' && inv.work_order_id === spkId
      );
    }

    // Fallback 2: cek dari work_order checklist_data yang tersinkronisasi dari Supabase
    if (!existingEst && selectedSpk?.checklist_data) {
      existingEst = (selectedSpk.checklist_data as any)[`estimation_${tabId}`] || (tabId === 'tab_1' ? (selectedSpk.checklist_data as any).estimation : undefined);
    }

    // 2. Cek localStorage draft
    let draftData: any = null;
    if (typeof window !== 'undefined') {
      try {
        const draftRaw = localStorage.getItem(`mhs_est_draft_${spkId}_${tabId}`);
        if (draftRaw) draftData = JSON.parse(draftRaw);
      } catch {}
    }

    const sourceData = draftData || existingEst;
    return { sourceData, existingEst };
  }, [selectedSpk]);

  // Helper function to load and populate estimation data for a work order (first tab)
  const loadEstimationForSpk = useCallback((found: WorkOrder) => {
    // Load tabs yang sudah tersimpan dari localStorage atau Supabase checklist_data
    let savedTabs: EstimationTab[] = [];
    if (typeof window !== 'undefined') {
      try {
        const tabsRaw = localStorage.getItem(`mhs_est_tabs_${found.id}`);
        if (tabsRaw) savedTabs = JSON.parse(tabsRaw);
      } catch {}
    }
    if (savedTabs.length === 0 && (found.checklist_data as any)?.tabs) {
      savedTabs = (found.checklist_data as any).tabs;
    }

    const tabs = savedTabs.length > 0 ? savedTabs : [{ id: 'tab_1', name: 'Estimasi 1' }];
    setTabList(tabs);
    const firstTabId = tabs[0].id;
    setActiveTabId(firstTabId);

    // Load data untuk tab pertama
    const { sourceData, existingEst } = loadTabData(found.id, firstTabId, invoices);

    if (existingEst) {
      setCurrentEstimationRecord(existingEst);
    } else {
      setCurrentEstimationRecord(null);
    }

    if (sourceData) {
      setEstimationType(sourceData.estimation_type || tabs[0].name || 'Estimasi 1');
      if (sourceData.estimation_date) setEstimationDate(sourceData.estimation_date);
      if (sourceData.estimation_time) setEstimationTime(sourceData.estimation_time);
      if (sourceData.vehicle_status) setVehicleStatus(sourceData.vehicle_status);
      if (sourceData.payment_plan) setPaymentPlan(sourceData.payment_plan);
      if (sourceData.estimator_name) setEstimatorName(sourceData.estimator_name);
      if (sourceData.estimator_signature || sourceData.signature_admin_url) {
        setEstimatorSignature(sourceData.estimator_signature || sourceData.signature_admin_url);
      } else {
        setEstimatorSignature('');
      }
      if (sourceData.estimated_duration) setEstimatedDuration(sourceData.estimated_duration);
      if (sourceData.customer_response) setCustomerResponse(sourceData.customer_response);
      if (sourceData.customer_response_note) setCustomerResponseNote(sourceData.customer_response_note);
      setShowDiscount(sourceData.has_discount || (sourceData.discount_amount || 0) > 0);
      setShowOpsi2(sourceData.has_opsi2 !== undefined ? sourceData.has_opsi2 : true);
      setShowTax(sourceData.has_tax || (sourceData.tax_percent || 0) > 0);
      setDiscountAmount(sourceData.discount_amount || 0);
      setTaxPercent(sourceData.tax_percent || 11);
      setAdminNotes(sourceData.admin_notes || '');

      if (sourceData.items && sourceData.items.length > 0) {
        const mappedItems = sourceData.items.map((it: any) => {
          const p1 = it.price_opsi1 !== undefined ? it.price_opsi1 : it.price;
          const p2 = it.price_opsi2 !== undefined ? it.price_opsi2 : p1;
          const qty = it.qty || 1;
          const isP1Text = typeof p1 === 'string' && /[a-zA-Z]/.test(p1);
          const isP2Text = typeof p2 === 'string' && /[a-zA-Z]/.test(p2);
          return {
            ...it,
            unit: it.unit || (it.is_service ? 'JASA' : 'PCS'),
            price_opsi1: p1,
            total_opsi1: isP1Text ? p1 : qty * (Number(p1) || 0),
            price_opsi2: p2,
            total_opsi2: isP2Text ? p2 : qty * (Number(p2) || 0),
            price: p1,
            subtotal: isP1Text ? p1 : qty * (Number(p1) || 0),
          };
        });
        setItems(mappedItems);
      } else {
        setItems(EMPTY_ESTIMATION_ROW);
      }
    } else {
      // SPK baru: mulai dengan 1 baris kosong (BUKAN sample data)
      setItems(EMPTY_ESTIMATION_ROW);
      setEstimatorName('');
      setEstimatorSignature('');
      setEstimatedDuration('');
      setCustomerResponse('');
      setCustomerResponseNote('');
      setAdminNotes('');
      setVehicleStatus('Di Tinggal');
    }
  }, [invoices, loadTabData]);

  // Initialize selected SPK and load estimation only on target SPK change
  useEffect(() => {
    if (workOrders.length > 0) {
      const activeWorkOrders = workOrders.filter((w) => w.status !== 'completed');
      const targetId = selectedSpkId || spkIdParam || activeWorkOrders[0]?.id || workOrders[0]?.id;
      if (targetId) {
        const found = workOrders.find((w) => w.id === targetId);
        if (found) {
          setSelectedSpk(found);
          if (!selectedSpkId) setSelectedSpkId(found.id);

          if (lastLoadedSpkId.current !== found.id) {
            lastLoadedSpkId.current = found.id;
            loadEstimationForSpk(found);
          }
        }
      }
    }
  }, [selectedSpkId, spkIdParam, workOrders, loadEstimationForSpk]);

  // Check whether work order is completed and locked
  const isLocked = selectedSpk?.status === 'completed';

  // Handler: ganti tab aktif (save current, load next)
  const handleSwitchTab = useCallback((tab: EstimationTab) => {
    // Save current tab draft before switching
    if (selectedSpkId && !isLocked) {
      const draftPayload = {
        items, estimation_type: estimationType, estimation_tab: activeTabId,
        estimation_date: estimationDate, estimation_time: estimationTime,
        vehicle_status: vehicleStatus, payment_plan: paymentPlan,
        estimator_name: estimatorName, estimator_signature: estimatorSignature,
        estimated_duration: estimatedDuration,
        customer_response: customerResponse, customer_response_note: customerResponseNote,
        has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
        discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
      };
      try { localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${activeTabId}`, JSON.stringify(draftPayload)); } catch {}
    }
    setActiveTabId(tab.id);
    // Load data for the new tab
    const { sourceData, existingEst } = loadTabData(selectedSpkId, tab.id, invoices);
    setCurrentEstimationRecord(existingEst || null);
    setEstimationType(tab.name);
    if (sourceData) {
      if (sourceData.estimation_date) setEstimationDate(sourceData.estimation_date);
      if (sourceData.estimation_time) setEstimationTime(sourceData.estimation_time);
      if (sourceData.vehicle_status) setVehicleStatus(sourceData.vehicle_status); else setVehicleStatus('Di Tinggal');
      if (sourceData.payment_plan) setPaymentPlan(sourceData.payment_plan);
      setEstimatorName(sourceData.estimator_name || '');
      setEstimatorSignature(sourceData.estimator_signature || sourceData.signature_admin_url || '');
      setEstimatedDuration(sourceData.estimated_duration || '');
      setCustomerResponse(sourceData.customer_response || '');
      setCustomerResponseNote(sourceData.customer_response_note || '');
      setShowDiscount(sourceData.has_discount || (sourceData.discount_amount || 0) > 0);
      setShowOpsi2(sourceData.has_opsi2 !== undefined ? sourceData.has_opsi2 : true);
      setShowTax(sourceData.has_tax || (sourceData.tax_percent || 0) > 0);
      setDiscountAmount(sourceData.discount_amount || 0);
      setTaxPercent(sourceData.tax_percent || 11);
      setAdminNotes(sourceData.admin_notes || '');
      if (sourceData.items && sourceData.items.length > 0) {
        const mapped = sourceData.items.map((it: any) => {
          const p1 = it.price_opsi1 !== undefined ? it.price_opsi1 : it.price;
          const p2 = it.price_opsi2 !== undefined ? it.price_opsi2 : p1;
          const qty = it.qty || 1;
          const isP1Text = typeof p1 === 'string' && /[a-zA-Z]/.test(p1);
          const isP2Text = typeof p2 === 'string' && /[a-zA-Z]/.test(p2);
          return { ...it, unit: it.unit || (it.is_service ? 'JASA' : 'PCS'),
            price_opsi1: p1, total_opsi1: isP1Text ? p1 : qty * (Number(p1) || 0),
            price_opsi2: p2, total_opsi2: isP2Text ? p2 : qty * (Number(p2) || 0),
            price: p1, subtotal: isP1Text ? p1 : qty * (Number(p1) || 0) };
        });
        setItems(mapped);
      } else { setItems(EMPTY_ESTIMATION_ROW); }
    } else {
      setItems(EMPTY_ESTIMATION_ROW);
      setEstimatorName(''); setEstimatorSignature(''); setEstimatedDuration('');
      setCustomerResponse(''); setCustomerResponseNote('');
      setAdminNotes(''); setVehicleStatus('Di Tinggal');
    }
  }, [selectedSpkId, isLocked, activeTabId, items, estimationType, estimationDate, estimationTime,
      vehicleStatus, paymentPlan, estimatorName, estimatorSignature, estimatedDuration, customerResponse, customerResponseNote,
      showDiscount, showOpsi2, showTax, discountAmount, taxPercent, adminNotes, loadTabData, invoices]);

  // Auto-save draft in LocalStorage so edits are never lost when navigating away
  useEffect(() => {
    if (!selectedSpk || !selectedSpkId || isLocked) return;
    const draftPayload = {
      items, estimation_type: estimationType, estimation_tab: activeTabId,
      estimation_date: estimationDate, estimation_time: estimationTime,
      vehicle_status: vehicleStatus, payment_plan: paymentPlan,
      estimator_name: estimatorName, estimator_signature: estimatorSignature,
      estimated_duration: estimatedDuration,
      customer_response: customerResponse, customer_response_note: customerResponseNote,
      has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
      discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
    };
    try {
      localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${activeTabId}`, JSON.stringify(draftPayload));
      localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(tabList));
    } catch {}
  }, [
    selectedSpk, selectedSpkId, isLocked, items, estimationType, activeTabId,
    estimationDate, estimationTime, vehicleStatus, paymentPlan,
    estimatorName, estimatorSignature, estimatedDuration, customerResponse, customerResponseNote,
    showDiscount, showOpsi2, showTax, discountAmount, taxPercent, adminNotes, tabList,
  ]);

  // Calculations (handles string/text prices like CEK cleanly)
  const subtotalOpsi1 = items.reduce((sum, it) => {
    const tot = typeof it.total_opsi1 === 'number'
      ? it.total_opsi1
      : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : 0);
    return sum + (Number.isNaN(tot) ? 0 : tot);
  }, 0);

  const subtotalOpsi2 = items.reduce((sum, it) => {
    const tot = typeof it.total_opsi2 === 'number'
      ? it.total_opsi2
      : (typeof it.price_opsi2 === 'number'
        ? (it.qty || 1) * it.price_opsi2
        : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : 0));
    return sum + (Number.isNaN(tot) ? 0 : tot);
  }, 0);

  const effectiveDiscount = showDiscount ? discountAmount : 0;
  const taxAmountOpsi1 = showTax ? ((subtotalOpsi1 - effectiveDiscount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi2 = showTax ? ((subtotalOpsi2 - effectiveDiscount) * (taxPercent / 100)) : 0;

  const totalFinalOpsi1 = Math.max(0, subtotalOpsi1 - effectiveDiscount + taxAmountOpsi1);
  const totalFinalOpsi2 = Math.max(0, subtotalOpsi2 - effectiveDiscount + taxAmountOpsi2);

  // Row update handlers
  const handleUpdateItemField = (index: number, field: keyof InvoiceItem, value: any) => {
    if (isLocked) return;
    const updated = [...items];
    const row = { ...updated[index] };

    if (field === 'qty') {
      const qty = Math.max(1, Number(value) || 1);
      row.qty = qty;
      if (typeof row.price_opsi1 === 'number') {
        row.total_opsi1 = qty * row.price_opsi1;
      }
      if (typeof row.price_opsi2 === 'number') {
        row.total_opsi2 = qty * row.price_opsi2;
      }
      if (typeof row.price === 'number') {
        row.subtotal = qty * row.price;
      }
    } else if (field === 'price_opsi1') {
      const valStr = String(value).trim();
      if (/[a-zA-Z]/.test(valStr)) {
        // User typed text like CEK, FREE, GRATIS, TERMASUK
        const upper = valStr.toUpperCase();
        row.price_opsi1 = upper;
        row.total_opsi1 = upper;
        row.price = upper;
        row.subtotal = upper;
      } else {
        const num = valStr.length > 0 ? parseInt(valStr.replace(/\D/g, ''), 10) || 0 : 0;
        row.price_opsi1 = num;
        row.total_opsi1 = (row.qty || 1) * num;
        row.price = num;
        row.subtotal = row.total_opsi1;
        if (row.price_opsi2 === undefined) {
          row.price_opsi2 = num;
          row.total_opsi2 = (row.qty || 1) * num;
        }
      }
    } else if (field === 'price_opsi2') {
      const valStr = String(value).trim();
      if (/[a-zA-Z]/.test(valStr)) {
        const upper = valStr.toUpperCase();
        row.price_opsi2 = upper;
        row.total_opsi2 = upper;
      } else {
        const num = valStr.length > 0 ? parseInt(valStr.replace(/\D/g, ''), 10) || 0 : 0;
        row.price_opsi2 = num;
        row.total_opsi2 = (row.qty || 1) * num;
      }
    } else if (field === 'name') {
      row.name = String(value);
    } else if (field === 'unit') {
      row.unit = String(value).toUpperCase();
    }

    updated[index] = row;
    setItems(updated);
  };

  const handleAddEmptyRow = () => {
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
    };
    setItems([...items, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (isLocked) return;
    if (items.length <= 1) {
      showToast('Minimal harus ada 1 baris estimasi.', 'warning');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddFromCatalog = (inventoryItem: InventoryItem) => {
    if (isLocked) return;
    const p = inventoryItem.sell_price;
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
    };
    setItems([...items, newRow]);
    showToast(`Ditambahkan: ${inventoryItem.name}`, 'info');
    setShowCatalogModal(false);
  };

  // Add new estimate tab with unique id
  const handleAddNewTab = () => {
    if (isLocked) return;
    const nextNum = tabList.length + 1;
    const newTabId = `tab_${Date.now()}`;
    const tabName = `Estimasi ${nextNum}`;
    const newTab: EstimationTab = { id: newTabId, name: tabName };
    // Save current tab before switching
    const draftPayload = {
      items, estimation_type: estimationType, estimation_tab: activeTabId,
      estimation_date: estimationDate, estimation_time: estimationTime,
      vehicle_status: vehicleStatus, payment_plan: paymentPlan,
      estimator_name: estimatorName, estimator_signature: estimatorSignature,
      estimated_duration: estimatedDuration,
      customer_response: customerResponse, customer_response_note: customerResponseNote,
      has_discount: showDiscount, has_opsi2: showOpsi2, has_tax: showTax,
      discount_amount: discountAmount, tax_percent: taxPercent, admin_notes: adminNotes,
    };
    if (selectedSpkId) {
      try { localStorage.setItem(`mhs_est_draft_${selectedSpkId}_${activeTabId}`, JSON.stringify(draftPayload)); } catch {}
    }
    const newTabs = [...tabList, newTab];
    setTabList(newTabs);
    setActiveTabId(newTabId);
    setEstimationType(tabName);
    setItems(EMPTY_ESTIMATION_ROW);
    setEstimatorName(''); setEstimatorSignature(''); setEstimatedDuration('');
    setCustomerResponse(''); setCustomerResponseNote('');
    setAdminNotes(''); setCurrentEstimationRecord(null);
    if (selectedSpkId) {
      try { localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(newTabs)); } catch {}
    }
    showToast(`Tab '${tabName}' dibuat. Klik nama tab untuk rename.`, 'info');
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
    if (renamingTabId === activeTabId) setEstimationType(trimmed);
    if (selectedSpkId) {
      try { localStorage.setItem(`mhs_est_tabs_${selectedSpkId}`, JSON.stringify(newTabs)); } catch {}
    }
    setRenamingTabId(null);
    showToast(`Tab diganti menjadi "${trimmed}"`, 'success');
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
    try {
      // Cari estimasi existing untuk tab ini
      const existingEst = invoices.find(
        (inv) => inv.type === 'estimation' && inv.work_order_id === selectedSpk.id
          && ((inv as any).tab_id === activeTabId || (!((inv as any).tab_id) && activeTabId === 'tab_1'))
      );
      const estNumber = existingEst ? existingEst.invoice_number : generateInvoiceNumber('estimation');
      const activeTabObj = tabList.find((t) => t.id === activeTabId) || tabList[0];

      const invoicePayload: Omit<Invoice, 'id'> & { id?: string; tab_id?: string } = {
        id: existingEst?.id,
        invoice_number: estNumber,
        type: 'estimation',
        work_order_id: selectedSpk.id,
        vehicle_id: selectedSpk.vehicle_id,
        items,
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
        estimation_type: activeTabObj?.name || estimationType,
        estimation_tab: activeTabId,
        estimation_date: estimationDate,
        estimation_time: estimationTime,
        vehicle_status: vehicleStatus,
        payment_plan: paymentPlan,
        estimator_name: estimatorName,
        estimator_signature: estimatorSignature,
        signature_admin_url: estimatorSignature,
        estimated_duration: estimatedDuration,
        customer_response: customerResponse as any,
        customer_response_note: customerResponseNote,
        has_discount: showDiscount,
        has_opsi2: showOpsi2,
        has_tax: showTax,
        total_opsi1: totalFinalOpsi1,
        total_opsi2: totalFinalOpsi2,
        tab_id: activeTabId,
        ttd_status: currentEstimationRecord?.ttd_status || 'pending',
        customer_signature: currentEstimationRecord?.customer_signature,
        customer_signed_at: currentEstimationRecord?.customer_signed_at,
        customer_signed_name: currentEstimationRecord?.customer_signed_name,
        customer_approved_option: currentEstimationRecord?.customer_approved_option,
      } as any;

      // 1. Save to Invoices (LocalStorage + Supabase)
      const saved = await saveInvoiceAsync(invoicePayload as any);

      // 2. Update Work Order status
      const updatedWorkOrder: WorkOrder = {
        ...selectedSpk,
        status: selectedSpk.status === 'queue' ? 'estimating' : selectedSpk.status,
        checklist_data: {
          ...(selectedSpk.checklist_data || {}),
          [`estimation_${activeTabId}`]: saved,
        } as any,
      };
      await DBService.saveWorkOrderAsync(updatedWorkOrder);

      // 3. Backup to LocalStorage and remove draft
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mhs_est_saved_${selectedSpk.id}_${activeTabId}`, JSON.stringify(saved));
        localStorage.removeItem(`mhs_est_draft_${selectedSpk.id}_${activeTabId}`);
        localStorage.setItem(`mhs_est_tabs_${selectedSpk.id}`, JSON.stringify(tabList));
      }

      refreshData();
      setCurrentEstimationRecord(saved);
      showToast(`Estimasi "${activeTabObj?.name}" (${estNumber}) berhasil disimpan!`, 'success');
      return saved;
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan estimasi.', 'error');
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

  const handleApproveAndProceedToServicing = () => {
    if (!selectedSpk) return;
    DBService.updateWorkOrderStatus(selectedSpk.id, 'servicing', currentRole);
    refreshData();
    showToast('Estimasi disetujui! Status SPK dipindahkan ke Dalam Pengerjaan.', 'success');
    router.push('/antrean');
  };

  // Generate public TTD URL
  const getPublicTtdUrl = () => {
    if (typeof window === 'undefined') return '';
    const estId = currentEstimationRecord?.id || selectedSpk?.id || 'demo';
    return `${window.location.origin}/estimasi/ttd/${estId}`;
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

  const filteredInventory = inventory.filter((item) => {
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
                    onChange={(e) => setSelectedSpkId(e.target.value)}
                    className="text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg border border-slate-300 outline-none cursor-pointer"
                  >
                    {workOrders.filter((wo) => wo.status !== 'completed').length === 0 ? (
                      <option value="">(Tidak ada mobil aktif yang perlu diestimasi)</option>
                    ) : (
                      workOrders
                        .filter((wo) => wo.status !== 'completed')
                        .map((wo) => (
                          <option key={wo.id} value={wo.id}>
                            {wo.spk_number} - {wo.vehicle?.customer_name} ({wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''})
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

        {/* PROMINENT LOCKING BANNER WHEN JOB IS COMPLETED */}
        {isLocked && (
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
                  Pekerjaan untuk SPK <strong>{selectedSpk?.spk_number}</strong> telah diselesaikan. Rincian item, jasa, harga, dan opsi telah terkunci permanen. <em>Data plat nomor kendaraan tetap dapat diubah jika diperlukan.</em>
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

        {/* Tab Bar — multi estimasi dengan rename inline */}
        <div className="flex items-center flex-wrap gap-2 pt-1 border-b border-slate-100 pb-3">
          {tabList.map((tab) => (
            <div key={tab.id} className={`relative flex items-center rounded-xl transition ${
              activeTabId === tab.id ? 'bg-[#0F172A] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
              {renamingTabId === tab.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCommitRename(); if (e.key === 'Escape') setRenamingTabId(null); }}
                  className="text-xs font-black px-3 py-1.5 rounded-xl bg-white text-slate-900 border-2 border-blue-500 outline-none w-36"
                />
              ) : (
                <button
                  onClick={() => handleSwitchTab(tab)}
                  onDoubleClick={() => handleStartRename(tab)}
                  title="Klik untuk aktif • Double-klik untuk rename"
                  className="px-4 py-1.5 text-xs font-black cursor-pointer"
                >
                  {tab.name}
                </button>
              )}
              {/* Rename icon */}
              {!isLocked && activeTabId === tab.id && renamingTabId !== tab.id && (
                <button
                  onClick={() => handleStartRename(tab)}
                  title="Rename tab"
                  className="pr-2 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <span className="text-[9px]">✏</span>
                </button>
              )}
            </div>
          ))}
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
        {currentEstimationRecord?.customer_signature ? (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>
                Sudah disetujui &amp; ditandatangani oleh <strong>{currentEstimationRecord.customer_signed_name || selectedSpk?.vehicle?.customer_name}</strong> ({currentEstimationRecord.customer_approved_option === 'opsi2' ? 'Pilihan: OPSI 2' : 'Pilihan: OPSI 1'})
                {currentEstimationRecord.customer_signed_at && ` pada ${new Date(currentEstimationRecord.customer_signed_at).toLocaleString('id-ID')}`}.
              </span>
            </div>
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition flex-shrink-0"
            >
              Lihat TTD Digital
            </button>
          </div>
        ) : (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-xl p-3.5 flex items-center space-x-2.5 text-xs font-bold shadow-2xs">
            <Hourglass className="w-4 h-4 text-[#D97706] flex-shrink-0" />
            <span>Belum diisi customer (menunggu via link TTD).</span>
          </div>
        )}

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
              onChange={(e) => setEstimationType(e.target.value)}
              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              placeholder="Contoh: Umum, Understeel, AC..."
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

        {/* Form Fields: Row 2 (Status Mobil, Estimasi Lama Pekerjaan) */}
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
              ESTIMATOR / SA
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

        {/* BOX TANDA TANGAN ESTIMATOR / SA */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PenTool className="w-4 h-4 text-blue-600" />
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                Tanda Tangan Estimator / SA Yang Mengerjakan:
              </label>
            </div>
            {estimatorSignature ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ✓ Tanda Tangan Tersimpan
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">
                Bubuhkan tanda tangan di bawah
              </span>
            )}
          </div>
          <div className="max-w-md bg-white p-3 rounded-xl border border-slate-200">
            <SignatureCanvas
              key={`${selectedSpkId}_${activeTabId}_${estimatorSignature ? 'has_sig' : 'empty'}`}
              initialDataUrl={estimatorSignature}
              onSave={(dataUrl) => setEstimatorSignature(dataUrl)}
              readOnly={isLocked}
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
                : customerResponse === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}>
                {customerResponse === 'opsi1' ? '✅ Pilih Opsi 1' : customerResponse === 'opsi2' ? '✅ Pilih Opsi 2' : customerResponse === 'pending' ? '⏸ Pending/Tidak Jadi' : '📝 Lain-lainnya'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'opsi1', label: '✅ Pilih Opsi 1', cls: customerResponse === 'opsi1' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400' },
              { value: 'opsi2', label: '✅ Pilih Opsi 2', cls: customerResponse === 'opsi2' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400' },
              { value: 'pending', label: '⏸ Pending / Tidak Jadi', cls: customerResponse === 'pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400' },
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

        {/* Switch Toggles Row (Diskon, Opsi 2, Pajak) */}
        <div className="flex flex-wrap items-center gap-6 pt-2 pb-2">
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

          {/* Toggle Opsi 2 */}
          <label className={`flex items-center space-x-2.5 select-none ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div
              onClick={() => { if (!isLocked) setShowOpsi2(!showOpsi2); }}
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
            <span className="text-xs font-bold text-slate-700">Opsi 2</span>
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
        </div>

        {/* 3. ITEMS ESTIMASI TABLE (Exact Match to Screenshot!) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-300 text-slate-800 font-black text-[10.5px] uppercase">
                <th className="p-3 w-10 text-center border-r border-slate-200">No</th>
                <th className="p-3 border-r border-slate-200">Saran/Perbaikan/Ganti Sparepart</th>
                <th className="p-3 w-16 text-center border-r border-slate-200">QTY</th>
                <th className="p-3 w-24 text-center border-r border-slate-200">Satuan</th>
                <th className="p-3 w-32 text-center border-r border-slate-200">Hrg Sat</th>
                <th className="p-3 w-36 text-right border-r border-slate-200">Total Opsi 1</th>
                {showOpsi2 && (
                  <>
                    <th className="p-3 w-32 text-center border-r border-slate-200 bg-blue-50/40 text-blue-950">Hrg Opsi 2</th>
                    <th className="p-3 w-36 text-right bg-blue-50/40 text-blue-950">Total Opsi 2</th>
                  </>
                )}
                {!isLocked && <th className="p-3 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => {
                const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof item.price_opsi1 === 'number' ? (item.qty || 1) * item.price_opsi1 : 0);
                const tot2 = item.total_opsi2 !== undefined ? item.total_opsi2 : (typeof item.price_opsi2 === 'number' ? (item.qty || 1) * item.price_opsi2 : tot1);

                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {/* Index */}
                    <td className="p-3 text-center text-slate-500 font-bold border-r border-slate-200">{idx + 1}</td>

                    {/* Saran/Perbaikan/Ganti Sparepart */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={item.name}
                        onChange={(e) => handleUpdateItemField(idx, 'name', e.target.value)}
                        placeholder="Nama Saran / Sparepart / Jasa..."
                        className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 placeholder:text-slate-300 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* QTY */}
                    <td className="p-2 text-center border-r border-slate-200">
                      <input
                        type="number"
                        min="1"
                        disabled={isLocked}
                        value={item.qty}
                        onChange={(e) => handleUpdateItemField(idx, 'qty', e.target.value)}
                        className="w-14 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Satuan (3 Opsi: SET, PCS, JASA) */}
                    <td className="p-2 text-center border-r border-slate-200">
                      <select
                        disabled={isLocked}
                        value={item.unit || 'PCS'}
                        onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value)}
                        className="w-20 text-xs font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Hrg Sat (Harga Opsi 1) */}
                    <td className="p-2 text-center border-r border-slate-200">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={item.price_opsi1 !== undefined ? item.price_opsi1 : ''}
                        onChange={(e) => handleUpdateItemField(idx, 'price_opsi1', e.target.value)}
                        placeholder="0 / CEK"
                        className="w-28 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Total Opsi 1 */}
                    <td className="p-3 text-right border-r border-slate-200">
                      <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                        {formatNumberOrText(tot1)}
                      </span>
                    </td>

                    {/* Opsi 2 (if enabled) */}
                    {showOpsi2 && (
                      <>
                        <td className="p-2 text-center border-r border-slate-200 bg-blue-50/20">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={item.price_opsi2 !== undefined ? item.price_opsi2 : ''}
                            onChange={(e) => handleUpdateItemField(idx, 'price_opsi2', e.target.value)}
                            placeholder="0 / CEK"
                            className="w-28 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="p-3 text-right bg-blue-50/20">
                          <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                            {formatNumberOrText(tot2)}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Trash Delete */}
                    {!isLocked && (
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-300 hover:text-red-600 transition p-1 cursor-pointer"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {/* Table Summary Footer: JUMLAH KESELURUHAN (Exact layout from image) */}
            <tfoot>
              <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300">
                <td colSpan={5} className="p-3 text-center uppercase tracking-wider text-slate-800 text-xs">
                  JUMLAH KESELURUHAN
                </td>
                <td className="p-3 text-right font-mono font-black text-sm text-slate-950 border-r border-slate-200">
                  {formatNumberOrText(totalFinalOpsi1)}
                </td>
                {showOpsi2 && (
                  <>
                    <td className="p-3 bg-blue-50/30 border-r border-slate-200"></td>
                    <td className="p-3 text-right font-mono font-black text-sm text-slate-950 bg-blue-50/30">
                      {formatNumberOrText(totalFinalOpsi2)}
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
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleAddEmptyRow}
              className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baris Kosong</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-4 py-2 rounded-xl border border-blue-200 transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Pilih dari Katalog Inventaris</span>
            </button>
          </div>
        )}

        {/* 4. SUMMARY & CALCULATION CARDS */}
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
                TOTAL AKHIR OPSI 1
              </div>
              <div className="font-mono font-black text-xl text-slate-900">
                {formatCurrency(totalFinalOpsi1)}
              </div>
              <p className="text-[10px] text-slate-400">Rekomendasi pengerjaan utama / standar</p>
            </div>

            {showOpsi2 && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-black uppercase tracking-wider text-purple-900">
                  TOTAL AKHIR OPSI 2
                </div>
                <div className="font-mono font-black text-xl text-slate-900">
                  {formatCurrency(totalFinalOpsi2)}
                </div>
                <p className="text-[10px] text-slate-400">Pilihan alternatif suku cadang / penanganan</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. NOTES & ACTION CONTROLS */}
        <div className="space-y-4 pt-2">
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
                  const estToPreview = currentEstimationRecord
                    ? {
                        ...currentEstimationRecord,
                        estimator_name: estimatorName || currentEstimationRecord.estimator_name,
                        estimator_signature: estimatorSignature || currentEstimationRecord.estimator_signature,
                      }
                    : null;
                  if (estToPreview) {
                    setSavedEstimation(estToPreview);
                  } else {
                    handleSaveEstimation().then((res) => {
                      if (res) setSavedEstimation(res);
                    });
                  }
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
                <h3 className="text-base font-black text-slate-900">Katalog Spare Part &amp; Jasa</h3>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
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