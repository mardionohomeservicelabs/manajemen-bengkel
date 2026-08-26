'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';

// Satuan item options
const UNIT_OPTIONS = ['SET', 'PCS', 'LTR', 'UNIT', 'JASA', 'BOTOL', 'PAKET', 'METER', 'ROLL'];

// Sample default rows if creating a new estimate (matching standard workshop understeel & engine service)
const DEFAULT_ESTIMATION_ROWS: InvoiceItem[] = [
  { name: 'SERVICE RACKSTEER', is_service: true, qty: 1, unit: 'SET', price_opsi1: 895000, total_opsi1: 895000, price_opsi2: 895000, total_opsi2: 895000, price: 895000, subtotal: 895000 },
  { name: 'BALLJOINT L/R JPN', is_service: false, qty: 2, unit: 'PCS', price_opsi1: 495000, total_opsi1: 990000, price_opsi2: 495000, total_opsi2: 990000, price: 495000, subtotal: 990000 },
  { name: 'LINK STABILIZER DPN L/R JPN', is_service: false, qty: 2, unit: 'PCS', price_opsi1: 475000, total_opsi1: 950000, price_opsi2: 475000, total_opsi2: 950000, price: 475000, subtotal: 950000 },
  { name: 'KARET STABILIZER U DPN L/R ORI', is_service: false, qty: 2, unit: 'PCS', price_opsi1: 175000, total_opsi1: 350000, price_opsi2: 175000, total_opsi2: 350000, price: 175000, subtotal: 350000 },
  { name: 'SUPPORT SHOCK LOWER DPN L/R ORI', is_service: false, qty: 2, unit: 'PCS', price_opsi1: 385000, total_opsi1: 770000, price_opsi2: 385000, total_opsi2: 770000, price: 385000, subtotal: 770000 },
];

function EstimationBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');
  const { workOrders, inventory, invoices, refreshData, showToast, settings, currentRole, saveInvoiceAsync } = useApp();

  // Selected SPK & Tab
  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Umum');
  const [tabList, setTabList] = useState<string[]>(['Umum']);

  // Meta Form Fields (matching screenshot)
  const [estimationType, setEstimationType] = useState<string>('Umum');
  const [estimationDate, setEstimationDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [estimationTime, setEstimationTime] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  });
  const [vehicleStatus, setVehicleStatus] = useState<string>('Ditinggal');
  const [paymentPlan, setPaymentPlan] = useState<string>('Transfer');

  // Switch Toggles
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [showOpsi2, setShowOpsi2] = useState<boolean>(true); // Default ON like screenshot
  const [showTax, setShowTax] = useState<boolean>(false);

  // Items & Values
  const [items, setItems] = useState<InvoiceItem[]>(DEFAULT_ESTIMATION_ROWS);
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

  // Live real-time clock
  const [currentClock, setCurrentClock] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

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

  // Initialize selected SPK
  useEffect(() => {
    if (workOrders.length > 0) {
      const targetId = selectedSpkId || workOrders[0]?.id;
      if (targetId) {
        const found = workOrders.find((w) => w.id === targetId);
        if (found) {
          setSelectedSpk(found);
          if (!selectedSpkId) setSelectedSpkId(found.id);

          // Find existing estimation for this SPK and active tab
          const existingEst = invoices.find(
            (inv) => inv.type === 'estimation' && inv.work_order_id === found.id
          );

          if (existingEst) {
            setCurrentEstimationRecord(existingEst);
            setEstimationType(existingEst.estimation_type || 'Umum');
            if (existingEst.estimation_date) setEstimationDate(existingEst.estimation_date);
            if (existingEst.estimation_time) setEstimationTime(existingEst.estimation_time);
            if (existingEst.vehicle_status) setVehicleStatus(existingEst.vehicle_status);
            if (existingEst.payment_plan) setPaymentPlan(existingEst.payment_plan);
            setShowDiscount(existingEst.has_discount || (existingEst.discount_amount || 0) > 0);
            setShowOpsi2(existingEst.has_opsi2 !== undefined ? existingEst.has_opsi2 : true);
            setShowTax(existingEst.has_tax || (existingEst.tax_percent || 0) > 0);
            setDiscountAmount(existingEst.discount_amount || 0);
            setTaxPercent(existingEst.tax_percent || 11);
            setAdminNotes(existingEst.admin_notes || '');

            if (existingEst.items && existingEst.items.length > 0) {
              const mappedItems = existingEst.items.map((it) => {
                const p1 = it.price_opsi1 !== undefined ? it.price_opsi1 : (typeof it.price === 'number' ? it.price : 0);
                const p2 = it.price_opsi2 !== undefined ? it.price_opsi2 : p1;
                const qty = it.qty || 1;
                return {
                  ...it,
                  unit: it.unit || (it.is_service ? 'JASA' : 'PCS'),
                  price_opsi1: p1,
                  total_opsi1: qty * p1,
                  price_opsi2: p2,
                  total_opsi2: qty * p2,
                  price: p1,
                  subtotal: qty * p1,
                };
              });
              setItems(mappedItems);
            }
          } else {
            setCurrentEstimationRecord(null);
            // Default sample rows for new SPK
            setItems(DEFAULT_ESTIMATION_ROWS);
          }
        }
      }
    }
  }, [selectedSpkId, workOrders, invoices]);

  // Calculations
  const subtotalOpsi1 = items.reduce((sum, it) => sum + (it.total_opsi1 || 0), 0);
  const subtotalOpsi2 = items.reduce((sum, it) => sum + (it.total_opsi2 || 0), 0);

  const effectiveDiscount = showDiscount ? discountAmount : 0;
  const taxAmountOpsi1 = showTax ? ((subtotalOpsi1 - effectiveDiscount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi2 = showTax ? ((subtotalOpsi2 - effectiveDiscount) * (taxPercent / 100)) : 0;

  const totalFinalOpsi1 = Math.max(0, subtotalOpsi1 - effectiveDiscount + taxAmountOpsi1);
  const totalFinalOpsi2 = Math.max(0, subtotalOpsi2 - effectiveDiscount + taxAmountOpsi2);

  // Row update handlers
  const handleUpdateItemField = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const row = { ...updated[index] };

    if (field === 'qty') {
      const qty = Math.max(1, Number(value) || 1);
      row.qty = qty;
      row.total_opsi1 = qty * (row.price_opsi1 || 0);
      row.total_opsi2 = qty * (row.price_opsi2 || 0);
      row.subtotal = row.total_opsi1;
    } else if (field === 'price_opsi1') {
      const p1 = Number(value) || 0;
      row.price_opsi1 = p1;
      row.total_opsi1 = (row.qty || 1) * p1;
      row.price = p1;
      row.subtotal = row.total_opsi1;
      // If price_opsi2 was not set or matches old, update together or keep
      if (row.price_opsi2 === undefined) {
        row.price_opsi2 = p1;
        row.total_opsi2 = (row.qty || 1) * p1;
      }
    } else if (field === 'price_opsi2') {
      const p2 = Number(value) || 0;
      row.price_opsi2 = p2;
      row.total_opsi2 = (row.qty || 1) * p2;
    } else if (field === 'name') {
      row.name = String(value);
    } else if (field === 'unit') {
      row.unit = String(value).toUpperCase();
    }

    updated[index] = row;
    setItems(updated);
  };

  const handleAddEmptyRow = () => {
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
    if (items.length <= 1) {
      showToast('Minimal harus ada 1 baris estimasi.', 'warning');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddFromCatalog = (inventoryItem: InventoryItem) => {
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

  // Add new estimate tab
  const handleAddNewTab = () => {
    const nextNum = tabList.length + 1;
    const tabName = `Estimasi ${nextNum}`;
    setTabList([...tabList, tabName]);
    setActiveTab(tabName);
    setEstimationType(tabName);
    setItems([
      { name: 'JASA SERVIS & PENGECEKAN', is_service: true, qty: 1, unit: 'JASA', price_opsi1: 150000, total_opsi1: 150000, price_opsi2: 150000, total_opsi2: 150000, price: 150000, subtotal: 150000 }
    ]);
    showToast(`Draf tab '${tabName}' dibuat.`, 'info');
  };

  // Save Estimation
  const handleSaveEstimation = async () => {
    if (!selectedSpk) {
      showToast('Pilih SPK kendaraan terlebih dahulu.', 'error');
      return;
    }
    if (items.length === 0 || !items.some((i) => i.name.trim())) {
      showToast('Tambahkan minimal 1 item estimasi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const existingEst = invoices.find(
        (inv) => inv.type === 'estimation' && inv.work_order_id === selectedSpk.id
      );
      const estNumber = existingEst ? existingEst.invoice_number : generateInvoiceNumber('estimation');

      const invoicePayload: Omit<Invoice, 'id'> & { id?: string } = {
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

        // Metadata fields matching screenshot
        estimation_type: estimationType,
        estimation_tab: activeTab,
        estimation_date: estimationDate,
        estimation_time: estimationTime,
        vehicle_status: vehicleStatus,
        payment_plan: paymentPlan,
        has_discount: showDiscount,
        has_opsi2: showOpsi2,
        has_tax: showTax,
        total_opsi1: totalFinalOpsi1,
        total_opsi2: totalFinalOpsi2,
        ttd_status: currentEstimationRecord?.ttd_status || 'pending',
        customer_signature: currentEstimationRecord?.customer_signature,
        customer_signed_at: currentEstimationRecord?.customer_signed_at,
        customer_signed_name: currentEstimationRecord?.customer_signed_name,
        customer_approved_option: currentEstimationRecord?.customer_approved_option,
      };

      const saved = await saveInvoiceAsync(invoicePayload);
      DBService.updateWorkOrderStatus(selectedSpk.id, 'estimating', currentRole);
      refreshData();
      setCurrentEstimationRecord(saved);
      showToast(`Estimasi ${estNumber} berhasil disimpan!`, 'success');
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
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Detail PKB</h1>
              {selectedSpk && (
                <div className="relative inline-block">
                  <select
                    value={selectedSpkId}
                    onChange={(e) => setSelectedSpkId(e.target.value)}
                    className="text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg border border-slate-300 outline-none cursor-pointer"
                  >
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.spk_number} - {wo.vehicle?.customer_name} ({wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''})
                      </option>
                    ))}
                  </select>
                </div>
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

        {/* Tab Bar (Umum, + Estimasi) */}
        <div className="flex items-center space-x-2 pt-1 border-b border-slate-100 pb-3">
          {tabList.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setEstimationType(tab);
              }}
              className={`px-5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={handleAddNewTab}
            className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Estimasi</span>
          </button>
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
              value={estimationType}
              onChange={(e) => setEstimationType(e.target.value)}
              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
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
                value={estimationDate}
                onChange={(e) => setEstimationDate(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
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
                value={estimationTime}
                onChange={(e) => setEstimationTime(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Form Fields: Row 2 (Status Mobil, Rencana Pembayaran) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              STATUS MOBIL
            </label>
            <select
              value={vehicleStatus}
              onChange={(e) => setVehicleStatus(e.target.value)}
              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 cursor-pointer"
            >
              <option value="Ditinggal">Ditinggal</option>
              <option value="Ditunggu">Ditunggu</option>
              <option value="Derek / Towing">Derek / Towing</option>
              <option value="Home Service">Home Service</option>
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              RENCANA PEMBAYARAN
            </label>
            <select
              value={paymentPlan}
              onChange={(e) => setPaymentPlan(e.target.value)}
              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 cursor-pointer"
            >
              <option value="Transfer">Transfer</option>
              <option value="Cash">Cash</option>
              <option value="QRIS">QRIS</option>
              <option value="Debit">Debit Card</option>
              <option value="Tempo">Tempo / Invoice Perusahaan</option>
            </select>
          </div>
        </div>

        {/* Switch Toggles Row (Diskon, Opsi 2, Pajak) */}
        <div className="flex flex-wrap items-center gap-6 pt-2 pb-2">
          {/* Toggle Diskon */}
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <div
              onClick={() => setShowDiscount(!showDiscount)}
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
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <div
              onClick={() => setShowOpsi2(!showOpsi2)}
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
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <div
              onClick={() => setShowTax(!showTax)}
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
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold text-[10.5px]">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">NAMA BARANG/JASA</th>
                <th className="p-3 w-16 text-center">QTY</th>
                <th className="p-3 w-24 text-center">SATUAN</th>
                <th className="p-3 w-28 text-center">HARGA OPSI 1</th>
                <th className="p-3 w-32 text-right">TOTAL OPSI 1</th>
                {showOpsi2 && (
                  <>
                    <th className="p-3 w-28 text-center bg-blue-50/30">HARGA OPSI 2</th>
                    <th className="p-3 w-32 text-right bg-blue-50/30">TOTAL OPSI 2</th>
                  </>
                )}
                <th className="p-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const tot1 = (item.qty || 1) * (item.price_opsi1 || 0);
                const tot2 = (item.qty || 1) * (item.price_opsi2 || item.price_opsi1 || 0);

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    {/* Index */}
                    <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                    {/* Nama Barang/Jasa */}
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItemField(idx, 'name', e.target.value)}
                        placeholder="Nama Jasa / Sparepart..."
                        className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 placeholder:text-slate-300 uppercase"
                      />
                    </td>

                    {/* Qty */}
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleUpdateItemField(idx, 'qty', e.target.value)}
                        className="w-14 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>

                    {/* Satuan */}
                    <td className="p-2.5 text-center">
                      <input
                        type="text"
                        value={item.unit || 'PCS'}
                        onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value)}
                        placeholder="PCS"
                        list="unit-suggestions"
                        className="w-20 text-xs font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase text-slate-700"
                      />
                    </td>

                    {/* Harga Opsi 1 */}
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="0"
                        value={item.price_opsi1 !== undefined ? item.price_opsi1 : ''}
                        onChange={(e) => handleUpdateItemField(idx, 'price_opsi1', e.target.value)}
                        className="w-28 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                      />
                    </td>

                    {/* Total Opsi 1 */}
                    <td className="p-3 text-right">
                      <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                        {formatCurrency(tot1)}
                      </span>
                    </td>

                    {/* Opsi 2 (if enabled) */}
                    {showOpsi2 && (
                      <>
                        <td className="p-2.5 text-center bg-blue-50/20">
                          <input
                            type="number"
                            min="0"
                            value={item.price_opsi2 !== undefined ? item.price_opsi2 : ''}
                            onChange={(e) => handleUpdateItemField(idx, 'price_opsi2', e.target.value)}
                            className="w-28 text-xs font-mono font-bold p-2.5 text-center rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                          />
                        </td>
                        <td className="p-3 text-right bg-blue-50/20">
                          <span className="font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                            {formatCurrency(tot2)}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Trash Delete */}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Datalist for unit suggestions */}
        <datalist id="unit-suggestions">
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        {/* Row Addition Buttons */}
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

        {/* 4. SUMMARY & CALCULATION CARDS */}
        <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/90 space-y-3">
          {showDiscount && (
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-200 pb-2">
              <span>Diskon Estimasi (Rp):</span>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                className="w-32 text-right p-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white text-emerald-800"
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
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan khusus teknisi / estimasi ini..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 resize-none outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (currentEstimationRecord) {
                    setSavedEstimation(currentEstimationRecord);
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
              <button
                type="button"
                onClick={handleSaveEstimation}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-black text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Estimasi'}</span>
              </button>

              {selectedSpk && (
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