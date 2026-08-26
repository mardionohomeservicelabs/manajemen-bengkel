'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DBService } from '@/lib/services/db-service';
import { Invoice, WorkshopSettings } from '@/lib/types/database';
import { formatCurrency, formatPlate, formatDateTime, formatNumberOrText } from '@/lib/utils';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { CheckCircle2, ShieldCheck, Car, Calendar, Clock, ArrowRight, Printer, Sparkles, Building2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerSignatureApprovalPage() {
  const params = useParams();
  const rawId = params?.id as string;

  const [estimation, setEstimation] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [selectedOption, setSelectedOption] = useState<'opsi1' | 'opsi2'>('opsi1');
  const [signerName, setSignerName] = useState<string>('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!rawId) return;

    const result = DBService.findEstimationByIdOrToken(rawId);
    if (result && result.estimation) {
      setEstimation(result.estimation);
      setSettings(DBService.getSettings(result.branch));
      setSignerName(result.estimation.vehicle?.customer_name || '');
      if (result.estimation.customer_approved_option) {
        setSelectedOption(result.estimation.customer_approved_option);
      }
      if (result.estimation.ttd_status === 'signed' || result.estimation.customer_signature) {
        setIsSubmittedSuccess(true);
      }
    } else {
      setNotFound(true);
    }
  }, [rawId]);

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimation) return;
    if (!signatureDataUrl) {
      alert('Silakan bubuhkan tanda tangan Anda pada kanvas terlebih dahulu.');
      return;
    }
    if (!agreedTerms) {
      alert('Harap centang persetujuan estimasi & ketentuan servis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await DBService.approveEstimationSignature(
        rawId,
        signatureDataUrl,
        signerName.trim() || estimation.vehicle?.customer_name || 'Customer',
        selectedOption
      );

      if (updated) {
        setEstimation(updated);
        setIsSubmittedSuccess(true);
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore confetti error if any
        }
      }
    } catch (err) {
      console.error('Error approving signature:', err);
      alert('Terjadi kesalahan saat mengirim tanda tangan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
            !
          </div>
          <h2 className="text-lg font-black text-slate-900">Estimasi Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">
            Tautan estimasi tidak valid atau telah dihapus oleh sistem. Silakan hubungi Service Advisor bengkel Anda.
          </p>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Memuat Lembar Persetujuan Estimasi...</p>
        </div>
      </div>
    );
  }

  const vehicle = estimation.vehicle;
  const items = estimation.items || [];
  const hasOpsi2 = estimation.has_opsi2 !== false;

  // Total Opsi 1
  const totalOpsi1 = items.reduce((sum, it) => {
    const tot = typeof it.total_opsi1 === 'number'
      ? it.total_opsi1
      : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : (typeof it.price === 'number' ? (it.qty || 1) * it.price : 0));
    return sum + (Number.isNaN(tot) ? 0 : tot);
  }, 0) - (estimation.discount_amount || 0);

  // Total Opsi 2
  const totalOpsi2 = items.reduce((sum, it) => {
    const tot = typeof it.total_opsi2 === 'number'
      ? it.total_opsi2
      : (typeof it.price_opsi2 === 'number'
        ? (it.qty || 1) * it.price_opsi2
        : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : (typeof it.price === 'number' ? (it.qty || 1) * it.price : 0)));
    return sum + (Number.isNaN(tot) ? 0 : tot);
  }, 0) - (estimation.discount_amount || 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Official Header */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-md flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {settings?.name || 'MARDIONO HOME SERVICE'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">{settings?.tagline || 'Spesialis Mesin & AC Mobil'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{settings?.phone || '0812-3076-2930'} • {settings?.city || 'Sidoarjo'}</p>
            </div>
          </div>
          <div className="text-center sm:text-right bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">No. Estimasi Resmi</span>
            <span className="font-mono font-black text-sm text-blue-950">{estimation.invoice_number}</span>
          </div>
        </div>

        {/* Success Banner if already signed */}
        {isSubmittedSuccess && (
          <div className="bg-emerald-50 border-2 border-emerald-500/80 rounded-2xl p-5 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-emerald-950">
                Persetujuan Estimasi Berhasil Dikonfirmasi!
              </h2>
              <p className="text-xs text-emerald-800 mt-1 max-w-lg mx-auto">
                Terima kasih, <strong>{estimation.customer_signed_name || signerName || vehicle?.customer_name}</strong>. Anda telah menyetujui pengerjaan dengan pilihan <strong>{estimation.customer_approved_option === 'opsi2' ? 'OPSI 2' : 'OPSI 1'}</strong>.
              </p>
              {estimation.customer_signed_at && (
                <p className="text-[11px] text-emerald-700 font-mono mt-1">
                  Waktu Konfirmasi: {formatDateTime(estimation.customer_signed_at)}
                </p>
              )}
            </div>

            {estimation.customer_signature && (
              <div className="mt-4 pt-3 border-t border-emerald-200 max-w-xs mx-auto">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">Tanda Tangan Digital Tersimpan:</span>
                <div className="bg-white p-2 rounded-xl border border-emerald-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estimation.customer_signature} alt="Tanda Tangan Customer" className="h-20 mx-auto object-contain" />
                </div>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan Salinan Persetujuan</span>
            </button>
          </div>
        )}

        {/* Customer & Vehicle Info Box */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
              <Car className="w-4 h-4 text-blue-600" />
              <span>Identitas Kendaraan &amp; Pelanggan</span>
            </h3>
            {estimation.vehicle_status && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Status Mobil: {estimation.vehicle_status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-slate-400 text-[10.5px] font-semibold block">Pemilik / Pelanggan:</span>
              <div className="font-black text-slate-900 text-sm">{vehicle?.customer_name || 'Pelanggan'}</div>
              <div className="text-slate-600 font-mono">{vehicle?.phone_number || '-'}</div>
              <div className="text-slate-500 text-[11px] line-clamp-1">{vehicle?.address || '-'}</div>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-slate-400 text-[10.5px] font-semibold block">Unit Kendaraan:</span>
              <div className="font-black text-blue-900 font-mono text-sm">
                {vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}
              </div>
              <div className="font-bold text-slate-800">{vehicle?.car_brand} {vehicle?.car_model}</div>
              <div className="text-slate-500 text-[11px]">Rencana Bayar: <strong>{estimation.payment_plan || 'Transfer'}</strong></div>
            </div>
          </div>
        </div>

        {/* Estimation Items Table */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Rincian Estimasi Biaya Pekerjaan &amp; Part
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Silakan tinjau rincian opsi estimasi di bawah ini.</p>
            </div>
            {estimation.work_order?.spk_number && (
              <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                SPK: {estimation.work_order.spk_number}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-300 text-slate-800 font-black text-[11px] uppercase">
                  <th className="p-3 w-8 text-center border-r border-slate-200">No</th>
                  <th className="p-3 border-r border-slate-200">Saran/Perbaikan/Ganti Sparepart</th>
                  <th className="p-3 w-16 text-center border-r border-slate-200">QTY</th>
                  <th className="p-3 w-20 text-center border-r border-slate-200">Satuan</th>
                  <th className="p-3 text-right border-r border-slate-200">Hrg Sat</th>
                  <th className="p-3 text-right border-r border-slate-200">Total Opsi 1</th>
                  {hasOpsi2 && (
                    <>
                      <th className="p-3 text-right text-blue-950 bg-blue-50/50 border-r border-slate-200">Hrg Opsi 2</th>
                      <th className="p-3 text-right text-blue-950 bg-blue-50/50">Total Opsi 2</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  const p1 = item.price_opsi1 !== undefined ? item.price_opsi1 : item.price;
                  const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof p1 === 'number' ? (item.qty || 1) * p1 : p1);
                  const p2 = item.price_opsi2 !== undefined ? item.price_opsi2 : p1;
                  const tot2 = item.total_opsi2 !== undefined ? item.total_opsi2 : (typeof p2 === 'number' ? (item.qty || 1) * p2 : p2);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 text-center text-slate-500 font-bold border-r border-slate-200">{idx + 1}</td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 uppercase">{item.name}</div>
                        {item.code && <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>}
                      </td>
                      <td className="p-3 text-center font-bold font-mono border-r border-slate-200">{item.qty || 1}</td>
                      <td className="p-3 text-center text-[11px] uppercase text-slate-700 font-bold border-r border-slate-200">{item.unit || 'PCS'}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800 border-r border-slate-200">{formatNumberOrText(p1)}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-950 border-r border-slate-200">{formatNumberOrText(tot1)}</td>
                      {hasOpsi2 && (
                        <>
                          <td className="p-3 text-right font-mono font-bold text-blue-900 bg-blue-50/30 border-r border-slate-200">{formatNumberOrText(p2)}</td>
                          <td className="p-3 text-right font-mono font-black text-blue-950 bg-blue-50/30">{formatNumberOrText(tot2)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total Footer Row */}
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs">
                  <td colSpan={5} className="p-3 text-center uppercase tracking-wider text-slate-900 font-black">
                    JUMLAH KESELURUHAN
                  </td>
                  <td className="p-3 text-right font-mono font-black text-sm text-slate-950 border-r border-slate-200">
                    {formatNumberOrText(totalOpsi1)}
                  </td>
                  {hasOpsi2 && (
                    <>
                      <td className="p-3 bg-blue-50/30 border-r border-slate-200"></td>
                      <td className="p-3 text-right font-mono font-black text-sm text-blue-950 bg-blue-50/30">
                        {formatNumberOrText(totalOpsi2)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Total Breakdown Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-900 block">Total Estimasi Opsi 1</span>
                <span className="text-[11px] text-slate-500">Standar / Rekomendasi Utama</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-base text-blue-950">{formatCurrency(totalOpsi1)}</span>
              </div>
            </div>

            {hasOpsi2 && (
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-purple-900 block">Total Estimasi Opsi 2</span>
                  <span className="text-[11px] text-slate-500">Pilihan Alternatif</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-base text-purple-950">{formatCurrency(totalOpsi2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signature & Approval Form (if not yet submitted) */}
        {!isSubmittedSuccess && (
          <form onSubmit={handleSubmitSignature} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Persetujuan &amp; Tanda Tangan Digital Pelanggan</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih opsi estimasi yang Anda setujui dan bubuhkan tanda tangan di bawah ini.
              </p>
            </div>

            {/* Option Selection Radio Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                1. Pilih Opsi Estimasi yang Anda Setujui: <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setSelectedOption('opsi1')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                    selectedOption === 'opsi1'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="approved_option"
                      checked={selectedOption === 'opsi1'}
                      onChange={() => setSelectedOption('opsi1')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <div>
                      <div className="font-black text-xs text-slate-900">SETUJUI OPSI 1</div>
                      <div className="text-[11px] text-slate-500">Estimasi Standar</div>
                    </div>
                  </div>
                  <div className="font-mono font-black text-sm text-blue-900">{formatCurrency(totalOpsi1)}</div>
                </div>

                {hasOpsi2 && (
                  <div
                    onClick={() => setSelectedOption('opsi2')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                      selectedOption === 'opsi2'
                        ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="approved_option"
                        checked={selectedOption === 'opsi2'}
                        onChange={() => setSelectedOption('opsi2')}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 accent-purple-600"
                      />
                      <div>
                        <div className="font-black text-xs text-slate-900">SETUJUI OPSI 2</div>
                        <div className="text-[11px] text-slate-500">Estimasi Alternatif</div>
                      </div>
                    </div>
                    <div className="font-mono font-black text-sm text-purple-900">{formatCurrency(totalOpsi2)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Name Input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                2. Nama Lengkap Penanda Tangan: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Contoh: Ahmad Fadillah"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
              />
            </div>

            {/* Signature Canvas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                3. Tanda Tangan Digital (Gunakan Jari / Stylus / Mouse): <span className="text-red-500">*</span>
              </label>
              <SignatureCanvas
                onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
              />
            </div>

            {/* Terms & Conditions Agreement */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-start space-x-2.5">
                <input
                  type="checkbox"
                  id="agree_terms"
                  required
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="agree_terms" className="text-xs text-slate-700 leading-relaxed cursor-pointer font-medium">
                  Saya menyatakan telah memeriksa rincian estimasi biaya di atas dan <strong>memberikan izin persetujuan</strong> kepada pihak bengkel untuk memulai proses servis/penggantian suku cadang pada kendaraan saya sesuai opsi yang dipilih.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !signatureDataUrl || !agreedTerms}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim Tanda Tangan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kirim Tanda Tangan &amp; Setujui Estimasi</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 py-2">
          {settings?.name} • Sistem Manajemen Bengkel Digital • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
