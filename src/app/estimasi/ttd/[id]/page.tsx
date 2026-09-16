'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DBService } from '@/lib/services/db-service';
import { Invoice, WorkshopSettings } from '@/lib/types/database';
import { formatCurrency, formatPlate, formatDate, formatDateTime, formatKM, formatNumberOrText, formatComplaintsAndDiagnosis } from '@/lib/utils';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

type CustomerChoice = 'opsi1' | 'opsi2' | 'batal';

// Helper: parse price field yang bisa berupa kisaran "150000 - 160000" atau angka biasa
const parseRangePrice = (val: any): { min: number; max: number } => {
  if (typeof val === 'number') return { min: isNaN(val) ? 0 : val, max: isNaN(val) ? 0 : val };
  if (!val) return { min: 0, max: 0 };
  const str = String(val).replace(/[Rp\s]/g, '');
  const parts = str.split(/[-\u2013]/);
  if (parts.length >= 2) {
    const minVal = parseInt(parts[0].replace(/\D/g, ''), 10) || 0;
    const maxVal = parseInt(parts[1].replace(/\D/g, ''), 10) || minVal;
    return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
  }
  const single = parseInt(str.replace(/\D/g, ''), 10) || 0;
  return { min: single, max: single };
};

const formatRangeDisplay = (min: number, max: number): string => {
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
};

// Helper render harga kompak: bila harga panjang (terutama rentang/range), otomatis mengarah ke bawah (stacked)
const renderCompactPrice = (priceStr: string | number, customColor?: string) => {
  if (priceStr === undefined || priceStr === null || priceStr === '') {
    return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
  }
  const str = String(priceStr).trim();
  if (str === '0' || str === 'Rp 0' || str === '-') {
    return <span className={`font-mono ${customColor || ''}`}>{str}</span>;
  }

  if (str.includes('–') || (str.includes(' - ') && str.includes('Rp'))) {
    const parts = str.includes('–') ? str.split('–') : str.split(' - ');
    if (parts.length >= 2) {
      const p1 = parts[0].trim();
      const p2 = parts[1].trim();
      return (
        <div className={`flex flex-col items-end leading-tight text-right ${customColor || ''}`}>
          <span className="font-mono whitespace-nowrap text-[10.5px]">{p1}</span>
          <span className="font-mono text-[9px] opacity-80 whitespace-nowrap">– {p2}</span>
        </div>
      );
    }
  }

  return (
    <span className={`font-mono text-right break-words leading-tight ${customColor || ''}`}>
      {str}
    </span>
  );
};

// Helper render subtotal/grand total kompak: bila angka rentang, otomatis mengarah ke bawah agar muat di layar/kertas
const renderTotalCellCompact = (min: number, max: number, customColor?: string) => {
  if (min === 0 && max === 0) return <span className={`font-mono ${customColor || ''}`}>Rp 0</span>;
  if (min === max) return <span className={`font-mono ${customColor || ''}`}>{formatCurrency(min)}</span>;
  return (
    <div className={`flex flex-col items-end leading-tight text-right ${customColor || ''}`}>
      <span className="font-mono whitespace-nowrap text-[10.5px]">{formatCurrency(min)}</span>
      <span className="font-mono text-[9px] opacity-80 whitespace-nowrap">– {formatCurrency(max)}</span>
    </div>
  );
};

