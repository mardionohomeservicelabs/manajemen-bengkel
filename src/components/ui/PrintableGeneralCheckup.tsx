'use client';

import React, { useState } from 'react';
import { QCGeneralCheckupData, WorkshopSettings } from '@/lib/types/database';
import { formatDate, formatPlate, createWhatsAppLink } from '@/lib/utils';
import { Printer, Share2, X, Wrench, CheckCircle2 } from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';

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
  // State untuk nama teknisi yang bisa diketik manual
  const [signerTeknisi, setSignerTeknisi] = useState<string>(
    checkup.technician_name || ''
  );

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${checkup.customer_name || 'Pelanggan'},\n` +
      `Berikut hasil Lembar Quality Control General Checkup kendaraan Anda (${checkup.license_plate}) dari ${settings.name}:\n\n` +
      `No. Dokumen: ${checkup.document_number}\n` +
      `KM: ${checkup.mileage?.toLocaleString('id-ID')} KM\n` +
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
            <h3 className="font-bold text-sm">Checklist General Checkup Tune Up & AC Mobil</h3>
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

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-[#8B0000] hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
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

          {/* Title Header: CHECKLIST GENERAL CHECKUP TUNE UP & AC MOBIL */}
          <div className="text-center pb-1">
            <h2 className="text-sm font-black tracking-wider uppercase text-slate-900 border-b-2 border-slate-900 inline-block pb-0.5">
              CHECKLIST GENERAL CHECKUP TUNE UP &amp; AC MOBIL
            </h2>
          </div>

          {/* Symmetrical Metadata Grid: Pelanggan & Kendaraan (Identical to AC Checkup) */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-800 font-medium">
            {/* Kolom Kiri */}
            <div className="space-y-1 border-r border-slate-300 pr-3">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Pelanggan</span>
                <span className="col-span-8 font-bold text-slate-950">: {checkup.customer_name || 'Pelanggan'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Unit / Tipe</span>
                <span className="col-span-8 font-bold text-slate-950">: {checkup.car_model || '-'}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Teknisi PIC</span>
                <span className="col-span-8 font-bold text-[#8B0000]">: {signerTeknisi || checkup.technician_name || 'Teknisi Pemeriksa'}</span>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-1 pl-1">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No Pol</span>
                <span className="col-span-8 font-mono font-black text-[#8B0000] text-sm">: {formatPlate(checkup.license_plate)}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No PKB / QC</span>
                <span className="col-span-8 font-mono font-bold text-[#8B0000]">: {checkup.document_number}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">Tanggal</span>
                <span className="col-span-8 font-bold text-slate-950">: {formatDate(checkup.check_date)}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">KM</span>
                <span className="col-span-8 font-mono font-bold text-slate-950">: {checkup.mileage ? checkup.mileage.toLocaleString('id-ID') : '-'}</span>
              </div>
            </div>
          </div>

          {/* 1. Cek Kondisi Aki (Symmetrical Box) */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[11px] uppercase tracking-wide">
              1. Cek Kondisi Aki Basa / Kering
            </div>
            <div className="p-2 grid grid-cols-3 gap-3 bg-white items-center">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">Kondisi:</span>
                <span
                  className={`px-2.5 py-0.5 rounded font-black text-white ${
                    checkup.battery_condition === 'baik' ? 'bg-emerald-700' : 'bg-red-700'
                  }`}
                >
                  {checkup.battery_condition?.toUpperCase() || 'BAIK'}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  ({checkup.battery_health_percent || 80}%)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700">Saran Ganti:</span>
                <span className="font-black text-red-700">
                  {checkup.battery_suggest_replace ? '☑ YA (GANTI)' : '☐ TIDAK'}
                </span>
              </div>

              <div className="text-slate-800 text-[11px] truncate">
                <strong className="text-slate-600">Catatan:</strong> {checkup.battery_notes || '-'}
              </div>
            </div>
          </div>

          {/* Symmetrical 2-Column Section: Sensor Cleaner (Left) & Physical Checklist (Right) */}
          <div className="grid grid-cols-12 gap-3 items-start text-xs">
            {/* Left Column (5 / 12): Pembersihan Sensor, BBM & Notice */}
            <div className="col-span-5 space-y-2">
              {/* Sensor Table: 2. Bersihkan sensor MAF, 3. ISC, 4. Airflow, 5. Throttle Body, 6. Busi, 7. Coil */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-[#8B0000] text-white px-2.5 py-1 font-black text-[10.5px] flex justify-between items-center uppercase">
                  <span>2. Pembersihan Sensor</span>
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded text-[8.5px] font-black">
                    *CONTACT CLEANER
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900">
                      <th className="p-1.5 border-r border-slate-300">Sensor / Komponen</th>
                      <th className="p-1.5 w-14 text-center border-r border-slate-300">Clean</th>
                      <th className="p-1.5 w-14 text-center">Ganti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      { label: '2. Bersihkan Sensor MAF', clean: checkup.sensor_maf_cleaned, repl: checkup.sensor_maf_suggest_replace },
                      { label: '3. Bersihkan Sensor ISC', clean: checkup.sensor_isc_cleaned, repl: checkup.sensor_isc_suggest_replace },
                      { label: '4. Bersihkan Sensor Airflow', clean: checkup.sensor_airflow_cleaned, repl: checkup.sensor_airflow_suggest_replace },
                      { label: '5. Bersihkan Throttle Body', clean: checkup.throttle_body_cleaned, repl: checkup.throttle_body_suggest_replace },
                      { label: '6. Bersihkan Busi Spark Plug', clean: checkup.spark_plug_checked, repl: checkup.spark_plug_suggest_replace },
                      { label: '7. Bersihkan Coil Pengapian', clean: checkup.ignition_coil_checked, repl: checkup.ignition_coil_suggest_replace },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-1.5 font-bold text-slate-900 border-r border-slate-300">{row.label}</td>
                        <td className="p-1.5 text-center border-r border-slate-300 font-bold text-emerald-800">
                          {row.clean ? 'CLEAN' : '-'}
                        </td>
                        <td className="p-1.5 text-center font-black text-red-700">
                          {row.repl ? 'GANTI' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Fuel Level */}
              <div className="border border-slate-800 rounded-xl p-2 bg-slate-50 text-[10.5px] flex items-center justify-between">
                <span className="font-black text-slate-900">PENGECEKAN BBM:</span>
                <span className="font-mono font-black text-sm text-[#8B0000]">
                  E [ {checkup.fuel_level_fraction || '3/4'} ] F ⛽
                </span>
              </div>

              {/* Quality Banner */}
              <div className="border border-[#8B0000] p-2 text-center text-[9px] bg-red-50/60 rounded-xl space-y-0.5">
                <p className="font-black text-[#8B0000] uppercase">MARDIONO QUALITY ASSURED</p>
                <p className="text-slate-700 leading-tight">
                  Seluruh pembersihan sensor wajib menggunakan contact cleaner resmi bertekanan tinggi.
                </p>
              </div>
            </div>

            {/* Right Column (7 / 12): Checklist Fisik 16 Titik (No 8-23) */}
            <div className="col-span-7 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[10.5px] uppercase tracking-wide">
                3. Checklist Fisik 16 Titik (No 8–23)
              </div>
              <table className="w-full text-left border-collapse text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900">
                    <th className="p-1 w-6 text-center border-r border-slate-300">No</th>
                    <th className="p-1 border-r border-slate-300">Item Pemeriksaan</th>
                    <th className="p-1 w-10 text-center border-r border-slate-300">Cek</th>
                    <th className="p-1 w-12 text-center border-r border-slate-300">Ganti</th>
                    <th className="p-1 w-28">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {checklistRows.map((row) => (
                    <tr key={row.no} className="hover:bg-slate-50">
                      <td className="p-1 text-center font-bold text-slate-500 border-r border-slate-300">
                        {row.no}
                      </td>
                      <td className="p-1 font-bold text-slate-900 border-r border-slate-300">
                        {row.label}
                      </td>
                      <td className="p-1 text-center font-bold text-emerald-800 border-r border-slate-300">
                        {row.data?.checked ? '☑' : '☐'}
                      </td>
                      <td className="p-1 text-center font-black text-red-700 border-r border-slate-300">
                        {row.data?.suggest_replace ? 'GANTI' : '-'}
                      </td>
                      <td className="p-1 text-slate-700 truncate max-w-[110px]">
                        {row.data?.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Saran Perbaikan 9 Poin & Tanda Tangan Simetris */}
          <div className="grid grid-cols-12 gap-3 items-start text-xs pt-0.5">
            {/* Saran 9 Baris (8 / 12) */}
            <div className="col-span-8 border border-slate-800 rounded-xl p-2.5 bg-slate-50 space-y-1">
              <h4 className="font-black text-slate-950 uppercase text-[10px]">
                4. Saran & Rekomendasi Teknisi:
              </h4>
              <ol className="list-decimal pl-4 text-[9px] text-slate-800 space-y-0.5 font-medium">
                <li>{checkup.improvement_suggestions?.[0] || 'Pergantian oli rutin setiap 5.000 KM / 3 bulan.'}</li>
                <li>{checkup.improvement_suggestions?.[1] || 'Perawatan berkala ke bengkel setiap 10.000 KM / 6 bulan.'}</li>
                <li>{checkup.improvement_suggestions?.[2] || 'Bersihkan filter udara dan filter kabin secara rutin.'}</li>
                <li>{checkup.improvement_suggestions?.[3] || 'Gunakan selalu bahan bakar dengan oktan sesuai rasio kompresi mesin.'}</li>
                <li>{checkup.improvement_suggestions?.[4] || 'Pastikan air radiator coolant tidak dicampur air kran biasa.'}</li>
                <li>{checkup.improvement_suggestions?.[5] || 'Cek kebocoran oli mesin, transmisi, dan minyak rem berkala.'}</li>
                <li>{checkup.improvement_suggestions?.[6] || 'Perhatikan bunyi asing pada kaki-kaki dan sistem pengereman.'}</li>
                <li>{checkup.improvement_suggestions?.[7] || 'Lakukan rotasi dan spooring balancing ban setiap 10.000 KM.'}</li>
                <li>{checkup.improvement_suggestions?.[8] || 'Segera konsultasikan ke Mardiono Home Service jika indikator check engine menyala.'}</li>
              </ol>
            </div>

            {/* Tanda Tangan Teknisi Pemeriksa (4 / 12) */}
            <div className="col-span-4 border border-slate-800 rounded-xl p-2 bg-white flex flex-col justify-between h-[160px] text-center">
              <p className="font-black text-[#8B0000] text-[10px] uppercase">
                Teknisi Pemeriksa (QC PIC)
              </p>
              <div className="h-16 flex items-center justify-center border border-dashed border-slate-300 rounded bg-slate-50 overflow-hidden my-1">
                {checkup.technician_signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkup.technician_signature_url}
                    alt="TTD Teknisi"
                    className="max-h-14 max-w-full object-contain block mx-auto"
                  />
                ) : (
                  <span className="text-[9px] text-slate-400 italic">(Tanda Tangan)</span>
                )}
              </div>
              <p className="font-bold text-slate-950 text-[10.5px] border-t border-slate-300 pt-1">
                ({signerTeknisi || 'Teknisi Pemeriksa'})
              </p>
            </div>
          </div>

          {/* Footer */}
          <OfficialDocumentFooter
            documentCode={checkup.document_number}
            termsNote="Lembar Quality Control General Checkup Sah • Mardiono Home Service"
          />
        </div>
      </div>
    </div>
  );
}
