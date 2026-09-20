'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { DBService } from '@/lib/services/db-service';
import {
  Invoice,
  InvoiceItem,
  PaymentMethod,
  PaymentStatus,
  WorkOrder,
  InventoryItem,
  CRMReminderPeriod,
} from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
  generateInvoiceNumber,
  parseNumericPrice,
  resolveInvoiceBranch,
  resolveWorkOrderBranch,
} from '@/lib/utils';
import Link from 'next/link';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Printer,
  Share2,
  Plus,
  PlusCircle,
  Trash2,
  Lock,
  Sparkles,
  Search,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Building,
  PenTool,
  Eye,
  X,
  FileCheck,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PrintableInvoice } from '@/components/ui/PrintableInvoice';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';

function CashierContent() {
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');
  const invoiceIdParam = searchParams.get('invoiceId');
  const modeParam = searchParams.get('mode');

  const {
    workOrders,
    allWorkOrders,
    inventory,
    invoices,
    allInvoices,
    refreshData,
    syncWithSupabase,
    showToast,
    settings,
    currentRole,
    saveInvoiceAsync,
    updateWorkOrderStatusAsync,
    generateUniqueInvoiceNumberAsync,
  } = useApp();
  const { currentUser, activeBranch } = useAuth();

  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoiceIdParam || '');
  const [isOwnerEditMode, setIsOwnerEditMode] = useState<boolean>(Boolean(invoiceIdParam || modeParam === 'owner_edit'));
  const [targetPaidInvoice, setTargetPaidInvoice] = useState<Invoice | null>(null);

  // Jika cabang berganti (misal oleh Via atau Owner), reset pilihan nota / SPK cabang sebelumnya
  useEffect(() => {
    if (selectedSpk && resolveWorkOrderBranch(selectedSpk) !== activeBranch) {
      setSelectedSpkId('');
      setSelectedSpk(null);
      setSelectedInvoiceId('');
      setIsOwnerEditMode(false);
      setTargetPaidInvoice(null);
    }
  }, [activeBranch, selectedSpk]);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [crmFollowupPeriod, setCrmFollowupPeriod] = useState<CRMReminderPeriod>('none');
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Item Picker & Manual Item Input
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [activeAddTab, setActiveAddTab] = useState<'manual' | 'inventory'>('manual');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemType, setCustomItemType] = useState<'part' | 'service'>('part');
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>('');
  const [customItemUnit, setCustomItemUnit] = useState<string>('PCS');

  // Dual Signatures (Customer & Admin)
  const [signatureCustomer, setSignatureCustomer] = useState<string>('');
  const [signatureAdmin, setSignatureAdmin] = useState<string>('');

  // Review & Signing Modal before settlement
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);

  // Final invoice preview modal after settlement
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Lacak SPK mana yang item estimasinya sudah dimuat agar sinkronisasi latar belakang tidak menimpa item tambahan kasir
  const loadedSpkIdRef = useRef<string>('');

  // Helper fungsi untuk memuat rincian item dari estimasi yang disetujui
  const loadEstimationItems = useCallback(
    (targetWo: WorkOrder) => {
      // Check estimations for this SPK - prioritize approved estimation
      const allSpkEsts = invoices.filter(
        (inv) =>
          inv.type === 'estimation' &&
          (inv.work_order_id === targetWo.id ||
            (targetWo.spk_number && inv.work_order_id === targetWo.spk_number) ||
            (inv.work_order?.spk_number && targetWo.spk_number && inv.work_order.spk_number === targetWo.spk_number))
      );

      const approvedEst = allSpkEsts.find(
        (inv) =>
          inv.customer_approved_option === 'opsi1' ||
          inv.customer_approved_option === 'opsi2' ||
          inv.customer_response === 'opsi1' ||
          inv.customer_response === 'opsi2' ||
          inv.ttd_status === 'signed'
      );

      const targetEst: Invoice | null =
        approvedEst ||
        (targetWo.checklist_data?.estimation &&
        (targetWo.checklist_data.estimation as any).customer_response !== 'batal' &&
        (targetWo.checklist_data.estimation as any).ttd_status !== 'rejected'
          ? (targetWo.checklist_data.estimation as Invoice)
          : null) ||
        allSpkEsts.find((inv) => inv.customer_response !== 'batal' && inv.ttd_status !== 'rejected') ||
        allSpkEsts[0] ||
        null;

      if (targetEst && targetEst.items && targetEst.items.length > 0) {
        const chosenOpt = targetEst.customer_approved_option || targetEst.customer_response || 'opsi1';
        const isOpsi2 = chosenOpt === 'opsi2';

        const mappedItems: InvoiceItem[] = targetEst.items
          .map((it) => {
            let priceToUse: any = it.price;
            let subtotalToUse: any = it.subtotal;

            if (isOpsi2) {
              const hasP2 =
                it.price_opsi2 !== undefined &&
                it.price_opsi2 !== '' &&
                it.price_opsi2 !== 0 &&
                it.price_opsi2 !== '0';
              if (hasP2) {
                priceToUse = it.price_opsi2;
                subtotalToUse =
                  it.total_opsi2 !== undefined && it.total_opsi2 !== 0
                    ? it.total_opsi2
                    : parseNumericPrice(priceToUse) * (it.qty || 1);
              } else if (it.price_opsi2 === '' || it.price_opsi2 === 0 || it.price_opsi2 === '0') {
                priceToUse = 0;
                subtotalToUse = 0;
              } else {
                priceToUse = it.price_opsi1 !== undefined ? it.price_opsi1 : it.price;
                subtotalToUse = it.total_opsi1 !== undefined ? it.total_opsi1 : it.subtotal;
              }
            } else {
              priceToUse = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : it.price;
              subtotalToUse = it.total_opsi1 !== undefined ? it.total_opsi1 : it.subtotal;
            }

            const numPrice = parseNumericPrice(priceToUse);
            const numSubtotal = parseNumericPrice(subtotalToUse) || numPrice * (it.qty || 1);

            return {
              ...it,
              name: (it.name || '').toUpperCase(),
              price: numPrice,
              subtotal: numSubtotal,
            };
          })
          // Filter out items that have 0 price in the selected option (e.g. only existed in the other option)
          .filter((it) => it.subtotal > 0 || it.price > 0 || Boolean(it.name));

        setItems(mappedItems);
        setDiscountAmount(targetEst.discount_amount || 0);
        setTaxPercent(targetEst.tax_percent || 0);
        setDownPayment(targetEst.down_payment || 0);
      } else {
        setItems([]);
        setDiscountAmount(0);
        setTaxPercent(0);
        setDownPayment(0);
      }
    },
    [invoices]
  );

  // Load from SPK or Estimation
  useEffect(() => {
    if (isOwnerEditMode && selectedInvoiceId) {
      // Jangan timpa item jika sedang dalam Mode Koreksi Nota Owner
      return;
    }
    if (selectedSpkId && workOrders.length > 0) {
      const found = workOrders.find((w) => w.id === selectedSpkId);
      if (found) {
        setSelectedSpk(found);

        // Hanya muat ulang item dari estimasi jika SPK berubah (mencegah background sync 12s menghapus item tambahan)
        if (loadedSpkIdRef.current !== selectedSpkId) {
          loadedSpkIdRef.current = selectedSpkId;
          loadEstimationItems(found);
          setCrmFollowupPeriod((found.crm_followup_period as CRMReminderPeriod) || 'none');
        }
      }
    } else if (!isOwnerEditMode) {
      setSelectedSpk(null);
      loadedSpkIdRef.current = '';
      setItems([]);
      setDiscountAmount(0);
      setTaxPercent(0);
      setDownPayment(0);
    }
  }, [selectedSpkId, workOrders, loadEstimationItems, isOwnerEditMode, selectedInvoiceId]);

  // Load nota tersimpan untuk Mode Koreksi Nota Owner
  useEffect(() => {
    if (selectedInvoiceId) {
      const allInvs = [...invoices, ...allInvoices];
      const foundInv = allInvs.find(
        (i) => i.id === selectedInvoiceId || i.invoice_number === selectedInvoiceId
      );
      if (foundInv) {
        setTargetPaidInvoice(foundInv);
        setIsOwnerEditMode(true);

        const allWos = [...workOrders, ...allWorkOrders];
        const matchingWo =
          allWos.find(
            (w) => w.id === foundInv.work_order_id || w.spk_number === foundInv.work_order_id
          ) || foundInv.work_order;

        if (matchingWo) {
          setSelectedSpk(matchingWo);
          setSelectedSpkId(matchingWo.id);
          loadedSpkIdRef.current = matchingWo.id;
        }

        // Muat seluruh item dari nota yang telah tersimpan
        const mappedItems: InvoiceItem[] = (foundInv.items || []).map((it) => ({
          ...it,
          name: (it.name || '').toUpperCase(),
          price: parseNumericPrice(it.price),
          subtotal: parseNumericPrice(it.subtotal) || parseNumericPrice(it.price) * (it.qty || 1),
        }));

        setItems(mappedItems);
        setDiscountAmount(foundInv.discount_amount || 0);
        setTaxPercent(foundInv.tax_percent || 0);
        setDownPayment(foundInv.down_payment || 0);
        if (foundInv.payment_method) {
          setPaymentMethod(foundInv.payment_method);
        }
        setAdminNotes(foundInv.admin_notes || '');
        setSignatureCustomer(foundInv.signature_customer_url || '');
        setSignatureAdmin(foundInv.signature_admin_url || '');
        if (foundInv.crm_followup_period) {
          setCrmFollowupPeriod(foundInv.crm_followup_period as CRMReminderPeriod);
        }
      }
    }
  }, [selectedInvoiceId, invoices, allInvoices, workOrders, allWorkOrders]);

  // Tombol aksi manual untuk memuat ulang rincian item persis seperti estimasi awal
  const handleResetFromEstimation = () => {
    if (!selectedSpk) return;
    loadEstimationItems(selectedSpk);
    showToast('Rincian item berhasil dikembalikan sesuai estimasi awal yang disetujui.', 'info');
  };

  // Cek apakah ada estimasi yang disetujui untuk SPK terpilih
  const spkInvoices = invoices.filter(
    (inv) =>
      inv.type === 'estimation' &&
      (inv.work_order_id === selectedSpk?.id ||
        (selectedSpk?.spk_number && inv.work_order_id === selectedSpk.spk_number))
  );

  const approvedEstimation = spkInvoices.find(
    (inv) =>
      inv.customer_approved_option === 'opsi1' ||
      inv.customer_approved_option === 'opsi2' ||
      inv.customer_response === 'opsi1' ||
      inv.customer_response === 'opsi2' ||
      inv.ttd_status === 'signed'
  );

  const existingEstimation = approvedEstimation || spkInvoices[0] || null;

  const isEstimationApproved =
    spkInvoices.length === 0 ||
    Boolean(approvedEstimation) ||
    ['approved', 'servicing', 'waiting_parts', 'completed_service', 'paid', 'completed'].includes(
      selectedSpk?.status || ''
    );

  // Cek apakah SPK / Mobil sudah selesai atau lunas
  const existingPaidInvoice = invoices.find(
    (inv) =>
      inv.type === 'invoice' &&
      inv.payment_status === 'paid' &&
      (inv.work_order_id === selectedSpk?.id ||
        (selectedSpk?.spk_number && inv.work_order_id === selectedSpk.spk_number))
  );

  const isAlreadyFinished = Boolean(
    selectedSpk?.status === 'completed' ||
    selectedSpk?.status === 'paid' ||
    existingPaidInvoice
  );

  // Khusus Owner dalam Mode Koreksi Nota: Buka kunci nota agar dapat diubah & dibayar ulang
  const isLockedForRole = isAlreadyFinished && !(currentRole === 'owner' && isOwnerEditMode);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + parseNumericPrice(item.subtotal), 0);
  const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);
  const balanceDue = Math.max(0, totalAmount - downPayment);

  const handleAddItem = (item: InventoryItem) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((i) => i.item_id === item.id);
      if (existingIndex !== -1) {
        const updated = [...prevItems];
        const newQty = (updated[existingIndex].qty || 1) + 1;
        const numPrice = parseNumericPrice(updated[existingIndex].price);
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: newQty,
          subtotal: newQty * numPrice,
        };
        return updated;
      } else {
        const newItem: InvoiceItem = {
          item_id: item.id,
          code: item.item_code,
          name: (item.name || '').toUpperCase(),
          is_service: Boolean(item.is_service),
          is_custom: true,
          qty: 1,
          price: item.sell_price,
          buy_price: item.buy_price,
          subtotal: item.sell_price,
        };
        return [...prevItems, newItem];
      }
    });
    showToast(`"${item.name.toUpperCase()}" berhasil ditambahkan ke nota.`, 'success');
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    setItems((prev) => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const numPrice = parseNumericPrice(updated[index].price);
      updated[index] = {
        ...updated[index],
        qty,
        subtotal: qty * numPrice,
      };
      return updated;
    });
  };

  const handleUpdatePrice = (index: number, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setItems((prev) => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const qty = updated[index].qty || 1;
      updated[index] = {
        ...updated[index],
        price,
        subtotal: qty * price,
      };
      return updated;
    });
  };

  const handleAddCustomItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customItemName.trim()) {
      showToast('Masukkan nama barang atau jasa terlebih dahulu.', 'error');
      return;
    }
    const priceNum = typeof customItemPrice === 'number' ? customItemPrice : Number(customItemPrice) || 0;
    const qtyNum = Math.max(1, Number(customItemQty) || 1);

    const newItem: InvoiceItem = {
      item_id: `custom-${Date.now()}`,
      code: customItemType === 'service' ? 'JASA-ADD' : 'PART-ADD',
      name: customItemName.trim().toUpperCase(),
      is_service: customItemType === 'service',
      is_custom: true,
      qty: qtyNum,
      unit: customItemUnit,
      price: priceNum,
      subtotal: qtyNum * priceNum,
    };

    setItems((prev) => [...prev, newItem]);
    showToast(`"${newItem.name}" berhasil ditambahkan ke nota.`, 'success');

    // Reset form
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openSignAndReviewModal = () => {
    if (!selectedSpk) {
      showToast('Pilih SPK kendaraan terlebih dahulu.', 'error');
      return;
    }
    if (isLockedForRole) {
      showToast('Mobil ini telah selesai & lunas. Transaksi nota terkunci dan tidak dapat diubah.', 'error');
      return;
    }
    if (existingEstimation && !isEstimationApproved && !isOwnerEditMode) {
      showToast('Estimasi belum disetujui pelanggan. Sesuai ketentuan, estimasi yang belum disetujui tidak dapat dijadikan nota.', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Tambahkan minimal 1 item untuk penagihan.', 'error');
      return;
    }
    setIsSignModalOpen(true);
  };

  // Selesaikan Transaksi Pembayaran (Simpan Nota Resmi secara Asinkron ke Cloud & Lokal)
  const handleProcessPayment = async (status: PaymentStatus) => {
    if (!selectedSpk) {
      showToast('Pilih SPK terlebih dahulu.', 'error');
      return;
    }

    if (isLockedForRole) {
      showToast('Transaksi ditolak: Mobil ini sudah selesai & lunas. Nota telah diarsipkan.', 'error');
      return;
    }

    if (existingEstimation && !isEstimationApproved && !isOwnerEditMode) {
      showToast('Gagal disimpan: Estimasi belum disetujui pelanggan. Tidak dapat memproses nota.', 'error');
      return;
    }

    if (items.length === 0) {
      showToast('Tambahkan minimal 1 item pekerjaan/sparepart.', 'error');
      return;
    }

    setIsProcessing(true);
    showToast(isOwnerEditMode ? 'Memperbarui nota & database laporan...' : 'Menyimpan nota & pembayaran ke database cloud...', 'info');

    try {
      const branch = resolveWorkOrderBranch(selectedSpk);
      const invoiceNumber = (isOwnerEditMode && targetPaidInvoice?.invoice_number)
        ? targetPaidInvoice.invoice_number
        : await generateUniqueInvoiceNumberAsync('invoice', branch);

      const uppercaseItems = items.map((it) => ({
        ...it,
        name: (it.name || '').toUpperCase(),
        price: parseNumericPrice(it.price),
        subtotal: parseNumericPrice(it.subtotal) || parseNumericPrice(it.price) * (it.qty || 1),
      }));

      const calculatedSubtotal = uppercaseItems.reduce(
        (sum, item) => sum + parseNumericPrice(item.subtotal),
        0
      );
      const calculatedTaxAmount = (calculatedSubtotal - discountAmount) * (taxPercent / 100);
      const calculatedTotalAmount = Math.max(0, calculatedSubtotal - discountAmount + calculatedTaxAmount);
      const calculatedBalanceDue = Math.max(
        0,
        calculatedTotalAmount - (status === 'paid' ? calculatedTotalAmount : downPayment)
      );

      const invoicePayload: Omit<Invoice, 'id'> & { id?: string } = {
        id: (isOwnerEditMode && targetPaidInvoice?.id) ? targetPaidInvoice.id : undefined,
        invoice_number: invoiceNumber,
        type: 'invoice',
        work_order_id: selectedSpk.id,
        vehicle_id: selectedSpk.vehicle_id,
        items: uppercaseItems,
        subtotal: calculatedSubtotal,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        tax_amount: calculatedTaxAmount,
        total_amount: calculatedTotalAmount,
        down_payment: status === 'paid' ? calculatedTotalAmount : downPayment,
        balance_due: status === 'paid' ? 0 : calculatedBalanceDue,
        payment_status: status,
        payment_method: paymentMethod,
        paid_at: status === 'paid' ? new Date().toISOString() : undefined,
        admin_notes: adminNotes,
        signature_customer_url: signatureCustomer || targetPaidInvoice?.signature_customer_url,
        signature_admin_url: signatureAdmin || targetPaidInvoice?.signature_admin_url,
        created_at: targetPaidInvoice?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        crm_followup_period: crmFollowupPeriod,
      };

      const newInvoice = await saveInvoiceAsync(invoicePayload);

      // Simpan jadwal follow up CRM ke WorkOrder & CRMLog (1 jadwal terpilih per mobil)
      DBService.setTransactionFollowupPeriod(selectedSpk.id, crmFollowupPeriod);

      // Update status SPK ke 'paid' di Supabase & local jika lunas
      if (status === 'paid' && selectedSpk.id) {
        await updateWorkOrderStatusAsync(selectedSpk.id, 'paid');
      }

      if (isOwnerEditMode && targetPaidInvoice) {
        DBService.logAudit(
          'Owner',
          'owner',
          'KOREKSI_NOTA_PEMBAYARAN_ULANG',
          'invoices',
          targetPaidInvoice.id,
          {
            invoice_number: invoiceNumber,
            old_total: targetPaidInvoice.total_amount,
            new_total: calculatedTotalAmount,
            old_payment_method: targetPaidInvoice.payment_method,
            new_payment_method: paymentMethod,
          },
          branch
        );
      }

      // Objek nota lengkap untuk pratinjau & cetak resmi langsung
      const invoiceForPreview: Invoice = {
        ...newInvoice,
        items: uppercaseItems,
        subtotal: calculatedSubtotal,
        total_amount: calculatedTotalAmount,
        tax_amount: calculatedTaxAmount,
        vehicle: selectedSpk.vehicle || newInvoice.vehicle,
        work_order: selectedSpk || newInvoice.work_order,
        signature_customer_url: signatureCustomer || newInvoice.signature_customer_url,
        signature_admin_url: signatureAdmin || newInvoice.signature_admin_url,
      };

      // Segarkan state lokal
      refreshData();

      // Trigger Confetti if paid
      if (status === 'paid') {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#800000', '#059669', '#F59E0B'],
        });
      }

      setIsSignModalOpen(false);
      showToast(
        isOwnerEditMode
          ? `Tersimpan! Koreksi Nota ${invoiceForPreview.invoice_number} berhasil disimpan & omzet laporan telah diperbarui.`
          : status === 'paid'
          ? `Tersimpan! Pembayaran Nota ${invoiceForPreview.invoice_number} LUNAS berhasil disimpan ke database cloud.`
          : `Tersimpan! Nota ${invoiceForPreview.invoice_number} berhasil disimpan (Pending) ke database cloud.`,
        'success'
      );
      setSavedInvoice(invoiceForPreview);
    } catch (err: any) {
      console.error('Payment processing error:', err);
      showToast(`Gagal disimpan: ${err?.message || 'Gagal memproses nota pembayaran.'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-maroon-700" />
            <span>Kasir &amp; Pembuatan Nota Servis (Invoicing)</span>
            <span className="ml-2 px-2.5 py-0.5 rounded-lg text-xs font-black bg-maroon-100 text-maroon-900 border border-maroon-200">
              {activeBranch}
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Penyelesaian transaksi pengerjaan, verifikasi nota + tanda tangan digital (Customer & Admin), dan cetak nota resmi.
          </p>
        </div>

        {currentRole === 'admin' && (
          <div className="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200">
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>Role Admin: Nominal Harga Satuan Terkunci</span>
          </div>
        )}
      </div>

      {/* Select SPK Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
        <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
          Pilih SPK Kendaraan untuk Ditagih:
        </label>
        <select
          value={isOwnerEditMode && targetPaidInvoice ? `inv:${targetPaidInvoice.id}` : selectedSpkId}
          onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith('inv:')) {
              const invId = val.slice(4);
              setSelectedInvoiceId(invId);
              setIsOwnerEditMode(true);
            } else {
              setSelectedInvoiceId('');
              setIsOwnerEditMode(false);
              setTargetPaidInvoice(null);
              setSelectedSpkId(val);
            }
          }}
          className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold"
        >
          <option value="">-- Pilih SPK / Kendaraan --</option>
          <optgroup label="Antrean Kendaraan Siap Ditagih">
            {[...workOrders]
              .filter((wo) => {
                // Sembunyikan yang dibatalkan, sudah selesai (completed), atau sudah lunas (paid)
                if (wo.status === 'cancelled' || wo.status === 'completed' || wo.status === 'paid') {
                  return false;
                }
                // Cek juga apakah sudah ada invoice lunas
                const hasPaid = invoices.some(
                  (inv) =>
                    inv.type === 'invoice' &&
                    inv.payment_status === 'paid' &&
                    (inv.work_order_id === wo.id || (wo.spk_number && inv.work_order_id === wo.spk_number))
                );
                return !hasPaid;
              })
              .sort((a, b) => {
                const priority = (s: string) => (s === 'completed_service' ? 0 : s === 'servicing' ? 1 : 2);
                return priority(a.status) - priority(b.status);
              })
              .map((wo) => {
                const isReadyToPay = wo.status === 'completed_service';
                return (
                  <option key={wo.id} value={wo.id}>
                    {isReadyToPay ? '⭐ [SELESAI SERVIS - SIAP BAYAR] ' : ''}
                    {wo.spk_number} • {wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''} •{' '}
                    {wo.vehicle?.customer_name} ({wo.vehicle?.car_brand} {wo.vehicle?.car_model}) - Status: {wo.status}
                  </option>
                );
              })}
          </optgroup>
          {currentRole === 'owner' && (
            <optgroup label={`🔧 Koreksi Nota Laporan (${activeBranch} - Khusus Owner)`}>
              {[...invoices, ...allInvoices]
                .filter(
                  (inv, index, self) =>
                    inv.type === 'invoice' &&
                    inv.payment_status === 'paid' &&
                    (inv.branch || resolveInvoiceBranch(inv, allWorkOrders)) === activeBranch &&
                    self.findIndex((i) => i.id === inv.id || i.invoice_number === inv.invoice_number) === index
                )
                .map((inv) => (
                  <option key={inv.id} value={`inv:${inv.id}`}>
                    [KOREKSI NOTA] {inv.invoice_number} • {inv.vehicle?.license_plate ? formatPlate(inv.vehicle.license_plate) : '-'} • {inv.vehicle?.customer_name || 'Pelanggan'} • {formatCurrency(inv.total_amount)}
                  </option>
                ))}
            </optgroup>
          )}
        </select>

        {/* Banner Khusus Mode Koreksi Nota Owner */}
        {selectedSpk && isOwnerEditMode && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 shadow-sm mt-3 animate-in fade-in duration-200">
            <div className="flex items-start space-x-3">
              <RotateCcw className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black uppercase tracking-wide text-amber-950">
                    Mode Koreksi Nota &amp; Pembayaran Ulang (Khusus Owner)
                  </h4>
                  {targetPaidInvoice && (
                    <span className="text-[10px] font-mono font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300">
                      {targetPaidInvoice.invoice_number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  Nota ini telah masuk ke database laporan omzet. Sebagai Owner, Anda memiliki wewenang penuh untuk mengubah rincian barang/jasa, harga, diskon, atau metode pembayaran (misal ganti dari Cash ke Transfer BCA/BRI). Pembayaran ulang akan langsung memperbarui database laporan omzet secara valid.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOwnerEditMode(false);
                  setSelectedInvoiceId('');
                  setSelectedSpkId('');
                  setTargetPaidInvoice(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-bold text-xs shadow-2xs transition cursor-pointer"
              >
                Batal Koreksi
              </button>
            </div>
          </div>
        )}

        {/* Locked Banner: Mobil Sudah Selesai / Lunas (Hanya jika BUKAN dalam mode koreksi) */}
        {selectedSpk && isAlreadyFinished && !isOwnerEditMode && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 shadow-sm mt-3 animate-in fade-in duration-200">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-emerald-900">
                  Mobil Sudah Selesai &amp; Lunas (Nota Terkunci)
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Pekerjaan dan pembayaran untuk kendaraan <strong>{selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : ''} ({selectedSpk.vehicle?.customer_name})</strong> telah berstatus Selesai/Lunas.
                  {currentRole === 'owner' ? ' Sebagai Owner, Anda dapat membuka kunci nota ini untuk melakukan koreksi dan pembayaran ulang apabila terjadi kesalahan nota.' : ' Transaksi nota kasir telah ditutup dan tidak dapat dibuka atau diubah kembali.'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {currentRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    const existingInv = invoices.find(
                      (inv) =>
                        inv.type === 'invoice' &&
                        (inv.work_order_id === selectedSpk.id || (selectedSpk.spk_number && inv.work_order_id === selectedSpk.spk_number))
                    ) || allInvoices.find(
                      (inv) =>
                        inv.type === 'invoice' &&
                        (inv.work_order_id === selectedSpk.id || (selectedSpk.spk_number && inv.work_order_id === selectedSpk.spk_number))
                    );
                    if (existingInv) {
                      setSelectedInvoiceId(existingInv.id);
                    }
                    setIsOwnerEditMode(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Koreksi Nota &amp; Bayar Ulang</span>
                </button>
              )}
              <Link
                href={`/riwayat?search=${encodeURIComponent(selectedSpk.vehicle?.license_plate || selectedSpk.spk_number)}`}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition flex-shrink-0"
              >
                <span>Buka Nota di Arsip</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Warning Banner: Estimasi Belum Disetujui */}
        {selectedSpk && !isEstimationApproved && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm mt-3 animate-in fade-in duration-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-amber-900">
                  Estimasi Belum Disetujui Pelanggan
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  SPK ini memiliki estimasi biaya ({existingEstimation?.invoice_number || 'Estimasi'}) yang belum disetujui pelanggan. Sesuai ketentuan, estimasi yang belum disetujui tidak dapat diproses menjadi nota pembayaran resmi.
                </p>
              </div>
            </div>
            <Link
              href={`/estimasi?spkId=${selectedSpk.id}`}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition flex-shrink-0"
            >
              <span>Buka & Setujui Estimasi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Cols: Tambah Item Tambahan (Manual & Inventory) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <PlusCircle className="w-4 h-4 text-maroon-700" />
              <span>Input Item Tambahan</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Input barang / jasa jika servis melebihi atau di luar estimasi awal.
            </p>
          </div>

          {/* Mode Switcher: Manual vs Gudang */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveAddTab('manual')}
              className={`flex-1 py-1.5 rounded-lg transition text-center ${
                activeAddTab === 'manual'
                  ? 'bg-white text-maroon-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✍️ Input Manual
            </button>
            <button
              type="button"
              onClick={() => setActiveAddTab('inventory')}
              className={`flex-1 py-1.5 rounded-lg transition text-center ${
                activeAddTab === 'inventory'
                  ? 'bg-white text-maroon-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Dari Gudang ({inventory.length})
            </button>
          </div>

          {activeAddTab === 'manual' ? (
            <form onSubmit={handleAddCustomItem} className="space-y-3 pt-1">
              {/* Jenis: Part vs Jasa */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Kategori Item:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomItemType('part');
                      if (customItemUnit === 'JASA') setCustomItemUnit('PCS');
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition ${
                      customItemType === 'part'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>🔧 Barang / Part</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomItemType('service');
                      setCustomItemUnit('JASA');
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition ${
                      customItemType === 'service'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>🛠️ Jasa Servis</span>
                  </button>
                </div>
              </div>

              {/* Nama Item */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama {customItemType === 'service' ? 'Jasa Servis' : 'Barang / Sparepart'}:
                </label>
                <input
                  type="text"
                  placeholder={
                    customItemType === 'service'
                      ? 'Contoh: Jasa Bubut Piringan Rem...'
                      : 'Contoh: Busi Iridium, Oli Tambahan...'
                  }
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-maroon-600 font-medium"
                />
              </div>

              {/* Qty & Satuan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Jumlah (Qty):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Satuan:
                  </label>
                  <select
                    value={customItemUnit}
                    onChange={(e) => setCustomItemUnit(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white font-medium outline-none"
                  >
                    <option value="PCS">PCS</option>
                    <option value="SET">SET</option>
                    <option value="JASA">JASA</option>
                    <option value="LTR">LITER (LTR)</option>
                    <option value="BOTOL">BOTOL</option>
                    <option value="PAKET">PAKET</option>
                  </select>
                </div>
              </div>

              {/* Harga Satuan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Harga Satuan (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={customItemPrice}
                    onChange={(e) =>
                      setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold outline-none focus:ring-2 focus:ring-maroon-600"
                  />
                </div>
              </div>

              {/* Subtotal Preview */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Subtotal Item:</span>
                <span className="font-mono font-bold text-maroon-900">
                  {formatCurrency((Number(customItemQty) || 1) * (Number(customItemPrice) || 0))}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-maroon-700 hover:bg-maroon-800 active:scale-98 text-white font-bold p-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan ke Rincian Nota</span>
              </button>
            </form>
          ) : (
            <div className="space-y-3 pt-1">
              <input
                type="text"
                placeholder="Cari part / jasa gudang..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-medium"
              />

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {inventory
                  .filter(
                    (i) =>
                      i.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                      i.item_code.toLowerCase().includes(pickerSearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleAddItem(item)}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-maroon-200 hover:bg-maroon-50/30 transition cursor-pointer text-xs"
                    >
                      <div className="overflow-hidden mr-2">
                        <div className="font-bold text-slate-800 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.is_service ? 'Jasa' : `Stok: ${item.stock_qty}`}
                        </div>
                      </div>
                      <span className="font-bold font-mono text-slate-900 flex-shrink-0">
                        {formatCurrency(item.sell_price)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 8 Cols: Invoice Items & Payment Method */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                Rincian Item Nota ({items.length})
              </h3>
              {selectedSpk && existingEstimation && (
                <button
                  type="button"
                  onClick={handleResetFromEstimation}
                  title="Kembalikan rincian item persis seperti estimasi awal yang disetujui"
                  className="text-[10.5px] font-bold text-slate-500 hover:text-maroon-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition inline-flex items-center space-x-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Muat Ulang Estimasi Awal</span>
                </button>
              )}
            </div>
            {selectedSpk && (
              <span className="text-xs font-black text-maroon-900">
                {selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : ''} •{' '}
                {selectedSpk.vehicle?.customer_name}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[180px]">
            {items.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-slate-400 text-xs font-medium">
                Pilih SPK atau tambahkan item untuk membuat nota pembayaran.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                    <th className="p-2.5">Item Jasa / Part</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    <th className="p-2.5 w-32 text-right">Harga Satuan</th>
                    <th className="p-2.5 w-28 text-right">Subtotal</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-2.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-900 uppercase">{(item.name || '').toUpperCase()}</span>
                          {item.is_custom && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              TAMBAHAN
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1 uppercase mt-0.5">
                          <span
                            className={`px-1 rounded text-[9px] font-bold ${
                              item.is_service ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {item.is_service ? 'JASA' : 'PART'}
                          </span>
                          {item.code && <span>• {item.code}</span>}
                          {item.unit && <span>• {item.unit}</span>}
                        </div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                          className="w-12 text-center p-1 rounded border border-slate-200 font-mono font-bold focus:ring-1 focus:ring-maroon-600 outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-slate-400 text-[10px]">Rp</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.price}
                            onChange={(e) => handleUpdatePrice(idx, Number(e.target.value))}
                            className="w-24 text-right p-1 rounded border border-slate-200 font-mono font-bold text-slate-800 focus:ring-1 focus:ring-maroon-600 outline-none"
                            title="Ubah harga satuan jika perlu penyesuaian"
                          />
                        </div>
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 transition"
                          title="Hapus item dari nota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Payment Method & Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Left: Payment Method Selection */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-800 uppercase tracking-wider">
                Metode Pembayaran:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: '💵 Tunai (Cash)', desc: 'Tunai di kasir' },
                  { id: 'transfer_bca', label: '🏦 Transfer BCA', desc: 'BCA 2711235398 ARDIYANTO WIJAYA' },
                  { id: 'transfer_bri', label: '🏦 Transfer BRI', desc: 'BRI 0086-0113-1974-508 ARDIYANTO WIJAYA' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      paymentMethod === pm.id
                        ? 'bg-maroon-700 text-white border-maroon-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{pm.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        paymentMethod === pm.id ? 'text-maroon-100' : 'text-slate-400'
                      }`}
                    >
                      {pm.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Catatan Tambahan Nota:</label>
                <input
                  type="text"
                  placeholder="Contoh: Lunas via Transfer BCA / BRI / Pembayaran tunai..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                />
              </div>

              {/* Jadwal Follow Up CRM (Langsung di Kasir) */}
              <div className="pt-2.5 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-maroon-700" />
                    <span>Jadwal Follow-Up CRM (Opsional):</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Pilih 1 jadwal</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { id: 'none', label: 'Tanpa', desc: 'Dilewati' },
                    { id: '1_week', label: '1 Mgg', desc: '+7 hari' },
                    { id: '2_weeks', label: '2 Mgg', desc: '+14 hari' },
                    { id: '1_month', label: '1 Bln', desc: '+30 hari' },
                    { id: '3_months', label: '3 Bln', desc: '+90 hari' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCrmFollowupPeriod(opt.id as CRMReminderPeriod)}
                      className={`p-1.5 rounded-lg border transition ${
                        crmFollowupPeriod === opt.id
                          ? 'bg-maroon-700 text-white border-maroon-800 font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="text-[11px]">{opt.label}</div>
                      <div className={`text-[9px] ${crmFollowupPeriod === opt.id ? 'text-maroon-100' : 'text-slate-400'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Calculations */}
            <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Subtotal:</span>
                <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
              </div>

              {currentRole === 'owner' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Diskon (Rp):</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-24 text-right p-1 rounded border border-slate-200 font-mono bg-white font-bold"
                  />
                </div>
              )}

              <div className="border-t-2 border-slate-300 pt-2 flex justify-between text-sm font-black text-maroon-900">
                <span>Total Tagihan:</span>
                <span className="font-mono text-base">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-800">
                <span>Metode Terpilih:</span>
                <span className="uppercase text-maroon-800">{paymentMethod.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Cashier Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            {isAlreadyFinished && selectedSpk && (
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Mobil Selesai &amp; Lunas — Nota Terkunci</span>
              </span>
            )}
            {!isEstimationApproved && selectedSpk && !isAlreadyFinished && (
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Estimasi belum disetujui — Penagihan terkunci</span>
              </span>
            )}
            <button
              type="button"
              onClick={openSignAndReviewModal}
              disabled={!selectedSpk || items.length === 0 || !isEstimationApproved || isAlreadyFinished}
              className="inline-flex items-center space-x-2 bg-maroon-800 hover:bg-maroon-900 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PenTool className="w-4 h-4 text-amber-300" />
              <span>Pratinjau Nota &amp; Tanda Tangan (Customer &amp; Admin)</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: REVIEW NOTA & DUAL SIGNATURE BEFORE SETTLEMENT */}
      {isSignModalOpen && selectedSpk && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-maroon-800">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-6 h-6 text-maroon-800" />
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Konfirmasi & Penandatanganan Nota Servis
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Tunjukkan rincian kepada customer sebelum pelunasan dan bubuhkan tanda tangan digital.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vehicle & Customer Summary */}
            <div className="grid grid-cols-2 gap-4 bg-maroon-50/40 p-4 rounded-xl border border-maroon-200 text-xs">
              <div>
                <span className="text-slate-500 font-semibold">Pelanggan:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedSpk.vehicle?.customer_name}</div>
                <div className="text-slate-600">{selectedSpk.vehicle?.phone_number}</div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-semibold">Kendaraan:</span>
                <div className="font-black text-maroon-900 text-sm">
                  {selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : '-'}
                </div>
                <div className="text-slate-700 font-medium">
                  {selectedSpk.vehicle?.car_brand} {selectedSpk.vehicle?.car_model}
                </div>
              </div>
            </div>

            {/* Items Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2">Item Jasa / Part</th>
                    <th className="p-2 w-16 text-center">Qty</th>
                    <th className="p-2 w-28 text-right">Harga</th>
                    <th className="p-2 w-32 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-semibold text-slate-800 uppercase">
                        <div className="flex items-center space-x-1.5">
                          <span>{(item.name || '').toUpperCase()}</span>
                          {item.is_custom && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              TAMBAHAN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center font-mono">{item.qty}</td>
                      <td className="p-2 text-right font-mono text-slate-600">{formatCurrency(item.price)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 flex justify-between items-center font-black text-sm text-maroon-900 border-t border-slate-200">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    Metode Bayar:{' '}
                    {paymentMethod === 'transfer_bri'
                      ? '🏦 Transfer Bank BRI (0086-0113-1974-508)'
                      : paymentMethod === 'transfer_bca'
                      ? '🏦 Transfer Bank BCA (2711235398)'
                      : '💵 Tunai (Cash)'}
                  </div>
                  <span>TOTAL YANG HARUS DIBAYAR:</span>
                </div>
                <span className="font-mono text-base">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* OPSI JADWAL FOLLOW UP CRM */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-maroon-700" />
                  <span>Jadwal Follow-up CRM Pelanggan (Opsional):</span>
                </label>
                <span className="text-[10.5px] text-slate-500 font-medium">Bisa diubah kapan saja di menu CRM</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { id: 'none', label: 'Tanpa Follow Up', desc: 'Tidak wajib / Dilewati' },
                  { id: '1_week', label: '1 Minggu', desc: 'Kepuasan awal' },
                  { id: '2_weeks', label: '2 Minggu', desc: 'Performa mesin/AC' },
                  { id: '1_month', label: '1 Bulan', desc: 'Garansi servis' },
                  { id: '3_months', label: '3 Bulan', desc: 'Servis berkala / Oli' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCrmFollowupPeriod(opt.id as CRMReminderPeriod)}
                    className={`p-2 rounded-xl border text-left transition ${
                      crmFollowupPeriod === opt.id
                        ? 'bg-maroon-700 text-white border-maroon-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className={`text-[10px] mt-0.5 ${crmFollowupPeriod === opt.id ? 'text-maroon-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* DUAL DIGITAL SIGNATURE CANVASES */}
            <div className="space-y-2">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">
                Pengesahan & Tanda Tangan Digital (Customer & Admin)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* TTD 1: Pelanggan */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="block font-bold text-xs text-maroon-900 uppercase">
                    1. Tanda Tangan Pelanggan / Pembayar
                  </span>
                  <SignatureCanvas onSave={(url) => setSignatureCustomer(url)} />
                  <p className="text-[10px] text-slate-400 text-center">
                    Tanda tangan oleh: {selectedSpk.vehicle?.customer_name}
                  </p>
                </div>

                {/* TTD 2: Admin */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="block font-bold text-xs text-maroon-900 uppercase">
                    2. Tanda Tangan Admin / Kasir
                  </span>
                  <SignatureCanvas onSave={(url) => setSignatureAdmin(url)} />
                  <p className="text-[10px] text-slate-400 text-center">
                    Tanda tangan oleh: Mey Wulandari (Admin Kasir)
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Settlement Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                Kembali Edit Item
              </button>

              <button
                type="button"
                onClick={() => handleProcessPayment('pending')}
                disabled={isProcessing || !isEstimationApproved}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 transition disabled:opacity-50"
              >
                Simpan Sebagai Pending
              </button>

              <button
                type="button"
                onClick={() => handleProcessPayment('paid')}
                disabled={isProcessing || !isEstimationApproved}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'Menyimpan ke Cloud...' : 'Tanda Tangani & Lunaskan Pembayaran'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* MODAL 2: PRINTABLE FINAL INVOICE */}
      {savedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <PrintableInvoice
              invoice={savedInvoice}
              settings={settings}
              onClose={() => setSavedInvoice(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashierPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat modul kasir...</div>}>
      <CashierContent />
    </Suspense>
  );
}
