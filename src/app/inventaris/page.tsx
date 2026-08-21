'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import { InventoryItem, StockMovement } from '@/lib/types/database';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Package,
  PlusCircle,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Edit2,
  TrendingUp,
  Lock,
  CheckCircle2,
  Sliders,
  DollarSign,
} from 'lucide-react';

export default function InventoryPage() {
  const { inventory, refreshData, showToast, currentRole } = useApp();

  const [activeTab, setActiveTab] = useState<'catalog' | 'movement' | 'opname' | 'pricing'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal Form State: Add/Edit Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // Modal State: Restock
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockNotes, setRestockNotes] = useState<string>('Restock bulanan');

  // Stock Opname Form State
  const [opnameItemId, setOpnameItemId] = useState<string>('');
  const [opnamePhysicalQty, setOpnamePhysicalQty] = useState<number>(0);
  const [opnameNotes, setOpnameNotes] = useState<string>('');

  const stockMovements = DBService.getStockMovements();

  const filteredItems = inventory.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.item_code || !editingItem?.name) {
      showToast('Kode item dan nama wajib diisi.', 'error');
      return;
    }

    DBService.saveInventoryItem(
      {
        item_code: editingItem.item_code,
        name: editingItem.name,
        category: editingItem.category || 'oli_cairan',
        is_service: Boolean(editingItem.is_service),
        stock_qty: Number(editingItem.stock_qty || 0),
        min_stock_alert: Number(editingItem.min_stock_alert || 5),
        unit: editingItem.unit || 'Pcs',
        buy_price: Number(editingItem.buy_price || 0),
        sell_price: Number(editingItem.sell_price || 0),
        supplier: editingItem.supplier || '',
        location_rack: editingItem.location_rack || '',
        id: editingItem.id,
      },
      currentRole
    );

    refreshData();
    showToast('Item inventaris berhasil disimpan!', 'success');
    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  const handleExecuteRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;

    DBService.adjustStock(
      restockItem.id,
      Number(restockQty),
      'in_purchase',
      `RESTOCK-${Date.now().toString().slice(-6)}`,
      restockNotes,
      currentRole
    );

    refreshData();
    showToast(`Berhasil restock +${restockQty} ${restockItem.unit} untuk ${restockItem.name}`, 'success');
    setIsRestockModalOpen(false);
    setRestockItem(null);
  };

  const handleExecuteOpname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opnameItemId) {
      showToast('Pilih item sparepart untuk opname.', 'error');
      return;
    }

    const item = inventory.find((i) => i.id === opnameItemId);
    if (!item) return;

    const discrepancy = opnamePhysicalQty - item.stock_qty;

    DBService.adjustStock(
      item.id,
      discrepancy,
      'adjustment_opname',
      `OPNAME-${Date.now().toString().slice(-6)}`,
      `Stock Opname: Fisik ${opnamePhysicalQty} vs Sistem ${item.stock_qty} (Selisih ${discrepancy}). Catatan: ${opnameNotes}`,
      currentRole
    );

    refreshData();
    showToast(`Stock Opname selesai! Stok disesuaikan menjadi ${opnamePhysicalQty} ${item.unit}`, 'success');
    setOpnameItemId('');
    setOpnamePhysicalQty(0);
    setOpnameNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Package className="w-6 h-6 text-maroon-700" />
            <span>Manajemen Inventaris & Suku Cadang</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kontrol stok sparepart, pencatatan mutasi, rekonsiliasi stock opname & master harga jual.
          </p>
        </div>

        {currentRole === 'owner' && (
          <button
            onClick={() => {
              setEditingItem({
                item_code: `PRT-${Date.now().toString().slice(-4)}`,
                name: '',
                category: 'oli_cairan',
                is_service: false,
                stock_qty: 10,
                min_stock_alert: 5,
                unit: 'Pcs',
                buy_price: 50000,
                sell_price: 75000,
              });
              setIsItemModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Tambah Sparepart / Jasa</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
            activeTab === 'catalog'
              ? 'bg-white text-maroon-900 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Katalog Master ({inventory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movement')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
            activeTab === 'movement'
              ? 'bg-white text-maroon-900 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Riwayat Mutasi Stok</span>
        </button>

        {currentRole === 'owner' && (
          <>
            <button
              onClick={() => setActiveTab('opname')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
                activeTab === 'opname'
                  ? 'bg-white text-maroon-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Stock Opname</span>
            </button>

            <button
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
                activeTab === 'pricing'
                  ? 'bg-white text-maroon-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Dynamic Price Master</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: MASTER CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama part, kode SKU, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 outline-none focus:ring-1 focus:ring-maroon-600"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 font-medium">Kategori:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 outline-none"
              >
                <option value="all">Semua Kategori</option>
                <option value="oli_cairan">Oli & Cairan</option>
                <option value="ac_parts">AC Parts</option>
                <option value="filter">Filter</option>
                <option value="mesin">Mesin</option>
                <option value="rem">Rem</option>
                <option value="jasa">Jasa / Labor</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="p-3.5">Kode / SKU</th>
                    <th className="p-3.5">Nama Barang / Jasa</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5 text-center">Stok</th>
                    {currentRole === 'owner' && <th className="p-3.5 text-right">HPP (Beli)</th>}
                    <th className="p-3.5 text-right">Harga Jual</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const isLow = !item.is_service && item.stock_qty <= item.min_stock_alert;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono font-bold text-slate-800">{item.item_code}</td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {item.location_rack && (
                            <div className="text-[10px] text-slate-400">Lokasi: {item.location_rack}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 uppercase font-medium">
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {item.is_service ? (
                            <span className="text-slate-400">Unlimited</span>
                          ) : (
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded ${
                                isLow
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'text-slate-900'
                              }`}
                            >
                              {item.stock_qty} {item.unit}
                            </span>
                          )}
                        </td>
                        {currentRole === 'owner' && (
                          <td className="p-3.5 text-right font-mono text-slate-500">
                            {formatCurrency(item.buy_price)}
                          </td>
                        )}
                        <td className="p-3.5 text-right font-mono font-bold text-maroon-900">
                          {formatCurrency(item.sell_price)}
                        </td>
                        <td className="p-3.5 text-right space-x-1">
                          {!item.is_service && (
                            <button
                              onClick={() => {
                                setRestockItem(item);
                                setRestockQty(10);
                                setIsRestockModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium text-[11px]"
                            >
                              Restock
                            </button>
                          )}
                          {currentRole === 'owner' && (
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setIsItemModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-maroon-700 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENT LOGS */}
      {activeTab === 'movement' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
            Riwayat Keluar / Masuk Barang (Mutasi)
          </h3>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3">Jenis Mutasi</th>
                  <th className="p-3 text-center">Perubahan</th>
                  <th className="p-3 text-center">Stok Akhir</th>
                  <th className="p-3">Ref / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockMovements.map((mov) => {
                  const isPositive = mov.qty_change > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(mov.created_at)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{mov.item_name || 'Sparepart'}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            mov.movement_type === 'in_purchase'
                              ? 'bg-emerald-100 text-emerald-800'
                              : mov.movement_type === 'adjustment_opname'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {mov.movement_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                          {isPositive ? `+${mov.qty_change}` : mov.qty_change}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-800">{mov.stock_after}</td>
                      <td className="p-3 text-slate-500">
                        <div>{mov.reference_number || '-'}</div>
                        <div className="text-[10px] text-slate-400">{mov.notes}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK OPNAME (Owner only) */}
      {activeTab === 'opname' && currentRole === 'owner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Sliders className="w-5 h-5 text-maroon-700" />
              <h3 className="font-bold text-sm text-slate-900">Form Rekonsiliasi Stock Opname</h3>
            </div>
            <p className="text-xs text-slate-500">
              Bandingkan jumlah fisik aktual di rak bengkel dengan catatan sistem untuk menyesuaikan selisih.
            </p>

            <form onSubmit={handleExecuteOpname} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Sparepart:
                </label>
                <select
                  required
                  value={opnameItemId}
                  onChange={(e) => {
                    setOpnameItemId(e.target.value);
                    const item = inventory.find((i) => i.id === e.target.value);
                    if (item) setOpnamePhysicalQty(item.stock_qty);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="">-- Pilih Barang --</option>
                  {inventory
                    .filter((i) => !i.is_service)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_code} - {item.name} (Stok Sistem: {item.stock_qty} {item.unit})
                      </option>
                    ))}
                </select>
              </div>

              {opnameItemId && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stok di Sistem:</span>
                    <span className="font-bold font-mono">
                      {inventory.find((i) => i.id === opnameItemId)?.stock_qty}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jumlah Fisik Dihitung Aktual:
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={opnamePhysicalQty}
                      onChange={(e) => setOpnamePhysicalQty(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Selisih Fisik vs Sistem:</span>
                    <span
                      className={`font-mono font-bold ${
                        opnamePhysicalQty - (inventory.find((i) => i.id === opnameItemId)?.stock_qty || 0) >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {opnamePhysicalQty - (inventory.find((i) => i.id === opnameItemId)?.stock_qty || 0) >= 0
                        ? `+${opnamePhysicalQty - (inventory.find((i) => i.id === opnameItemId)?.stock_qty || 0)}`
                        : opnamePhysicalQty - (inventory.find((i) => i.id === opnameItemId)?.stock_qty || 0)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Alasan Selisih / Catatan:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Barang rusak saat pengiriman / salah input..."
                      value={opnameNotes}
                      onChange={(e) => setOpnameNotes(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!opnameItemId}
                className="w-full bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-xs py-2.5 rounded-xl transition disabled:opacity-50"
              >
                Konfirmasi & Sesuaikan Stok Sistem
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
              Panduan Stock Opname
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Stock Opname dilakukan berkala untuk memastikan kecocokan antara pembukuan stok komputer dan fisik barang di gudang/rak.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4">
              <li>Setiap penyesuaian akan otomatis dicatat pada Riwayat Mutasi.</li>
              <li>Riwayat audit log akan menyimpan data pengguna yang mengeksekusi opname.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: DYNAMIC PRICE MASTER (Owner only) */}
      {activeTab === 'pricing' && currentRole === 'owner' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Dynamic Price Master & Margin Calculator</h3>
              <p className="text-xs text-slate-500">
                Ubah harga jual dan pantau persentase margin laba per item suku cadang & jasa secara dinamis.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3">Kode & Nama</th>
                  <th className="p-3 text-right">HPP (Harga Beli)</th>
                  <th className="p-3 text-right">Harga Jual Saat Ini</th>
                  <th className="p-3 text-right">Laba Satuan</th>
                  <th className="p-3 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const profit = item.sell_price - item.buy_price;
                  const marginPercent = item.sell_price > 0 ? ((profit / item.sell_price) * 100).toFixed(1) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.item_code}</div>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {formatCurrency(item.buy_price)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-maroon-900">
                        {formatCurrency(item.sell_price)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                        +{formatCurrency(profit)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {marginPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Item */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">
              {editingItem.id ? 'Edit Data Sparepart' : 'Tambah Sparepart / Jasa Baru'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kode Item / SKU</label>
                  <input
                    type="text"
                    required
                    value={editingItem.item_code}
                    onChange={(e) => setEditingItem({ ...editingItem, item_code: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                    className="w-full p-2 rounded-lg border border-slate-200"
                  >
                    <option value="oli_cairan">Oli & Cairan</option>
                    <option value="ac_parts">AC Parts</option>
                    <option value="filter">Filter</option>
                    <option value="mesin">Mesin</option>
                    <option value="rem">Rem</option>
                    <option value="jasa">Jasa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Barang / Jasa</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Harga Beli (HPP)</label>
                  <input
                    type="number"
                    value={editingItem.buy_price}
                    onChange={(e) => setEditingItem({ ...editingItem, buy_price: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Harga Jual</label>
                  <input
                    type="number"
                    required
                    value={editingItem.sell_price}
                    onChange={(e) => setEditingItem({ ...editingItem, sell_price: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    value={editingItem.stock_qty}
                    onChange={(e) => setEditingItem({ ...editingItem, stock_qty: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Alert</label>
                  <input
                    type="number"
                    value={editingItem.min_stock_alert}
                    onChange={(e) => setEditingItem({ ...editingItem, min_stock_alert: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={editingItem.unit}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-maroon-700 text-white font-bold hover:bg-maroon-800"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Restock */}
      {isRestockModalOpen && restockItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Restock: {restockItem.name}</h3>

            <form onSubmit={handleExecuteRestock} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Jumlah Tambahan ({restockItem.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan Restock:</label>
                <input
                  type="text"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Konfirmasi Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
