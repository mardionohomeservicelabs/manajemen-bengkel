'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { Invoice, InvoiceItem, InventoryItem, WorkOrder } from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
  generateInvoiceNumber,
} from '@/lib/utils';
import {
  Calculator,
  Plus,
  Trash2,
  Share2,
  Printer,
  FileCheck,
  CheckCircle2,
  Lock,
  Edit3,
  Car,
  DollarSign,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';

function EstimationBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');

  const { workOrders, inventory, invoices, refreshData, showToast, settings, currentRole } = useApp();

  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');
  const [selectedSpk, setSelectedSpk] = useState<WorkOrder | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Item Picker Mode: 'catalog' vs 'custom'
  const [itemSourceTab, setItemSourceTab] = useState<'catalog' | 'custom'>('catalog');
  const [pickerCategory, setPickerCategory] = useState<string>('all');
  const [pickerSearch, setPickerSearch] = useState<string>('');

  // Custom Item Form State (On-The-Fly)
  const [customItemName, setCustomItemName] = useState('');
  const [customItemIsService, setCustomItemIsService] = useState(true);
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemPrice, setCustomItemPrice] = useState<number>(150000);

  const [savedEstimation, setSavedEstimation] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedSpkId && workOrders.length > 0) {
      const found = workOrders.find((w) => w.id === selectedSpkId);
      if (found) {
        setSelectedSpk(found);
        const existingEst = invoices.find(
          (inv) => inv.type === 'estimation' && inv.work_order_id === found.id
        );
        if (existingEst) {
          setItems(existingEst.items);
          setDiscountAmount(existingEst.discount_amount || 0);
          setTaxPercent(existingEst.tax_percent || 0);
          setAdminNotes(existingEst.admin_notes || '');
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

  const handleAddItemFromCatalog = (inventoryItem: InventoryItem) => {
    const existingIndex = items.findIndex((i) => i.item_id === inventoryItem.id);
    if (existingIndex !== -1) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].price;
      setItems(updated);
    } else {
      const newItem: InvoiceItem = {
        item_id: inventoryItem.id,
        code: inventoryItem.item_code,
        name: inventoryItem.name,
        is_service: inventoryItem.is_service,
        is_custom: false,
        qty: 1,
        price: inventoryItem.sell_price,
        buy_price: inventoryItem.buy_price,
        subtotal: inventoryItem.sell_price,
      };
      setItems([...items, newItem]);
    }
    showToast(`Ditambahkan: ${inventoryItem.name}`, 'info');
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) {
      showToast('Nama jasa atau barang kustom wajib diisi.', 'error');
      return;
    }

    const newItem: InvoiceItem = {
      name: customItemName.trim(),
      is_service: customItemIsService,
      is_custom: true,
      qty: Number(customItemQty),
      price: Number(customItemPrice),
      subtotal: Number(customItemQty) * Number(customItemPrice),
    };

    setItems([...items, newItem]);
    showToast(`Jasa/Part kustom "${customItemName}" berhasil ditambahkan!`, 'success');

    // Reset custom form
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice(100000);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index].qty = qty;
    updated[index].subtotal = qty * updated[index].price;
    setItems(updated);
  };

  const handleUpdatePrice = (index: number, newPrice: number) => {
    if (currentRole !== 'owner' && !items[index].is_custom) return;
    const price = Math.max(0, newPrice);
    const updated = [...items];
    updated[index].price = price;
    updated[index].subtotal = updated[index].qty * price;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSaveEstimation = () => {
    if (!selectedSpk) {
      showToast('Pilih SPK kendaraan terlebih dahulu.', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Tambahkan minimal 1 item jasa atau sparepart.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const existingEst = invoices.find(
        (inv) => inv.type === 'estimation' && inv.work_order_id === selectedSpk.id
      );

      const estNumber = existingEst ? existingEst.invoice_number : generateInvoiceNumber('estimation');

      const saved = DBService.saveInvoice({
        id: existingEst?.id,
        invoice_number: estNumber,
        type: 'estimation',
        work_order_id: selectedSpk.id,
        vehicle_id: selectedSpk.vehicle_id,
        items,
        subtotal,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        down_payment: 0,
        balance_due: totalAmount,
        payment_status: 'pending',
        admin_notes: adminNotes,
        created_at: existingEst?.created_at || new Date().toISOString(),
      });

      DBService.updateWorkOrderStatus(selectedSpk.id, 'estimating', currentRole);
      refreshData();
      showToast(`Estimasi ${estNumber} berhasil disimpan!`, 'success');
      setSavedEstimation(saved);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan estimasi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndProceedToServicing = () => {
    if (!selectedSpk) return;
    DBService.updateWorkOrderStatus(selectedSpk.id, 'servicing', currentRole);
    refreshData();
    showToast('Estimasi disetujui! SPK dipindahkan ke Dalam Pengerjaan.', 'success');
    router.push('/antrean');
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesCat = pickerCategory === 'all' || item.category === pickerCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      item.item_code.toLowerCase().includes(pickerSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div>
      <div className="no-print space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Calculator className="w-6 h-6 text-maroon-700" />
            <span>Kalkulator Estimasi Biaya & Persetujuan Pelanggan</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pilih dari katalog inventaris atau buat jasa/barang kustom baru langsung on-the-fly.
          </p>
        </div>

        {currentRole === 'admin' && (
          <div className="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200">
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>Role Admin: Harga Satuan Katalog Terkunci</span>
          </div>
        )}
      </div>

      {/* Select SPK Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
        <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
          Pilih SPK Kendaraan untuk Estimasi:
        </label>
        <select
          value={selectedSpkId}
          onChange={(e) => setSelectedSpkId(e.target.value)}
          className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold"
        >
          <option value="">-- Pilih SPK Aktif --</option>
          {workOrders.map((wo) => (
            <option key={wo.id} value={wo.id}>
              {wo.spk_number} • {wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''} •{' '}
              {wo.vehicle?.customer_name} ({wo.vehicle?.car_brand} {wo.vehicle?.car_model}) - Status: {wo.status}
            </option>
          ))}
        </select>

        {selectedSpk && (
          <div className="mt-4 p-3.5 bg-maroon-50/40 rounded-xl border border-maroon-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 font-medium">Pelanggan & Mobil:</span>
              <div className="font-bold text-slate-900">
                {selectedSpk.vehicle?.customer_name} ({selectedSpk.vehicle?.phone_number})
              </div>
              <div className="text-maroon-900 font-black text-sm">
                {selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : '-'} •{' '}
                {selectedSpk.vehicle?.car_brand} {selectedSpk.vehicle?.car_model}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 font-medium">Keluhan Masuk:</span>
              <p className="text-slate-800 font-medium italic mt-0.5 line-clamp-2">
                "{selectedSpk.complaints}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Item & Service Selector (Catalog + Custom On-The-Fly) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setItemSourceTab('catalog')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                itemSourceTab === 'catalog'
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Katalog Inventaris ({filteredInventory.length})
            </button>
            <button
              type="button"
              onClick={() => setItemSourceTab('custom')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${
                itemSourceTab === 'custom'
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Jasa / Part Kustom
            </button>
          </div>

          {/* TAB 1: FROM INVENTORY */}
          {itemSourceTab === 'catalog' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Cari sparepart / jasa katalog..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-medium"
              />

              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'jasa', label: 'Jasa Servis' },
                  { id: 'oli_cairan', label: 'Oli & Cairan' },
                  { id: 'ac_parts', label: 'Part AC' },
                  { id: 'filter', label: 'Filter' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setPickerCategory(c.id)}
                    className={`text-[10.5px] px-2.5 py-1 rounded-lg font-semibold transition ${
                      pickerCategory === c.id
                        ? 'bg-maroon-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItemFromCatalog(item)}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-maroon-300 bg-slate-50/50 hover:bg-maroon-50/40 transition cursor-pointer group"
                  >
                    <div className="overflow-hidden mr-2">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-maroon-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.item_code} • {item.is_service ? 'Jasa' : `Stok: ${item.stock_qty}`}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="font-black text-xs font-mono text-slate-900">
                        {formatCurrency(item.sell_price)}
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-maroon-100 text-maroon-700 flex items-center justify-center group-hover:bg-maroon-700 group-hover:text-white transition">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM ON-THE-FLY FORM */}
          {itemSourceTab === 'custom' && (
            <form onSubmit={handleAddCustomItem} className="space-y-3 p-3 bg-maroon-50/30 rounded-xl border border-maroon-200 text-xs">
              <div className="font-bold text-maroon-900 text-xs">
                Buat Jasa / Suku Cadang Kustom (On-The-Fly)
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Item ini akan langsung masuk ke estimasi tanpa harus didaftarkan ke master inventaris.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Jasa / Barang Kustom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jasa Bubut Piringan Rem / Part Khusus..."
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Item</label>
                  <select
                    value={customItemIsService ? 'jasa' : 'part'}
                    onChange={(e) => setCustomItemIsService(e.target.value === 'jasa')}
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  >
                    <option value="jasa">🛠️ Jasa / Labor</option>
                    <option value="part">📦 Suku Cadang / Part</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Harga Satuan (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold text-sm text-maroon-900"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white font-bold py-2 rounded-xl transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Masukkan ke Estimasi</span>
              </button>
            </form>
          )}
        </div>

        {/* Right 7 Cols: Estimation Table & Totals */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
              Rincian Item Estimasi ({items.length})
            </h3>
            {selectedSpk && (
              <span className="text-xs font-mono text-maroon-900 font-black">
                SPK: {selectedSpk.spk_number}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[220px]">
            {items.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Calculator className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-bold">Belum ada item estimasi.</p>
                <p className="text-[10px]">Pilih dari katalog atau buat item kustom di sebelah kiri.</p>
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
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.is_custom ? (
                            <span className="text-maroon-700 font-semibold">[Kustom On-The-Fly]</span>
                          ) : (
                            item.code
                          )}
                        </div>
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
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                        {currentRole === 'owner' || item.is_custom ? (
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdatePrice(idx, Number(e.target.value))}
                            className="w-20 text-right p-1 rounded border border-slate-200 font-mono"
                          />
                        ) : (
                          formatCurrency(item.price)
                        )}
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

          {/* Discount and Summary */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Subtotal Item:</span>
              <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
            </div>

            {currentRole === 'owner' && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Diskon Khusus (Rp):</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-28 text-right p-1 rounded border border-slate-200 font-mono bg-white font-bold"
                />
              </div>
            )}

            <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-maroon-900">
              <span>Total Estimasi Biaya:</span>
              <span className="font-mono text-base">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              onClick={handleSaveEstimation}
              disabled={isSaving || !selectedSpk}
              className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>Simpan & Terbitkan Estimasi</span>
            </button>

            {selectedSpk && (
              <button
                onClick={handleApproveAndProceedToServicing}
                className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Pelanggan Setuju → Mulai Servis</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Modal Preview Printable Estimation */}
      {savedEstimation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
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
