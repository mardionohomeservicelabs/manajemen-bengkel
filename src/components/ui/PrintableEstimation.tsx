'use client';

import React, { useState } from 'react';
import { Invoice, InvoiceItem, WorkshopSettings } from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
  createWhatsAppLink,
  parseNumericPrice,
} from '@/lib/utils';
import {
  Printer,
  Share2,
  X,
  FileCheck,
  Calculator,
} from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';

// --- Price range helpers (backward-compatible) ---
function pMin(item: InvoiceItem): number {
  return item.price_min !== undefined ? item.price_min : parseNumericPrice(item.price);
}
function pMax(item: InvoiceItem): number {
  return item.price_max !== undefined ? item.price_max : (item.price_min !== undefined ? item.price_min : parseNumericPrice(item.price));
}
function isTextItem(item: InvoiceItem): boolean {
  return typeof item.price === 'string' && /[a-zA-Z]/.test(item.price) && item.price_min === undefined;
}
function fmtRange(min: number, max: number): string {
  return min === max ? formatCurrency(min) : formatCurrency(min) + ' – ' + formatCurrency(max);
}
function isActiveItem(item: InvoiceItem): boolean {
  return !item.option_group || item.is_active_option === true;
}

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

  // State untuk nama Estimator yang bisa diketik manual (Default: Via Rizkiana)
  const [signerEstimator, setSignerEstimator] = useState<string>('Via Rizkiana');

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pelanggan'},\n` +
      `Berikut rincian Surat Estimasi Biaya Perbaikan dari ${settings.name}:\n\n` +
      `No. Estimasi: ${estimation.invoice_number}\n` +
      `Kendaraan: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `Total Estimasi: ${formatCurrency(estimation.total_amount)}\n` +
      `Estimator: ${signerEstimator || 'Via Rizkiana'}\n\n` +
      `Mohon konfirmasi persetujuan pengerjaan dengan membalas pesan ini "SETUJU" agar teknisi kami dapat segera memulai proses pengerjaan.\n` +
      `Terima kasih.`
    );
  };

  const waLink = vehicle?.phone_number
    ? createWhatsAppLink(vehicle.phone_number, getWhatsAppMessage())
    : '#';

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
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur • Multi-Halaman • Mardiono Home Service</p>
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

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          {vehicle?.phone_number && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Minta Persetujuan WA</span>
            </a>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC AUTO-HEIGHT DOCUMENT PREVIEW CONTAINER (MULTI-PAGE AWARE) */}
      <div className="doc-preview-wrapper rounded-2xl">
        <div className="doc-sheet printable-estimation-sheet space-y-3">
          {/* Header & Identitas Kendaraan */}
          <div className="estimation-header-box avoid-break space-y-2">
            <OfficialDocumentHeader settings={settings} />

            {/* Title Header */}
            <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-900 mt-2">
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

            {/* Meta Info (Symmetrical 3-Column) */}
            <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-300 mt-2">
              <div>
                <span className="text-slate-500 text-[10px] block">Waktu Terbit:</span>
                <strong className="text-slate-900">{formatDateTime(estimation.created_at)}</strong>
              </div>
              {estimation.work_order ? (
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Ref SPK:</span>
                  <strong className="font-mono text-[#001F7A] font-bold">{estimation.work_order.spk_number}</strong>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Tipe Estimasi:</span>
                  <strong className="text-slate-900">Estimasi Awal</strong>
                </div>
              )}
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">Estimator:</span>
                <strong className="text-slate-900 font-black text-[#8B0000]">{signerEstimator || 'Via Rizkiana'}</strong>
              </div>
            </div>

            {/* Customer & Vehicle Info Box (Symmetrical 2-Column) */}
            <div className="grid grid-cols-2 gap-3 text-xs mt-2">
              <div className="border border-slate-800 rounded-xl p-3 bg-white space-y-1">
                <h4 className="font-black text-[#8B0000] uppercase text-[10.5px] pb-0.5 border-b border-slate-200">
                  Pelanggan / Pemilik:
                </h4>
                <div className="font-black text-slate-900 text-sm">{vehicle?.customer_name || 'Pelanggan'}</div>
                <div className="text-slate-600 font-mono">{vehicle?.phone_number || '-'}</div>
                <div className="text-slate-700 leading-tight text-[11px]">{vehicle?.address || '-'}</div>
              </div>

              <div className="border border-slate-800 rounded-xl p-3 bg-white space-y-1">
                <h4 className="font-black text-[#001F7A] uppercase text-[10.5px] pb-0.5 border-b border-slate-200">
                  Identitas Kendaraan:
                </h4>
                <div className="font-mono font-black text-[#8B0000] text-sm">
                  {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
                </div>
                <div className="font-bold text-slate-900">
                  {vehicle?.car_brand} {vehicle?.car_model} ({vehicle?.car_year || '-'})
                </div>
                <div className="text-slate-600 text-[11px]">
                  KM: <strong>{vehicle?.current_mileage ? `${vehicle.current_mileage.toLocaleString('id-ID')} KM` : '-'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table — multi-page flow with repeating thead and clean row breaks */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs my-2 estimation-table-wrapper">
            <table className="w-full text-left border-collapse text-[11px] estimation-items-table">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-800 font-bold text-slate-900">
                  <th className="p-2 w-8 text-center border-r border-slate-300">No.</th>
                  <th className="p-2 border-r border-slate-300">Rincian Estimasi Jasa &amp; Sparepart</th>
                  <th className="p-2 w-14 text-center border-r border-slate-300">Tipe</th>
                  <th className="p-2 w-10 text-center border-r border-slate-300">Qty</th>
                  <th className="p-2 w-14 text-center border-r border-slate-300">Satuan</th>
                  <th className="p-2 w-28 text-right border-r border-slate-300">Harga Opsi 1</th>
                  <th className="p-2 w-28 text-right border-r border-slate-300">Total Opsi 1</th>
                  {estimation.has_opsi2 && (
                    <>
                      <th className="p-2 w-28 text-right border-r border-slate-300 bg-purple-50/40">Harga Opsi 2</th>
                      <th className="p-2 w-28 text-right bg-purple-50/40">Total Opsi 2</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  let rowNum = 0;
                  return estimation.items.map((item, idx) => {
                    if (!isActiveItem(item)) return null;
                    rowNum++;
                    const p1 = item.price_opsi1 !== undefined ? item.price_opsi1 : pMin(item);
                    const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (item.qty || 1) * p1;
                    const p2 = item.price_opsi2 !== undefined ? item.price_opsi2 : pMax(item);
                    const tot2 = item.total_opsi2 !== undefined ? item.total_opsi2 : (item.qty || 1) * p2;
                    const textMode = isTextItem(item);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 estimation-item-row">
                        <td className="p-2 text-center font-bold border-r border-slate-300 align-top">{rowNum}</td>
                        <td className="p-2 border-r border-slate-300 align-top">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          {item.code && <div className="text-[9.5px] text-slate-500 font-mono">{item.code}</div>}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 align-top">
                          <span className={'inline-block text-[9px] px-1.5 py-0.5 rounded font-black ' + (item.is_service ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900')}>
                            {item.is_service ? 'JASA' : 'PART'}
                          </span>
                        </td>
                        <td className="p-2 text-center font-mono font-bold border-r border-slate-300 align-top">{item.qty || 1}</td>
                        <td className="p-2 text-center text-[10px] font-bold uppercase text-slate-600 border-r border-slate-300 align-top">{item.unit || 'PCS'}</td>
                        <td className="p-2 text-right border-r border-slate-300 align-top font-mono">
                          {textMode ? <span className="font-bold text-amber-800 italic">{item.price}</span> : formatCurrency(p1)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300 align-top">
                          {textMode ? '-' : formatCurrency(tot1)}
                        </td>
                        {estimation.has_opsi2 && (
                          <>
                            <td className="p-2 text-right border-r border-slate-300 align-top font-mono bg-purple-50/20 text-purple-900">
                              {formatCurrency(p2)}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-purple-950 bg-purple-50/20 align-top">
                              {formatCurrency(tot2)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* 1. Breakdown Total — with price range & multi options */}
          <div className="estimation-total-box avoid-break flex justify-end my-2">
            <div className="w-full sm:w-96 space-y-1 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300">
              {(() => {
                const tot1 = (estimation.total_opsi1 !== undefined ? estimation.total_opsi1 : estimation.total_amount) || 0;
                const tot2 = estimation.total_opsi2 || tot1;
                return (
                  <>
                    {estimation.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-800 font-bold text-[11px]">
                        <span>Diskon Khusus:</span>
                        <span className="font-mono">- {formatCurrency(estimation.discount_amount)}</span>
                      </div>
                    )}
                    <div className="border-t-2 border-slate-800 pt-1 flex justify-between text-sm font-black text-[#8B0000]">
                      <span>TOTAL ESTIMASI OPSI 1:</span>
                      <span className="font-mono text-base">{formatCurrency(tot1)}</span>
                    </div>
                    {estimation.has_opsi2 && (
                      <div className="flex justify-between text-sm font-black text-purple-900 pt-0.5">
                        <span>TOTAL ESTIMASI OPSI 2:</span>
                        <span className="font-mono text-base">{formatCurrency(tot2)}</span>
                      </div>
                    )}
                    {estimation.customer_approved_option && (
                      <div className="text-[10px] text-emerald-800 font-bold text-right pt-1">
                        ✓ Disetujui Customer: {estimation.customer_approved_option === 'opsi2' ? 'OPSI 2' : 'OPSI 1'}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* 2. KETERANGAN KHUSUS & KETENTUAN ESTIMASI RESMI */}
          <div className="estimation-terms-box avoid-break border-2 border-[#8B0000] rounded-xl p-3 bg-amber-50/40 text-slate-900 text-[10px] sm:text-[10.5px] space-y-2 leading-relaxed my-2">
            {/* Highlight Keterangan */}
            <div className="bg-[#8B0000] text-white p-2 rounded-lg font-black text-center text-[10px] sm:text-[11px] uppercase tracking-wide shadow-xs">
              APABILA SELAMA PENGECEKAN TERDAPAT SPAREPART YANG PERLU DIGANTI, AKAN KAMI KONFIRMASIKAN TERLEBIH DAHULU. HARGA DI ATAS BERSIFAT ESTIMASI SEMENTARA.
            </div>

            {/* Ketentuan Estimasi Berbutir */}
            <div className="pt-1">
              <h5 className="font-black text-[#8B0000] uppercase text-[11px] mb-1">
                KETENTUAN ESTIMASI:
              </h5>
              <ol className="space-y-1 pl-1 font-medium list-none">
                <li><strong>1.</strong> Customer tidak diperkenankan membawa sparepart sendiri pada pekerjaan Overhaul Mesin/Transmisi.</li>
                <li><strong>2.</strong> Segala risiko akibat part bawaan sendiri tidak menjadi tanggung jawab/garansi kami.</li>
                <li><strong>3.</strong> Apabila membawa part sendiri, batas maksimal pengadaan part adalah 2 hari. Selebihnya akan dikenakan biaya parkir <strong>Rp25.000/hari</strong>.</li>
                <li><strong>4.</strong> Jika membawa part sendiri, tidak ada garansi dalam bentuk apa pun.</li>
                <li><strong>5.</strong> Apabila sparepart sudah terpasang dan tidak berfungsi, kami berlakukan jasa double.</li>
                <li><strong>6.</strong> Harga estimasi yang muncul berlaku selama <strong>1 minggu</strong> dari tanggal estimasi dikeluarkan.</li>
                <li><strong>7.</strong> Apabila harga sparepart mengalami kenaikan, akan kami informasikan kembali dengan estimasi terbaru.</li>
              </ol>
            </div>
          </div>

          {/* 3. Symmetrical Dual Signatures */}
          <div className="estimation-signatures-box avoid-break border border-slate-900 rounded-xl p-3 bg-white space-y-2 my-2">
            <h4 className="text-center font-black text-xs uppercase tracking-wider text-slate-950 pb-1 border-b border-slate-200">
              Persetujuan Estimasi Biaya
            </h4>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[115px]">
                <p className="font-black text-[#001F7A] text-[10px] uppercase">Estimator</p>
                <div className="h-14 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5">
                  <span className="text-[9px] text-slate-400 italic">Tanda tangan Estimator</span>
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  {signerEstimator || 'Via Rizkiana'}
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[115px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Persetujuan Pelanggan</p>
                <div className="h-14 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5 overflow-hidden">
                  {estimation.customer_signature || estimation.signature_customer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={estimation.customer_signature || estimation.signature_customer_url}
                      alt="TTD Customer"
                      className="max-h-12 object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">Tanda tangan persetujuan</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  {estimation.customer_signed_name || vehicle?.customer_name || 'Pelanggan'}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Footer */}
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
