'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import {
  Invoice,
  InvoiceItem,
  PaymentMethod,
  PaymentStatus,
  WorkOrder,
  InventoryItem,
} from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
  generateInvoiceNumber,
} from '@/lib/utils';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Printer,
  Share2,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  Search,
  DollarSign,
  AlertCircle,
  Building,
  PenTool,
  Eye,
  X,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PrintableInvoice } from '@/components/ui/PrintableInvoice';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';

function CashierContent() {
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');

  const { workOrders, inventory, invoices, refreshData, showToast, settings, currentRole } = useApp();

  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Item Picker
  const [pickerSearch, setPickerSearch] = useState<string>('');

  // Dual Signatures (Customer & Admin)
  const [signatureCustomer, setSignatureCustomer] = useState<string>('');
  const [signatureAdmin, setSignatureAdmin] = useState<string>('');

  // Review & Signing Modal before settlement
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);

  // Final invoice preview modal after settlement
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Load from SPK or Estimation
  useEffect(() => {
    if (selectedSpkId && workOrders.length > 0) {
      const found = workOrders.find((w) => w.id === selectedSpkId);
      if (found) {
        setSelectedSpk(found);

        // Check if there is an estimation for this SPK
        const est = invoices.find(
          (inv) => inv.type === 'estimation' && inv.work_order_id === found.id
        );
        if (est) {
          setItems(est.items);
          setDiscountAmount(est.discount_amount || 0);
          setTaxPercent(est.tax_percent || 0);
        } else {
          setItems([]);
        }
      }
    }
  }, [selectedSpkId, workOrders, invoices]);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);
  const balanceDue = Math.max(0, totalAmount - downPayment);

  const handleAddItem = (item: InventoryItem) => {
    const existingIndex = items.findIndex((i) => i.item_id === item.id);
    if (existingIndex !== -1) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].price;
      setItems(updated);
    } else {
      const newItem: InvoiceItem = {
        item_id: item.id,
        code: item.item_code,
        name: item.name,
        is_service: item.is_service,
        qty: 1,
        price: item.sell_price,
        buy_price: item.buy_price,
        subtotal: item.sell_price,
      };
      setItems([...items, newItem]);
    }
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index].qty = qty;
    updated[index].subtotal = qty * updated[index].price;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const openSignAndReviewModal = () => {
    if (!selectedSpk) {
      showToast('Pilih SPK kendaraan terlebih dahulu.', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Tambahkan minimal 1 item untuk penagihan.', 'error');
      return;
    }
    setIsSignModalOpen(true);
  };

  const handleProcessPayment = (status: PaymentStatus) => {
    if (!selectedSpk) {
      showToast('Pilih SPK terlebih dahulu.', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Tambahkan minimal 1 item untuk penagihan.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const invoiceNumber = generateInvoiceNumber('invoice');
      const newInvoice = DBService.saveInvoice({
        invoice_number: invoiceNumber,
        type: 'invoice',
        work_order_id: selectedSpk.id,
        vehicle_id: selectedSpk.vehicle_id,
        items,
        subtotal,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        down_payment: status === 'paid' ? totalAmount : downPayment,
        balance_due: status === 'paid' ? 0 : balanceDue,
        payment_status: status,
        payment_method: paymentMethod,
        paid_at: status === 'paid' ? new Date().toISOString() : undefined,
        admin_notes: adminNotes,
        signature_customer_url: signatureCustomer,
        signature_admin_url: signatureAdmin,
        created_at: new Date().toISOString(),
      });

      // Trigger Confetti if paid
      if (status === 'paid') {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#800000', '#059669', '#F59E0B'],
        });
      }

      refreshData();
      setIsSignModalOpen(false);
      showToast(
        status === 'paid'
          ? `Pembayaran Nota ${invoiceNumber} LUNAS & Ditandatangani!`
          : `Nota ${invoiceNumber} disimpan (Pending).`,
        'success'
      );
      setSavedInvoice(newInvoice);
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses nota pembayaran.', 'error');
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
            <span>Kasir & Pembuatan Nota Servis (Invoicing)</span>
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
          value={selectedSpkId}
          onChange={(e) => setSelectedSpkId(e.target.value)}
          className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold"
        >
          <option value="">-- Pilih SPK / Kendaraan --</option>
          {workOrders.map((wo) => (
            <option key={wo.id} value={wo.id}>
              {wo.spk_number} • {wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''} •{' '}
              {wo.vehicle?.customer_name} ({wo.vehicle?.car_brand} {wo.vehicle?.car_model}) - Status: {wo.status}
            </option>
          ))}
        </select>
      </div>

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Cols: Quick Add Item */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-3">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
            Tambah Item Manual / Part
          </h3>
          <input
            type="text"
            placeholder="Cari part / jasa tambahan..."
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

        {/* Right 8 Cols: Invoice Items & Payment Method */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
              Rincian Item Nota ({items.length})
            </h3>
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
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    <th className="p-2.5 w-24 text-right">Harga</th>
                    <th className="p-2.5 w-28 text-right">Subtotal</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                          className="w-12 text-center p-1 rounded border border-slate-200 font-mono font-bold"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700 font-medium">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 transition"
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

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'cash', label: '💵 Tunai (Cash)' },
                  { id: 'qris', label: '📱 QRIS Instant' },
                  { id: 'transfer_bca', label: '🏦 Transfer BCA' },
                  { id: 'transfer_mandiri', label: '🏦 Transfer Mandiri' },
                  { id: 'debit_card', label: '💳 Kartu Debit' },
                  { id: 'credit_card', label: '💳 Kartu Kredit' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                    className={`p-2 rounded-lg text-[11px] font-bold border text-left transition ${
                      paymentMethod === pm.id
                        ? 'bg-maroon-700 text-white border-maroon-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Catatan Tambahan Nota:</label>
                <input
                  type="text"
                  placeholder="Contoh: Lunas via QRIS / Pembayaran bertahap..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                />
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
            <button
              type="button"
              onClick={openSignAndReviewModal}
              disabled={!selectedSpk || items.length === 0}
              className="inline-flex items-center space-x-2 bg-maroon-800 hover:bg-maroon-900 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <PenTool className="w-4 h-4 text-amber-300" />
              <span>Pratinjau Nota & Tanda Tangan (Customer & Admin)</span>
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
                      <td className="p-2 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-2 text-center font-mono">{item.qty}</td>
                      <td className="p-2 text-right font-mono text-slate-600">{formatCurrency(item.price)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 flex justify-between items-center font-black text-sm text-maroon-900 border-t border-slate-200">
                <span>TOTAL YANG HARUS DIBAYAR:</span>
                <span className="font-mono text-base">{formatCurrency(totalAmount)}</span>
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
                    Tanda tangan oleh: Siti Rahmawati (Admin Kasir)
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
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 transition"
              >
                Simpan Sebagai Pending
              </button>

              <button
                type="button"
                onClick={() => handleProcessPayment('paid')}
                disabled={isProcessing}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'Memproses...' : 'Tanda Tangani & Lunaskan Pembayaran'}</span>
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
