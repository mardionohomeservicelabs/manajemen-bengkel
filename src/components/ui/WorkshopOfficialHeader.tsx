'use client';

import React from 'react';
import { WorkshopSettings } from '@/lib/types/database';
import { MapPin, Phone, Mail } from 'lucide-react';

interface WorkshopOfficialHeaderProps {
  settings: WorkshopSettings;
  documentTitle?: string;
  documentNumber?: string;
  documentBadgeColor?: 'maroon' | 'blue' | 'emerald' | 'amber';
}

export function WorkshopOfficialHeader({
  settings,
  documentTitle,
  documentNumber,
  documentBadgeColor = 'maroon',
}: WorkshopOfficialHeaderProps) {
  return (
    <div className="w-full space-y-3 pb-3 border-b-2 border-slate-800">
      {/* Official Header Banner Image */}
      <div className="relative w-full overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/header-banner.png"
          alt="Mardiono Home Service Header Banner"
          className="w-full h-auto object-contain block max-h-32 sm:max-h-36 mx-auto print:max-h-28"
          onError={(e) => {
            // Fallback to stylized vector banner if image is not loaded
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Optional Document Title & Sub-header Bar */}
      {documentTitle && (
        <div className="flex items-center justify-between pt-1 text-slate-900">
          <div>
            <span
              className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider text-white ${
                documentBadgeColor === 'blue'
                  ? 'bg-[#001F7A]'
                  : documentBadgeColor === 'emerald'
                  ? 'bg-emerald-700'
                  : documentBadgeColor === 'amber'
                  ? 'bg-amber-600'
                  : 'bg-[#8B0000]'
              }`}
            >
              {documentTitle}
            </span>
          </div>
          {documentNumber && (
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                No. Dokumen:
              </span>
              <span className="text-sm font-mono font-black text-slate-950 tracking-tight">
                {documentNumber}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
