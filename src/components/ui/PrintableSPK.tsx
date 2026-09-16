'use client';

import React, { useState, useRef, useEffect } from 'react';
import { WorkOrder, WorkshopSettings } from '@/lib/types/database';
import {
  formatDate,
  formatDateTime,
  formatPlate,
  createWhatsAppLink,
  formatKM,
} from '@/lib/utils';
import { printCleanDocument } from '@/lib/utils/print-helper';
import {
  Printer,
  Share2,
  X,
  FileText,
  Pencil,
} from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
  OfficialDocumentMetaGrid,
} from './OfficialDocumentLayout';
import { DocumentImageModal } from './DocumentImageModal';

interface PrintableSPKProps {
  workOrder: WorkOrder;
  settings: WorkshopSettings;
  onClose?: () => void;
  onEdit?: () => void;
}

export function PrintableSPK({ workOrder, settings, onClose, onEdit }: PrintableSPKProps) {
  const vehicle = workOrder.vehicle;
  const documentRef = useRef<HTMLDivElement>(null);

  // State untuk nama yang bisa diketik manual di dokumen
  const [signerSA, setSignerSA] = useState<string>(
    workOrder.petugas_name ||
    (workOrder.checklist_data as any)?.petugas_name ||
    workOrder.sa_profile?.full_name ||
    ''
  );
  const [signerMechanic, setSignerMechanic] = useState<string>(
    workOrder.mechanic_name || ''
  );

  useEffect(() => {
    const freshSA = workOrder.petugas_name ||
                    (workOrder.checklist_data as any)?.petugas_name ||
                    workOrder.sa_profile?.full_name || '';
    if (freshSA) setSignerSA(freshSA);
    if (workOrder.mechanic_name) setSignerMechanic(workOrder.mechanic_name);
  }, [workOrder]);

  const handlePrint = () => {
    printCleanDocument(documentRef.current, `SPK - ${workOrder.spk_number}`);
  };

  // Format Jam Datang / Terbit (HH:mm)
  const spkIssuedTimestamp = workOrder.created_at || workOrder.entry_date;
  const entryDateObj = new Date(spkIssuedTimestamp);
  const jamDatang = !isNaN(entryDateObj.getTime())
    ? entryDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '09:00';

  const tanggalDatang = formatDate(spkIssuedTimestamp);

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pemilik Kendaraan'},\n` +
      `Berikut konfirmasi Dokumen Surat Perintah Kerja Bengkel (PKB) dari ${settings.name}:\n\n` +
      `No. PKB: ${workOrder.spk_number}\n` +
      `Unit: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `KM: ${formatKM(vehicle?.current_mileage)}\n` +
      `Keluhan: ${workOrder.complaints}\n\n` +
      `Status: Sedang dalam penanganan teknisi bengkel.\n` +
      `Terima kasih telah mempercayakan kendaraan Anda kepada kami.`
    );
  };

  const waLink = vehicle?.phone_number
    ? createWhatsAppLink(vehicle.phone_number, getWhatsAppMessage())
    : '#';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Top Action Control Bar */}
      <div className="no-print bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 flex-wrap">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#8B0000] flex items-center justify-center text-white font-bold flex-shrink-0">
            <FileText className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Perintah Kerja Bengkel (PKB / SPK)</h3>
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur • Mardiono Home Service</p>
          </div>
        </div>

        {/* Input Nama Penandatangan */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Petugas / SA</label>
            <input
              type="text"
              value={signerSA}
              onChange={(e) => setSignerSA(e.target.value)}
              placeholder="Nama SA / Petugas..."
              className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-44 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Mekanik</label>
            <input
              type="text"
              value={signerMechanic}
              onChange={(e) => setSignerMechanic(e.target.value)}
              placeholder="Nama mekanik..."
              className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-44 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-md cursor-pointer"
              title="Edit Isi SPK (Pekerjaan, Pelanggan, Mekanik, dll.)"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Isi SPK</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-[#8B0000] hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <DocumentImageModal
            documentRef={documentRef}
            label="Lihat sebagai Gambar"
            filename={`SPK-${workOrder.spk_number}`}
          />
          {vehicle?.phone_number && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Kirim WhatsApp</span>
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
        <div ref={documentRef} className="doc-sheet space-y-1.5">
          {/* Header */}
          <OfficialDocumentHeader settings={settings} />

          {/* Title Header: SURAT PERINTAH KERJA BENGKEL */}
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-black mt-1">
            <div>
              <span className="inline-flex items-center justify-center bg-[#8B0000] text-white px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider leading-normal">
                SURAT PERINTAH KERJA BENGKEL (SPK / PKB)
              </span>
            </div>
            <div className="text-right inline-flex items-center gap-1">
              <span className="text-[10px] text-black font-bold uppercase">No. PKB:</span>
              <span className="font-mono font-black text-sm text-[#001F7A]">
                {workOrder.spk_number}
              </span>
            </div>
          </div>

          {/* Symmetrical Grid: Data Pelanggan & Kendaraan */}
          <OfficialDocumentMetaGrid
            customerName={vehicle?.customer_name || 'Pemilik Kendaraan'}
            address={vehicle?.address || 'Surabaya / Sidoarjo'}
            unit={`${vehicle?.car_brand || ''} ${vehicle?.car_model || ''} ${vehicle?.car_year ? `(${vehicle.car_year})` : ''}`.trim() || '-'}
            entryTime={jamDatang}
            licensePlate={vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
            docNumber={workOrder.spk_number}
            docLabel="No PKB"
            docColor="#001F7A"
            date={tanggalDatang}
            mileage={formatKM(vehicle?.current_mileage, false)}
          />

          {/* Box 1: KELUHAN PEMILIK KENDARAAN */}
          <div className="border-2 border-black rounded-xl p-2 bg-white text-[11px] space-y-0.5">
            <h4 className="font-black text-[#8B0000] uppercase text-[10px]">
              KELUHAN PEMILIK KENDARAAN :
            </h4>
            <p className="text-black font-semibold text-[10.5px] leading-relaxed min-h-[22px] pl-1 whitespace-pre-wrap break-words uppercase">
              {workOrder.complaints?.toUpperCase() || 'PERAWATAN BERKALA / SERVIS RUTIN'}
            </p>
          </div>

          {/* Box 2: URAIAN PEKERJAAN */}
          <div className="border-2 border-black rounded-xl p-2 bg-white text-[11px] space-y-0.5">
            <h4 className="font-black text-[#001F7A] uppercase text-[10px]">
              URAIAN PEKERJAAN :
            </h4>
            <p className="text-black font-semibold text-[10.5px] leading-relaxed min-h-[22px] pl-1 whitespace-pre-wrap break-words uppercase">
              {workOrder.notes?.toUpperCase() || 'PEMERIKSAAN MENYELURUH, TUNE-UP, SERVIS BERKALA, DAN UJI FUNGSI SISTEM KENDARAAN.'}
            </p>
          </div>

          {/* KETENTUAN 10 POIN RESMI VERBATIM */}
          <div className="border-2 border-black rounded-xl p-2 bg-slate-50 text-[8.5px] space-y-0.5 text-black leading-tight">
            <h4 className="font-black text-black uppercase text-[9px]">
              KETENTUAN:
            </h4>
            <ol className="list-decimal pl-3.5 space-y-0.5 font-semibold text-black">
              <li>PKB ini merupakan <strong className="font-black text-black">SURAT KUASA</strong> dari pemilik kendaraan kepada bengkel untuk mengerjakan pekerjaan seperti yang tertulis.</li>
              <li>Jaminan Pekerjaan Berlaku: <strong className="font-black text-black">General repair 100 KM dalam waktu 3 hari</strong>.</li>
              <li>Apabila dalam waktu 2 hari part bekas tidak diambil, kami berhak melakukan pemusnahan.</li>
              <li>Untuk menjaga kualitas, kami membatasi pemilik kendaraan membawa sparepart sendiri pada pekerjaan Overhaul.</li>
              <li>Apabila pemilik kendaraan membawa part sendiri, maksimal parkir gratis 2 hari, lebih dari itu <strong className="font-black text-black">Rp 25.000/hari</strong>.</li>
              <li>Segala resiko akibat part yang dibawa pemilik kendaraan <strong className="font-black text-black">bukan tanggung jawab Mardiono Home Service</strong>.</li>
              <li>Batas pengambilan kendaraan setelah service adalah <strong className="font-black text-black">1x24 jam</strong>.</li>
              <li>Apabila lebih dari 1 minggu bukan menjadi tanggung jawab bengkel (Misal: Aki tekor, Cat Baret).</li>
              <li><strong className="font-black text-black">Jika Membawa Part Sendiri Tidak Ada Garansi Dalam Bentuk Apapun.</strong></li>
              <li><strong className="font-black text-black">Apabila Sparepart Sudah Terpasang Dan Tidak Berfungsi, Kami Berlakukan Jasa Double.</strong></li>
            </ol>
          </div>

          {/* Symmetrical Two Bottom Info Boxes: Sumber Informasi & Status Kendaraan + Di Terima Di */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="border-2 border-black rounded-xl p-1.5 bg-white flex items-center justify-between">
              <span className="font-bold text-black">Sumber Info:</span>
              <span className="font-black text-[#001F7A] uppercase text-[10px]">{workOrder.source_info?.toUpperCase() || 'REFERENSI'}</span>
            </div>
            <div className="border-2 border-black rounded-xl p-1.5 bg-white flex items-center justify-between">
              <span className="font-bold text-black">Status Mobil:</span>
              <span className="font-black text-[#8B0000] uppercase text-[10px]">{workOrder.vehicle_status?.toUpperCase() || 'DITUNGGU'}</span>
            </div>
            <div className="border-2 border-black rounded-xl p-1.5 bg-white flex items-center justify-between">
              <span className="font-bold text-black">Di Terima Di:</span>
              <span className="font-black text-emerald-800 uppercase text-[10px]">{workOrder.received_at_branch?.toUpperCase() || '-'}</span>
            </div>
          </div>

          {/* Agreement Title */}
          <div className="text-center pt-0.5">
            <p className="text-[10px] font-black italic text-black">
              "Saya Telah Membaca dan Menyetujui Ketentuan Di Atas"
            </p>
          </div>

          {/* 3 BAGIAN TANDA TANGAN DIGITAL RESMI (Symmetrical 3 Columns) */}
          <div className="border-2 border-black rounded-xl p-2 bg-white">
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              {/* TTD 1: Petugas Bengkel */}
              <div className="border-2 border-black rounded-lg p-1.5 bg-slate-50 flex flex-col justify-between min-h-[92px]">
                <p className="font-black text-[#8B0000] text-[9.5px] uppercase">Petugas Bengkel</p>
                <div className="h-9 flex items-center justify-center border border-dashed border-slate-400 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_sa_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_sa_url}
                      alt="TTD Petugas"
                      className="max-h-8 max-w-full object-contain inline-block mx-auto"
                    />
                  ) : (
                    <span className="text-[8.5px] text-slate-500 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-black text-black text-[9.5px] border-t-2 border-black pt-0.5 break-words leading-tight uppercase">
                  ({(signerSA || 'Petugas Bengkel').toUpperCase()})
                </p>
              </div>

              {/* TTD 2: Teknisi / Mekanik */}
              <div className="border-2 border-black rounded-lg p-1.5 bg-slate-50 flex flex-col justify-between min-h-[92px]">
                <p className="font-black text-[#001F7A] text-[9.5px] uppercase">Teknisi / Mekanik</p>
                <div className="h-9 flex items-center justify-center border border-dashed border-slate-400 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_mechanic_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_mechanic_url}
                      alt="TTD Mekanik"
                      className="max-h-8 max-w-full object-contain inline-block mx-auto"
                    />
                  ) : (
                    <span className="text-[8.5px] text-slate-500 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-black text-black text-[9.5px] border-t-2 border-black pt-0.5 break-words leading-tight uppercase">
                  ({(signerMechanic || 'Teknisi / Mekanik').toUpperCase()})
                </p>
              </div>

              {/* TTD 3: Pemilik Kendaraan */}
              <div className="border-2 border-black rounded-lg p-1.5 bg-slate-50 flex flex-col justify-between min-h-[92px]">
                <p className="font-black text-[#8B0000] text-[9.5px] uppercase">Pemilik Kendaraan</p>
                <div className="h-9 flex items-center justify-center border border-dashed border-slate-400 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_customer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_customer_url}
                      alt="TTD Pemilik"
                      className="max-h-8 max-w-full object-contain inline-block mx-auto"
                    />
                  ) : (
                    <span className="text-[8.5px] text-slate-500 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-black text-black text-[9.5px] border-t-2 border-black pt-0.5 break-words leading-tight uppercase">
                  ({(vehicle?.customer_name || 'Pemilik Kendaraan').toUpperCase()})
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <OfficialDocumentFooter
            documentCode={workOrder.spk_number}
            termsNote={`Perintah Kerja Bengkel Sah • Mardiono Home Service • ${tanggalDatang}`}
          />
        </div>
      </div>
    </div>
  );
}
