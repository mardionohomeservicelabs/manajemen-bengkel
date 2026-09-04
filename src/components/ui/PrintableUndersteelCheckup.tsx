'use client';

import React, { useState, useRef } from 'react';
import { UndersteelCheckupData, WorkshopSettings } from '@/lib/types/database';
import { formatDate, formatPlate, createWhatsAppLink } from '@/lib/utils';
import { printCleanDocument } from '@/lib/utils/print-helper';
import { Printer, Share2, X, Wrench, ShieldCheck } from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';
import { DocumentImageModal } from './DocumentImageModal';

interface PrintableUndersteelCheckupProps {
  checkup: UndersteelCheckupData;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableUndersteelCheckup({
  checkup,
  settings,
  onClose,
}: PrintableUndersteelCheckupProps) {
  const documentRef = useRef<HTMLDivElement>(null);

  const [signerTeknisi, setSignerTeknisi] = useState<string>(
    checkup.technician_name || 'Mekanik Understeel'
  );

  const handlePrint = () => {
    printCleanDocument(documentRef.current, `Understeel - ${checkup.document_number}`);
  };

  const getWhatsAppMessage = () => {
    const replacedItems = (checkup.items || [])
      .filter((i) => i.replace)
      .map((i) => `• ${i.label} (GANTI)`)
      .slice(0, 5)
      .join('\n');

    const serviceItems = (checkup.items || [])
      .filter((i) => i.service)
      .map((i) => `• ${i.label} (SERVICE)`)
      .slice(0, 5)
      .join('\n');

    return (
      `Halo Bpk/Ibu ${checkup.customer_name || 'Pelanggan'},\n` +
      `Berikut hasil Form Keluhan Understeel (Kaki-Kaki) kendaraan Anda (${checkup.license_plate}) dari ${settings.name}:\n\n` +
      `No. Dokumen: ${checkup.document_number}\n` +
      `Mobil: ${checkup.car_brand || ''} ${checkup.car_model || ''} (${checkup.car_year || ''} / ${checkup.car_color || ''})\n` +
      `Teknisi: ${signerTeknisi}\n\n` +
      (replacedItems ? `Part Perlu Diganti:\n${replacedItems}\n\n` : '') +
      (serviceItems ? `Part Perlu Diservis:\n${serviceItems}\n\n` : '') +
      `Dokumen lengkap siap dicetak. Terima kasih atas kepercayaan Anda!`
    );
  };

  const waLink = createWhatsAppLink('081230762930', getWhatsAppMessage());

  const items = checkup.items || [];
  const customItems = checkup.custom_items || [
    { label: '-', replace: false, service: false, notes: '' },
    { label: '-', replace: false, service: false, notes: '' },
    { label: '-', replace: false, service: false, notes: '' },
    { label: '-', replace: false, service: false, notes: '' },
    { label: '-', replace: false, service: false, notes: '' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Top Action Control Bar */}
      <div className="no-print bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 flex-wrap">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#8B0000] flex items-center justify-center text-white font-bold flex-shrink-0">
            <Wrench className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Form Keluhan Understeel (Kaki-Kaki)</h3>
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur • Mardiono Home Service</p>
          </div>
        </div>

        {/* Input Nama Teknisi */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Teknisi</label>
          <input
            type="text"
            value={signerTeknisi}
            onChange={(e) => setSignerTeknisi(e.target.value)}
            placeholder="Nama teknisi pemeriksa..."
            className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-52 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-[#8B0000] hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <DocumentImageModal
            documentRef={documentRef}
            label="Lihat sebagai Gambar"
            filename={`Understeel-${checkup.document_number}`}
          />
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span>Kirim WhatsApp</span>
          </a>
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
        <div ref={documentRef} className="doc-sheet printable-understeel-sheet space-y-2 text-slate-900 font-sans">
          {/* Header */}
          <OfficialDocumentHeader settings={settings} />

          {/* Title Header: FORM KELUHAN UNDERSTEEL */}
          <div className="border-2 border-slate-900 text-center py-1 bg-white">
            <h1 className="text-base sm:text-lg font-black tracking-widest uppercase font-serif text-slate-950">
              FORM KELUHAN UNDERSTEEL
            </h1>
          </div>

          {/* Vehicle Metadata Box */}
          <div className="border border-slate-900 text-xs p-2.5 grid grid-cols-2 gap-3 bg-white">
            <div className="space-y-1 border-r border-slate-300 pr-2">
              <div className="flex items-baseline gap-1.5">
                <span className="w-20 shrink-0 font-bold text-slate-800 whitespace-nowrap">Merk:</span>
                <span className="font-bold text-slate-950 flex-1 min-w-0 break-words">{checkup.car_brand || '-'}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-20 shrink-0 font-bold text-slate-800 whitespace-nowrap">Tipe Mobil:</span>
                <span className="font-bold text-slate-950 flex-1 min-w-0 break-words leading-tight">{checkup.car_model || '-'}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-20 shrink-0 font-bold text-slate-800 whitespace-nowrap">Tahun/Warna:</span>
                <span className="font-bold text-slate-950 flex-1 min-w-0 break-words">{checkup.car_year || '-'} / {checkup.car_color || '-'}</span>
              </div>
            </div>

            <div className="space-y-1 pl-1">
              <div className="flex items-baseline gap-1.5">
                <span className="w-18 shrink-0 font-bold text-slate-800 whitespace-nowrap">No. Polisi:</span>
                <span className="font-mono font-black text-[#8B0000] text-[13px] flex-1 min-w-0">{formatPlate(checkup.license_plate)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-18 shrink-0 font-bold text-slate-800 whitespace-nowrap">Pelanggan:</span>
                <span className="font-bold text-slate-950 flex-1 min-w-0 break-words leading-tight">{checkup.customer_name || 'Pelanggan'}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-18 shrink-0 font-bold text-slate-800 whitespace-nowrap">Tanggal:</span>
                <span className="font-bold text-slate-950 flex-1 min-w-0">{formatDate(checkup.check_date)}</span>
              </div>
            </div>
          </div>

          {/* Main 26-Point Checklist Table */}
          <div className="border border-slate-900 overflow-hidden text-[10.5px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-white font-black text-slate-900">
                  <th className="p-1 pl-2 border-r border-slate-900 w-[42%] text-left">Order:</th>
                  <th className="p-1 border-r border-slate-900 w-[14%] text-center">DIGANTI</th>
                  <th className="p-1 border-r border-slate-900 w-[14%] text-center">SERVICE</th>
                  <th className="p-1 pl-2 w-[30%] text-center">KETERANGAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {items.map((item, idx) => (
                  <tr key={idx} className="h-5">
                    <td className="p-0.5 pl-2 border-r border-slate-900 font-bold uppercase truncate">
                      {item.no}. {item.label}
                      {item.sub_label && <span className="text-slate-500 font-normal"> ({item.sub_label})</span>}
                    </td>
                    <td className="p-0.5 border-r border-slate-900 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border border-slate-900 flex items-center justify-center bg-white rounded-[2px]">
                          {item.replace ? (
                            <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-0.5 border-r border-slate-900 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border border-slate-900 flex items-center justify-center bg-white rounded-[2px]">
                          {item.service ? (
                            <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-0.5 pl-2 text-slate-800 font-semibold truncate">
                      {item.notes || ''}
                    </td>
                  </tr>
                ))}

                {/* Header Keterangan Lain-Lain */}
                <tr className="bg-slate-100/60 font-black border-t border-b border-slate-900 text-[10px]">
                  <td colSpan={4} className="p-0.5 pl-2 uppercase">
                    KETERANGAN LAIN LAIN:
                  </td>
                </tr>

                {/* 5 Custom Rows */}
                {customItems.map((c, cIdx) => (
                  <tr key={`custom-${cIdx}`} className="h-5">
                    <td className="p-0.5 pl-2 border-r border-slate-900 font-bold truncate">
                      {c.label && c.label !== '-' ? c.label : '-'}
                    </td>
                    <td className="p-0.5 border-r border-slate-900 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border border-slate-900 flex items-center justify-center bg-white rounded-[2px]">
                          {c.replace ? (
                            <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-0.5 border-r border-slate-900 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border border-slate-900 flex items-center justify-center bg-white rounded-[2px]">
                          {c.service ? (
                            <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-0.5 pl-2 text-slate-800 font-semibold truncate">
                      {c.notes || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Box: Teknisi Yang Mengerjakan & TTD Mekanik */}
          <div className="border border-slate-900 text-xs grid grid-cols-12 bg-white">
            <div className="col-span-9 p-2 border-r border-slate-900 space-y-1">
              <div className="font-black text-[10.5px] uppercase">
                KETERANGAN YANG MENGERJAKAN:
              </div>
              <div className="space-y-0.5 text-[11px] font-bold text-slate-800 pl-1">
                <div>1. {checkup.technicians_assigned?.[0] || signerTeknisi || '..........................................................'}</div>
                <div>2. {checkup.technicians_assigned?.[1] || '..........................................................'}</div>
                <div>3. {checkup.technicians_assigned?.[2] || '..........................................................'}</div>
              </div>
            </div>

            <div className="col-span-3 p-2 pb-1.5 flex flex-col justify-between text-center min-h-[78px]">
              <div className="font-black text-[10px] uppercase">TTD MEKANIK:</div>
              <div className="h-9 flex items-center justify-center my-0.5">
                {checkup.mechanic_signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkup.mechanic_signature_url}
                    alt="TTD Mekanik"
                    className="max-h-8 object-contain"
                  />
                ) : (
                  <span className="text-[9px] text-slate-400 italic">(Tanda Tangan)</span>
                )}
              </div>
              <div className="text-[10px] font-bold border-t border-slate-300 pt-0.5 truncate leading-tight">
                {signerTeknisi || 'Mekanik'}
              </div>
            </div>
          </div>

          {/* 4-View Car Illustration Diagram */}
          <div className="border border-slate-900 p-2 bg-white text-center space-y-1">
            <div className="grid grid-cols-4 gap-2 items-end">
              {/* Kiri */}
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-700 block">KIRI</span>
                <div className="h-12 border border-slate-300 rounded bg-slate-50 flex items-center justify-center p-1">
                  <svg className="w-full h-full text-slate-700" viewBox="0 0 160 60" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 40 L25 40 L30 25 L65 20 L110 20 L130 30 L150 35 L150 45 L135 45 M35 45 A10 10 0 0 0 55 45 M105 45 A10 10 0 0 0 125 45 M55 45 L105 45 M125 45 L135 45" />
                    <circle cx="45" cy="45" r="7" />
                    <circle cx="115" cy="45" r="7" />
                    <line x1="68" y1="22" x2="68" y2="38" />
                    <line x1="100" y1="22" x2="100" y2="38" />
                  </svg>
                </div>
              </div>

              {/* Kanan */}
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-700 block">KANAN</span>
                <div className="h-12 border border-slate-300 rounded bg-slate-50 flex items-center justify-center p-1">
                  <svg className="w-full h-full text-slate-700" viewBox="0 0 160 60" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M150 40 L135 40 L130 25 L95 20 L50 20 L30 30 L10 35 L10 45 L25 45 M125 45 A10 10 0 0 1 105 45 M55 45 A10 10 0 0 1 35 45 M105 45 L55 45 M35 45 L25 45" />
                    <circle cx="115" cy="45" r="7" />
                    <circle cx="45" cy="45" r="7" />
                    <line x1="92" y1="22" x2="92" y2="38" />
                    <line x1="60" y1="22" x2="60" y2="38" />
                  </svg>
                </div>
              </div>

              {/* Depan */}
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-700 block">DEPAN</span>
                <div className="h-12 border border-slate-300 rounded bg-slate-50 flex items-center justify-center p-1">
                  <svg className="w-full h-full text-slate-700" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="20" y="15" width="60" height="35" rx="6" />
                    <path d="M25 28 L75 28" />
                    <circle cx="30" cy="38" r="4" />
                    <circle cx="70" cy="38" r="4" />
                    <rect x="40" y="36" width="20" height="6" rx="1" />
                    <rect x="15" y="42" width="8" height="12" rx="2" />
                    <rect x="77" y="42" width="8" height="12" rx="2" />
                  </svg>
                </div>
              </div>

              {/* Belakang */}
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-700 block">BELAKANG</span>
                <div className="h-12 border border-slate-300 rounded bg-slate-50 flex items-center justify-center p-1">
                  <svg className="w-full h-full text-slate-700" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="20" y="15" width="60" height="35" rx="6" />
                    <path d="M25 28 L75 28" />
                    <circle cx="30" cy="35" r="3" />
                    <circle cx="70" cy="35" r="3" />
                    <rect x="38" y="34" width="24" height="8" rx="1" />
                    <rect x="15" y="42" width="8" height="12" rx="2" />
                    <rect x="77" y="42" width="8" height="12" rx="2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Slogan Banner */}
          <div className="border-2 border-slate-900 p-2 text-center bg-white">
            <p className="font-black text-[10.5px] sm:text-xs uppercase tracking-wide text-slate-950">
              PASTIKAN KONDISI MOBIL CUSTOMER BERSIH, AMAN DAN SELALU UTAMAKAN KESELAMATAN DALAM BEKERJA
            </p>
          </div>

          {/* Document Footer Note */}
          <OfficialDocumentFooter
            documentCode={checkup.document_number}
            termsNote="Form Keluhan Understeel Sah • Mardiono Home Service"
          />
        </div>
      </div>
    </div>
  );
}