// Helper format baris persetujuan estimasi: jika ada tulisan 'CEK'/'cek', muncul 'CEK' bukan 0
const formatTtdItemRow = (
  priceRaw: any,
  totalRaw: any,
  qty: number,
  isOpsi2: boolean = false
): { priceDisplay: string; totalDisplay: string } => {
  if (isOpsi2) {
    const val2 = totalRaw !== undefined && totalRaw !== null && totalRaw !== ''
      ? totalRaw
      : (priceRaw !== undefined && priceRaw !== null && priceRaw !== '' ? priceRaw : '');

    const isValEmpty = val2 === '' || val2 === 0 || val2 === '0';
    if (isValEmpty) {
      return { priceDisplay: '-', totalDisplay: '-' };
    }

    const isText = typeof val2 === 'string' && /[a-zA-Z]/.test(val2.trim());
    if (isText) {
      const textVal = val2.toString().trim().toUpperCase();
      return { priceDisplay: textVal, totalDisplay: textVal };
    }

    const { min, max } = parseRangePrice(val2);
    const totalDisplay = min === max ? formatNumberOrText(min) : `${formatNumberOrText(min)} – ${formatNumberOrText(max)}`;
    return { priceDisplay: totalDisplay, totalDisplay };
  }

  const isPriceEmpty = priceRaw === '' || priceRaw === undefined || priceRaw === null;

  // Cek apakah ada teks seperti 'CEK', 'cek', dll.
  const isPriceText = typeof priceRaw === 'string' && /[a-zA-Z]/.test(priceRaw.trim());
  const isTotalText = totalRaw !== undefined && totalRaw !== null && typeof totalRaw === 'string' && /[a-zA-Z]/.test(totalRaw.trim());

  if (isPriceText || isTotalText) {
    const textVal = isPriceText
      ? priceRaw.toString().trim().toUpperCase()
      : totalRaw.toString().trim().toUpperCase();
    const totVal = isTotalText
      ? totalRaw.toString().trim().toUpperCase()
      : textVal;
    return {
      priceDisplay: textVal,
      totalDisplay: totVal,
    };
  }

  if (isPriceEmpty) {
    return { priceDisplay: isOpsi2 ? '-' : '0', totalDisplay: isOpsi2 ? '-' : '0' };
  }

  const { min, max } = parseRangePrice(priceRaw);
  const isZero = priceRaw === 0 || priceRaw === '0' || (min === 0 && max === 0);
  if (isZero) {
    return { priceDisplay: isOpsi2 ? '-' : '0', totalDisplay: isOpsi2 ? '-' : '0' };
  }

  const priceDisplay = min === max ? formatNumberOrText(min) : `${formatNumberOrText(min)} – ${formatNumberOrText(max)}`;
  const totalDisplay = min === max ? formatNumberOrText(min * qty) : `${formatNumberOrText(min * qty)} – ${formatNumberOrText(max * qty)}`;

  return { priceDisplay, totalDisplay };
};

