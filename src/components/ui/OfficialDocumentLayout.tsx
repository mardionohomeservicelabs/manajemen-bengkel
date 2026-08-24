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
    <div className="w-full space-y-2 mb-3 avoid-break official-document-header-wrap">
      {/* Top Multi-tone Geometric Accent Stripe */}
      <div className="w-full flex h-1.5 rounded-t overflow-hidden">
        <div className="w-[60%] bg-gradient-to-r from-[#700000] via-[#8B0000] to-[#B30000]" />
        <div className="w-[4%] bg-[#D4AF37] transform -skew-x-12" />
        <div className="w-[36%] bg-gradient-to-r from-[#001F7A] to-[#0B1B4F]" />
      </div>

      {/* Main Header Row: Symmetrical Balance between Fixed Logo & Pure Right-Aligned Info */}
      <div className="flex items-center justify-between py-2 px-0.5 gap-4">
        {/* Left: Strictly Dimensioned Official Logo — Enlarged for Clarity & Symmetry */}
        <div className="flex-shrink-0 w-[300px] h-[75px] flex items-center justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Mardiono Home Service"
            width={300}
            height={75}
            className="official-document-logo block"
            style={{
              width: '300px',
              height: '75px',
              minWidth: '300px',
              minHeight: '75px',
              maxWidth: '300px',
              maxHeight: '75px',
              objectFit: 'contain',
              objectPosition: 'left center',
              display: 'block',
            }}
          />
        </div>

        {/* Right: Crisp, Pure Right-Aligned Information Block (Perfect Flush-Right) */}
        <div className="text-right text-[9.5px] sm:text-[10px] space-y-0.5 max-w-[380px] text-slate-800 font-medium">
          <p className="font-bold text-slate-900 leading-tight">
            Jl. Perum Beringin Indah No.D - 19, Bringinbendo, Taman, Sidoarjo
          </p>
          <p className="font-mono text-[10px] text-slate-700">
            Telp / WhatsApp: <strong className="font-black text-[#8B0000]">{phone}</strong>
          </p>
          <p className="font-mono text-[9.5px] text-slate-600">
            Email: <span className="text-[#001F7A] font-semibold">{email}</span>
          </p>
          <p className="text-[9px] text-slate-500 font-medium">
            IG: <span className="text-slate-800 font-bold">@official_mardionohomeservice</span> • TikTok: <span className="text-slate-800 font-bold">@mardionotrosobo</span>
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
      <div className="flex justify-between items-center text-[9px] sm:text-[9.5px] text-slate-600 border-t border-slate-300 pt-1.5 font-medium">
        <span>
          {termsNote || 'Garansi Servis & AC 1 Bulan / 1.000 KM • Simpan dokumen ini sebagai bukti sah pengerjaan.'}
        </span>
        <span className="font-bold text-[#8B0000] font-mono uppercase tracking-wider text-[9px]">
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
