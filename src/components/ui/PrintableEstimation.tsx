'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  OfficialDocumentMetaGrid,
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

  useEffect(() => {
    if (estimation.estimator_name) {
      setSignerEstimator(estimation.estimator_name);
    }
  }, [estimation.estimator_name]);

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

  const hasOpsi2Detail = Boolean(
    hasOpsi2 && (
      estimation.has_opsi2_detail ||
      (estimation.items &&
        estimation.items.some(
          (it: any) =>
            it.qty_opsi2 !== undefined &&
            it.qty_opsi2 !== null &&
            it.qty_opsi2 !== '' &&
            Number(it.qty_opsi2) > 0
        )) ||
      (estimation.items_table2 &&
        estimation.items_table2.some(
          (it: any) =>
            it.qty_opsi2 !== undefined &&
            it.qty_opsi2 !== null &&
            it.qty_opsi2 !== '' &&
            Number(it.qty_opsi2) > 0
        ))
    )
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
      const qty1 = it.qty || 1;
      const isP1Empty = it.price_opsi1 === '' || it.price_opsi1 === 0 || it.price_opsi1 === '0';
      const hasTot1 = it.total_opsi1 !== undefined && it.total_opsi1 !== '' && it.total_opsi1 !== 0 && it.total_opsi1 !== '0';
      const p1Raw = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
      
      const hasTot2 = it.total_opsi2 !== undefined && it.total_opsi2 !== '' && it.total_opsi2 !== 0 && it.total_opsi2 !== '0';
      const hasP2 = it.price_opsi2 !== undefined && it.price_opsi2 !== '' && it.price_opsi2 !== 0 && it.price_opsi2 !== '0';
      const isP2Empty = !hasTot2 && !hasP2;

      // Opsi 1: Jika Total Opsi 1 diedit manual langsung, prioritaskan nilainya
      if (hasTot1) {
        const r1 = parseRangePrice(it.total_opsi1);
        if (typeof it.total_opsi1 !== 'string' || !/[a-zA-Z]/.test(String(it.total_opsi1)) || r1.min > 0) {
          tot1Min += r1.min;
          tot1Max += r1.max;
        }
      } else if (!isP1Empty) {
        const r1 = parseRangePrice(p1Raw);
        if (typeof p1Raw !== 'string' || !/[a-zA-Z]/.test(p1Raw) || r1.min > 0) {
          tot1Min += r1.min * qty1;
          tot1Max += r1.max * qty1;
        }
      }

      // Opsi 2:
      if (!isP2Empty) {
        if (hasTot2) {
          const r2 = parseRangePrice(it.total_opsi2);
          if (typeof it.total_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.total_opsi2)) || r2.min > 0) {
            tot2Min += r2.min;
            tot2Max += r2.max;
          }
        } else {
          const qty2 = it.qty_opsi2 !== undefined && it.qty_opsi2 !== null && it.qty_opsi2 !== '' ? Number(it.qty_opsi2) || 1 : qty1;
          const r2 = parseRangePrice(it.price_opsi2);
          if (typeof it.price_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.price_opsi2)) || r2.min > 0) {
            tot2Min += r2.min * qty2;
            tot2Max += r2.max * qty2;
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

  // Helper render harga: jika rentang/range, tampilkan inline satu baris dengan separator "–"
  function renderCompactPrice(priceStr: string | number, customColor?: string) {
    if (priceStr === undefined || priceStr === null || priceStr === '') {
      return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
    }
    const str = String(priceStr).trim();
    if (str === '0' || str === 'Rp 0' || str === '-') {
      return <span className={`font-mono ${customColor || ''}`}>{str}</span>;
    }

    // Tampilkan range harga inline (satu baris), bukan ditumpuk, ukuran font sama
    return (
      <span className={`font-mono text-right whitespace-nowrap leading-tight ${customColor || ''}`}>
        {str}
      </span>
    );
  }

  // Helper render subtotal/grand total: bila angka rentang, tampilkan stacked dua baris (di sel total bawah agar rapi)
  function renderTotalCellCompact(min: number, max: number, customColor?: string) {
    if (min === 0 && max === 0) return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
    if (min === max) return <span className={`font-mono ${customColor || ''}`}>{formatCurrency(min)}</span>;
    // Untuk total/subtotal cell: tampilkan dua baris agar rapi
    return (
      <div className={`flex flex-col items-end leading-snug text-right ${customColor || ''}`}>
        <span className="font-mono font-black whitespace-nowrap">{formatCurrency(min)}</span>
        <span className="font-mono font-semibold whitespace-nowrap opacity-75">– {formatCurrency(max)}</span>
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
    const hasTotalExplicit = totalRaw !== undefined && totalRaw !== null && totalRaw !== '';
    const hasPriceExplicit = priceRaw !== undefined && priceRaw !== null && priceRaw !== '';

    if (isOpsi2) {
      if (!hasTotalExplicit && !hasPriceExplicit) {
        return { priceDisplay: '-', totalDisplay: '-' };
      }

      const isPriceText = typeof priceRaw === 'string' && /[a-zA-Z]/.test(priceRaw.trim());
      const isTotalText = typeof totalRaw === 'string' && /[a-zA-Z]/.test(totalRaw.trim());
      if (isPriceText || isTotalText) {
        const textVal = isPriceText ? priceRaw.toString().trim().toUpperCase() : totalRaw.toString().trim().toUpperCase();
        const totVal = isTotalText ? totalRaw.toString().trim().toUpperCase() : textVal;
        return { priceDisplay: textVal, totalDisplay: totVal };
      }

      const pR = parseRangePrice(priceRaw);
      const tR = hasTotalExplicit ? parseRangePrice(totalRaw) : null;

      const priceDisplay = hasPriceExplicit ? (pR.min === pR.max ? formatCurrency(pR.min) : `${formatCurrency(pR.min)} – ${formatCurrency(pR.max)}`) : '-';
      const totalDisplay = tR 
        ? (tR.min === tR.max ? formatCurrency(tR.min) : `${formatCurrency(tR.min)} – ${formatCurrency(tR.max)}`)
        : (pR.min === pR.max ? formatCurrency(pR.min * qty) : `${formatCurrency(pR.min * qty)} – ${formatCurrency(pR.max * qty)}`);

      return { priceDisplay, totalDisplay };
    }

    // Opsi 1
    const isPriceText = typeof priceRaw === 'string' && /[a-zA-Z]/.test(priceRaw.trim());
    const isTotalText = typeof totalRaw === 'string' && /[a-zA-Z]/.test(totalRaw.trim());

    if (isPriceText || isTotalText) {
      const textVal = isPriceText
        ? priceRaw.toString().trim().toUpperCase()
        : totalRaw.toString().trim().toUpperCase();
      const totVal = isTotalText
        ? totalRaw.toString().trim().toUpperCase()
        : textVal;
      return { priceDisplay: textVal, totalDisplay: totVal };
    }

    if (!hasPriceExplicit && !hasTotalExplicit) {
      return { priceDisplay: '0', totalDisplay: '0' };
    }

    const pR = parseRangePrice(priceRaw);
    const tR = hasTotalExplicit ? parseRangePrice(totalRaw) : null;

    const priceDisplay = hasPriceExplicit ? (pR.min === pR.max ? formatCurrency(pR.min) : `${formatCurrency(pR.min)} – ${formatCurrency(pR.max)}`) : '0';
    const totalDisplay = tR 
      ? (tR.min === tR.max ? formatCurrency(tR.min) : `${formatCurrency(tR.min)} – ${formatCurrency(tR.max)}`)
      : (pR.min === pR.max ? formatCurrency(pR.min * qty) : `${formatCurrency(pR.min * qty)} – ${formatCurrency(pR.max * qty)}`);

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
            <div className="flex items-center justify-between pb-1.5 border-b-2 border-black mt-1">
              <div>
                <span className="inline-flex items-center justify-center bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider leading-normal">
                  SURAT ESTIMASI BIAYA &amp; PERSETUJUAN
                </span>
              </div>
              <div className="text-right inline-flex items-center gap-1">
                <span className="text-[10px] text-black font-bold uppercase">No. Estimasi:</span>
                <span className="font-mono font-black text-sm text-[#001F7A]">
                  {estimation.invoice_number}
                </span>
              </div>
            </div>

            {/* Symmetrical Grid: Data Pemilik Kendaraan & Kendaraan */}
            <OfficialDocumentMetaGrid
              customerName={vehicle?.customer_name || 'Pemilik Kendaraan'}
              address={vehicle?.address || '-'}
              unit={`${vehicle?.car_brand || ''} ${vehicle?.car_model || ''} ${vehicle?.car_year ? `(${vehicle.car_year})` : ''}`.trim() || '-'}
              entryTime={jamDatang}
              licensePlate={vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
              docNumber={workOrder?.spk_number || estimation.invoice_number}
              docLabel="No PKB"
              docColor="#001F7A"
              date={tanggalDatang}
              mileage={formatKM(vehicle?.current_mileage, false)}
            />

            {/* Section: Keluhan / Diagnosa Awal (Hanya menampilkan keluhan saja, tanpa uraian pekerjaan) */}
            {complaintsText ? (
              <div className="border-2 border-black rounded-xl p-2.5 bg-white text-xs text-black font-medium">
                <span className="font-black text-black block text-[10px] uppercase tracking-wider mb-0.5">
                  Keluhan / Diagnosa Awal:
                </span>
                <span className="font-black text-black text-[11.5px] leading-snug break-words uppercase">
                  {complaintsText}
                </span>
              </div>
            ) : null}
          </div>

          {/* Items Table — Exact format from user reference screenshot */}
          <div className="border-2 border-black rounded-xl overflow-hidden text-xs my-2 estimation-table-wrapper">
            <table className="w-full text-left border-collapse text-[10.5px] estimation-items-table">
              <thead className="estimation-items-thead" style={{ display: 'table-row-group' }}>
                {hasOpsi2 && hasOpsi2Detail ? (
                  <>
                    <tr className="bg-slate-100 border-b border-black font-black text-black uppercase text-[9.5px]">
                      <th rowSpan={2} className="p-1 w-6 text-center border-r border-black align-middle">No</th>
                      <th rowSpan={2} className="p-1.5 border-r border-black align-middle min-w-[100px]">Saran / Perbaikan / Ganti Sparepart</th>
                      <th colSpan={4} className="p-1 text-center border-r border-black bg-slate-200/80 text-black font-black text-[10px] uppercase tracking-wider">
                        PILIHAN 1 (OPSI 1)
                      </th>
                      <th colSpan={3} className="p-1 text-center bg-blue-100/70 text-blue-950 font-black text-[10px] uppercase tracking-wider">
                        PILIHAN 2 (OPSI 2)
                      </th>
                    </tr>
                    <tr className="bg-slate-50 border-b-2 border-black font-bold text-black uppercase text-[9px]">
                      <th className="p-1 w-7 text-center border-r border-black">QTY</th>
                      <th className="p-1 w-9 text-center border-r border-black">SAT</th>
                      <th className="p-1 w-[78px] text-right border-r border-black">HRG SAT</th>
                      <th className="p-1 w-[84px] text-right border-r border-black">TOTAL 1</th>
                      <th className="p-1 w-7 text-center border-r border-black bg-blue-50/40 text-blue-950 font-black">QTY</th>
                      <th className="p-1 w-[78px] text-right border-r border-black bg-blue-50/40 text-blue-950 font-black">HRG SAT</th>
                      <th className="p-1 w-[84px] text-right bg-blue-50/40 text-blue-950 font-black">TOTAL 2</th>
                    </tr>
                  </>
                ) : (
                  <tr className="bg-slate-100 border-b-2 border-black font-black text-black uppercase text-[10px]">
                    <th className="p-1.5 w-7 text-center border-r border-black">No</th>
                    <th className="p-1.5 border-r border-black">Saran / Perbaikan / Ganti Sparepart</th>
                    <th className="p-1.5 w-9 text-center border-r border-black">QTY</th>
                    <th className="p-1.5 w-11 text-center border-r border-black">Satuan</th>
                    <th className="p-1.5 w-[92px] text-right border-r border-black">Hrg Satuan</th>
                    <th className={`p-1.5 ${hasOpsi2 ? 'w-[100px]' : 'w-[110px]'} text-right border-r border-black`}>
                      {hasOpsi2 ? 'Total Opsi 1' : 'Total Harga'}
                    </th>
                    {hasOpsi2 && (
                      <th className="p-1.5 w-[100px] text-right bg-blue-50/40 text-blue-950 font-black">
                        Total Opsi 2
                      </th>
                    )}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-black">
                {/* Table 1 Slice Divider (Rendered when Double Table is enabled) */}
                {isDoubleTable && (
                  <tr className="bg-slate-200/90 border-b-2 border-black">
                    <td
                      colSpan={hasOpsi2 ? (hasOpsi2Detail ? 9 : 7) : 6}
                      className="py-1 px-4 text-center font-black text-black uppercase tracking-wider text-[11px]"
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
                  const qty2 = isP2Empty ? '-' : (item.qty_opsi2 !== undefined && item.qty_opsi2 !== null && item.qty_opsi2 !== '' ? Number(item.qty_opsi2) || 1 : qty);
                  const p2Info = formatEstimationRowItem(item.price_opsi2, item.total_opsi2, typeof qty2 === 'number' ? qty2 : qty, true);

                  return (
                    <tr key={`t1-${idx}`} className="hover:bg-slate-50 estimation-item-row">
                      <td className="p-1 text-center font-bold border-r border-black align-middle text-black">
                        {idx + 1}
                      </td>
                      <td className="p-1 border-r border-black align-middle min-w-[90px]">
                        <div className="font-bold text-black uppercase break-words whitespace-normal leading-snug">
                          {item.name}
                        </div>
                      </td>
                      <td className="p-1 text-center font-mono font-bold border-r border-black align-middle text-black">
                        {qty}
                      </td>
                      <td className="p-1 text-center text-[10px] font-black uppercase text-black border-r border-black align-middle">
                        {item.unit || 'PCS'}
                      </td>
                      <td className="p-1 text-right border-r border-black align-middle font-mono font-bold text-black">
                        {renderCompactPrice(p1Info.priceDisplay)}
                      </td>
                      <td className="p-1 text-right font-mono font-black text-black border-r border-black align-middle">
                        {renderCompactPrice(p1Info.totalDisplay)}
                      </td>
                      {hasOpsi2 && (
                        hasOpsi2Detail ? (
                          <>
                            <td className="p-1.5 text-center font-mono font-bold border-r border-black align-middle text-blue-950 bg-blue-50/20">
                              {qty2}
                            </td>
                            <td className="p-1.5 text-right border-r border-black align-middle font-mono font-bold text-blue-950 bg-blue-50/20">
                              {renderCompactPrice(p2Info.priceDisplay, 'text-blue-950')}
                            </td>
                            <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                              {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                            </td>
                          </>
                        ) : (
                          <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                            {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                          </td>
                        )
                      )}
                    </tr>
                  );
                })}

                {/* If Double Table: Render Subtotal Table 1, Slice Divider, Table 2 Items, and Subtotal Table 2 */}
                {isDoubleTable && (
                  <>
                    {/* Subtotal Row Table 1 */}
                    <tr className="bg-slate-100/90 text-black font-bold border-y-2 border-black text-xs">
                      <td colSpan={5} className="p-1.5 text-center uppercase tracking-wider font-black text-black text-[10.5px]">
                        TOTAL {table1Title ? `(${table1Title.toUpperCase()})` : 'TABEL 1'}
                      </td>
                      <td className="p-1.5 text-right font-mono font-black text-black border-r border-black">
                        {renderTotalCellCompact(t1Totals.tot1Min, t1Totals.tot1Max)}
                      </td>
                      {hasOpsi2 && (
                        <>
                          {hasOpsi2Detail && <td colSpan={2} className="border-r border-black bg-blue-50/10"></td>}
                          <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                            {renderTotalCellCompact(t1Totals.tot2Min, t1Totals.tot2Max, 'text-blue-950')}
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Slice Divider */}
                    <tr className="bg-slate-200/90 border-y-2 border-black">
                      <td
                        colSpan={hasOpsi2 ? (hasOpsi2Detail ? 9 : 7) : 6}
                        className="py-1 px-4 text-center font-black text-black uppercase tracking-wider text-[11px]"
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
                      const qty2 = isP2Empty ? '-' : (item.qty_opsi2 !== undefined && item.qty_opsi2 !== null && item.qty_opsi2 !== '' ? Number(item.qty_opsi2) || 1 : qty);
                      const p2Info = formatEstimationRowItem(item.price_opsi2, item.total_opsi2, typeof qty2 === 'number' ? qty2 : qty, true);

                      return (
                        <tr key={`t2-${idx}`} className="hover:bg-slate-50 estimation-item-row">
                          <td className="p-1 text-center font-bold border-r border-black align-middle text-black">
                            {displayNum}
                          </td>
                          <td className="p-1 border-r border-black align-middle min-w-[90px]">
                            <div className="font-bold text-black uppercase break-words whitespace-normal leading-snug">
                              {item.name}
                            </div>
                          </td>
                          <td className="p-1 text-center font-mono font-bold border-r border-black align-middle text-black">
                            {qty}
                          </td>
                          <td className="p-1 text-center text-[10px] font-black uppercase text-black border-r border-black align-middle">
                            {item.unit || 'PCS'}
                          </td>
                          <td className="p-1 text-right border-r border-black align-middle font-mono font-bold text-black">
                            {renderCompactPrice(p1Info.priceDisplay)}
                          </td>
                          <td className="p-1 text-right font-mono font-black text-black border-r border-black align-middle">
                            {renderCompactPrice(p1Info.totalDisplay)}
                          </td>
                          {hasOpsi2 && (
                            hasOpsi2Detail ? (
                              <>
                                <td className="p-1.5 text-center font-mono font-bold border-r border-black align-middle text-blue-950 bg-blue-50/20">
                                  {qty2}
                                </td>
                                <td className="p-1.5 text-right border-r border-black align-middle font-mono font-bold text-blue-950 bg-blue-50/20">
                                  {renderCompactPrice(p2Info.priceDisplay, 'text-blue-950')}
                                </td>
                                <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                                  {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                                </td>
                              </>
                            ) : (
                              <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                                {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                              </td>
                            )
                          )}
                        </tr>
                      );
                    })}

                    {/* Subtotal Row Table 2 */}
                    <tr className="bg-slate-100/90 text-black font-bold border-y-2 border-black text-xs">
                      <td colSpan={5} className="p-1.5 text-center uppercase tracking-wider font-black text-black text-[10.5px]">
                        TOTAL {table2Title ? `(${table2Title.toUpperCase()})` : 'TABEL 2'}
                      </td>
                      <td className="p-1.5 text-right font-mono font-black text-black border-r border-black">
                        {renderTotalCellCompact(t2Totals.tot1Min, t2Totals.tot1Max)}
                      </td>
                      {hasOpsi2 && (
                        <>
                          {hasOpsi2Detail && <td colSpan={2} className="border-r border-black bg-blue-50/10"></td>}
                          <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                            {renderTotalCellCompact(t2Totals.tot2Min, t2Totals.tot2Max, 'text-blue-950')}
                          </td>
                        </>
                      )}
                    </tr>
                  </>
                )}
              </tbody>
              {/* Grand Total Row: JUMLAH KESELURUHAN (Rendered as separate tbody to ensure it only appears once at the very end of items, never at page 1 bottom) */}
              <tbody className="border-t-2 border-black estimation-grand-total-tbody">
                <tr className="bg-slate-100 font-black text-xs estimation-grand-total-row avoid-break">
                  <td colSpan={5} className="p-2 text-center uppercase tracking-wider text-black font-black">
                    JUMLAH KESELURUHAN
                  </td>
                  <td className="p-2 text-right font-mono font-black text-black border-r border-black text-xs">
                    {renderTotalCellCompact(grandTot1Min, grandTot1Max)}
                  </td>
                  {hasOpsi2 && (
                    <>
                      {hasOpsi2Detail && <td colSpan={2} className="border-r border-black bg-blue-50/10"></td>}
                      <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/40 text-xs">
                        {renderTotalCellCompact(grandTot2Min, grandTot2Max, 'text-blue-950')}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* KETERANGAN BOX (Matching screenshot) */}
          <div className="border-2 border-black rounded-xl p-3 bg-white text-xs space-y-1">
            <h5 className="font-black text-black uppercase text-[11px]">
              KETERANGAN:
            </h5>
            <p className="text-black leading-relaxed font-semibold text-[10.5px]">
              {estimation.admin_notes || 'Harga di atas merupakan estimasi perkiraan awal. Apabila ditemukan komponen lain yang perlu diganti selama proses pembongkaran, teknisi kami akan segera mengonfirmasi terlebih dahulu kepada pemilik kendaraan.'}
            </p>
          </div>

          {/* Ketentuan Estimasi Berbutir */}
          <div className="estimation-terms-box avoid-break border-2 border-black rounded-xl p-3 bg-amber-50/30 text-black text-[10px] space-y-1 leading-relaxed">
            <h5 className="font-black text-[#8B0000] uppercase text-[10.5px]">
              KETENTUAN ESTIMASI:
            </h5>
            <ol className="space-y-0.5 pl-1 font-semibold list-none text-black">
              <li><strong className="font-black text-black">1.</strong> Pemilik kendaraan tidak diperkenankan membawa sparepart sendiri pada pekerjaan Overhaul Mesin/Transmisi.</li>
              <li><strong className="font-black text-black">2.</strong> Segala risiko akibat part bawaan sendiri tidak menjadi tanggung jawab/garansi kami.</li>
              <li><strong className="font-black text-black">3.</strong> Apabila membawa part sendiri, batas maksimal pengadaan part adalah 2 hari. Selebihnya dikenakan biaya parkir <strong className="font-black text-black">Rp25.000/hari</strong>.</li>
              <li><strong className="font-black text-black">4.</strong> Harga estimasi yang muncul berlaku selama <strong className="font-black text-black">1 minggu</strong> dari tanggal estimasi dikeluarkan.</li>
            </ol>
          </div>

          {/* Symmetrical Dual Signatures */}
          <div className="estimation-signatures-box avoid-break border-2 border-black rounded-xl p-3 bg-white space-y-2 my-2">
            <h4 className="text-center font-black text-xs uppercase tracking-wider text-black pb-1 border-b-2 border-black">
              Persetujuan Estimasi Biaya
            </h4>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="border-2 border-black rounded-lg p-2 pb-1.5 bg-slate-50 flex flex-col justify-between min-h-[110px]">
                <p className="font-black text-[#001F7A] text-[10px] uppercase">Estimator</p>
                <div className="h-11 flex items-center justify-center border border-dashed border-slate-400 rounded bg-white my-0.5 overflow-hidden">
                  {estimation.estimator_signature || (estimation as any).signature_admin_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={estimation.estimator_signature || (estimation as any).signature_admin_url}
                      alt="TTD Estimator"
                      className="max-h-10 object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-500 italic">Tanda tangan Estimator</span>
                  )}
                </div>
                <p className="font-black text-black text-[10px] border-t-2 border-black pt-0.5 break-words leading-tight">
                  {signerEstimator || estimation.estimator_name || 'Via Rizkiana'}
                </p>
              </div>

              <div className="border-2 border-black rounded-lg p-2 pb-1.5 bg-slate-50 flex flex-col justify-between min-h-[110px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Persetujuan Pemilik Kendaraan</p>
                <div className="h-11 flex items-center justify-center border border-dashed border-slate-400 rounded bg-white my-0.5 overflow-hidden">
                  {estimation.customer_signature || estimation.signature_customer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={estimation.customer_signature || estimation.signature_customer_url}
                      alt="TTD Pemilik Kendaraan"
                      className="max-h-10 object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-500 italic">Tanda tangan persetujuan</span>
                  )}
                </div>
                <p className="font-black text-black text-[10px] border-t-2 border-black pt-0.5 break-words leading-tight">
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
