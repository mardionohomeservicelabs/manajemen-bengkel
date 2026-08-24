'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { Invoice, InvoiceItem, InventoryItem, WorkOrder } from '@/lib/types/database';
import { formatCurrency, formatPlate, generateInvoiceNumber, parseNumericPrice } from '@/lib/utils';
import { Calculator, Plus, Trash2, FileCheck, CheckCircle2, Lock } from 'lucide-react';
import { PrintableEstimation } from '@/components/ui/PrintableEstimation';

function genGroupId(): string { return Math.random().toString(36).slice(2, 10); }
function resolveMin(item: InvoiceItem): number { return item.price_min !== undefined ? item.price_min : parseNumericPrice(item.price); }
function resolveMax(item: InvoiceItem): number { return item.price_max !== undefined ? item.price_max : (item.price_min !== undefined ? item.price_min : parseNumericPrice(item.price)); }
function formatRange(min: number, max: number): string { return min === max ? formatCurrency(min) : formatCurrency(min) + ' - ' + formatCurrency(max); }
function isTextPrice(item: InvoiceItem): boolean { return typeof item.price === 'string' && /[a-zA-Z]/.test(item.price) && item.price_min === undefined; }
function isActiveForTotal(item: InvoiceItem): boolean { return !item.option_group || item.is_active_option === true; }

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
  const [itemSourceTab, setItemSourceTab] = useState<'catalog' | 'custom'>('catalog');
  const [pickerCategory, setPickerCategory] = useState<string>('all');
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemIsService, setCustomItemIsService] = useState(true);
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemPriceMin, setCustomItemPriceMin] = useState<string>('');
  const [customItemPriceMax, setCustomItemPriceMax] = useState<string>('');
  const [savedEstimation, setSavedEstimation] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedSpkId && workOrders.length > 0) {
      const found = workOrders.find((w) => w.id === selectedSpkId);
      if (found) {
        setSelectedSpk(found);
        const existingEst = invoices.find((inv) => inv.type === 'estimation' && inv.work_order_id === found.id);
        if (existingEst) {
          const normalized = existingEst.items.map((it) => {
            if (it.price_min === undefined) {
              const p = parseNumericPrice(it.price);
              return { ...it, price_min: p, price_max: it.price_max ?? p, subtotal_min: it.qty * p, subtotal_max: it.qty * p };
            }
            return it;
          });
          setItems(normalized);
          setDiscountAmount(existingEst.discount_amount || 0);
          setTaxPercent(existingEst.tax_percent || 0);
          setAdminNotes(existingEst.admin_notes || '');
        } else { setItems([]); }
      }
    }
  }, [selectedSpkId, workOrders, invoices]);

  const activeItems = items.filter(isActiveForTotal);
  const totalMin = activeItems.reduce((sum, item) => isTextPrice(item) ? sum : sum + (item.subtotal_min ?? resolveMin(item) * item.qty), 0);
  const totalMax = activeItems.reduce((sum, item) => isTextPrice(item) ? sum : sum + (item.subtotal_max ?? resolveMax(item) * item.qty), 0);
  const subtotal = activeItems.reduce((sum, item) => sum + parseNumericPrice(item.subtotal), 0);
  const taxAmount = (totalMin - discountAmount) * (taxPercent / 100);
  const totalAmount = Math.max(0, totalMin - discountAmount + taxAmount);

  const handleAddItemFromCatalog = (inventoryItem: InventoryItem) => {
    const existingIndex = items.findIndex((i) => i.item_id === inventoryItem.id && !i.option_group);
    if (existingIndex !== -1) {
      const updated = [...items];
      const it = updated[existingIndex];
      it.qty += 1;
      const min = resolveMin(it); const max = resolveMax(it);
      it.price_min = min; it.price_max = max;
      it.subtotal_min = it.qty * min; it.subtotal_max = it.qty * max; it.subtotal = it.subtotal_min;
      setItems(updated);
    } else {
      const p = inventoryItem.sell_price;
      const newItem: InvoiceItem = { item_id: inventoryItem.id, code: inventoryItem.item_code, name: inventoryItem.name, is_service: inventoryItem.is_service, is_custom: false, qty: 1, price: p, buy_price: inventoryItem.buy_price, subtotal: p, price_min: p, price_max: p, subtotal_min: p, subtotal_max: p };
      setItems([...items, newItem]);
    }
    showToast('Ditambahkan: ' + inventoryItem.name, 'info');
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) { showToast('Nama wajib diisi.', 'error'); return; }
    const minRaw = customItemPriceMin.trim();
    const maxRaw = customItemPriceMax.trim();
    const isText = /[a-zA-Z]/.test(minRaw);
    let newItem: InvoiceItem;
    if (isText || !minRaw) {
      const textVal = minRaw || 'Menyesuaikan';
      newItem = { name: customItemName.trim(), is_service: customItemIsService, is_custom: true, qty: Number(customItemQty), price: textVal, subtotal: textVal };
    } else {
      const minNum = parseNumericPrice(minRaw);
      const maxNum = maxRaw && !(/[a-zA-Z]/.test(maxRaw)) ? parseNumericPrice(maxRaw) : minNum;
      const effectiveMax = Math.max(minNum, maxNum);
      newItem = { name: customItemName.trim(), is_service: customItemIsService, is_custom: true, qty: Number(customItemQty), price: minNum, subtotal: Number(customItemQty) * minNum, price_min: minNum, price_max: effectiveMax, subtotal_min: Number(customItemQty) * minNum, subtotal_max: Number(customItemQty) * effectiveMax };
    }
    setItems([...items, newItem]);
    showToast(customItemName + ' ditambahkan!', 'success');
    setCustomItemName(''); setCustomItemQty(1); setCustomItemPriceMin(''); setCustomItemPriceMax('');
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    const it = updated[index];
    it.qty = qty;
    if (!isTextPrice(it)) { it.subtotal_min = qty * resolveMin(it); it.subtotal_max = qty * resolveMax(it); it.subtotal = it.subtotal_min; }
    if (it.option_group) {
      updated.forEach((s, i) => {
        if (i !== index && s.option_group === it.option_group) {
          s.qty = qty;
          if (!isTextPrice(s)) { s.subtotal_min = qty * resolveMin(s); s.subtotal_max = qty * resolveMax(s); s.subtotal = s.subtotal_min; }
        }
      });
    }
    setItems(updated);
  };

  const handleUpdatePriceRange = (index: number, field: 'min' | 'max', rawValue: string) => {
    const updated = [...items];
    const it = updated[index];
    const num = parseNumericPrice(rawValue);
    if (field === 'min') { it.price_min = num; it.price = num; } else { it.price_max = num; }
    const min = it.price_min ?? parseNumericPrice(it.price);
    const max = it.price_max ?? min;
    it.subtotal_min = it.qty * min; it.subtotal_max = it.qty * max; it.subtotal = it.subtotal_min;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const target = items[index];
    if (target.option_group) { setItems(items.filter((it) => it.option_group !== target.option_group)); }
    else { setItems(items.filter((_, idx) => idx !== index)); }
  };

  const handleRemoveSingleOption = (index: number) => {
    const target = items[index];
    if (!target.option_group) return handleRemoveItem(index);
    const updated = items.filter((_, idx) => idx !== index);
    if (target.is_active_option) { const first = updated.find((it) => it.option_group === target.option_group); if (first) first.is_active_option = true; }
    const remaining = updated.filter((it) => it.option_group === target.option_group);
    if (remaining.length === 1) { remaining[0].option_group = undefined; remaining[0].option_label = undefined; remaining[0].is_active_option = undefined; }
    setItems(updated);
  };

  const handleAddOption = (index: number) => {
    const source = items[index];
    const groupId = source.option_group || genGroupId();
    const updated = [...items];
    updated[index] = { ...source, option_group: groupId, option_label: 'opsi1', is_active_option: true };
    const opsi2: InvoiceItem = { ...source, name: source.name + ' (Opsi 2)', is_custom: true, option_group: groupId, option_label: 'opsi2', is_active_option: false };
    updated.splice(index + 1, 0, opsi2);
    setItems(updated);
    showToast('Opsi 2 ditambahkan. Isi detail harga Opsi 2.', 'info');
  };

  const handleToggleActiveOption = (groupId: string, selectedLabel: 'opsi1' | 'opsi2') => {
    setItems((prev) => prev.map((it) => { if (it.option_group !== groupId) return it; return { ...it, is_active_option: it.option_label === selectedLabel }; }));
  };

  const handleSaveEstimation = () => {
    if (!selectedSpk) { showToast('Pilih SPK kendaraan terlebih dahulu.', 'error'); return; }
    if (items.length === 0) { showToast('Tambahkan minimal 1 item.', 'error'); return; }
    setIsSaving(true);
    try {
      const existingEst = invoices.find((inv) => inv.type === 'estimation' && inv.work_order_id === selectedSpk.id);
      const estNumber = existingEst ? existingEst.invoice_number : generateInvoiceNumber('estimation');
      const saved = DBService.saveInvoice({ id: existingEst?.id, invoice_number: estNumber, type: 'estimation', work_order_id: selectedSpk.id, vehicle_id: selectedSpk.vehicle_id, items, subtotal, discount_amount: discountAmount, tax_percent: taxPercent, tax_amount: taxAmount, total_amount: totalAmount, down_payment: 0, balance_due: totalAmount, payment_status: 'pending', admin_notes: adminNotes, created_at: existingEst?.created_at || new Date().toISOString() });
      DBService.updateWorkOrderStatus(selectedSpk.id, 'estimating', currentRole);
      refreshData(); showToast('Estimasi ' + estNumber + ' berhasil disimpan!', 'success'); setSavedEstimation(saved);
    } catch (err) { console.error(err); showToast('Gagal menyimpan estimasi.', 'error'); } finally { setIsSaving(false); }
  };

  const handleApproveAndProceedToServicing = () => {
    if (!selectedSpk) return;
    DBService.updateWorkOrderStatus(selectedSpk.id, 'servicing', currentRole);
    refreshData(); showToast('Estimasi disetujui! SPK dipindahkan ke Dalam Pengerjaan.', 'success'); router.push('/antrean');
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesCat = pickerCategory === 'all' || item.category === pickerCategory;
    const matchesSearch = item.name.toLowerCase().includes(pickerSearch.toLowerCase()) || item.item_code.toLowerCase().includes(pickerSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div>
      <div className="no-print space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Calculator className="w-6 h-6 text-maroon-700" />
              <span>Kalkulator Estimasi Biaya &amp; Persetujuan Pelanggan</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Dukung rentang harga Min-Maks dan Opsi 1 / Opsi 2 untuk alternatif spare part.</p>
          </div>
          {currentRole === 'admin' && (
            <div className="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-700" /><span>Role Admin: Harga Satuan Katalog Terkunci</span>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Pilih SPK Kendaraan untuk Estimasi:</label>
          <select value={selectedSpkId} onChange={(e) => setSelectedSpkId(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold">
            <option value="">-- Pilih SPK Aktif --</option>
            {workOrders.map((wo) => (<option key={wo.id} value={wo.id}>{wo.spk_number} - {wo.vehicle?.customer_name} ({wo.vehicle?.car_brand} {wo.vehicle?.car_model})</option>))}
          </select>
          {selectedSpk && (
            <div className="mt-4 p-3.5 bg-maroon-50/40 rounded-xl border border-maroon-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 font-medium">Pelanggan &amp; Mobil:</span>
                <div className="font-bold text-slate-900">{selectedSpk.vehicle?.customer_name} ({selectedSpk.vehicle?.phone_number})</div>
                <div className="text-maroon-900 font-black text-sm">{selectedSpk.vehicle?.license_plate ? formatPlate(selectedSpk.vehicle.license_plate) : '-'} - {selectedSpk.vehicle?.car_brand} {selectedSpk.vehicle?.car_model}</div>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 font-medium">Keluhan Masuk:</span>
                <p className="text-slate-800 font-medium italic mt-0.5 line-clamp-2">&quot;{selectedSpk.complaints}&quot;</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button type="button" onClick={() => setItemSourceTab('catalog')} className={'flex-1 py-1.5 rounded-lg font-bold transition text-center ' + (itemSourceTab === 'catalog' ? 'bg-maroon-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900')}>Katalog Inventaris ({filteredInventory.length})</button>
              <button type="button" onClick={() => setItemSourceTab('custom')} className={'flex-1 py-1.5 rounded-lg font-bold transition text-center ' + (itemSourceTab === 'custom' ? 'bg-maroon-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900')}>+ Jasa / Part Kustom</button>
            </div>

            {itemSourceTab === 'catalog' && (
              <div className="space-y-3">
                <input type="text" placeholder="Cari sparepart / jasa katalog..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600 font-medium" />
                <div className="flex flex-wrap gap-1">
                  {[{ id: 'all', label: 'Semua' }, { id: 'jasa', label: 'Jasa Servis' }, { id: 'oli_cairan', label: 'Oli & Cairan' }, { id: 'ac_parts', label: 'Part AC' }, { id: 'filter', label: 'Filter' }].map((c) => (<button key={c.id} onClick={() => setPickerCategory(c.id)} className={'text-[10.5px] px-2.5 py-1 rounded-lg font-semibold transition ' + (pickerCategory === c.id ? 'bg-maroon-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{c.label}</button>))}
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredInventory.map((item) => (
                    <div key={item.id} onClick={() => handleAddItemFromCatalog(item)} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-maroon-300 bg-slate-50/50 hover:bg-maroon-50/40 transition cursor-pointer group">
                      <div className="overflow-hidden mr-2">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-maroon-900 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.item_code} - {item.is_service ? 'Jasa' : 'Stok: ' + item.stock_qty}</div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="font-black text-xs font-mono text-slate-900">{formatCurrency(item.sell_price)}</span>
                        <div className="w-6 h-6 rounded-lg bg-maroon-100 text-maroon-700 flex items-center justify-center group-hover:bg-maroon-700 group-hover:text-white transition"><Plus className="w-3.5 h-3.5" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemSourceTab === 'custom' && (
              <form onSubmit={handleAddCustomItem} className="space-y-3 p-3 bg-maroon-50/30 rounded-xl border border-maroon-200 text-xs">
                <div className="font-bold text-maroon-900 text-xs">Buat Jasa / Suku Cadang Kustom (On-The-Fly)</div>
                <p className="text-[11px] text-slate-500 leading-tight">Item masuk ke estimasi tanpa didaftarkan ke inventaris. Isi rentang harga Min dan Maks (atau sama untuk harga tetap).</p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Jasa / Barang Kustom <span className="text-red-500">*</span></label>
                  <input type="text" required placeholder="Contoh: Jasa Bubut Piringan Rem..." value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jenis Item</label>
                    <select value={customItemIsService ? 'jasa' : 'part'} onChange={(e) => setCustomItemIsService(e.target.value === 'jasa')} className="w-full p-2 rounded-lg border border-slate-300 font-bold">
                      <option value="jasa">Jasa / Labor</option><option value="part">Suku Cadang / Part</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jumlah (Qty)</label>
                    <input type="number" min="1" required value={customItemQty} onChange={(e) => setCustomItemQty(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold" />
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Rentang Harga Satuan</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Harga Minimum <span className="text-red-500">*</span></label>
                      <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Rp</span><input type="text" inputMode="numeric" required placeholder="50000" value={customItemPriceMin} onChange={(e) => setCustomItemPriceMin(e.target.value)} className="w-full pl-7 p-2 rounded-lg border border-slate-300 font-bold text-sm" /></div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Harga Maksimum</label>
                      <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Rp</span><input type="text" inputMode="numeric" placeholder="75000" value={customItemPriceMax} onChange={(e) => setCustomItemPriceMax(e.target.value)} className="w-full pl-7 p-2 rounded-lg border border-slate-300 font-bold text-sm" /></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Kosongkan Maks untuk harga tetap. Isi huruf di Min untuk harga non-numerik (mis: Menyesuaikan).</p>
                </div>
                <button type="submit" className="w-full inline-flex items-center justify-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white font-bold py-2 rounded-xl transition shadow-xs"><Plus className="w-4 h-4" /><span>+ Masukkan ke Estimasi</span></button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">Rincian Item Estimasi ({items.length})</h3>
              {selectedSpk && <span className="text-xs font-mono text-maroon-900 font-black">SPK: {selectedSpk.spk_number}</span>}
            </div>
            <div className="border border-slate-200 rounded-xl overflow-auto min-h-[220px]">
              {items.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs"><Calculator className="w-8 h-8 text-slate-300 mb-2" /><p className="font-bold">Belum ada item estimasi.</p><p className="text-[10px]">Pilih dari katalog atau buat item kustom di sebelah kiri.</p></div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[10.5px]">
                      <th className="p-2.5">Nama Spare Part / Pekerjaan</th>
                      <th className="p-2.5 w-14 text-center">Qty</th>
                      <th className="p-2.5 w-24 text-right">Harga Min</th>
                      <th className="p-2.5 w-24 text-right">Harga Maks</th>
                      <th className="p-2.5 w-16 text-center">Opsi</th>
                      <th className="p-2.5 w-36 text-right">Estimasi Harga</th>
                      <th className="p-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const itemMin = resolveMin(item); const itemMax = resolveMax(item);
                      const subMin = item.subtotal_min ?? item.qty * itemMin; const subMax = item.subtotal_max ?? item.qty * itemMax;
                      const textPriceMode = isTextPrice(item);
                      const rowBg = item.option_group ? (item.is_active_option ? 'bg-emerald-50/60 border-l-2 border-l-emerald-400' : 'bg-slate-50/60 border-l-2 border-l-slate-300 opacity-70') : 'hover:bg-slate-50/60';
                      return (
                        <tr key={idx} className={rowBg + ' transition-colors'}>
                          <td className="p-2.5 align-top">
                            <div className="flex items-start gap-1.5">
                              {item.option_label && (<span className={'flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide mt-0.5 ' + (item.option_label === 'opsi1' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800')}>{item.option_label === 'opsi1' ? 'OPT 1' : 'OPT 2'}</span>)}
                              <div><div className="font-bold text-slate-900 leading-tight">{item.name}</div><div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.is_custom ? <span className="text-maroon-700 font-semibold">[Kustom]</span> : item.code}</div></div>
                            </div>
                          </td>
                          <td className="p-2.5 text-center align-top"><input type="number" min="1" value={item.qty} onChange={(e) => handleUpdateQty(idx, Number(e.target.value))} className="w-12 text-center p-1 rounded border border-slate-200 font-mono font-bold text-xs" /></td>
                          <td className="p-2.5 text-right align-top">
                            {textPriceMode ? (<span className="text-amber-700 italic text-[10px]">{item.price}</span>)
                              : currentRole === 'owner' || item.is_custom ? (
                                <div className="relative inline-block"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]">Rp</span><input type="text" inputMode="numeric" value={itemMin || ''} onChange={(e) => handleUpdatePriceRange(idx, 'min', e.target.value)} className="w-[78px] text-right pl-6 pr-1 py-1 rounded border border-slate-200 font-bold text-[10.5px]" /></div>
                              ) : (<span className="font-mono text-[10.5px]">{formatCurrency(itemMin)}</span>)}
                          </td>
                          <td className="p-2.5 text-right align-top">
                            {textPriceMode ? (<span className="text-slate-400 text-[10px]">-</span>)
                              : currentRole === 'owner' || item.is_custom ? (
                                <div className="relative inline-block"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]">Rp</span><input type="text" inputMode="numeric" value={itemMax || ''} onChange={(e) => handleUpdatePriceRange(idx, 'max', e.target.value)} className="w-[78px] text-right pl-6 pr-1 py-1 rounded border border-slate-200 font-bold text-[10.5px]" /></div>
                              ) : (<span className="font-mono text-[10.5px]">{formatCurrency(itemMax)}</span>)}
                          </td>
                          <td className="p-2.5 text-center align-top">
                            {item.option_group ? (
                              <label className="flex items-center justify-center gap-1 cursor-pointer group">
                                <input type="radio" name={'opt-' + item.option_group} checked={item.is_active_option === true} onChange={() => handleToggleActiveOption(item.option_group!, item.option_label!)} className="accent-emerald-600 w-3.5 h-3.5" />
                                <span className="text-[9px] font-bold text-slate-600 group-hover:text-slate-900">Aktif</span>
                              </label>
                            ) : (<button type="button" onClick={() => handleAddOption(idx)} title="Tambah Opsi Alternatif" className="text-[9px] font-bold text-slate-400 hover:text-maroon-700 hover:bg-maroon-50 px-1.5 py-1 rounded-lg transition whitespace-nowrap">+ Opsi</button>)}
                          </td>
                          <td className="p-2.5 text-right align-top">
                            {textPriceMode ? (<span className="text-amber-700 text-[10px] italic">{item.subtotal}</span>)
                              : (<span className={'font-mono font-black text-[10.5px] leading-tight ' + (item.option_group && !item.is_active_option ? 'text-slate-400' : 'text-slate-900')}>{formatRange(subMin, subMax)}</span>)}
                          </td>
                          <td className="p-2.5 align-top"><button onClick={() => item.option_group ? handleRemoveSingleOption(idx) : handleRemoveItem(idx)} className="text-slate-300 hover:text-red-600 p-1 transition" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              {currentRole === 'owner' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Diskon Khusus (Rp):</span>
                  <input type="number" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} className="w-28 text-right p-1 rounded border border-slate-200 font-mono bg-white font-bold" />
                </div>
              )}
              <div className="border-t-2 border-slate-300 pt-2">
                <div className="flex justify-between items-start font-black text-maroon-900">
                  <span className="text-sm">TOTAL ESTIMASI:</span>
                  <span className="font-mono text-sm text-right leading-tight">{totalMin === totalMax ? formatCurrency(Math.max(0, totalMin - discountAmount)) : formatCurrency(Math.max(0, totalMin - discountAmount)) + ' - ' + formatCurrency(Math.max(0, totalMax - discountAmount))}</span>
                </div>
                {totalMin !== totalMax && (<p className="text-[10px] text-slate-400 text-right mt-0.5">Rentang berdasarkan harga minimum dan maksimum item aktif</p>)}
              </div>
            </div>

            <div><label className="block text-xs font-bold text-slate-700 mb-1">Catatan Admin (Opsional):</label><textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Catatan khusus untuk estimasi ini..." className="w-full text-xs p-2.5 rounded-xl border border-slate-200 resize-none outline-none focus:ring-1 focus:ring-maroon-600 font-medium" /></div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button onClick={handleSaveEstimation} disabled={isSaving || !selectedSpk} className="inline-flex items-center space-x-1.5 bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"><FileCheck className="w-4 h-4" /><span>Simpan &amp; Terbitkan Estimasi</span></button>
              {selectedSpk && (<button onClick={handleApproveAndProceedToServicing} className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition"><CheckCircle2 className="w-4 h-4" /><span>Pelanggan Setuju - Mulai Servis</span></button>)}
            </div>
          </div>
        </div>
      </div>

      {savedEstimation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto"><PrintableEstimation estimation={savedEstimation} settings={settings} onClose={() => setSavedEstimation(null)} /></div>
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