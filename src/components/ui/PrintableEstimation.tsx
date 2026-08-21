'use client';

import React, { useState } from 'react';
import { Invoice, WorkshopSettings } from '@/lib/types/database';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlate,
  createWhatsAppLink,
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

  // State untuk nama SA yang bisa diketik manual
  const [signerSA, setSignerSA] = useState<string>('');

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pelanggan'},\n` +
      `Berikut rincian Surat Estimasi Biaya Perbaikan dari ${settings.name}:\n\n` +
      `No. Estimasi: ${estimation.invoice_number}\n` +
      `Kendaraan: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `Total Estimasi: ${formatCurrency(estimation.total_amount)}\n\n` +
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
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur • Mardiono Home Service</p>
          </div>
        </div>

        {/* Input Nama SA */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Service Advisor (SA)</label>
          <input
            type="text"
            value={signerSA}
            onChange={(e) => setSignerSA(e.target.value)}
            placeholder="Nama SA yang menandatangani..."
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

      {/* DYNAMIC AUTO-HEIGHT DOCUMENT PREVIEW CONTAINER */}
      <div className="doc-preview-wrapper rounded-2xl">
        <div className="doc-sheet space-y-3">
          {/* Header */}
          <OfficialDocumentHeader settings={settings} />

          {/* Title Header */}
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-900">
            <div>
              <span className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-black uppercase tracking-wider">
                SURAT ESTIMASI BIAYA & PERSETUJUAN
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
              <span className="text-slate-500 text-[10px] block">Service Advisor:</span>
              <strong className="text-slate-900">Dito Ade Prawira</strong>
            </div>
          </div>

          {/* Customer & Vehicle Info Box (Symmetrical 2-Column) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
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

          {/* Items Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-800 font-bold text-slate-900">
                  <th className="p-2 w-8 text-center border-r border-slate-300">No.</th>
                  <th className="p-2 border-r border-slate-300">Rincian Estimasi Jasa & Sparepart</th>
                  <th className="p-2 w-16 text-center border-r border-slate-300">Tipe</th>
                  <th className="p-2 w-12 text-center border-r border-slate-300">Qty</th>
                  <th className="p-2 w-24 text-right border-r border-slate-300">Estimasi Biaya</th>
                  <th className="p-2 w-28 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estimation.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 text-center font-bold border-r border-slate-300">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.code && <div className="text-[9.5px] text-slate-500 font-mono">{item.code}</div>}
                    </td>
                    <td className="p-2 text-center border-r border-slate-300">
                      <span
                        className={`inline-block text-[9.5px] px-2 py-0.5 rounded font-black ${
                          item.is_service ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.is_service ? 'JASA' : 'PART'}
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono font-bold border-r border-slate-300">{item.qty}</td>
                    <td className="p-2 text-right font-mono border-r border-slate-300">{formatCurrency(item.price)}</td>
                    <td className="p-2 text-right font-mono font-black text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Symmetrical Grid: Terms & Total Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-300 space-y-1 text-[11px]">
              <h5 className="font-black text-amber-900 uppercase text-[10.5px] flex items-center space-x-1">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Ketentuan Estimasi & Masa Berlaku</span>
              </h5>
              <p className="text-slate-700 leading-snug">
                1. Estimasi biaya berlaku selama <strong>14 hari kerja</strong> sejak diterbitkan.
              </p>
              <p className="text-slate-700 leading-snug">
                2. Jika terdapat temuan komponen rusak lainnya di luar estimasi, teknisi akan konfirmasi persetujuan terlebih dahulu.
              </p>
            </div>

            <div className="space-y-1 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300">
              <div className="flex justify-between text-slate-700 font-semibold text-[11px]">
                <span>Subtotal Estimasi:</span>
                <span className="font-mono font-bold">{formatCurrency(estimation.subtotal)}</span>
              </div>

              {estimation.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-800 font-bold text-[11px]">
                  <span>Diskon Promo:</span>
                  <span className="font-mono">- {formatCurrency(estimation.discount_amount)}</span>
                </div>
              )}

              {estimation.tax_amount > 0 && (
                <div className="flex justify-between text-slate-700 font-semibold text-[11px]">
                  <span>PPN ({estimation.tax_percent}%):</span>
                  <span className="font-mono">{formatCurrency(estimation.tax_amount)}</span>
                </div>
              )}

              <div className="border-t-2 border-slate-800 pt-1 flex justify-between text-sm font-black text-[#8B0000]">
                <span>Total Estimasi Biaya:</span>
                <span className="font-mono text-base">{formatCurrency(estimation.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Symmetrical Dual Signatures */}
          <div className="border border-slate-900 rounded-xl p-3 bg-white space-y-2">
            <h4 className="text-center font-black text-xs uppercase tracking-wider text-slate-950 pb-1 border-b border-slate-200">
              Persetujuan Estimasi Biaya
            </h4>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[105px]">
                <p className="font-black text-[#001F7A] text-[10px] uppercase">Service Advisor (SA)</p>
                <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5">
                  <span className="text-[9px] text-slate-400 italic">Tanda tangan SA</span>
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5">
                  {signerSA || 'Service Advisor (SA)'}
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[105px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Persetujuan Pelanggan</p>
                <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white my-0.5">
                  <span className="text-[9px] text-slate-400 italic">Tanda tangan persetujuan</span>
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  {vehicle?.customer_name || 'Pelanggan'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <OfficialDocumentFooter
            documentCode={estimation.invoice_number}
            termsNote="Estimasi Biaya Resmi Mardiono Home Service • Berlaku 14 Hari"
          />
        </div>
      </div>
    </div>
  );
}
