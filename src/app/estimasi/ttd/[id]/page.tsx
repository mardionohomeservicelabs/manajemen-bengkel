'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DBService } from '@/lib/services/db-service';
import { Invoice, WorkshopSettings } from '@/lib/types/database';
import { formatCurrency, formatPlate, formatDateTime, formatNumberOrText } from '@/lib/utils';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';

type CustomerChoice = 'opsi1' | 'opsi2' | 'pending';

export default function CustomerSignatureApprovalPage() {
  const params = useParams();
  const rawId = params?.id as string;

  const [estimation, setEstimation] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [selectedOption, setSelectedOption] = useState<CustomerChoice>('opsi1');
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
        setSelectedOption(result.estimation.customer_approved_option as CustomerChoice);
      }
      if (result.estimation.ttd_status === 'signed' || result.estimation.customer_signature) {
        setIsSubmittedSuccess(true);
      }
    } else {
      setNotFound(true);
    }
  }, [rawId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimation) return;

    if (selectedOption !== 'pending' && !signatureDataUrl) {
      alert('Silakan bubuhkan tanda tangan Anda pada kanvas terlebih dahulu.');
      return;
    }
    if (!agreedTerms) {
      alert('Harap centang persetujuan ketentuan estimasi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedOption === 'pending') {
        // Untuk Pending: simpan pilihan tanpa TTD
        const saved = DBService.savePendingResponse(
          rawId,
          signerName || estimation.vehicle?.customer_name || 'Customer'
        );
        if (saved) setEstimation(saved);
        setIsSubmittedSuccess(true);
        return;
      }

      // Opsi 1 atau Opsi 2: simpan TTD + pilihan
      const updated = await DBService.approveEstimationSignature(
        rawId,
        signatureDataUrl,
        signerName.trim() || estimation.vehicle?.customer_name || 'Customer',
        selectedOption as 'opsi1' | 'opsi2'
      );

      if (updated) {
        // Juga update customer_response sesuai pilihan
        const finalUpdated: Invoice = {
          ...updated,
          customer_response: selectedOption as 'opsi1' | 'opsi2',
        };
        setEstimation(finalUpdated);
        setIsSubmittedSuccess(true);
        try {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Loading & Error States ─── */
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">!</div>
          <h2 className="text-base font-black text-slate-900">Estimasi Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tautan estimasi tidak valid atau telah kedaluwarsa. Silakan hubungi Service Advisor bengkel Anda.
          </p>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Memuat Lembar Persetujuan...</p>
        </div>
      </div>
    );
  }

  const vehicle = estimation.vehicle;
  const items = estimation.items || [];
  const hasOpsi2 = estimation.has_opsi2 !== false;

  const totalOpsi1 = Math.max(0, items.reduce((s, it) => {
    const t = typeof it.total_opsi1 === 'number' ? it.total_opsi1
      : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : 0);
    return s + (isNaN(t) ? 0 : t);
  }, 0) - (estimation.discount_amount || 0));

  const totalOpsi2 = Math.max(0, items.reduce((s, it) => {
    const t = typeof it.total_opsi2 === 'number' ? it.total_opsi2
      : (typeof it.price_opsi2 === 'number' ? (it.qty || 1) * it.price_opsi2
        : (typeof it.price_opsi1 === 'number' ? (it.qty || 1) * it.price_opsi1 : 0));
    return s + (isNaN(t) ? 0 : t);
  }, 0) - (estimation.discount_amount || 0));

  const workshopName = settings?.name || 'MARDIONO HOME SERVICE';
  const workshopPhone = settings?.phone || '';
  const workshopAddress = settings?.address || '';

  /* ─── Success Page ─── */
  if (isSubmittedSuccess) {
    const isPending = estimation.customer_response === 'pending' || selectedOption === 'pending';
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-5 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`}>
            {isPending
              ? <Clock className="w-8 h-8 text-white" />
              : <CheckCircle2 className="w-8 h-8 text-white" />
            }
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h2 className={`text-base font-black ${isPending ? 'text-amber-800' : 'text-emerald-800'}`}>
              {isPending ? 'Respon Diterima: Pending' : 'Persetujuan Berhasil Dikonfirmasi!'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isPending
                ? `Terima kasih, ${signerName || vehicle?.customer_name}. Kami akan menunggu keputusan Anda. Silakan hubungi SA kami untuk konfirmasi selanjutnya.`
                : `Terima kasih, ${estimation.customer_signed_name || signerName || vehicle?.customer_name}. Anda telah menyetujui dengan pilihan ${selectedOption === 'opsi2' ? 'Opsi 2' : 'Opsi 1'}.`
              }
            </p>
            {estimation.customer_signed_at && (
              <p className="text-[11px] text-slate-400 font-mono">
                Waktu: {formatDateTime(estimation.customer_signed_at)}
              </p>
            )}
            {!isPending && estimation.customer_signature && (
              <div className="mt-2 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 block mb-1">Tanda Tangan Digital Tersimpan:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estimation.customer_signature} alt="TTD" className="h-16 mx-auto object-contain opacity-80" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{workshopName} · Sistem Manajemen Bengkel</p>
        </div>
      </div>
    );
  }

  /* ─── Main Page ─── */
  return (
    <div className="min-h-screen bg-[#f5f5f5] py-4 px-3">
      <div className="max-w-2xl mx-auto space-y-3">

        {/* ── BENGKEL HEADER (mirip header dokumen resmi) ── */}
        <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded-lg border border-slate-200" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#001F7A] text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                  {workshopName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-black text-sm text-slate-900 leading-tight">{workshopName}</h1>
                {workshopPhone && <p className="text-[11px] text-slate-500 font-mono">No. HP: {workshopPhone}</p>}
                {workshopAddress && <p className="text-[11px] text-slate-500 leading-tight line-clamp-1">{workshopAddress}</p>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">No. Estimasi</span>
              <span className="font-mono font-black text-xs text-[#001F7A]">{estimation.invoice_number}</span>
              {estimation.work_order?.spk_number && (
                <span className="text-[9px] text-slate-400 font-mono block mt-0.5">SPK: {estimation.work_order.spk_number}</span>
              )}
            </div>
          </div>

          {/* Identitas Customer & Kendaraan */}
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Pemilik / Pelanggan</span>
              <div className="font-black text-slate-900">{vehicle?.customer_name || '-'}</div>
              <div className="text-slate-500 font-mono text-[11px]">{vehicle?.phone_number || '-'}</div>
              <div className="text-slate-500 text-[11px] leading-tight">{vehicle?.address || '-'}</div>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Kendaraan</span>
              <div className="font-black text-[#8B0000] font-mono">{vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}</div>
              <div className="font-bold text-slate-800 text-[11px]">{vehicle?.car_brand} {vehicle?.car_model} ({vehicle?.car_year || '-'})</div>
              <div className="text-slate-500 text-[11px]">KM: {vehicle?.current_mileage?.toLocaleString('id-ID') || '-'}</div>
            </div>
          </div>

          {/* Status Mobil + Estimator */}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            {estimation.vehicle_status && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                {estimation.vehicle_status === 'Di Tunggu' ? '⏳' : estimation.vehicle_status === 'Rawat Inap' ? '🏥' : '🚗'} {estimation.vehicle_status}
              </span>
            )}
            {(estimation as any).estimated_duration && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                ⏱ Est. {(estimation as any).estimated_duration}
              </span>
            )}
            {(estimation as any).estimator_name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                👤 SA: {(estimation as any).estimator_name}
              </span>
            )}
          </div>
        </div>

        {/* ── TABEL ESTIMASI ── */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          {/* Section header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              Estimasi: {estimation.estimation_type || 'Umum'}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Harga berlaku sesuai dengan estimasi, dilangsungkan untuk jasa servis dengan ketersediaan sparepart di gudang.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-slate-800 text-white text-[10px] font-black uppercase">
                  <th className="p-2 w-7 text-center border-r border-slate-600">No</th>
                  <th className="p-2 border-r border-slate-600">Item</th>
                  <th className="p-2 w-10 text-center border-r border-slate-600">Qty</th>
                  <th className="p-2 w-14 text-center border-r border-slate-600">Satuan</th>
                  <th className="p-2 w-24 text-right border-r border-slate-600">Harga</th>
                  <th className="p-2 w-24 text-right border-r border-slate-600">Total 1</th>
                  {hasOpsi2 && <th className="p-2 w-24 text-right bg-blue-900">Total 2</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const p1 = item.price_opsi1 !== undefined ? item.price_opsi1 : item.price;
                  const tot1 = item.total_opsi1 !== undefined ? item.total_opsi1 : (typeof p1 === 'number' ? (item.qty || 1) * p1 : p1);
                  const p2 = item.price_opsi2 !== undefined ? item.price_opsi2 : p1;
                  const tot2 = item.total_opsi2 !== undefined ? item.total_opsi2 : (typeof p2 === 'number' ? (item.qty || 1) * p2 : p2);

                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2 text-center text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-100">
                        <div className="font-bold text-slate-900 uppercase text-[10.5px]">{item.name}</div>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700 border-r border-slate-100">{item.qty || 1}</td>
                      <td className="p-2 text-center text-[10px] font-black uppercase text-slate-600 border-r border-slate-100">{item.unit || 'PCS'}</td>
                      <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-100">{formatNumberOrText(p1)}</td>
                      <td className="p-2 text-right font-mono font-black text-slate-900 border-r border-slate-100">{formatNumberOrText(tot1)}</td>
                      {hasOpsi2 && (
                        <td className="p-2 text-right font-mono font-black text-blue-900 bg-blue-50/30">{formatNumberOrText(tot2)}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-[11px]">
                  <td colSpan={5} className="p-2 text-center uppercase tracking-wider text-slate-800 border-r border-slate-200">
                    Total Cost
                  </td>
                  <td className="p-2 text-right font-mono text-slate-950 border-r border-slate-200">
                    {formatNumberOrText(totalOpsi1)}
                  </td>
                  {hasOpsi2 && (
                    <td className="p-2 text-right font-mono text-blue-950 bg-blue-50/30">
                      {formatNumberOrText(totalOpsi2)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── FORM PERSETUJUAN & TTD ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          {/* Keputusan Anda */}
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Keputusan Anda</h3>
          </div>
          <div className="p-4 space-y-2">
            {/* Opsi 1 */}
            <label className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition ${
              selectedOption === 'opsi1' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="radio"
                name="choice"
                value="opsi1"
                checked={selectedOption === 'opsi1'}
                onChange={() => setSelectedOption('opsi1')}
                className="w-4 h-4 accent-emerald-600"
              />
              <div className="flex-1">
                <span className="text-xs font-black text-slate-900">Setuju → Opsi 1</span>
                <span className="block text-[11px] text-slate-500">Total: <strong className="text-slate-800 font-mono">{formatCurrency(totalOpsi1)}</strong></span>
              </div>
              {selectedOption === 'opsi1' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            </label>

            {/* Opsi 2 */}
            {hasOpsi2 && (
              <label className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                selectedOption === 'opsi2' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="choice"
                  value="opsi2"
                  checked={selectedOption === 'opsi2'}
                  onChange={() => setSelectedOption('opsi2')}
                  className="w-4 h-4 accent-blue-600"
                />
                <div className="flex-1">
                  <span className="text-xs font-black text-slate-900">Setuju → Opsi 2</span>
                  <span className="block text-[11px] text-slate-500">Total: <strong className="text-slate-800 font-mono">{formatCurrency(totalOpsi2)}</strong></span>
                </div>
                {selectedOption === 'opsi2' && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              </label>
            )}

            {/* Pending */}
            <label className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition ${
              selectedOption === 'pending' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="radio"
                name="choice"
                value="pending"
                checked={selectedOption === 'pending'}
                onChange={() => setSelectedOption('pending')}
                className="w-4 h-4 accent-amber-500"
              />
              <div className="flex-1">
                <span className="text-xs font-black text-slate-900">Pending / Tidak pilih dulu</span>
                <span className="block text-[11px] text-slate-500">Saya perlu waktu untuk mempertimbangkan</span>
              </div>
              {selectedOption === 'pending' && <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            </label>
          </div>

          {/* Ketentuan Estimasi */}
          <div className="border-t border-b border-slate-200 px-4 py-3 bg-slate-50">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">KETENTUAN ESTIMASI:</h3>
            <ol className="text-[10.5px] text-slate-600 space-y-1.5 leading-relaxed list-decimal list-inside">
              <li>Membawa customer tidak diperkenankan membawa sparepart sendiri pada Kami / Teknisi.</li>
              <li>Apabila daya dari sendiri, dalam maksimal 2 hari, setelah pembayaran parkir Rp 20.000/hari.</li>
              <li>Apabila Anda memutuskan untuk melihat sendiri / Dan tidak bertanggung jawab atas kerusakan yang terjadi selama proses.</li>
              <li>Jika Membawa Part Sendiri Tidak Ada Garansi Dalam Bentuk Apapun.</li>
              <li className="font-bold text-slate-800">Apabila Sparepart Sudah Terpasang Dan Tidak Berfungsi, Kami Tidak Bisa Diretur.</li>
              <li className="font-bold text-slate-800">Harga Yang Estimasi Yang Muncul Berlaku 1 Minggu Dari Tanggal Estimasi Di Keluarkan.</li>
              <li>Apabila Harga Sparepart Ada Kenaikan Akan Kami Informasikan / Kembali Dengan Estimasi Terbaru.</li>
            </ol>
          </div>

          {/* Nama Penanda Tangan */}
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Nama Lengkap:
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nama penanda tangan..."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
              />
            </div>

            {/* Tanda Tangan — hanya tampil jika bukan Pending */}
            {selectedOption !== 'pending' && (
              <div>
                <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Tanda Tangan: <span className="text-red-500">*</span>
                </label>
                <div className="text-[10px] text-slate-400 mb-2">
                  Saya telah Membaca dan Menyetujui Ketentuan Di Atas
                </div>
                <SignatureCanvas onSave={(dataUrl) => setSignatureDataUrl(dataUrl)} />
              </div>
            )}

            {/* Agree Terms */}
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="terms"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-xs text-slate-600 leading-relaxed font-medium">
                Saya menyatakan telah membaca dan menyetujui seluruh <strong>Ketentuan Estimasi</strong> di atas.
              </span>
            </label>

            {/* Warning jika pending tapi tidak ada TTD */}
            {selectedOption === 'pending' && (
              <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span>Anda memilih <strong>Pending</strong>. Pekerjaan belum akan dimulai. Silakan hubungi SA kami untuk konfirmasi.</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !agreedTerms || (selectedOption !== 'pending' && !signatureDataUrl)}
              className={`w-full font-black text-sm py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedOption === 'pending'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-[#1E40AF] hover:bg-[#1E3A8A] text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  {selectedOption === 'pending'
                    ? <Clock className="w-4 h-4" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  <span>
                    {selectedOption === 'pending' ? 'Kirim Respon Pending' : '✓ Simpan Persetujuan'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 py-2 pb-6">
          {workshopName} · Sistem Manajemen Bengkel Digital · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
