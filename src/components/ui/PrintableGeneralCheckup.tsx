'use client';

import React, { useState, useRef } from 'react';
import { QCGeneralCheckupData, WorkshopSettings } from '@/lib/types/database';
import { formatDate, formatPlate, createWhatsAppLink, formatKM } from '@/lib/utils';
import { printCleanDocument } from '@/lib/utils/print-helper';
import { Printer, Share2, X, Wrench, CheckCircle2 } from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';
import { DocumentImageModal } from './DocumentImageModal';

interface PrintableGeneralCheckupProps {
  checkup: QCGeneralCheckupData;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableGeneralCheckup({
  checkup,
  settings,
  onClose,
}: PrintableGeneralCheckupProps) {
  const documentRef = useRef<HTMLDivElement>(null);

  // State untuk nama teknisi yang bisa diketik manual
  const [signerTeknisi, setSignerTeknisi] = useState<string>(
    checkup.technician_name || ''
  );

  const handlePrint = () => {
    printCleanDocument(documentRef.current, `QC Tune Up - ${checkup.document_number}`);
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${checkup.customer_name || 'Pelanggan'},\n` +
      `Berikut hasil Lembar Quality Control Tune Up kendaraan Anda (${checkup.license_plate}) dari ${settings.name}:\n\n` +
      `No. Dokumen: ${checkup.document_number}\n` +
      `KM: ${formatKM(checkup.mileage)}\n` +
      `Teknisi: ${checkup.technician_name}\n` +
      `Kondisi Aki: ${checkup.battery_condition?.toUpperCase()} (${checkup.battery_health_percent || 80}%)\n\n` +
      `Dokumen lengkap siap dicetak. Terima kasih atas kepercayaan Anda!`
    );
  };

  const checklistRows = [
    { no: 8, label: 'CEK FILTER UDARA', data: checkup.filter_udara },
    { no: 9, label: 'CEK VOLUME OLI ENGINE', data: checkup.volume_oli_engine },
    { no: 10, label: 'CEK MINYAK REM', data: checkup.minyak_rem },
    { no: 11, label: 'CEK MINYAK KOPLING / MATIC', data: checkup.minyak_kopling_transmisi },
    { no: 12, label: 'CEK MINYAK POWER STEERING', data: checkup.minyak_power_steering },
    { no: 13, label: 'CEK AIR RADIATOR COOLANT', data: checkup.air_radiator_coolant },
    { no: 14, label: 'CEK VANBELT ENGINE / AC', data: checkup.vanbelt_engine_ac },
    { no: 15, label: 'CEK KEKENCANGAN MUR BAN', data: checkup.kekencangan_mur_ban },
    { no: 16, label: 'CEK FUNGSI LAMPU ALL', data: checkup.fungsi_lampu_all },
    { no: 17, label: 'CEK FUNGSI TAPE / AUDIO', data: checkup.fungsi_tape_audio },
    { no: 18, label: 'CEK KLAKSON HORN', data: checkup.klakson_horn },
    { no: 19, label: 'CEK WHELDOP VELG', data: checkup.wheldop_velg },
    { no: 20, label: 'KEBERSIHAN FILTER CABIN', data: checkup.kebersihan_filter_cabin },
    { no: 21, label: 'CEK TEKANAN FREON AC', data: checkup.tekanan_freon_ac },
    { no: 22, label: 'CEK INTERIOR (STIR/PLAFON)', data: checkup.kebersihan_interior_plafon_stir },
    { no: 23, label: 'RISET KM OLI ENGINE', data: checkup.riset_km_oli_engine },
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
            <h3 className="font-bold text-sm">Quality Control Tune Up</h3>
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur • Mardiono Home Service</p>
          </div>
        </div>

        {/* Input Nama Teknisi */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Teknisi Pemeriksa</label>
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
            filename={`QC-TuneUp-${checkup.document_number}`}
          />
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
        <div ref={documentRef} className="doc-sheet printable-qc-sheet space-y-2.5">
          {/* Header */}
          <OfficialDocumentHeader settings={settings} />

          {/* Title Header: QUALITY CONTROL TUNE UP */}
          <div className="text-center pb-1">
            <h2 className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-900 border-b-2 border-slate-900 inline-block pb-0.5">
              QUALITY CONTROL TUNE UP
            </h2>
          </div>

          {/* Symmetrical Metadata Grid: Pelanggan & Kendaraan */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-800 font-medium">
            {/* Kolom Kiri */}
            <div className="space-y-1 border-r border-slate-300 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">Pelanggan</span>
                <span className="font-bold text-slate-950 truncate">: {checkup.customer_name || 'Pelanggan'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">Unit / Tipe</span>
                <span className="font-bold text-slate-950 truncate">: {checkup.car_model || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">Teknisi PIC</span>
                <span className="font-bold text-[#8B0000] truncate">: {signerTeknisi || checkup.technician_name || 'Teknisi Pemeriksa'}</span>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-1 pl-1">
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">No Pol</span>
                <span className="font-mono font-black text-[#8B0000] text-sm">: {formatPlate(checkup.license_plate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">No PKB / QC</span>
                <span className="font-mono font-bold text-[#8B0000] truncate">: {checkup.document_number}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">Tanggal</span>
                <span className="font-bold text-slate-950">: {formatDate(checkup.check_date)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 font-bold text-slate-600 whitespace-nowrap">KM Odometer</span>
                <span className="font-mono font-bold text-slate-950">: {formatKM(checkup.mileage)}</span>
              </div>
            </div>
          </div>

          {/* 1. Cek Kondisi Aki & Bahan Bakar (BBM) */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[11px] uppercase tracking-wide flex justify-between items-center">
              <span>1. Kondisi Aki &amp; Pengecekan Bahan Bakar (BBM)</span>
              <span className="text-[10.5px] font-mono bg-white/10 px-2 py-0.5 rounded font-bold">
                BBM: E [ {checkup.fuel_level_fraction || '3/4'} ] F ⛽
              </span>
            </div>
            <div className="p-2.5 grid grid-cols-12 gap-2 bg-white items-center text-xs">
              <div className="col-span-5 flex items-center space-x-2">
                <span className="font-bold text-slate-700">Kondisi Aki:</span>
                <span
                  className={`px-2.5 py-0.5 rounded font-black text-white text-[11px] ${
                    checkup.battery_condition === 'baik' ? 'bg-emerald-700' : 'bg-red-700'
                  }`}
                >
                  {checkup.battery_condition?.toUpperCase() || 'BAIK'}
                </span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  ({checkup.battery_health_percent || 85}%)
                </span>
              </div>

              <div className="col-span-3 flex items-center space-x-1.5">
                <span className="font-bold text-slate-700">Saran Ganti:</span>
                <div className="inline-flex items-center gap-1 font-bold text-xs">
                  <div className="w-3.5 h-3.5 border border-slate-900 rounded-[2px] flex items-center justify-center bg-white">
                    {checkup.battery_suggest_replace ? (
                      <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    ) : null}
                  </div>
                  <span className={checkup.battery_suggest_replace ? 'text-red-700 font-black' : 'text-slate-700'}>
                    {checkup.battery_suggest_replace ? 'YA' : 'TIDAK'}
                  </span>
                </div>
              </div>

              <div className="col-span-4 text-slate-800 text-[11px] leading-snug">
                <strong className="text-slate-600">Catatan:</strong> {checkup.battery_notes || 'Normal'}
              </div>
            </div>
          </div>

          {/* Symmetrical 2-Column Section: Sensor Cleaner (Left) & Physical Checklist (Right) */}
          <div className="grid grid-cols-2 gap-3.5 items-stretch text-xs">
            {/* Left Column (50%): Pembersihan Sensor & Quality Note */}
            <div className="flex flex-col justify-between space-y-2.5 h-full">
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-[#8B0000] text-white px-3 py-1.5 font-black text-[11px] flex justify-between items-center uppercase">
                  <span>2. Pembersihan Sensor Mesin</span>
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded text-[9px] font-black">
                    *CONTACT CLEANER
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-[10.5px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900">
                      <th className="p-1.5 border-r border-slate-300">Sensor / Komponen</th>
                      <th className="p-1.5 w-14 text-center border-r border-slate-300">Clean</th>
                      <th className="p-1.5 w-14 text-center border-r border-slate-300">Rusak</th>
                      <th className="p-1.5 w-14 text-center">Ganti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      { label: '2. Sensor MAF (Mass Air Flow)', clean: checkup.sensor_maf_cleaned, damaged: checkup.sensor_maf_damaged, repl: checkup.sensor_maf_suggest_replace },
                      { label: '3. Sensor ISC (Idle Speed Control)', clean: checkup.sensor_isc_cleaned, damaged: checkup.sensor_isc_damaged, repl: checkup.sensor_isc_suggest_replace },
                      { label: '4. Sensor Airflow Engine', clean: checkup.sensor_airflow_cleaned, damaged: checkup.sensor_airflow_damaged, repl: checkup.sensor_airflow_suggest_replace },
                      { label: '5. Throttle Body Valve', clean: checkup.throttle_body_cleaned, damaged: checkup.throttle_body_damaged, repl: checkup.throttle_body_suggest_replace },
                      { label: '6. Busi / Spark Plug', clean: checkup.spark_plug_checked, damaged: checkup.spark_plug_damaged, repl: checkup.spark_plug_suggest_replace },
                      { label: '7. Coil Pengapian Mesin', clean: checkup.ignition_coil_checked, damaged: checkup.ignition_coil_damaged, repl: checkup.ignition_coil_suggest_replace },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-1.5 font-bold text-slate-900 border-r border-slate-300">{row.label}</td>
                        <td className="p-1.5 text-center border-r border-slate-300 font-black text-emerald-700">
                          {row.clean ? 'CLEAN' : '-'}
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-300 font-black text-red-600">
                          {row.damaged ? 'RUSAK' : '-'}
                        </td>
                        <td className="p-1.5 text-center font-black text-amber-700">
                          {row.repl ? 'GANTI' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Quality Banner */}
              <div className="border border-[#8B0000] p-2.5 text-center text-[10px] bg-red-50/60 rounded-xl space-y-0.5">
                <p className="font-black text-[#8B0000] uppercase tracking-wider">MARDIONO QUALITY ASSURED</p>
                <p className="text-slate-700 leading-normal font-medium">
                  Seluruh pembersihan sensor wajib menggunakan contact cleaner resmi bertekanan tinggi untuk mengembalikan performa mesin maksimal.
                </p>
              </div>
            </div>

            {/* Right Column (50%): Checklist Fisik 16 Titik (No 8-23) */}
            <div className="border border-slate-800 rounded-xl overflow-hidden h-full">
              <div className="bg-[#8B0000] text-white px-3 py-1.5 font-black text-[11px] uppercase tracking-wide">
                3. Checklist Fisik 16 Titik (No 8–23)
              </div>
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900">
                    <th className="p-1 w-6 text-center border-r border-slate-300">No</th>
                    <th className="p-1 border-r border-slate-300">Item Pemeriksaan</th>
                    <th className="p-1 w-10 text-center border-r border-slate-300">Cek</th>
                    <th className="p-1 w-12 text-center border-r border-slate-300">Ganti</th>
                    <th className="p-1 w-24">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {checklistRows.map((row) => (
                    <tr key={row.no} className="hover:bg-slate-50">
                      <td className="p-1 text-center font-bold text-slate-500 border-r border-slate-300">
                        {row.no}
                      </td>
                      <td className="p-1 font-bold text-slate-900 border-r border-slate-300 truncate">
                        {row.label}
                      </td>
                      <td className="p-1 text-center font-black text-emerald-700 border-r border-slate-300">
                        {row.data?.checked ? '✓' : '-'}
                      </td>
                      <td className="p-1 text-center font-black text-red-700 border-r border-slate-300">
                        {row.data?.suggest_replace ? 'GANTI' : '-'}
                      </td>
                      <td className="p-1 text-slate-700 truncate max-w-[100px] font-medium">
                        {row.data?.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Saran Perbaikan 6 Poin & Tanda Tangan Simetris */}
          <div className="grid grid-cols-12 gap-3.5 items-stretch text-xs pt-0.5">
            {/* Saran 6 Baris (7 / 12) */}
            <div className="col-span-7 border border-slate-800 rounded-xl p-3 bg-slate-50 space-y-1">
              <h4 className="font-black text-slate-950 uppercase text-[10.5px]">
                4. Saran &amp; Rekomendasi Teknisi:
              </h4>
              <ol className="list-decimal pl-4 text-[9.5px] text-slate-800 space-y-1 font-medium leading-relaxed min-h-[90px]">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li key={idx} className="min-h-[14px]">
                    {checkup.improvement_suggestions?.[idx] || ''}
                  </li>
                ))}
              </ol>
            </div>

            {/* Tanda Tangan Teknisi Pemeriksa (5 / 12) */}
            <div className="col-span-5 border border-slate-800 rounded-xl p-3 bg-white flex flex-col justify-between text-center">
              <p className="font-black text-[#8B0000] text-[10.5px] uppercase">
                Teknisi Pemeriksa (QC PIC)
              </p>
              <div className="h-14 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50 my-1 overflow-hidden">
                {checkup.technician_signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkup.technician_signature_url}
                    alt="TTD Teknisi"
                    className="max-h-12 max-w-full object-contain block mx-auto"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">(Tanda Tangan)</span>
                )}
              </div>
              <p className="font-bold text-slate-950 text-[11px] border-t border-slate-300 pt-1">
                ({signerTeknisi || checkup.technician_name || 'Teknisi Pemeriksa'})
              </p>
            </div>
          </div>

          {/* Footer */}
          <OfficialDocumentFooter
            documentCode={checkup.document_number}
            termsNote="Lembar Quality Control Tune Up Sah • Mardiono Home Service"
          />
        </div>
      </div>
    </div>
  );
}
