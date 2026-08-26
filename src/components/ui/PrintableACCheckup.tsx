'use client';

import React, { useState } from 'react';
import { ACCheckupData, WorkshopSettings, CheckConditionStatus } from '@/lib/types/database';
import { formatDate, formatPlate, createWhatsAppLink } from '@/lib/utils';
import { Printer, Share2, X, ThermometerSnowflake } from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';

interface PrintableACCheckupProps {
  checkup: ACCheckupData;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableACCheckup({
  checkup,
  settings,
  onClose,
}: PrintableACCheckupProps) {
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
      `Berikut hasil Lembar Quality Control AC dari ${settings.name}:\n\n` +
      `No. Dokumen: ${checkup.document_number}\n` +
      `No. Pol: ${checkup.license_plate}\n` +
      `KM: ${checkup.mileage?.toLocaleString('id-ID')} KM\n` +
      `Suhu Embusan: ${checkup.air_vent_temperature || '7 °C'}\n` +
      `Tekanan Freon: Low ${checkup.low_pressure_psi || '25 Psi'} / High ${checkup.high_pressure_psi || '160 Psi'}\n` +
      `Catatan: ${checkup.recommendations || 'Cek kebocoran berkala.'}\n\n` +
      `Terima kasih telah mempercayakan servis AC mobil Anda kepada kami.`
    );
  };

  const waLink = createWhatsAppLink(
    '081230762930',
    getWhatsAppMessage()
  );

  const formatStatusBadge = (status?: CheckConditionStatus) => {
    if (status === 'rusak' || status === 'buruk') {
      return <span className="font-bold text-red-700">Rusak</span>;
    }
    if (status === 'lemah') {
      return <span className="font-bold text-amber-600">Lemah</span>;
    }
    return <span className="font-bold text-emerald-700">Baik</span>;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Top Action Control Bar */}
      <div className="no-print bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 flex-wrap">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#8B0000] flex items-center justify-center text-white font-bold flex-shrink-0">
            <ThermometerSnowflake className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Quality Control AC</h3>
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
            placeholder="Nama teknisi AC..."
            className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-48 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
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

          {/* Title Header: QUALITY CONTROL AC */}
          <div className="text-center pb-1">
            <h2 className="text-sm font-black tracking-wider uppercase text-slate-900 border-b-2 border-slate-900 inline-block pb-0.5">
              QUALITY CONTROL AC
            </h2>
          </div>

          {/* Symmetrical Metadata Grid: Pelanggan & Kendaraan */}
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
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-1 pl-1">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No Pol</span>
                <span className="col-span-8 font-mono font-black text-[#8B0000] text-sm">: {formatPlate(checkup.license_plate)}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 text-slate-600 font-bold">No PKB</span>
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

          {/* Section 1: Pemeriksaan Visual & Fisik (Mesin Mati) - Maroon Red */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[11px] tracking-wide">
              Pemeriksaan Visual & Fisik (Mesin Mati)
            </div>
            <table className="w-full text-left border-collapse text-[11px]">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Kompresor & Clutch</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.compressor_clutch)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Drive Belt (Tali Kipas)</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.drive_belt)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Kondensor AC & Radiator</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.condenser_radiator)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Selang & Pipa AC</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.hoses_pipes)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Air Coolant (Air Radiator)</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.air_coolant)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Pemeriksaan Operasional (AC & Mesin Menyala) - Maroon Red */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[11px] tracking-wide">
              Pemeriksaan Operasional (AC & Mesin Menyala)
            </div>
            <table className="w-full text-left border-collapse text-[11px]">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Fungsi Magnetic Clutch</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.func_magnetic_clutch)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Kipas Radiator & Kondensor</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.radiator_condenser_fan)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Blower & Aliran Udara</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.blower_airflow)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Sight Glass & Aroma Kabin</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.sight_glass_odour)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Pengukuran Parameter Teknis - Maroon Red */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-[#8B0000] text-white px-3 py-1 font-black text-[11px] tracking-wide">
              Pengukuran Parameter Teknis
            </div>
            <table className="w-full text-left border-collapse text-[11px]">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Filter Kabin (Filter AC)</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.cabin_filter_condition)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">Pembuangan Air Evaporator</td>
                  <td className="p-2 w-32 text-center">{formatStatusBadge(checkup.evaporator_drain_condition)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">
                    Suhu Embusan Kisi AC <span className="text-slate-500 font-normal">(Target 4–8°C)</span>
                  </td>
                  <td className="p-2 w-32 text-center font-bold text-slate-900 font-mono">
                    {checkup.air_vent_temperature || '7 °C'}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">
                    Tekanan Rendah (Low Pressure) <span className="text-slate-500 font-normal">(Normal 20–35 Psi)</span>
                  </td>
                  <td className="p-2 w-32 text-center font-bold text-slate-900 font-mono">
                    {checkup.low_pressure_psi || '25 Psi'}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-900 border-r border-slate-300">
                    Tekanan Tinggi (High Pressure) <span className="text-slate-500 font-normal">(Normal 150–250 Psi)</span>
                  </td>
                  <td className="p-2 w-32 text-center font-bold text-slate-900 font-mono">
                    {checkup.high_pressure_psi || '160 Psi'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Catatan Box */}
          <div className="text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-300 space-y-0.5">
            <span className="font-black text-slate-900">Catatan: </span>
            <span className="text-slate-800 font-medium">
              {checkup.recommendations || 'Cek kebocoran berkala dan lakukan pembersihan filter kabin secara rutin.'}
            </span>
          </div>

          {/* Symmetrical Dual Digital Signatures */}
          <div className="border border-slate-800 rounded-xl p-3 bg-white">
            <div className="grid grid-cols-2 gap-6 text-center text-xs">
              {/* TTD Teknisi */}
              <div className="space-y-1">
                <p className="font-bold text-slate-700 text-[10.5px]">Teknisi</p>
                <div className="h-14 flex items-center justify-center overflow-hidden my-0.5">
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
                  {signerTeknisi || 'Teknisi AC'}
                </p>
              </div>

              {/* TTD Pelanggan */}
              <div className="space-y-1">
                <p className="font-bold text-slate-700 text-[10.5px]">Pelanggan</p>
                <div className="h-14 flex items-center justify-center overflow-hidden my-0.5">
                  {checkup.customer_signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={checkup.customer_signature_url}
                      alt="TTD Pelanggan"
                      className="max-h-12 max-w-full object-contain block mx-auto"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">(Tanda Tangan)</span>
                  )}
                </div>
                <p className="font-bold text-slate-950 text-[11px] border-t border-slate-300 pt-1">
                  ({checkup.customer_name || '............'})
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <OfficialDocumentFooter
            documentCode={checkup.document_number}
            termsNote="Lembar Quality Control AC Sah • Mardiono Home Service"
          />
        </div>
      </div>
    </div>
  );
}
