'use client';

import React, { useState } from 'react';
import { WorkOrder, WorkshopSettings } from '@/lib/types/database';
import {
  formatDate,
  formatDateTime,
  formatPlate,
  createWhatsAppLink,
} from '@/lib/utils';
import {
  Printer,
  Share2,
  X,
  FileText,
} from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';

interface PrintableSPKProps {
  workOrder: WorkOrder;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableSPK({ workOrder, settings, onClose }: PrintableSPKProps) {
  const vehicle = workOrder.vehicle;

  // State untuk nama yang bisa diketik manual di dokumen
  const [signerSA, setSignerSA] = useState<string>(
    workOrder.sa_profile?.full_name || ''
  );
  const [signerMechanic, setSignerMechanic] = useState<string>(
    workOrder.mechanic_name || ''
  );

  const handlePrint = () => {
    window.print();
  };

  // Format Jam Datang (HH:mm)
  const entryDateObj = new Date(workOrder.entry_date);
  const jamDatang = !isNaN(entryDateObj.getTime())
    ? entryDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '09:00';

  const tanggalDatang = formatDate(workOrder.entry_date);

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pelanggan'},\n` +
      `Berikut konfirmasi Dokumen Surat Perintah Kerja Bengkel (PKB) dari ${settings.name}:\n\n` +
      `No. PKB: ${workOrder.spk_number}\n` +
      `Unit: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `KM: ${vehicle?.current_mileage?.toLocaleString('id-ID')} KM\n` +
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

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-[#8B0000] hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md"
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
        <div className="doc-sheet space-y-2.5">
          {/* Header */}
          <OfficialDocumentHeader settings={settings} />

          {/* Title Header: PERINTAH KERJA BENGKEL */}
          <div className="text-center pb-1">
            <h2 className="text-sm font-black tracking-wider uppercase text-slate-900 border-b-2 border-slate-900 inline-block pb-0.5">
              PERINTAH KERJA BENGKEL — BARU
            </h2>
          </div>

          {/* Symmetrical Grid: Data Pelanggan & Kendaraan */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-800 font-medium">
            {/* Kolom Kiri */}
            <div className="space-y-1.5 border-r border-slate-300 pr-3">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Jam Datang</span>
                <span className="col-span-8 font-bold text-slate-950">: {jamDatang}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Customer</span>
                <span className="col-span-8 font-bold text-slate-950">: {vehicle?.customer_name || 'Pelanggan'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Alamat Customer</span>
                <span className="col-span-8 text-slate-800 leading-tight">: {vehicle?.address || 'Surabaya / Sidoarjo'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Unit</span>
                <span className="col-span-8 font-bold text-slate-950">: {vehicle?.car_brand} {vehicle?.car_model} {vehicle?.car_year ? `(${vehicle.car_year})` : ''}</span>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-1.5 pl-1">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No Pol</span>
                <span className="col-span-8 font-mono font-black text-[#8B0000] text-sm">: {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No PKB</span>
                <span className="col-span-8 font-mono font-bold text-[#001F7A]">: {workOrder.spk_number}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Tanggal</span>
                <span className="col-span-8 font-bold text-slate-950">: {tanggalDatang}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">KM</span>
                <span className="col-span-8 font-mono font-bold text-slate-950">: {vehicle?.current_mileage ? vehicle.current_mileage.toLocaleString('id-ID') : '-'}</span>
              </div>
            </div>
          </div>

          {/* Box 1: KELUHAN CUSTOMER */}
          <div className="border border-slate-800 rounded-xl p-2.5 bg-white text-xs space-y-1">
            <h4 className="font-black text-[#8B0000] uppercase text-[10.5px]">
              KELUHAN CUSTOMER :
            </h4>
            <p className="text-slate-900 font-medium text-[11px] leading-relaxed min-h-[30px] pl-1">
              {workOrder.complaints || 'Perawatan berkala / Servis rutin'}
            </p>
          </div>

          {/* Box 2: URAIAN PEKERJAAN */}
          <div className="border border-slate-800 rounded-xl p-2.5 bg-white text-xs space-y-1">
            <h4 className="font-black text-[#001F7A] uppercase text-[10.5px]">
              URAIAN PEKERJAAN :
            </h4>
            <p className="text-slate-900 font-medium text-[11px] leading-relaxed min-h-[30px] pl-1">
              {workOrder.notes || 'Pemeriksaan menyeluruh, tune-up, servis berkala, dan uji fungsi sistem kendaraan.'}
            </p>
          </div>

          {/* KETENTUAN 10 POIN RESMI VERBATIM */}
          <div className="border border-slate-800 rounded-xl p-2.5 bg-slate-50 text-[9.5px] space-y-1 text-slate-800 leading-snug">
            <h4 className="font-black text-slate-950 uppercase text-[10px]">
              KETENTUAN:
            </h4>
            <ol className="list-decimal pl-4 space-y-0.5 font-medium">
              <li>PKB ini merupakan <strong>SURAT KUASA</strong> dari pelanggan kepada bengkel untuk mengerjakan pekerjaan seperti yang tertulis.</li>
              <li>Jaminan Pekerjaan Berlaku: <strong>General repair 100 KM dalam waktu 3 hari</strong>.</li>
              <li>Apabila dalam waktu 2 hari part bekas tidak diambil, kami berhak melakukan pemusnahan.</li>
              <li>Untuk menjaga kualitas, kami membatasi customer membawa sparepart sendiri pada pekerjaan Overhaul.</li>
              <li>Apabila customer membawa part sendiri, maksimal parkir gratis 2 hari, lebih dari itu <strong>Rp 25.000/hari</strong>.</li>
              <li>Segala resiko akibat part yang dibawa customer <strong>bukan tanggung jawab Mardiono Home Service</strong>.</li>
              <li>Batas pengambilan kendaraan setelah service adalah <strong>1x24 jam</strong>.</li>
              <li>Apabila lebih dari 1 minggu bukan menjadi tanggung jawab bengkel (Misal: Aki tekor, Cat Baret).</li>
              <li><strong>Jika Membawa Part Sendiri Tidak Ada Garansi Dalam Bentuk Apapun.</strong></li>
              <li><strong>Apabila Sparepart Sudah Terpasang Dan Tidak Berfungsi, Kami Berlakukan Jasa Double.</strong></li>
            </ol>
          </div>

          {/* Symmetrical Two Bottom Info Boxes: Sumber Informasi & Status Kendaraan */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-800 rounded-xl p-2 bg-white flex items-center justify-between">
              <span className="font-bold text-slate-700">Sumber Informasi:</span>
              <span className="font-black text-[#001F7A] uppercase">{workOrder.source_info || 'REFERENSI'}</span>
            </div>
            <div className="border border-slate-800 rounded-xl p-2 bg-white flex items-center justify-between">
              <span className="font-bold text-slate-700">Status Kendaraan:</span>
              <span className="font-black text-[#8B0000] uppercase">{workOrder.vehicle_status || 'Ditunggu'}</span>
            </div>
          </div>

          {/* Agreement Title */}
          <div className="text-center pt-1">
            <p className="text-xs font-bold italic text-slate-900">
              "Saya Telah Membaca dan Menyetujui Ketentuan Di Atas"
            </p>
          </div>

          {/* 3 BAGIAN TANDA TANGAN DIGITAL RESMI (Symmetrical 3 Columns) */}
          <div className="border border-slate-800 rounded-xl p-2.5 bg-white">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              {/* TTD 1: Petugas Bengkel */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[110px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Petugas Bengkel</p>
                <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_sa_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_sa_url}
                      alt="TTD Petugas"
                      className="max-h-11 max-w-full object-contain block mx-auto"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  ({signerSA || 'Petugas Bengkel'})
                </p>
              </div>

              {/* TTD 2: Teknisi / Mekanik */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[110px]">
                <p className="font-black text-[#001F7A] text-[10px] uppercase">Teknisi / Mekanik</p>
                <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_mechanic_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_mechanic_url}
                      alt="TTD Mekanik"
                      className="max-h-11 max-w-full object-contain block mx-auto"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  ({signerMechanic || 'Teknisi / Mekanik'})
                </p>
              </div>

              {/* TTD 3: Pemilik Kendaraan */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[110px]">
                <p className="font-black text-[#8B0000] text-[10px] uppercase">Pemilik Kendaraan</p>
                <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white overflow-hidden my-0.5">
                  {workOrder.signature_customer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={workOrder.signature_customer_url}
                      alt="TTD Pemilik"
                      className="max-h-11 max-w-full object-contain block mx-auto"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                  ({vehicle?.customer_name || 'Pelanggan'})
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
