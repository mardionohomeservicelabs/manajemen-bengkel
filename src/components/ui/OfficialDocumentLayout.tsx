'use client';

import React from 'react';
import { WorkshopSettings } from '@/lib/types/database';

interface OfficialDocumentHeaderProps {
  settings?: WorkshopSettings;
}

export function OfficialDocumentHeader({ settings }: OfficialDocumentHeaderProps) {
  const phone = settings?.phone || '0812-3076-2930';
  const email = settings?.email || 'mardionoohomeservice@gmail.com';

  return (
    <div className="w-full space-y-1.5 mb-2 avoid-break official-document-header-wrap">
      {/* Top Multi-tone Geometric Accent Stripe */}
      <div className="w-full flex h-1.5 rounded-t overflow-hidden">
        <div className="w-[60%] bg-gradient-to-r from-[#700000] via-[#8B0000] to-[#B30000]" />
        <div className="w-[4%] bg-[#D4AF37] transform -skew-x-12" />
        <div className="w-[36%] bg-gradient-to-r from-[#001F7A] to-[#0B1B4F]" />
      </div>

      {/* Main Header Row: Symmetrical Balance between Fixed Logo & Pure Right-Aligned Info */}
      <div className="flex items-center justify-between py-1 px-0.5 gap-4">
        {/* Left: Strictly Dimensioned Official Logo — Proportional to 1003x196 aspect ratio */}
        <div className="flex-shrink-0 w-[240px] h-[47px] flex items-center justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Mardiono Home Service"
            width={240}
            height={47}
            className="official-document-logo inline-block"
            style={{
              width: '240px',
              height: '47px',
              minWidth: '240px',
              minHeight: '47px',
              maxWidth: '240px',
              maxHeight: '47px',
              objectFit: 'contain',
              objectPosition: 'left center',
              display: 'inline-block',
            }}
          />
        </div>

        {/* Right: Crisp, Pure Right-Aligned Information Block (Symmetrically Balanced with Logo) */}
        <div className="text-right text-[9.5px] sm:text-[10px] space-y-0.5 max-w-[380px] text-black font-semibold">
          <p className="font-bold text-black leading-tight">
            Jl. Perum Beringin Indah No.D - 19, Bringinbendo, Taman, Sidoarjo
          </p>
          <p className="font-mono text-[10px] text-black leading-tight">
            Telp / WhatsApp: <strong className="font-black text-[#8B0000]">{phone}</strong>
          </p>
          <p className="font-mono text-[9.5px] text-black leading-tight">
            Email: <span className="text-[#001F7A] font-black">{email}</span>
          </p>
          <p className="text-[9px] text-black font-semibold leading-tight">
            IG: <span className="text-black font-black">@official_mardionohomeservice</span> • TikTok: <span className="text-black font-black">@mardionotrosobo</span>
          </p>
        </div>
      </div>

      {/* Bottom Header Separator Bar */}
      <div className="w-full flex h-1 rounded-b overflow-hidden">
        <div className="w-[60%] bg-[#8B0000]" />
        <div className="w-[4%] bg-[#D4AF37]" />
        <div className="w-[36%] bg-[#001F7A]" />
      </div>
    </div>
  );
}

export interface OfficialDocumentMetaGridProps {
  customerName?: string;
  address?: string;
  unit?: string;
  entryTime?: string;
  licensePlate?: string;
  docNumber?: string;
  docLabel?: string;
  docColor?: string;
  date?: string;
  mileage?: string;
}

export function OfficialDocumentMetaGrid({
  customerName,
  address,
  unit,
  entryTime,
  licensePlate,
  docNumber,
  docLabel = 'No PKB',
  docColor = '#001F7A',
  date,
  mileage,
}: OfficialDocumentMetaGridProps) {
  return (
    <div className="border-2 border-black rounded-xl bg-white p-2 text-[10.5px] font-medium avoid-break shadow-none">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {/* Row 1 */}
        <div className="flex items-center gap-1.5 border-r-2 border-black pr-2 min-h-[20px]">
          <span className="w-28 shrink-0 font-bold text-black">Pemilik Kendaraan</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-black text-black flex-1 min-w-0 truncate uppercase">{customerName?.toUpperCase() || 'PEMILIK KENDARAAN'}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-1 min-h-[20px]">
          <span className="w-16 shrink-0 font-bold text-black">No Pol</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-mono font-black text-[#8B0000] text-xs flex-1 min-w-0 uppercase">{licensePlate?.toUpperCase() || '-'}</span>
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-1.5 border-r-2 border-black pr-2 min-h-[20px]">
          <span className="w-28 shrink-0 font-bold text-black">Alamat</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-black text-black flex-1 min-w-0 truncate uppercase">{address?.toUpperCase() || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-1 min-h-[20px]">
          <span className="w-16 shrink-0 font-bold text-black">{docLabel?.toUpperCase() || 'NO PKB'}</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-mono font-black text-xs flex-1 min-w-0 truncate uppercase" style={{ color: docColor }}>{docNumber?.toUpperCase() || '-'}</span>
        </div>

        {/* Row 3 */}
        <div className="flex items-center gap-1.5 border-r-2 border-black pr-2 min-h-[20px]">
          <span className="w-28 shrink-0 font-bold text-black">Unit</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-black text-black flex-1 min-w-0 truncate uppercase">{unit?.toUpperCase() || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-1 min-h-[20px]">
          <span className="w-16 shrink-0 font-bold text-black">Tanggal</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-black text-black flex-1 min-w-0">{date || '-'}</span>
        </div>

        {/* Row 4 */}
        <div className="flex items-center gap-1.5 border-r-2 border-black pr-2 min-h-[20px]">
          <span className="w-28 shrink-0 font-bold text-black">Jam Datang</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-black text-black flex-1 min-w-0">{entryTime || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-1 min-h-[20px]">
          <span className="w-16 shrink-0 font-bold text-black">KM</span>
          <span className="shrink-0 font-black text-black">:</span>
          <span className="font-mono font-black text-black flex-1 min-w-0">{mileage || '-'}</span>
        </div>
      </div>
    </div>
  );
}

interface OfficialDocumentFooterProps {
  documentCode?: string;
  termsNote?: string;
}

export function OfficialDocumentFooter({
  documentCode,
  termsNote,
}: OfficialDocumentFooterProps) {
  return (
    <div className="w-full space-y-1.5 mt-4 pt-2 avoid-break official-document-footer-wrap">
      {/* Upper Footer: Terms / Disclaimer */}
      <div className="flex justify-between items-center text-[9px] sm:text-[9.5px] text-black border-t-2 border-black pt-1.5 font-bold">
        <span>
          {termsNote || 'Garansi Servis & AC 1 Bulan / 1.000 KM • Simpan dokumen ini sebagai bukti sah pengerjaan.'}
        </span>
        <span className="font-black text-[#8B0000] font-mono uppercase tracking-wider text-[9.5px]">
          {documentCode || 'MARDIONO HOME SERVICE'}
        </span>
      </div>

      {/* Bottom Decorative Stripe */}
      <div className="w-full flex h-1 rounded overflow-hidden">
        <div className="w-[60%] bg-gradient-to-r from-[#700000] via-[#8B0000] to-[#B30000]" />
        <div className="w-[4%] bg-[#D4AF37] transform -skew-x-12" />
        <div className="w-[36%] bg-gradient-to-r from-[#001F7A] to-[#0B1B4F]" />
      </div>
    </div>
  );
}

