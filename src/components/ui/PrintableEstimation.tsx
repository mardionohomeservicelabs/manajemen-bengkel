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
  formatNumberOrText,
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
    // Ambil HTML dari .doc-sheet (konten dokumen estimasi murni)
    const docSheet = document.querySelector('.printable-estimation-sheet') as HTMLElement;
    if (!docSheet) return;

    const origin = window.location.origin;

    // Kumpulkan semua <style> inline (Tailwind yang sudah di-compile + custom CSS)
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map((el) => `<style>${el.textContent}</style>`)
      .join('\n');

    // Kumpulkan <link rel="stylesheet"> dengan URL diubah ke absolut
    const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((el) => {
        const href = (el as HTMLLinkElement).href;
        // href sudah absolut dari browser, langsung pakai
        return `<link rel="stylesheet" href="${href}" />`;
      })
      .join('\n');

    // Ambil innerHTML dokumen estimasi dan ganti semua src relatif ke absolut
    let docHtml = docSheet.innerHTML;
    // Ganti src="/..." menjadi src="https://..."
    docHtml = docHtml.replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`);
    docHtml = docHtml.replace(/href="\/([^"]+)"/g, `href="${origin}/$1"`);

    // Buat HTML lengkap untuk popup window
    const popupHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Estimasi Biaya - ${estimation.invoice_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${linkStyles}
  ${inlineStyles}
  <style>
    @page {
      size: 210mm auto;
      margin: 8mm 10mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: 'Montserrat', system-ui, sans-serif !important;
    }
    /* Override wrapper agar tidak ada background abu */
    .doc-preview-wrapper {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
    }
    /* Sheet: full lebar, tanpa shadow/border layar */
    .doc-sheet {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 20px 24px !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      background: #ffffff !important;
      display: block !important;
    }
    /* Pastikan semua bagian estimasi TIDAK terpotong */
    .estimation-header-box,
    .estimation-table-wrapper,
    .estimation-terms-box,
    .estimation-signatures-box,
    .estimation-footer-box {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border-collapse: collapse !important;
      width: 100% !important;
    }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    /* Sembunyikan control bar */
    .no-print { display: none !important; }
    @media print {
      @page { size: 210mm auto; margin: 8mm 10mm; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="doc-preview-wrapper">
    <div class="doc-sheet printable-estimation-sheet space-y-2.5">
      ${docHtml}
    </div>
  </div>
  <script>
    // Tunggu font & semua gambar dimuat lalu print
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1000);
      }, 600);
    });
  <\/script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=920,height=1000,scrollbars=yes');
    if (!popup) {
      alert('Popup diblokir browser. Izinkan popup untuk halaman ini lalu coba lagi.');
      return;
    }
    popup.document.open();
    popup.document.write(popupHtml);
    popup.document.close();
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pelanggan'},\n` +
      `Berikut rincian Surat Estimasi Biaya Perbaikan dari ${settings.name}:\n\n` +
      `No. Estimasi: ${estimation.invoice_number}\n` +
      `Kendaraan: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `Total Estimasi Opsi 1: ${formatCurrency(estimation.total_opsi1 || estimation.total_amount)}\n` +
      (estimation.has_opsi2 ? `Total Estimasi Opsi 2: ${formatCurrency(estimation.total_opsi2 || estimation.total_amount)}\n` : '') +
      `Estimator: ${signerEstimator || 'Via Rizkiana'}\n\n` +
      `Mohon konfirmasi persetujuan pengerjaan dengan membalas pesan ini "SETUJU" atau klik tautan digital approval.\n` +
      `Terima kasih.`
    );
  };

  const waLink = vehicle?.phone_number
    ? createWhatsAppLink(vehicle.phone_number, getWhatsAppMessage())
    : '#';

  // Total Calculations
  const tot1 = itemsTotal(estimation.items || [], 'opsi1') - (estimation.discount_amount || 0);
  const tot2 = itemsTotal(estimation.items || [], 'opsi2') - (estimation.discount_amount || 0);

  function itemsTotal(itemsList: InvoiceItem[], option: 'opsi1' | 'opsi2'): number {
    return itemsList.reduce((sum, it) => {
      if (option === 'opsi1') {
        const val = typeof it.total_opsi1 === 'number'
          ? it.total_opsi1
          : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : (typeof it.price === 'number' ? (it.qty || 1) * it.price : 0));
        return sum + (Number.isNaN(val) ? 0 : val);
      } else {
        const val = typeof it.total_opsi2 === 'number'
          ? it.total_opsi2
          : (typeof it.price_opsi2 === 'number'
            ? (it.qty || 1) * it.price_opsi2
            : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : 0));
        return sum + (Number.isNaN(val) ? 0 : val);
      }
    }, 0);
  }

  const complaintsText = estimation.work_order?.complaints || 'Ketika kena lubang kerasa banget, suara bising sebelah kanan';

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

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
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
        <div className="doc-sheet printable-estimation-sheet space-y-2.5">
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

            {/* Meta Info (Symmetrical 3-Column) */}
            <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-300">
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
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-slate-800 rounded-xl p-2.5 bg-white space-y-1">
                <h4 className="font-black text-[#8B0000] uppercase text-[10.5px] pb-0.5 border-b border-slate-200">
                  Pelanggan / Pemilik:
                </h4>
                <div className="font-black text-slate-900 text-sm">{vehicle?.customer_name || 'Pelanggan'}</div>
                <div className="text-slate-600 font-mono">{vehicle?.phone_number || '-'}</div>
                <div className="text-slate-700 leading-tight text-[11px]">{vehicle?.address || '-'}</div>
              </div>

              <div className="border border-slate-800 rounded-xl p-2.5 bg-white space-y-1">
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

            {/* Section: Keluhan Awal & Status Mobil / Pembayaran Bar (Exact to Reference Screenshot) */}
            {complaintsText && (
              <div className="border border-slate-800 rounded-xl p-2 bg-white text-xs text-slate-900 font-medium">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">Keluhan / Diagnosa Awal:</span>
                <span>{complaintsText}</span>
              </div>
            )}
          </div>

          {/* Items Table — Exact format from user reference screenshot */}
          <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs my-2 estimation-table-wrapper">
            <table className="w-full text-left border-collapse text-[10.5px] estimation-items-table">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900 font-black text-slate-900 uppercase">
                  <th className="p-2 w-8 text-center border-r border-slate-300">No</th>
                  <th className="p-2 border-r border-slate-300">Saran/Perbaikan/Ganti Sparepart</th>
                  <th className="p-2 w-12 text-center border-r border-slate-300">QTY</th>
                  <th className="p-2 w-16 text-center border-r border-slate-300">Satuan</th>
                  <th className="p-2 w-28 text-right border-r border-slate-300">Hrg Sat</th>
                  <th className="p-2 w-28 text-right border-r border-slate-300">Total Opsi 1</th>
                  {estimation.has_opsi2 && (
                    <>
                      <th className="p-2 w-28 text-right border-r border-slate-300 bg-blue-50/40 text-blue-950">Hrg Opsi 2</th>
                      <th className="p-2 w-28 text-right bg-blue-50/40 text-blue-950">Total Opsi 2</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {estimation.items.map((item, idx) => {
                  const p1 = item.price_opsi1 !== undefined ? item.price_opsi1 : item.price;
                  const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof p1 === 'number' ? (item.qty || 1) * p1 : p1);
                  const p2 = item.price_opsi2 !== undefined ? item.price_opsi2 : p1;
                  const tot2 = item.total_opsi2 !== undefined ? item.total_opsi2 : (typeof p2 === 'number' ? (item.qty || 1) * p2 : p2);

                  return (
                    <tr key={idx} className="hover:bg-slate-50 estimation-item-row">
                      <td className="p-1.5 text-center font-bold border-r border-slate-300 align-middle">{idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-300 align-middle">
                        <div className="font-bold text-slate-900 uppercase">{item.name}</div>
                      </td>
                      <td className="p-1.5 text-center font-mono font-bold border-r border-slate-300 align-middle">{item.qty || 1}</td>
                      <td className="p-1.5 text-center text-[10px] font-black uppercase text-slate-700 border-r border-slate-300 align-middle">{item.unit || 'PCS'}</td>
                      <td className="p-1.5 text-right border-r border-slate-300 align-middle font-mono font-bold">
                        {formatNumberOrText(p1)}
                      </td>
                      <td className="p-1.5 text-right font-mono font-black text-slate-900 border-r border-slate-300 align-middle">
                        {formatNumberOrText(tot1)}
                      </td>
                      {estimation.has_opsi2 && (
                        <>
                          <td className="p-1.5 text-right border-r border-slate-300 align-middle font-mono font-bold bg-blue-50/20 text-blue-900">
                            {formatNumberOrText(p2)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-black text-blue-950 bg-blue-50/20 align-middle">
                            {formatNumberOrText(tot2)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total Row: JUMLAH KESELURUHAN (Exact layout from user screenshot) */}
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-xs">
                  <td colSpan={5} className="p-2 text-center uppercase tracking-wider text-slate-900 font-black">
                    JUMLAH KESELURUHAN
                  </td>
                  <td className="p-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 text-sm">
                    {formatNumberOrText(tot1)}
                  </td>
                  {estimation.has_opsi2 && (
                    <>
                      <td className="p-2 bg-blue-50/40 border-r border-slate-300"></td>
                      <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/40 text-sm">
                        {formatNumberOrText(tot2)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* KETERANGAN BOX (Matching screenshot) */}
          <div className="border-2 border-slate-900 rounded-xl p-3 bg-white text-xs space-y-1">
            <h5 className="font-black text-slate-950 uppercase text-[11px]">
              KETERANGAN:
            </h5>
            <p className="text-slate-700 leading-relaxed font-medium text-[10.5px]">
              {estimation.admin_notes || 'Harga di atas merupakan estimasi perkiraan awal. Apabila ditemukan komponen lain yang perlu diganti selama proses pembongkaran, teknisi kami akan segera mengonfirmasi terlebih dahulu kepada customer.'}
            </p>
          </div>

          {/* Ketentuan Estimasi Berbutir */}
          <div className="estimation-terms-box avoid-break border border-slate-800 rounded-xl p-3 bg-amber-50/30 text-slate-900 text-[10px] space-y-1 leading-relaxed">
            <h5 className="font-black text-[#8B0000] uppercase text-[10.5px]">
              KETENTUAN ESTIMASI:
            </h5>
            <ol className="space-y-0.5 pl-1 font-medium list-none">
              <li><strong>1.</strong> Customer tidak diperkenankan membawa sparepart sendiri pada pekerjaan Overhaul Mesin/Transmisi.</li>
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