export default function CustomerSignatureApprovalPage() {
  const params = useParams();
  const rawId = params?.id as string;
  const cleanId = rawId ? decodeURIComponent(rawId) : '';

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
    if (!cleanId) return;
    let isMounted = true;

    const loadData = async () => {
      try {
        const result = await DBService.findEstimationByIdOrTokenAsync(cleanId);
        if (!isMounted) return;

        if (result && result.estimation) {
          setEstimation(result.estimation);
          setSettings(DBService.getSettings(result.branch));
          setSignerName(
            result.estimation.customer_signed_name ||
            result.estimation.vehicle?.customer_name ||
            ''
          );

          if (result.estimation.customer_approved_option) {
            setSelectedOption(result.estimation.customer_approved_option as CustomerChoice);
          } else if (result.estimation.customer_response === 'opsi2') {
            setSelectedOption('opsi2');
          } else if (result.estimation.customer_response === 'batal') {
            setSelectedOption('batal');
          }

          if (
            result.estimation.ttd_status === 'signed' ||
            result.estimation.ttd_status === 'rejected' ||
            result.estimation.customer_signature
          ) {
            setIsSubmittedSuccess(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching estimation for TTD:', err);
        if (isMounted) setNotFound(true);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [cleanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimation) return;

    if (!signatureDataUrl) {
      alert('Silakan bubuhkan tanda tangan Anda pada kanvas terlebih dahulu.');
      return;
    }
    if (!agreedTerms) {
      alert('Harap centang persetujuan pernyataan konfirmasi estimasi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await DBService.approveEstimationSignature(
        cleanId,
        signatureDataUrl,
        signerName.trim() || estimation.vehicle?.customer_name || 'Pemilik Kendaraan',
        selectedOption
      );

      if (updated) {
        const finalUpdated: Invoice = {
          ...updated,
          customer_response: selectedOption,
        };
        setEstimation(finalUpdated);
        setIsSubmittedSuccess(true);

        if (selectedOption !== 'batal') {
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch { /* ignore */ }
        }
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
  
  // Deteksi Double Estimasi
  const checklistData = (estimation as any).checklist_data || {};
  const hasSecondTable = Boolean(
    estimation.has_second_table ||
    checklistData.has_second_table ||
    (checklistData.items_table2 && checklistData.items_table2.length > 0) ||
    items.some((it) => it.section === 2)
  );

  const table1Title =
    estimation.table1_title ||
    checklistData.table1_title ||
    'BAGIAN 1';

  const table2Title =
    estimation.table2_title ||
    checklistData.table2_title ||
    'BAGIAN REM';

  let table1Items: typeof items = [];
  let table2Items: typeof items = [];

  if (hasSecondTable) {
    if (items.some((it) => it.section === 2)) {
      table1Items = items.filter((it) => it.section !== 2);
      table2Items = items.filter((it) => it.section === 2);
    } else if (checklistData.items_table2 && checklistData.items_table2.length > 0) {
      table1Items = items;
      table2Items = checklistData.items_table2;
    } else {
      table1Items = items;
      table2Items = [];
    }
  } else {
    table1Items = items;
    table2Items = [];
  }

  const allItems = hasSecondTable && table2Items.length > 0 && !items.some(it => it.section === 2)
    ? [...table1Items, ...table2Items]
    : items;

  // Helper kalkulasi subtotal per tabel
  const calcSectionTotals = (itemList: typeof items) => {
    let s1Min = 0, s1Max = 0, s2Min = 0, s2Max = 0;
    itemList.forEach((it) => {
      const qty = it.qty || 1;
      const isP1Empty = it.price_opsi1 === '' || it.price_opsi1 === 0 || it.price_opsi1 === '0';
      const p1Raw = it.price_opsi1 !== undefined && it.price_opsi1 !== '' ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
      
      const hasTot2 = it.total_opsi2 !== undefined && it.total_opsi2 !== '' && it.total_opsi2 !== 0 && it.total_opsi2 !== '0';
      const hasP2 = it.price_opsi2 !== undefined && it.price_opsi2 !== '' && it.price_opsi2 !== 0 && it.price_opsi2 !== '0';
      const isP2Empty = !hasTot2 && !hasP2;

      const r1 = parseRangePrice(p1Raw);

      if (!isP1Empty) {
        s1Min += r1.min * qty;
        s1Max += r1.max * qty;
      }
      if (!isP2Empty) {
        if (hasTot2) {
          const r2 = parseRangePrice(it.total_opsi2);
          if (typeof it.total_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.total_opsi2)) || r2.min > 0) {
            s2Min += r2.min;
            s2Max += r2.max;
          }
        } else {
          const r2 = parseRangePrice(it.price_opsi2);
          if (typeof it.price_opsi2 !== 'string' || !/[a-zA-Z]/.test(String(it.price_opsi2)) || r2.min > 0) {
            s2Min += r2.min * qty;
            s2Max += r2.max * qty;
          }
        }
      }
    });
    return { s1Min, s1Max, s2Min, s2Max };
  };

  const t1Totals = calcSectionTotals(table1Items);
  const t2Totals = calcSectionTotals(table2Items);

  // Opsi 2 aktif jika explicitly true atau terdapat item yang memiliki price_opsi2 / total_opsi2
  const hasOpsi2 = Boolean(
    estimation.has_opsi2 === true ||
    (estimation.has_opsi2 !== false &&
      allItems.some(
        (it) =>
          (it.total_opsi2 !== undefined && it.total_opsi2 !== '' && it.total_opsi2 !== 0 && it.total_opsi2 !== '0') ||
          (it.price_opsi2 !== undefined && it.price_opsi2 !== '' && it.price_opsi2 !== 0 && it.price_opsi2 !== '0')
      ))
  );

  const discount = estimation.discount_amount || 0;
  const taxPercent = estimation.tax_percent || 0;

  // Kalkulasi Opsi 1
  const subtotalOpsi1Min = allItems.reduce((sum, it) => {
    const p = it.price_opsi1 !== undefined ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
    const { min } = parseRangePrice(p);
    return sum + min * (it.qty || 1);
  }, 0);

  const subtotalOpsi1Max = allItems.reduce((sum, it) => {
    const p = it.price_opsi1 !== undefined ? it.price_opsi1 : (it.price !== undefined ? it.price : 0);
    const { max } = parseRangePrice(p);
    return sum + max * (it.qty || 1);
  }, 0);

  const taxAmountOpsi1Min = taxPercent > 0 ? ((subtotalOpsi1Min - discount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi1Max = taxPercent > 0 ? ((subtotalOpsi1Max - discount) * (taxPercent / 100)) : 0;

  const totalFinalOpsi1Min = Math.max(0, subtotalOpsi1Min - discount + taxAmountOpsi1Min);
  const totalFinalOpsi1Max = Math.max(0, subtotalOpsi1Max - discount + taxAmountOpsi1Max);

  // Kalkulasi Opsi 2
  const subtotalOpsi2Min = allItems.reduce((sum, it) => {
    const val2 = it.total_opsi2 !== undefined && it.total_opsi2 !== '' ? it.total_opsi2 : it.price_opsi2;
    if (val2 === undefined || val2 === null || val2 === '' || val2 === 0 || val2 === '0') return sum;
    if (typeof val2 === 'string' && /[a-zA-Z]/.test(val2)) return sum;
    const { min } = parseRangePrice(val2);
    return sum + min;
  }, 0);

  const subtotalOpsi2Max = allItems.reduce((sum, it) => {
    const val2 = it.total_opsi2 !== undefined && it.total_opsi2 !== '' ? it.total_opsi2 : it.price_opsi2;
    if (val2 === undefined || val2 === null || val2 === '' || val2 === 0 || val2 === '0') return sum;
    if (typeof val2 === 'string' && /[a-zA-Z]/.test(val2)) return sum;
    const { max } = parseRangePrice(val2);
    return sum + max;
  }, 0);

  const taxAmountOpsi2Min = taxPercent > 0 ? ((subtotalOpsi2Min - discount) * (taxPercent / 100)) : 0;
  const taxAmountOpsi2Max = taxPercent > 0 ? ((subtotalOpsi2Max - discount) * (taxPercent / 100)) : 0;

  const totalFinalOpsi2Min = Math.max(0, subtotalOpsi2Min - discount + taxAmountOpsi2Min);
  const totalFinalOpsi2Max = Math.max(0, subtotalOpsi2Max - discount + taxAmountOpsi2Max);

  const workshopName = settings?.name || 'MARDIONO HOME SERVICE';
  const workshopPhone = settings?.phone || '';
  const workshopAddress = settings?.address || '';

  /* ─── Success Page ─── */
  if (isSubmittedSuccess) {
    const isBatal = estimation.customer_response === 'batal' || estimation.customer_approved_option === 'batal' || selectedOption === 'batal';
    const isOpsi2 = estimation.customer_response === 'opsi2' || estimation.customer_approved_option === 'opsi2' || selectedOption === 'opsi2';

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-5 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg ${
            isBatal ? 'bg-rose-500' : isOpsi2 ? 'bg-blue-600' : 'bg-emerald-500'
          }`}>
            {isBatal ? (
              <XCircle className="w-8 h-8 text-white" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h2 className={`text-base font-black ${
              isBatal ? 'text-rose-800' : isOpsi2 ? 'text-blue-900' : 'text-emerald-800'
            }`}>
              {isBatal ? 'Estimasi Telah Dibatalkan' : 'Persetujuan Berhasil Dikonfirmasi!'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isBatal
                ? `Terima kasih, ${estimation.customer_signed_name || signerName || vehicle?.customer_name}. Konfirmasi pembatalan estimasi telah kami terima. Tanda tangan Anda telah dicatat secara resmi di sistem.`
                : `Terima kasih, ${estimation.customer_signed_name || signerName || vehicle?.customer_name}. Anda telah menyetujui estimasi ini dengan pilihan ${isOpsi2 ? 'Opsi 2' : 'Opsi 1'}. Pekerjaan servis akan segera diproses oleh bengkel.`
              }
            </p>
            {estimation.customer_signed_at && (
              <p className="text-[11px] text-slate-400 font-mono">
                Waktu: {formatDateTime(estimation.customer_signed_at)}
              </p>
            )}
            {estimation.customer_signature && (
              <div className="mt-2 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 block mb-1">Tanda Tangan Digital Tersimpan:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estimation.customer_signature} alt="TTD" className="h-16 mx-auto object-contain opacity-85" />
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

          {/* Identitas Pemilik Kendaraan & Kendaraan */}
          {(() => {
            const estTimestamp = estimation.work_order?.entry_date || estimation.work_order?.created_at || estimation.created_at;
            const estDateObj = new Date(estTimestamp);
            const jamDatang = !isNaN(estDateObj.getTime())
              ? estDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              : '09:00';

            return (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5 border-r border-slate-200 pr-2">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Pemilik Kendaraan</span>
                    <div className="font-black text-slate-900 text-sm break-words leading-tight">{vehicle?.customer_name || 'Pemilik Kendaraan'}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Alamat</span>
                    <div className="font-black text-slate-900 text-xs break-words leading-tight">{vehicle?.address || '-'}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Unit</span>
                    <div className="font-bold text-slate-900 text-xs break-words leading-tight">{vehicle?.car_brand} {vehicle?.car_model} ({vehicle?.car_year || '-'})</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Jam Datang</span>
                    <div className="font-bold text-slate-900 text-xs">{jamDatang}</div>
                  </div>
                </div>
                <div className="space-y-1.5 pl-1">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">No Pol</span>
                    <div className="font-black text-[#8B0000] font-mono text-sm">{vehicle?.license_plate ? formatPlate(vehicle.license_plate) : '-'}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">No PKB / Estimasi</span>
                    <div className="font-bold text-[#001F7A] font-mono text-xs break-words">{estimation.work_order?.spk_number || estimation.invoice_number}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Tanggal</span>
                    <div className="font-bold text-slate-900 text-xs">{formatDate(estimation.created_at)}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">KM</span>
                    <div className="font-mono font-bold text-slate-900 text-xs">{formatKM(vehicle?.current_mileage)}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Keluhan / Diagnosa Awal */}
          {(() => {
            const rawEst = (estimation as any).complaints;
            const complaintsText = (rawEst && String(rawEst).trim())
              ? formatComplaintsAndDiagnosis(null, null, String(rawEst)).displayText
              : (estimation.work_order?.complaints?.trim() || '');
            if (!complaintsText) return null;
            return (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">
                  Keluhan / Diagnosa Awal:
                </span>
                <p className="font-bold text-slate-900 mt-0.5 leading-snug uppercase">
                  {complaintsText}
                </p>
              </div>
            );
          })()}

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

          {(estimation.estimator_signature || (estimation as any).signature_admin_url) && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold">Estimasi ini telah diverifikasi &amp; ditandatangani oleh Estimator: <strong>{(estimation as any).estimator_name || 'SA Bengkel'}</strong></span>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={estimation.estimator_signature || (estimation as any).signature_admin_url}
                  alt="TTD Estimator"
                  className="h-7 object-contain opacity-90"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── TABEL RINCIAN ESTIMASI ── */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          {/* Section header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                Rincian Estimasi: {estimation.estimation_type || 'Umum'}
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Harga berlaku sesuai ketersediaan suku cadang dan kesepakatan servis.
              </p>
            </div>
            {hasOpsi2 && (
              <span className="text-[9.5px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                Tersedia 2 Pilihan (Opsi 1 &amp; Opsi 2)
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-slate-800 text-white text-[10px] font-black uppercase">
                  <th className="p-2 w-7 text-center border-r border-slate-600">No</th>
                  <th className="p-2 border-r border-slate-600">Saran / Sparepart / Jasa</th>
                  <th className="p-2 w-9 text-center border-r border-slate-600">Qty</th>
                  <th className="p-2 w-11 text-center border-r border-slate-600">Satuan</th>
                  <th className="p-2 w-[90px] text-right border-r border-slate-600">Harga Sat</th>
                  <th className={`p-2 ${hasOpsi2 ? 'w-[96px]' : 'w-[105px]'} text-right border-r border-slate-600`}>
                    {hasOpsi2 ? 'Total 1' : 'Total'}
                  </th>
                  {hasOpsi2 && (
                    <th className="p-2 w-[96px] text-right bg-blue-900">Total 2</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Table 1 Slice Divider (Rendered when Double Table is enabled) */}
                {hasSecondTable && (
                  <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                    <td
                      colSpan={hasOpsi2 ? 7 : 6}
                      className="py-2 px-4 text-center font-extrabold text-slate-800 uppercase tracking-wider text-[11px]"
                    >
                      {table1Title}
                    </td>
                  </tr>
                )}

                {/* Table 1 Items */}
                {table1Items.map((item, idx) => {
                  const qty = item.qty || 1;
                  const p1Raw = item.price_opsi1 !== undefined && item.price_opsi1 !== '' ? item.price_opsi1 : (item.price !== undefined ? item.price : 0);
                  const p1Info = formatTtdItemRow(p1Raw, item.total_opsi1, qty, false);
                  const p2Info = formatTtdItemRow(item.price_opsi2, item.total_opsi2, qty, true);

                  return (
                    <tr key={`t1-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2 text-center text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-100">
                        <div className="font-bold text-slate-900 uppercase text-[10.5px]">{item.name}</div>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700 border-r border-slate-100">{qty}</td>
                      <td className="p-2 text-center text-[10px] font-black uppercase text-slate-600 border-r border-slate-100">{item.unit || 'PCS'}</td>
                      <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-100">
                        {renderCompactPrice(p1Info.priceDisplay)}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-slate-900 border-r border-slate-100">
                        {renderCompactPrice(p1Info.totalDisplay)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                          {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* If Double Table: Render Subtotal Table 1, Slice Divider, Table 2 Items, and Subtotal Table 2 */}
                {hasSecondTable && (
                  <>
                    {/* Subtotal Row Table 1 */}
                    <tr className="bg-slate-100/90 text-slate-800 font-bold text-[11px] border-y border-slate-200">
                      <td colSpan={5} className="p-2 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[10.5px]">
                        TOTAL {table1Title ? `(${table1Title.toUpperCase()})` : 'TABEL 1'}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-slate-900 border-r border-slate-200">
                        {renderTotalCellCompact(t1Totals.s1Min, t1Totals.s1Max)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                          {renderTotalCellCompact(t1Totals.s2Min, t1Totals.s2Max, 'text-blue-950')}
                        </td>
                      )}
                    </tr>

                    {/* Slice Divider */}
                    <tr className="bg-slate-100/90 border-y-2 border-slate-300">
                      <td
                        colSpan={hasOpsi2 ? 7 : 6}
                        className="py-2 px-4 text-center font-extrabold text-slate-800 uppercase tracking-wider text-[11px]"
                      >
                        {table2Title}
                      </td>
                    </tr>

                    {/* Table 2 Items */}
                    {table2Items.map((item, idx) => {
                      const displayNum = table1Items.length + idx + 1;
                      const qty = item.qty || 1;
                      const p1Raw = item.price_opsi1 !== undefined && item.price_opsi1 !== '' ? item.price_opsi1 : (item.price !== undefined ? item.price : 0);
                      const p1Info = formatTtdItemRow(p1Raw, item.total_opsi1, qty, false);
                      const p2Info = formatTtdItemRow(item.price_opsi2, item.total_opsi2, qty, true);

                      return (
                        <tr key={`t2-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-2 text-center text-slate-400 font-bold border-r border-slate-100">{displayNum}</td>
                          <td className="p-2 border-r border-slate-100">
                            <div className="font-bold text-slate-900 uppercase text-[10.5px]">{item.name}</div>
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-slate-700 border-r border-slate-100">{qty}</td>
                          <td className="p-2 text-center text-[10px] font-black uppercase text-slate-600 border-r border-slate-100">{item.unit || 'PCS'}</td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-100">
                            {renderCompactPrice(p1Info.priceDisplay)}
                          </td>
                          <td className="p-2 text-right font-mono font-black text-slate-900 border-r border-slate-100">
                            {renderCompactPrice(p1Info.totalDisplay)}
                          </td>
                          {hasOpsi2 && (
                            <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                              {renderCompactPrice(p2Info.totalDisplay, 'text-blue-950')}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Subtotal Row Table 2 */}
                    <tr className="bg-slate-100/90 text-slate-800 font-bold text-[11px] border-y border-slate-200">
                      <td colSpan={5} className="p-2 text-center uppercase tracking-wider font-extrabold text-slate-700 text-[10.5px]">
                        TOTAL {table2Title ? `(${table2Title.toUpperCase()})` : 'TABEL 2'}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-slate-900 border-r border-slate-200">
                        {renderTotalCellCompact(t2Totals.s1Min, t2Totals.s1Max)}
                      </td>
                      {hasOpsi2 && (
                        <td className="p-2 text-right font-mono font-black text-blue-950 bg-blue-50/30">
                          {renderTotalCellCompact(t2Totals.s2Min, t2Totals.s2Max, 'text-blue-950')}
                        </td>
                      )}
                    </tr>
                  </>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-[11px]">
                  <td colSpan={5} className="p-2 text-center uppercase tracking-wider text-slate-800 border-r border-slate-200">
                    JUMLAH KESELURUHAN
                  </td>
                  <td className="p-2 text-right font-mono text-slate-950 border-r border-slate-200">
                    {renderTotalCellCompact(totalFinalOpsi1Min, totalFinalOpsi1Max)}
                  </td>
                  {hasOpsi2 && (
                    <td className="p-2 text-right font-mono text-blue-950 bg-blue-50/40">
                      {renderTotalCellCompact(totalFinalOpsi2Min, totalFinalOpsi2Max, 'text-blue-950')}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── FORM KEPUTUSAN & TANDA TANGAN ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          {/* Header Keputusan */}
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Pilih Keputusan Persetujuan:</h3>
            <span className="text-[10px] text-slate-400">Pilih salah satu dari opsi di bawah</span>
          </div>

          <div className="p-4 space-y-2.5">
            {/* 1. Opsi 1 */}
            <label className={`flex items-center space-x-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
              selectedOption === 'opsi1' ? 'border-emerald-500 bg-emerald-50/80 shadow-xs' : 'border-slate-200 hover:border-slate-300'
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
                <span className="text-xs font-black text-slate-900 block">Setuju → Opsi 1</span>
                <span className="block text-[11px] text-slate-500">
                  Total Estimasi: <strong className="text-slate-900 font-mono">{formatRangeDisplay(totalFinalOpsi1Min, totalFinalOpsi1Max)}</strong>
                </span>
              </div>
              {selectedOption === 'opsi1' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
            </label>

            {/* 2. Opsi 2 (jika tersedia) */}
            {hasOpsi2 && (
              <label className={`flex items-center space-x-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                selectedOption === 'opsi2' ? 'border-blue-500 bg-blue-50/80 shadow-xs' : 'border-slate-200 hover:border-slate-300'
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
                  <span className="text-xs font-black text-slate-900 block">Setuju → Opsi 2</span>
                  <span className="block text-[11px] text-slate-500">
                    Total Estimasi: <strong className="text-blue-900 font-mono">{formatRangeDisplay(totalFinalOpsi2Min, totalFinalOpsi2Max)}</strong>
                  </span>
                </div>
                {selectedOption === 'opsi2' && <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />}
              </label>
            )}

            {/* 3. Batal / Menolak Estimasi */}
            <label className={`flex items-center space-x-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
              selectedOption === 'batal' ? 'border-rose-500 bg-rose-50/80 shadow-xs' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="radio"
                name="choice"
                value="batal"
                checked={selectedOption === 'batal'}
                onChange={() => setSelectedOption('batal')}
                className="w-4 h-4 accent-rose-600"
              />
              <div className="flex-1">
                <span className="text-xs font-black text-rose-900 block">✕ Batal / Menolak Estimasi</span>
                <span className="block text-[11px] text-slate-500">
                  Saya memutuskan untuk membatalkan atau tidak melanjutkan perbaikan/servis ini
                </span>
              </div>
              {selectedOption === 'batal' && <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
            </label>
          </div>

          {/* Ketentuan Estimasi */}
          <div className="border-t border-b border-slate-200 px-4 py-3 bg-slate-50">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">KETENTUAN ESTIMASI:</h3>
            <ol className="text-[10.5px] text-slate-600 space-y-1.5 leading-relaxed list-decimal list-inside">
              <li>Pemilik kendaraan tidak diperkenankan membawa sparepart sendiri ke Teknisi kami.</li>
              <li>Jika membawa part sendiri, tidak ada garansi dalam bentuk apapun.</li>
              <li className="font-bold text-slate-800">Apabila sparepart sudah terpasang dan tidak berfungsi, barang tidak dapat diretur.</li>
              <li className="font-bold text-slate-800">Harga estimasi yang tercantum berlaku 1 minggu sejak tanggal estimasi diterbitkan.</li>
              <li>Apabila terjadi kenaikan harga suku cadang dari distributor, akan kami informasikan estimasi revisi terbaru.</li>
            </ol>
          </div>

          {/* Nama Penanda Tangan & Canvas TTD */}
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Nama Lengkap Pemilik Kendaraan: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda..."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
              />
            </div>

            {/* Canvas TTD — Wajib untuk Setuju maupun Batal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {selectedOption === 'batal'
                      ? 'Tanda Tangan Konfirmasi Pembatalan:'
                      : selectedOption === 'opsi2'
                      ? 'Tanda Tangan Persetujuan Opsi 2:'
                      : 'Tanda Tangan Persetujuan Opsi 1:'} <span className="text-red-500">*</span>
                  </span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Goreskan tanda tangan di kotak</span>
              </div>
              <div className="text-[10.5px] text-slate-500 mb-2">
                {selectedOption === 'batal'
                  ? 'Dengan menandatangani ini, saya menyatakan membatalkan perbaikan kendaraan sesuai estimasi di atas.'
                  : 'Dengan menandatangani ini, saya menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan estimasi di atas.'}
              </div>
              <SignatureCanvas onSave={(dataUrl) => setSignatureDataUrl(dataUrl)} />
            </div>

            {/* Persetujuan Checkbox */}
            <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-semibold">
                Saya menyatakan pilihan dan tanda tangan yang saya berikan di atas adalah benar dan sah.
              </span>
            </label>

            {/* Alert info bila batal */}
            {selectedOption === 'batal' && (
              <div className="flex items-start space-x-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>Anda memilih untuk <strong>Membatalkan Estimasi</strong>. Bengkel tidak akan memulai pengerjaan dan status estimasi akan langsung tercatat sebagai Dibatalkan.</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !agreedTerms || !signatureDataUrl}
              className={`w-full font-black text-sm py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedOption === 'batal'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : selectedOption === 'opsi2'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim Keputusan...</span>
                </>
              ) : (
                <>
                  {selectedOption === 'batal' ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {selectedOption === 'batal'
                      ? '✕ Konfirmasi Batalkan & Kirim Tanda Tangan'
                      : selectedOption === 'opsi2'
                      ? '✓ Setujui Opsi 2 & Kirim Tanda Tangan'
                      : '✓ Setujui Opsi 1 & Kirim Tanda Tangan'}
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
