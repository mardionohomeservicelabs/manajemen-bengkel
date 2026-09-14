'use client';

import React, { useState, useRef } from 'react';
import { Invoice, InvoiceItem, WorkshopSettings } from '@/lib/types/database';
import {
  formatCurrency,
  formatPlate,
  formatDate,
  createWhatsAppLink,
  parseRangePrice,
  formatKM,
  formatComplaintsAndDiagnosis,
} from '@/lib/utils';
import { printCleanDocument } from '@/lib/utils/print-helper';
import {
  Printer,
  Share2,
  X,
  Calculator,
} from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';
import { DocumentImageModal } from './DocumentImageModal';
import { DBService } from '@/lib/services/db-service';

interface PrintableEstimationProps {
  estimation: Invoice;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableEstimation({
  estimation,
  settings,
  onClose,
}: PrintableEstimationProps) {
  const vehicle = estimation.vehicle;
  // Ambil data SPK terkini: utamakan data live dari cache/database work orders agar perubahan SPK langsung tercermin
  const workOrder =
    (estimation.work_order_id
      ? DBService.getAllWorkOrders().find(
          (w) => w.id === estimation.work_order_id || w.spk_number === estimation.work_order_id
        )
      : undefined) || estimation.work_order;
  const documentRef = useRef<HTMLDivElement>(null);

  // State untuk nama Estimator (ambil dari data estimasi, bisa dioverride)
  const [signerEstimator, setSignerEstimator] = useState<string>(
    estimation.estimator_name || (estimation as any).estimator_name || ''
  );

  const handlePrint = () => {
    printCleanDocument(documentRef.current, `Estimasi Biaya - ${estimation.invoice_number}`);
  };

  // Format Jam Datang (HH:mm) dan Tanggal
  const estTimestamp = workOrder?.entry_date || workOrder?.created_at || estimation.created_at;
  const estDateObj = new Date(estTimestamp);
  const jamDatang = !isNaN(estDateObj.getTime())
    ? estDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '09:00';
  const tanggalDatang = formatDate(estimation.created_at || estTimestamp);

  const hasOpsi2 = Boolean(
    estimation.has_opsi2 ||
    (estimation.items &&
      estimation.items.some(
        (it: any) =>
          (it.total_opsi2 !== undefined &&
            it.total_opsi2 !== '' &&
            it.total_opsi2 !== 0 &&
            it.total_opsi2 !== '0') ||
          (it.price_opsi2 !== undefined &&
            it.price_opsi2 !== '' &&
            it.price_opsi2 !== 0 &&
            it.price_opsi2 !== '0')
      ))
  );

  // Deteksi mode Double Estimasi (Tabel 1 & Tabel 2)
  const isDoubleTable = Boolean(
    estimation.has_second_table ||
    (estimation.items_table2 && estimation.items_table2.length > 0) ||
    (estimation.items && estimation.items.some((it: any) => it.section === 2))
  );

  const table1Items = isDoubleTable
    ? estimation.items.filter((it: any) => it.section !== 2)
    : (estimation.items || []);

  const table2Items = isDoubleTable
    ? ((estimation.items_table2 && estimation.items_table2.length > 0)
        ? estimation.items_table2
        : estimation.items.filter((it: any) => it.section === 2))
    : [];

  const table1Title = estimation.table1_title || (estimation as any).checklist_data?.table1_title || 'BAGIAN 1';
  const table2Title = estimation.table2_title || (estimation as any).checklist_data?.table2_title || 'BAGIAN REM';

  // Perhitungan Subtotal Per Bagian
  function calculateSectionTotals(itemsList: InvoiceItem[]) {
    let tot1Min = 0;
    let tot1Max = 0;
    let tot2Min = 0;
    let tot2Max = 0;

    itemsList.forEach((it) => {
      const qty = it.qty || 1;
      const isP1Empty = it.price_opsi1 === '' || it.price_opsi1 === 0 || it.price_opsi1 === '0';
      const p1Raw = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
      
      const hasTot2 = it.total_opsi2 !== undefined && it.total_opsi2 !== '' && it.total_opsi2 !== 0 && it.total_opsi2 !== '0';
      const hasP2 = it.price_opsi2 !== undefined && it.price_opsi2 !== '' && it.price_opsi2 !== 0 && it.price_opsi2 !== '0';
      const isP2Empty = !hasTot2 && !hasP2;

      const r1 = parseRangePrice(p1Raw);

      if (!isP1Empty && (typeof p1Raw !== 'string' || !/[a-zA-Z]/.test(p1Raw) || r1.min > 0)) {
        tot1Min += r1.min * qty;
        tot1Max += r1.max * qty;
      }
      if (!isP2Empty) {
        if (hasTot2) {
          const r2 = parseRangePrice(it.total_opsi2);
          if (typeof it.total_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.total_opsi2)) || r2.min > 0) {
            tot2Min += r2.min;
            tot2Max += r2.max;
          }
        } else {
          const r2 = parseRangePrice(it.price_opsi2);
          if (typeof it.price_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.price_opsi2)) || r2.min > 0) {
            tot2Min += r2.min * qty;
            tot2Max += r2.max * qty;
          }
        }
      }
    });

    return { tot1Min, tot1Max, tot2Min, tot2Max };
  }

  const t1Totals = calculateSectionTotals(table1Items);
  const t2Totals = calculateSectionTotals(table2Items);

  const grandTot1Min = isDoubleTable ? (t1Totals.tot1Min + t2Totals.tot1Min) : t1Totals.tot1Min;
  const grandTot1Max = isDoubleTable ? (t1Totals.tot1Max + t2Totals.tot1Max) : t1Totals.tot1Max;
  const grandTot2Min = isDoubleTable ? (t1Totals.tot2Min + t2Totals.tot2Min) : t1Totals.tot2Min;
  const grandTot2Max = isDoubleTable ? (t1Totals.tot2Max + t2Totals.tot2Max) : t1Totals.tot2Max;

  function formatTotalCell(min: number, max: number): string {
    if (min === 0 && max === 0) return 'Rp 0';
    if (min === max) return formatCurrency(min);
    return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  }

  // Helper render harga kompak: bila harga panjang (terutama rentang/range), otomatis mengarah ke bawah (stacked)
  function renderCompactPrice(priceStr: string | number, customColor?: string) {
    if (priceStr === undefined || priceStr === null || priceStr === '') {
      return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
    }
    const str = String(priceStr).trim();
    if (str === '0' || str === 'Rp 0' || str === '-') {
      return <span className={`font-mono ${customColor || ''}`}>{str}</span>;
    }

    if (str.includes('–') || (str.includes(' - ') && str.includes('Rp'))) {
      const parts = str.includes('–') ? str.split('–') : str.split(' - ');
      if (parts.length >= 2) {
        const p1 = parts[0].trim();
        const p2 = parts[1].trim();
        return (
          <div className={`flex flex-col items-end leading-tight text-right ${customColor || ''}`}>
            <span className="font-mono whitespace-nowrap text-[10px]">{p1}</span>
            <span className="font-mono text-[9px] opacity-80 whitespace-nowrap">– {p2}</span>
          </div>
        );
      }
    }

    return (
      <span className={`font-mono text-right break-words leading-tight ${customColor || ''}`}>
        {str}
      </span>
    );
  }

  // Helper render subtotal/grand total kompak: bila angka rentang, otomatis mengarah ke bawah agar muat di kertas
  function renderTotalCellCompact(min: number, max: number, customColor?: string) {
    if (min === 0 && max === 0) return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
    if (min === max) return <span className={`font-mono ${customColor || ''}`}>{formatCurrency(min)}</span>;
    return (
      <div className={`flex flex-col items-end leading-tight text-right ${customColor || ''}`}>
        <span className="font-mono whitespace-nowrap text-[10px]">{formatCurrency(min)}</span>
        <span className="font-mono text-[9px] opacity-80 whitespace-nowrap">– {formatCurrency(max)}</span>
      </div>
    );
  }

  // Helper format harga satuan & total baris item: jika tertulis 'CEK'/'cek', tetap muncul 'CEK' dan bukan 0
  function formatEstimationRowItem(
    priceRaw: any,
    totalRaw: any,
    qty: number,
    isOpsi2: boolean = false
  ): { priceDisplay: string; totalDisplay: string } {
    if (isOpsi2) {
      const val2 = totalRaw !== undefined && totalRaw !== null && totalRaw !== ''
        ? totalRaw
        : (priceRaw !== undefined && priceRaw !== null && priceRaw !== '' ? priceRaw : '');

      const isValEmpty = val2 === '' || val2 === 0 || val2 === '0';
      if (isValEmpty) {
        return { priceDisplay: '0', totalDisplay: '0' };
      }

      const isText = typeof val2 === 'string' && /[a-zA-Z]/.test(val2.trim());
      if (isText) {
        const textVal = val2.toString().trim().toUpperCase();
        return { priceDisplay: textVal, totalDisplay: textVal };
      }

      const r = parseRangePrice(val2);
      const totalDisplay = r.min === r.max
        ? formatCurrency(r.min)
        : `${formatCurrency(r.min)} – ${formatCurrency(r.max)}`;
      return { priceDisplay: totalDisplay, totalDisplay };
    }

    const isPriceEmpty = priceRaw === '' || priceRaw === undefined || priceRaw === null;

    // Cek apakah kolom berisi teks seperti 'CEK', 'cek', 'Cek', dll.
    const isPriceText = typeof priceRaw === 'string' && /[a-zA-Z]/.test(priceRaw.trim());
    const isTotalText = totalRaw !== undefined && totalRaw !== null && typeof totalRaw === 'string' && /[a-zA-Z]/.test(totalRaw.trim());

    if (isPriceText || isTotalText) {
      const textVal = isPriceText
        ? priceRaw.toString().trim().toUpperCase()
        : totalRaw.toString().trim().toUpperCase();
      const totVal = isTotalText
        ? totalRaw.toString().trim().toUpperCase()
        : textVal;
      return {
        priceDisplay: textVal,
        totalDisplay: totVal,
      };
    }

    if (isPriceEmpty) {
      return { priceDisplay: '0', totalDisplay: '0' };
    }

    const r = parseRangePrice(priceRaw);
    const isZero = priceRaw === 0 || priceRaw === '0' || (r.min === 0 && r.max === 0);
    if (isZero) {
      return { priceDisplay: '0', totalDisplay: '0' };
    }

    const priceDisplay = formatCurrency(priceRaw);
    const totalDisplay = r.min === r.max
      ? formatCurrency(r.min * qty)
      : `${formatCurrency(r.min * qty)} – ${formatCurrency(r.max * qty)}`;

    return { priceDisplay, totalDisplay };
  }

  const getWhatsAppMessage = () => {
    let baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      process.env.NEXT_PUBLIC_APP_URL
    ) {
      baseOrigin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    }
    const token = estimation.invoice_number || estimation.id;
    const approvalUrl = baseOrigin ? `${baseOrigin}/estimasi/ttd/${encodeURIComponent(token)}` : '';

    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pemilik Kendaraan'},\n` +
      `Berikut rincian Surat Estimasi Biaya Perbaikan dari ${settings.name}:\n\n` +
      `No. Estimasi: ${estimation.invoice_number}\n` +
      `Kendaraan: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `Total Estimasi Opsi 1: ${formatTotalCell(grandTot1Min, grandTot1Max)}\n` +
      (hasOpsi2 ? `Total Estimasi Opsi 2: ${formatTotalCell(grandTot2Min, grandTot2Max)}\n` : '') +
      `Estimator: ${signerEstimator || 'Via Rizkiana'}\n\n` +
      (approvalUrl ? `Silakan klik tautan resmi di bawah ini untuk melihat rincian & menyetujui secara digital:\n🔗 ${approvalUrl}\n\n` : '') +
      `Mohon konfirmasi persetujuan pengerjaan dengan membuka tautan di atas atau membalas pesan ini "SETUJU".\n` +
      `Terima kasih.`
    );
  };

  const waLink = vehicle?.phone_number
    ? createWhatsAppLink(vehicle.phone_number, getWhatsAppMessage())
    : '#';

  // Ambil keluhan yang tertulis di estimasi (tanpa uraian pekerjaan)
  const rawEstComplaints = (estimation as any).complaints;
  const complaintsText = (rawEstComplaints && String(rawEstComplaints).trim())
    ? formatComplaintsAndDiagnosis(null, null, String(rawEstComplaints)).displayText
    : (workOrder?.complaints?.trim() || 'Perawatan berkala / Servis rutin');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Top Floating Control Bar */}
      <div className="no-print bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 flex-wrap">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold flex-shrink-0">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Surat Estimasi Biaya &amp; Persetujuan Pelanggan</h3>
            <p className="text-[11px] text-slate-400">Tata Letak Standar Resmi • Multi-Opsi &amp; Satuan SET/PCS/JASA • Mardiono Home Service</p>
          </div>
        </div>

        {/* Input Nama Estimator */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Estimator</label>
          <input
            type="text"
            value={signerEstimator}
            onChange={(e) => setSignerEstimator(e.target.value)}
            placeholder="Nama Estimator..."
            className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-52 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <DocumentImageModal
            documentRef={documentRef}
            label="Lihat sebagai Gambar"
            filename={`Estimasi-${estimation.invoice_number}`}
          />
          {vehicle?.phone_number && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-md cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Minta Persetujuan WA</span>
            </a>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC AUTO-HEIGHT DOCUMENT PREVIEW CONTAINER */}
      <div className="doc-preview-wrapper rounded-2xl">
        <div ref={documentRef} className="doc-sheet printable-estimation-sheet space-y-2.5">
          {/* Header & Identitas Kendaraan */}
          <div className="estimation-header-box avoid-break space-y-2">
            <OfficialDocumentHeader settings={settings} />

            {/* Title Header */}
            <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-900 mt-1">
              <div>
                <span className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-black uppercase tracking-wider">
                  SURAT ESTIMASI BIAYA &amp; PERSETUJUAN
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase">No. Estimasi: </span>
                <span className="font-mono font-black text-sm text-[#001F7A]">
                  {estimation.invoice_number}
                </span>
              </div>
            </div>

            {/* Symmetrical Grid: Data Pemilik Kendaraan & Kendaraan */}
            <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50/70 p-2.5 rounded-xl border border-slate-800 font-medium">
              {/* Kolom Kiri */}
              <div className="space-y-1 border-r border-slate-300 pr-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="w-28 shrink-0 font-bold text-slate-600 whitespace-nowrap">Pemilik Kendaraan</span>
                  <span className="font-bold text-slate-950 flex-1 min-w-0 break-words leading-tight">: {vehicle?.customer_name || 'Pemilik Kendaraan'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-28 shrink-0 font-bold text-slate-600 whitespace-nowrap">Alamat</span>
                  <span className="font-bold text-slate-950 leading-tight flex-1 min-w-0 break-words">: {vehicle?.address || '-'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-28 shrink-0 font-bold text-slate-600 whitespace-nowrap">Unit</span>
                  <span className="font-bold text-slate-950 flex-1 min-w-0 break-words leading-tight">: {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-28 shrink-0 font-bold text-slate-600 whitespace-nowrap">Jam Datang</span>
                  <span className="font-bold text-slate-950 flex-1 min-w-0">: {jamDatang}</span>
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-1 pl-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="w-16 shrink-0 font-bold text-slate-600 whitespace-nowrap">No Pol</span>
                  <span className="font-mono font-black text-[#8B0000] text-sm flex-1 min-w-0">: {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-16 shrink-0 font-bold text-slate-600 whitespace-nowrap">No PKB</span>
                  <span className="font-mono font-bold text-[#001F7A] flex-1 min-w-0 break-words">: {workOrder?.spk_number || estimation.invoice_number}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-16 shrink-0 font-bold text-slate-600 whitespace-nowrap">Tanggal</span>
                  <span className="font-bold text-slate-950 flex-1 min-w-0">: {tanggalDatang}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="w-16 shrink-0 font-bold text-slate-600 whitespace-nowrap">KM</span>
                  <span className="font-mono font-bold text-slate-950 flex-1 min-w-0">: {formatKM(vehicle?.current_mileage, false)}</span>
                </div>
              </div>
            </div>

            {/* Section: Keluhan / Diagnosa Awal (Hanya menampilkan keluhan saja, tanpa uraian pekerjaan) */}
            {complaintsText ? (
              <div className="border border-slate-800 rounded-xl p-2.5 bg-white text-xs text-slate-900 font-medium">
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">
                  Keluhan / Diagnosa Awal:
                </span>
                <span className="font-bold text-slate-900 text-[11.5px] leading-snug break-words">
                  {complaintsText}
                </span>
              </div>
            ) : null}
          </div>

          {/* Items Table — Exact format from user reference screenshot */}
          <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs my-2 estimation-table-wrapper">
            <table className="w-full text-left border-collapse text-[10.5px] estimation-items-table">
              <thead className="estimation-items-thead" style={{ display: 'table-row-group' }}>
                <tr className="bg-slate-100 border-b-2 border-slate-900 font-black text-slate-900 uppercase text-[10px]">
                  <th className="p-1.5 w-7 text-center border-r border-slate-300">No</th>
                  <th className="p-1.5 border-r border-slate-300">Saran/Perbaikan/Ganti Sparepart</th>
                  <th className="p-1.5 w-9 text-center border-r border-slate-300">QTY</th>
                  <th className="p-1.5 w-11 text-center border-r border-slate-300">Satuan</th>
                  <th className="p-1.5 w-[92px] text-right border-r border-slate-300">Hrg Satuan</th>
                  <th className={`p-1.5 ${hasOpsi2 ? 'w-[98px]' : 'w-[110px]'} text-right border-r border-slate-300`}>
                    {hasOpsi2 ? 'Total Opsi 1' : 'Total Harga'}
                  </th>
                  {hasOpsi2 && (
                    <th className="p-1.5 w-[98px] text-right bg-blue-50/40 text-blue-950">
                      Total Opsi 2
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {/* Table 1 Slice Divider (Rendered when Double Table is enabled) */}
                {isDoubleTable && (
                  <tr className="bg-slate-200/90 border-b border-slate-300">
                    <td
                      colSpan={hasOpsi2 ? 7 : 6}
                      className="py-1 px-4 text-center font-extrabold text-slate-800 uppercase tracking-wider text-[11px]"
                    >
                      {table1Title}
                    </td>
                  </tr>
                )}

                {/* Table 1 Items */}
                {table1Items.map((item, idx) => {
                  const qty = item.qty || 1;
                  const p1Raw =
                    item.price_opsi1 !== undefined && item.price_opsi1 !== ''
                      ? item.price_opsi1
                      : item.price !== undefined
                      ? item.price
                      : 0;
                  const p1Info = formatEstimationRowItem(p1Raw, item.total_opsi1, qty, false);

                  const isP2Empty =
                    (item.total_opsi2 === '' || item.total_opsi2 === undefined || item.total_opsi2 === null || item.total_opsi2 === 0 || item.total_opsi2 === '0') &&
                    (item.price_opsi2 === '' || item.price_opsi2 === undefined || item.price_opsi2 === null || item.price_opsi2 === 0 || item.price_opsi2 === '0');
                  const p2Raw = isP2Empty ? '' : (item.total_opsi2 || item.price_opsi2);
                  const p2Info = formatEstimationRowItem(item.price_opsi2, item.total_opsi2, qty, true);

                  return (
                    <tr key={`t1-${idx}`} className="hover:bg-slate-50 estimation-item-row">
                      <td className="p-1.5 text-center font-bold border-r border-slate-300 align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 align-middle">
                        <div className="font-bold text-slate-900 uppercase break-words whitespace-normal leading-snug">
                          {item.name}
                        </div>
                      </td>
                      <td className="p-1.5 text-center font-mono font-bold border-r border-slate-300 align-middle">
                        {qty}
                      </td>
                      <td className="p-1.5 text-center text-[10px] font-black uppercase text-slate-700 border-r border-slate-300 align-middle">
                        {item.unit || 'PCS'}
                      </td>
                      <td className="p-1.5 text-right border-r border-slate-300 align-middle font-mono font-bold text-slate-800">
                        {renderCompactPrice(p1Info.priceDisplay)}
                      </td>
                      <td className="p-1.5 text-right font-mono font-black text-slate-900 border-r border-slate-300 align-middle">
                        {renderCompactPrice(p1Info.totalDisplay)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                          {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* If Double Table: Render Subtotal Table 1, Slice Divider, Table 2 Items, and Subtotal Table 2 */}
                {isDoubleTable && (
                  <>
                    {/* Subtotal Row Table 1 */}
                    <tr className="bg-slate-100/90 text-slate-800 font-bold border-y border-slate-300 text-xs">
                      <td colSpan={5} className="p-1.5 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[10.5px]">
                        TOTAL {table1Title ? `(${table1Title.toUpperCase()})` : 'TABEL 1'}
                      </td>
                      <td className="p-1.5 text-right font-mono font-extrabold text-slate-950 border-r border-slate-300">
                        {renderTotalCellCompact(t1Totals.tot1Min, t1Totals.tot1Max)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-1.5 text-right font-mono font-extrabold text-blue-950 bg-blue-50/30">
                          {renderTotalCellCompact(t1Totals.tot2Min, t1Totals.tot2Max, 'text-blue-950')}
                        </td>
                      )}
                    </tr>

                    {/* Slice Divider */}
                    <tr className="bg-slate-200/90 border-y border-slate-300">
                      <td
                        colSpan={hasOpsi2 ? 7 : 6}
                        className="py-1 px-4 text-center font-extrabold text-slate-800 uppercase tracking-wider text-[11px]"
                      >
                        {table2Title}
                      </td>
                    </tr>

                    {/* Table 2 Items (Sequential numbering continuing from Table 1) */}
                    {table2Items.map((item, idx) => {
                      const displayNum = table1Items.length + idx + 1;
                      const qty = item.qty || 1;
                      const p1Raw =
                        item.price_opsi1 !== undefined && item.price_opsi1 !== ''
                          ? item.price_opsi1
                          : item.price !== undefined
                          ? item.price
                          : 0;
                      const p1Info = formatEstimationRowItem(p1Raw, item.total_opsi1, qty, false);

                      const isP2Empty =
                        (item.total_opsi2 === '' || item.total_opsi2 === undefined || item.total_opsi2 === null || item.total_opsi2 === 0 || item.total_opsi2 === '0') &&
                        (item.price_opsi2 === '' || item.price_opsi2 === undefined || item.price_opsi2 === null || item.price_opsi2 === 0 || item.price_opsi2 === '0');
                      const p2Raw = isP2Empty ? '' : (item.total_opsi2 || item.price_opsi2);
                      const p2Info = formatEstimationRowItem(item.price_opsi2, item.total_opsi2, qty, true);

                      return (
                        <tr key={`t2-${idx}`} className="hover:bg-slate-50 estimation-item-row">
                          <td className="p-1.5 text-center font-bold border-r border-slate-300 align-middle">
                            {displayNum}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 align-middle">
                            <div className="font-bold text-slate-900 uppercase break-words whitespace-normal leading-snug">
                              {item.name}
                            </div>
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold border-r border-slate-300 align-middle">
                            {qty}
                          </td>
                          <td className="p-1.5 text-center text-[10px] font-black uppercase text-slate-700 border-r border-slate-300 align-middle">
                            {item.unit || 'PCS'}
                          </td>
                          <td className="p-1.5 text-right border-r border-slate-300 align-middle font-mono font-bold text-slate-800">
                            {renderCompactPrice(p1Info.priceDisplay)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-black text-slate-900 border-r border-slate-300 align-middle">
                            {renderCompactPrice(p1Info.totalDisplay)}
                          </td>
                          {hasOpsi2 && (
                            <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                              {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Subtotal Row Table 2 */}
                    <tr className="bg-slate-100/90 text-slate-800 font-bold border-y border-slate-300 text-xs">
                      <td colSpan={5} className="p-1.5 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[10.5px]">
                        TOTAL {table2Title ? `(${table2Title.toUpperCase()})` : 'TABEL 2'}
                      </td>
                      <td className="p-1.5 text-right font-mono font-extrabold text-slate-950 border-r border-slate-300">
                        {renderTotalCellCompact(t2Totals.tot1Min, t2Totals.tot1Max)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-1.5 text-right font-mono font-extrabold text-blue-950 bg-blue-50/30">
                          {renderTotalCellCompact(t2Totals.tot2Min, t2Totals.tot2Max, 'text-blue-950')}
                        </td>
                      )}
                    </tr>
                  </>
                )}
              </tbody>
              {/* Grand Total Row: JUMLAH KESELURUHAN (Rendered as separate tbody to ensure it only appears once at the very end of items, never at page 1 bottom) */}
              <tbody className="border-t-2 border-slate-900 estimation-grand-total-tbody">
                <tr className="bg-slate-100 font-black text-xs estimation-grand-total-row avoid-break">
                  <td colSpan={5} className="p-2 text-center uppercase tracking-wider text-slate-900 font-black">
                    JUMLAH KESELURUHAN
                  </td>
                  <td className="p-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 text-xs">
                    {renderTotalCellCompact(grandTot1Min, grandTot1Max)}
                  </td>
                  {hasOpsi2 && (
                    <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/40 text-xs">
                      {renderTotalCellCompact(grandTot2Min, grandTot2Max, 'text-blue-950')}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* KETERANGAN BOX (Matching screenshot) */}
          <div className="border-2 border-slate-900 rounded-xl p-3 bg-white text-xs space-y-1">
            <h5 className="font-black text-slate-950 uppercase text-[11px]">
              KETERANGAN:
            </h5>
            <p className="text-slate-700 leading-relaxed font-medium text-[10.5px]">
              {estimation.admin_notes || 'Harga di atas merupakan estimasi perkiraan awal. Apabila ditemukan komponen lain yang perlu diganti selama proses pembongkaran, teknisi kami akan segera mengonfirmasi terlebih dahulu kepada pemilik kendaraan.'}
            </p>
          </div>

          {/* Ketentuan Estimasi Berbutir */}
          <div className="estimation-terms-box avoid-break border border-slate-800 rounded-xl p-3 bg-amber-50/30 text-slate-900 text-[10px] space-y-1 leading-relaxed">
            <h5 className="font-black text-[#8B0000] uppercase text-[10.5px]">
              KETENTUAN ESTIMASI:
            </h5>
            <ol className="space-y-0.5 pl-1 font-medium list-none">
              <li><strong>1.</strong> Pemilik kendaraan tidak diperkenankan membawa sparepart sendiri pada pekerjaan Overhaul Mesin/Transmisi.</li>
              <li><strong>2.</strong> Segala risiko akibat part bawaan sendiri tidak menjadi tanggung jawab/garansi kami.</li>
              <li><strong>3.</strong> Apabila membawa part sendiri, batas maksimal pengadaan part adalah 2 hari. Selebihnya dikenakan biaya parkir <strong>Rp25.000/hari</strong>.</li>
              <li><strong>4.</strong> Harga estimasi yang muncul berlaku selama <strong>1 minggu</strong> dari tanggal estimasi dikeluarkan.</li>
            </ol>
          </div>

          {/* Symmetrical Dual Signatures */}
          <div className="estimation-signatures-box avoid-break border border-slate-900 rounded-xl p-3 bg-white space-y-2 my-2">
            <h4 className="text-center font-black text-xs uppercase tracking-wider text-slate-950 pb-1 border-b border-slate-200">
              Persetujuan Estimasi Biaya
            </h4>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="border border-slate-300 rounded-lg p-2 pb-1.5 bg-slate-50 flex flex-col justify-between min-h-[110px]">
                <p className="font-black text-[#001F7A] text-[10px] uppercase">Estimator</p>
                <div className="h-11 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5 overflow-hidden">
                  {estimation.estimator_signature || (estimation as any).signature_admin_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={estimation.estimator_signature || (estimation as any).signature_admin_url}
                      alt="TTD Estimator"
                      className="max-h-10 object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">Tanda tangan Estimator</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 break-words leading-tight">
                  {signerEstimator || estimation.estimator_name || 'Via Rizkiana'}
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg p-2 pb-1.5 bg-slate-50 flex flex-col justify-between min-h-[110px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Persetujuan Pemilik Kendaraan</p>
                <div className="h-11 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5 overflow-hidden">
                  {estimation.customer_signature || estimation.signature_customer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={estimation.customer_signature || estimation.signature_customer_url}
                      alt="TTD Pemilik Kendaraan"
                      className="max-h-10 object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">Tanda tangan persetujuan</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 break-words leading-tight">
                  {estimation.customer_signed_name || vehicle?.customer_name || 'Pemilik Kendaraan'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="estimation-footer-box avoid-break">
            <OfficialDocumentFooter
              documentCode={estimation.invoice_number}
              termsNote={`Estimasi Biaya Resmi ${settings.name} • Berlaku 1 Minggu`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
