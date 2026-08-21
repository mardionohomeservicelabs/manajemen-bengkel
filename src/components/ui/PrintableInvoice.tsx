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
  CheckCircle2,
  Receipt,
  CreditCard,
} from 'lucide-react';
import {
  OfficialDocumentHeader,
  OfficialDocumentFooter,
} from './OfficialDocumentLayout';

interface PrintableInvoiceProps {
  invoice: Invoice;
  settings: WorkshopSettings;
  onClose?: () => void;
}

export function PrintableInvoice({
  invoice,
  settings,
  onClose,
}: PrintableInvoiceProps) {
  const [printMode, setPrintMode] = useState<'sheet' | 'thermal'>('sheet');
  const [signerKasir, setSignerKasir] = useState<string>('');
  const vehicle = invoice.vehicle;
  const isPaid = invoice.payment_status === 'paid';

  const handlePrint = () => {
    window.print();
  };

  const getPaymentMethodLabel = (method?: string) => {
    const map: Record<string, string> = {
      cash: 'Tunai (Cash)',
      transfer_bca: 'Transfer Bank BCA',
      transfer_mandiri: 'Transfer Bank Mandiri',
      transfer_bri: 'Transfer Bank BRI',
      qris: 'QRIS Instant Payment',
      debit_card: 'Kartu Debit',
      credit_card: 'Kartu Kredit',
    };
    return method ? map[method] || method : 'Tunai';
  };

  const getWhatsAppMessage = () => {
    return (
      `Halo Bpk/Ibu ${vehicle?.customer_name || 'Pelanggan'},\n` +
      `Berikut rincian Nota Servis resmi dari ${settings.name}:\n\n` +
      `No. Nota: ${invoice.invoice_number}\n` +
      `Kendaraan: ${vehicle?.car_brand} ${vehicle?.car_model} (${vehicle?.license_plate})\n` +
      `Total Pembayaran: ${formatCurrency(invoice.total_amount)}\n` +
      `Status: ${isPaid ? 'LUNAS' : 'PENDING'}\n` +
      `Metode: ${getPaymentMethodLabel(invoice.payment_method)}\n\n` +
      `Garansi servis & AC berlaku 1 bulan / 1.000 KM. Terima kasih atas kepercayaan Anda!`
    );
  };

  const waLink = vehicle?.phone_number
    ? createWhatsAppLink(vehicle.phone_number, getWhatsAppMessage())
    : '#';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      {/* Top Floating Control Bar */}
      <div className="no-print bg-slate-900 text-white px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B0000] flex items-center justify-center text-white font-bold">
            <Receipt className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Nota Servis Resmi • Mardiono Home Service</h3>
            <p className="text-[11px] text-slate-400">Ukuran Otomatis Sesuai Struktur Nota</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs ml-2">
            <button
              onClick={() => setPrintMode('sheet')}
              className={`px-3 py-1.5 rounded-lg transition font-bold ${
                printMode === 'sheet'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Format Dokumen Resmi
            </button>
            <button
              onClick={() => setPrintMode('thermal')}
              className={`px-3 py-1.5 rounded-lg transition font-bold ${
                printMode === 'thermal'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Format Struk Thermal (80mm)
            </button>
          </div>
        </div>

        {/* Input Nama Kasir */}
        {printMode === 'sheet' && (
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Nama Kasir / Admin</label>
            <input
              type="text"
              value={signerKasir}
              onChange={(e) => setSignerKasir(e.target.value)}
              placeholder="Nama kasir yang menandatangani..."
              className="bg-slate-800 border border-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg w-52 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
        )}

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 bg-[#8B0000] hover:bg-maroon-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak {printMode === 'sheet' ? 'Nota' : 'Struk (80mm)'}</span>
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

      {/* RENDER MODE 1: DOKUMEN RESMI AUTO-HEIGHT */}
      {printMode === 'sheet' && (
        <div className="doc-preview-wrapper rounded-2xl">
          <div className="doc-sheet space-y-3">
            {/* Header */}
            <OfficialDocumentHeader settings={settings} />

            {/* Title Header */}
            <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-900">
              <div>
                <span className="bg-[#8B0000] text-white px-3 py-1 rounded text-xs font-black uppercase tracking-wider">
                  FAKTUR / NOTA PEMBAYARAN RESMI
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase">No. Nota: </span>
                <span className="font-mono font-black text-sm text-[#001F7A]">
                  {invoice.invoice_number}
                </span>
              </div>
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-300">
              <div>
                <span className="text-slate-500 text-[10px] block">Waktu Terbit:</span>
                <strong className="text-slate-900">{formatDateTime(invoice.created_at)}</strong>
              </div>
              {invoice.work_order ? (
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Ref SPK:</span>
                  <strong className="font-mono text-[#001F7A] font-bold">{invoice.work_order.spk_number}</strong>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Tipe Nota:</span>
                  <strong className="text-slate-900">Servis Langsung</strong>
                </div>
              )}
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">Kasir PIC:</span>
                <strong className="text-slate-900">Siti Rahmawati</strong>
              </div>
            </div>

            {/* Customer & Vehicle Info Box (Symmetrical 2-Column) */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-slate-800 rounded-xl p-3 bg-white space-y-1">
                <h4 className="font-black text-[#8B0000] uppercase text-[10.5px] pb-0.5 border-b border-slate-200">
                  Ditagihkan Kepada:
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
                    <th className="p-2 border-r border-slate-300">Deskripsi Jasa & Sparepart</th>
                    <th className="p-2 w-16 text-center border-r border-slate-300">Tipe</th>
                    <th className="p-2 w-12 text-center border-r border-slate-300">Qty</th>
                    <th className="p-2 w-24 text-right border-r border-slate-300">Harga Satuan</th>
                    <th className="p-2 w-28 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-bold border-r border-slate-300">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {item.code && <div className="text-[9.5px] text-slate-500 font-mono">{item.code}</div>}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">
                        <span
                          className={`inline-block text-[9.5px] px-2 py-0.5 rounded font-black ${
                            item.is_service ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'
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

            {/* Symmetrical Grid: Payment Info & Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Left: Payment Info & LUNAS Stamp */}
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1 text-[11px]">
                  <h5 className="font-black text-[#8B0000] uppercase text-[10.5px] flex items-center space-x-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Informasi Pembayaran</span>
                  </h5>
                  <div>Metode: <strong>{getPaymentMethodLabel(invoice.payment_method)}</strong></div>
                  {invoice.paid_at && <div>Waktu Bayar: <strong>{formatDateTime(invoice.paid_at)}</strong></div>}
                  <div className="pt-1 border-t border-slate-300 text-[10px] text-slate-600">
                    <p className="font-bold text-slate-800">Transfer Rekening Resmi Bengkel:</p>
                    <p className="whitespace-pre-line font-mono font-bold text-slate-900">{settings.bank_account_info}</p>
                  </div>
                </div>

                {/* Status Stamp */}
                {isPaid ? (
                  <div className="inline-flex items-center space-x-2 border-2 border-emerald-700 bg-emerald-50 text-emerald-900 px-3.5 py-1.5 rounded-xl font-black uppercase tracking-wider text-xs shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>LUNAS / TELAH DIBAYAR</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center space-x-2 border-2 border-amber-600 bg-amber-50 text-amber-900 px-3.5 py-1.5 rounded-xl font-black uppercase tracking-wider text-xs">
                    <span>MENUNGGU PEMBAYARAN</span>
                  </div>
                )}
              </div>

              {/* Right: Calculations Breakdown */}
              <div className="space-y-1 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300">
                <div className="flex justify-between text-slate-700 font-semibold text-[11px]">
                  <span>Subtotal Rincian:</span>
                  <span className="font-mono font-bold">{formatCurrency(invoice.subtotal)}</span>
                </div>

                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold text-[11px]">
                    <span>Potongan Diskon:</span>
                    <span className="font-mono">- {formatCurrency(invoice.discount_amount)}</span>
                  </div>
                )}

                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-slate-700 font-semibold text-[11px]">
                    <span>PPN ({invoice.tax_percent}%):</span>
                    <span className="font-mono">{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                )}

                <div className="border-t-2 border-slate-800 pt-1 flex justify-between text-sm font-black text-[#8B0000]">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-base">{formatCurrency(invoice.total_amount)}</span>
                </div>

                {invoice.down_payment > 0 && (
                  <div className="flex justify-between text-slate-700 pt-0.5 text-[11px]">
                    <span>Uang Muka (DP):</span>
                    <span className="font-mono">{formatCurrency(invoice.down_payment)}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs font-black text-slate-900 pt-0.5 border-t border-slate-300">
                  <span>Sisa Tagihan:</span>
                  <span className="font-mono text-emerald-800">
                    {formatCurrency(invoice.balance_due || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Symmetrical Dual Digital Signatures */}
            <div className="border border-slate-900 rounded-xl p-3 bg-white space-y-2">
              <h4 className="text-center font-black text-xs uppercase tracking-wider text-slate-950 pb-1 border-b border-slate-200">
                Pengesahan Bukti Pembayaran
              </h4>

              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                {/* TTD Kasir */}
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[105px]">
                  <p className="font-black text-[#8B0000] text-[10px] uppercase">Kasir / Admin Penagihan</p>
                  <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white overflow-hidden my-0.5">
                    {invoice.signature_admin_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={invoice.signature_admin_url}
                        alt="TTD Admin"
                        className="max-h-11 max-w-full object-contain block mx-auto"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">Tanda tangan kasir</span>
                    )}
                  </div>
                  <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                    {signerKasir || 'Kasir / Admin Penagihan'}
                  </p>
                </div>

                {/* TTD Pelanggan */}
                <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col justify-between h-[105px]">
                  <p className="font-black text-[#001F7A] text-[10px] uppercase">Pelanggan / Pembayar</p>
                  <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white overflow-hidden my-0.5">
                    {invoice.signature_customer_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={invoice.signature_customer_url}
                        alt="TTD Pelanggan"
                        className="max-h-11 max-w-full object-contain block mx-auto"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">Tanda tangan pelanggan</span>
                    )}
                  </div>
                  <p className="font-bold text-slate-950 text-[10px] border-t border-slate-300 pt-0.5 truncate">
                    {vehicle?.customer_name || 'Pelanggan'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <OfficialDocumentFooter
              documentCode={invoice.invoice_number}
              termsNote="Garansi Servis & AC 1 Bulan / 1.000 KM • Bukti Pembayaran Sah Mardiono Home Service"
            />
          </div>
        </div>
      )}

      {/* RENDER MODE 2: FORMAT THERMAL POS 80MM */}
      {printMode === 'thermal' && (
        <div className="p-4 text-slate-900 font-mono text-[11px] leading-tight thermal-receipt-print max-w-[340px] mx-auto bg-white border border-slate-300 rounded-xl shadow-lg">
          <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
            <h2 className="font-black text-sm uppercase">{settings.name}</h2>
            <p className="text-[10px] uppercase font-sans font-bold">{settings.tagline}</p>
            <p className="text-[10px] leading-tight font-sans">{settings.address}</p>
            <p className="text-[10px] font-sans">Telp: {settings.phone}</p>
          </div>

          <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>No. Nota:</span>
              <span className="font-bold">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>{formatDateTime(invoice.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span className="font-bold">{vehicle?.customer_name || 'Umum'}</span>
            </div>
            <div className="flex justify-between">
              <span>Kendaraan:</span>
              <span>{vehicle?.car_brand} {vehicle?.car_model} ({vehicle?.license_plate})</span>
            </div>
          </div>

          <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
            {invoice.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold">{item.name}</div>
                <div className="flex justify-between text-[10px] text-slate-700">
                  <span>{item.qty} x {formatCurrency(item.price)}</span>
                  <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between">
                <span>Diskon:</span>
                <span>-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between">
                <span>PPN ({invoice.tax_percent}%):</span>
                <span>{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs border-t border-slate-300 pt-1">
              <span>TOTAL:</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Metode:</span>
              <span className="uppercase font-bold">{getPaymentMethodLabel(invoice.payment_method)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Status:</span>
              <span className="font-black uppercase">{isPaid ? 'LUNAS' : 'BELUM LUNAS'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-b border-dashed border-slate-400 text-center text-[9px]">
            <div>
              <span>Kasir</span>
              <div className="h-10 flex items-center justify-center">
                {invoice.signature_admin_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invoice.signature_admin_url} alt="TTD Admin" className="max-h-8 object-contain" />
                ) : (
                  <span className="text-[8px] italic">(TTD)</span>
                )}
              </div>
              <span>(Admin)</span>
            </div>
            <div>
              <span>Pelanggan</span>
              <div className="h-10 flex items-center justify-center">
                {invoice.signature_customer_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invoice.signature_customer_url} alt="TTD Pelanggan" className="max-h-8 object-contain" />
                ) : (
                  <span className="text-[8px] italic">(TTD)</span>
                )}
              </div>
              <span>({vehicle?.customer_name || 'Pelanggan'})</span>
            </div>
          </div>

          <div className="pt-2 text-center text-[9px] space-y-0.5">
            <p className="font-bold">*** TERIMA KASIH ***</p>
            <p>Garansi Servis & AC 1 Bulan / 1.000 KM</p>
            <p>Simpan nota ini sebagai bukti garansi sah</p>
          </div>
        </div>
      )}
    </div>
  );
}
