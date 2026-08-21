'use client';

import React from 'react';
import { InspectionChecklistData, InspectionPointStatus } from '@/lib/types/database';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  MinusCircle,
  ThermometerSnowflake,
  Wrench,
  Fan,
  Car,
} from 'lucide-react';

interface InspectionChecklistProps {
  value: InspectionChecklistData;
  onChange: (data: InspectionChecklistData) => void;
  readOnly?: boolean;
}

interface ChecklistItemConfig {
  key: keyof InspectionChecklistData;
  label: string;
  category: 'engine' | 'ac';
  notesKey?: keyof InspectionChecklistData;
}

const CHECKLIST_ITEMS: ChecklistItemConfig[] = [
  // Mesin & Mekanikal
  { key: 'engine_oil', label: 'Kondisi & Volume Oli Mesin', category: 'engine', notesKey: 'engine_oil_notes' },
  { key: 'oil_filter', label: 'Filter Oli Mesin', category: 'engine', notesKey: 'oil_filter_notes' },
  { key: 'radiator_coolant', label: 'Air Radiator / Coolant & Tutup Radiator', category: 'engine', notesKey: 'radiator_coolant_notes' },
  { key: 'battery', label: 'Kondisi Aki & Tegangan Voltase', category: 'engine', notesKey: 'battery_notes' },
  { key: 'fan_belt', label: 'Fan Belt / V-Belt & Tensioner', category: 'engine', notesKey: 'fan_belt_notes' },
  { key: 'spark_plugs', label: 'Busi Mesin (Spark Plugs)', category: 'engine', notesKey: 'spark_plugs_notes' },
  { key: 'brake_pads', label: 'Ketebalan Kampas Rem (Depan/Belakang)', category: 'engine', notesKey: 'brake_pads_notes' },
  { key: 'brake_fluid', label: 'Minyak Rem & Kebocoran Master Rem', category: 'engine', notesKey: 'brake_fluid_notes' },
  { key: 'transmission_oil', label: 'Oli Transmisi (ATF / MTF / CVTF)', category: 'engine', notesKey: 'transmission_oil_notes' },
  { key: 'suspension_shocks', label: 'Shockbreaker & Karet Kaki-Kaki', category: 'engine', notesKey: 'suspension_shocks_notes' },

  // Sistem AC Mobil
  { key: 'ac_compressor', label: 'Kompresor AC & Magnetic Clutch', category: 'ac', notesKey: 'ac_compressor_notes' },
  { key: 'freon_pressure', label: 'Tekanan Freon (High & Low Pressure)', category: 'ac', notesKey: 'freon_pressure_notes' },
  { key: 'ac_condenser', label: 'Kebersihan Kondensor & Sirip AC', category: 'ac', notesKey: 'ac_condenser_notes' },
  { key: 'cabin_filter', label: 'Filter Kabin AC (Cabin Air Filter)', category: 'ac', notesKey: 'cabin_filter_notes' },
  { key: 'blower_motor', label: 'Motor Blower & Kecepatan Angin', category: 'ac', notesKey: 'blower_motor_notes' },
  { key: 'extra_fan', label: 'Extra Fan / Kipas Kondensor', category: 'ac', notesKey: 'extra_fan_notes' },
];

export function InspectionChecklist({
  value,
  onChange,
  readOnly = false,
}: InspectionChecklistProps) {
  const setStatus = (key: keyof InspectionChecklistData, status: InspectionPointStatus) => {
    if (readOnly) return;
    onChange({
      ...value,
      [key]: status,
    });
  };

  const setNotes = (key: keyof InspectionChecklistData, notes: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      [key]: notes,
    });
  };

  // Status calculation
  const engineItems = CHECKLIST_ITEMS.filter((i) => i.category === 'engine');
  const acItems = CHECKLIST_ITEMS.filter((i) => i.category === 'ac');

  const countStatus = (status: InspectionPointStatus) => {
    return CHECKLIST_ITEMS.reduce((acc, item) => {
      return (value[item.key] as InspectionPointStatus) === status ? acc + 1 : acc;
    }, 0);
  };

  const goodCount = countStatus('baik');
  const warningCount = countStatus('perhatian');
  const criticalCount = countStatus('kritis');

  return (
    <div className="space-y-6">
      {/* Summary Score Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-sm">
        <div className="flex items-center space-x-2">
          <Wrench className="w-4 h-4 text-maroon-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Hasil Ringkasan Inspeksi Teknis:
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="flex items-center space-x-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{goodCount} Kondisi Baik</span>
          </span>
          <span className="flex items-center space-x-1.5 bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2.5 py-1 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{warningCount} Perlu Perhatian</span>
          </span>
          <span className="flex items-center space-x-1.5 bg-red-950/80 text-red-300 border border-red-800/80 px-2.5 py-1 rounded-lg">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span>{criticalCount} Kritis</span>
          </span>
        </div>
      </div>

      {/* Grid: Mesin & AC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Mesin & Mekanikal */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-maroon-50 text-maroon-700 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inspeksi Mesin & Mekanikal</h3>
              <p className="text-[11px] text-slate-500">Cek pelumasan, sistem pendingin, dan pengereman</p>
            </div>
          </div>

          <div className="space-y-3">
            {engineItems.map((item) => (
              <ChecklistRow
                key={item.key}
                item={item}
                currentStatus={(value[item.key] as InspectionPointStatus) || 'tidak_diperiksa'}
                notes={(value[item.notesKey!] as string) || ''}
                onStatusChange={(s) => setStatus(item.key, s)}
                onNotesChange={(n) => setNotes(item.notesKey!, n)}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* General Engine Notes */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Khusus Area Mesin:
            </label>
            <textarea
              disabled={readOnly}
              rows={2}
              value={value.general_engine_notes || ''}
              onChange={(e) => setNotes('general_engine_notes', e.target.value)}
              placeholder="Catatan tambahan mekanik terkait kondisi mesin..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-maroon-600 focus:border-maroon-600 outline-none disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Section 2: Sistem AC Mobil */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <ThermometerSnowflake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inspeksi Sistem AC & Pendingin</h3>
              <p className="text-[11px] text-slate-500">Kompresor, freon, evaporator & kualitas hembusan</p>
            </div>
          </div>

          <div className="space-y-3">
            {acItems.map((item) => (
              <ChecklistRow
                key={item.key}
                item={item}
                currentStatus={(value[item.key] as InspectionPointStatus) || 'tidak_diperiksa'}
                notes={(value[item.notesKey!] as string) || ''}
                onStatusChange={(s) => setStatus(item.key, s)}
                onNotesChange={(n) => setNotes(item.notesKey!, n)}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* AC Extra Metrics */}
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Suhu Hembusan AC (°C):
              </label>
              <input
                type="text"
                disabled={readOnly}
                value={value.cooling_temperature || ''}
                onChange={(e) => onChange({ ...value, cooling_temperature: e.target.value })}
                placeholder="Contoh: 6.8 °C (Standar 4-8 °C)"
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-maroon-600 focus:border-maroon-600 outline-none disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kualitas Aroma AC:
              </label>
              <select
                disabled={readOnly}
                value={value.ac_odour || 'normal'}
                onChange={(e) =>
                  onChange({ ...value, ac_odour: e.target.value as InspectionChecklistData['ac_odour'] })
                }
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-maroon-600 focus:border-maroon-600 outline-none disabled:bg-slate-50"
              >
                <option value="segar">Segar & Bersih</option>
                <option value="normal">Normal</option>
                <option value="apek">Apek (Bakteri/Lembap)</option>
                <option value="asam">Bau Asam / Asap Rokok</option>
              </select>
            </div>
          </div>

          {/* General AC Notes */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Khusus Area AC:
            </label>
            <textarea
              disabled={readOnly}
              rows={2}
              value={value.general_ac_notes || ''}
              onChange={(e) => setNotes('general_ac_notes', e.target.value)}
              placeholder="Catatan tambahan kondisi AC..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-maroon-600 focus:border-maroon-600 outline-none disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChecklistRowProps {
  item: ChecklistItemConfig;
  currentStatus: InspectionPointStatus;
  notes: string;
  onStatusChange: (s: InspectionPointStatus) => void;
  onNotesChange: (n: string) => void;
  readOnly?: boolean;
}

function ChecklistRow({
  item,
  currentStatus,
  notes,
  onStatusChange,
  onNotesChange,
  readOnly,
}: ChecklistRowProps) {
  const [showNotes, setShowNotes] = React.useState(Boolean(notes));

  return (
    <div className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-800">
          {item.label}
        </div>

        {/* Status Buttons */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onStatusChange('baik')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition ${
              currentStatus === 'baik'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Baik
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onStatusChange('perhatian')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition ${
              currentStatus === 'perhatian'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Perhatian
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onStatusChange('kritis')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition ${
              currentStatus === 'kritis'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Kritis
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onStatusChange('tidak_diperiksa')}
            className={`px-1.5 py-1 rounded text-[11px] font-medium transition ${
              currentStatus === 'tidak_diperiksa'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Tidak Diperiksa"
          >
            -
          </button>
        </div>
      </div>

      {/* Quick Mechanic Note Toggle/Input */}
      {(showNotes || currentStatus === 'perhatian' || currentStatus === 'kritis') && (
        <div className="mt-2">
          <input
            type="text"
            disabled={readOnly}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Catatan temuan / kondisi fisik item ini..."
            className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-maroon-600 outline-none"
          />
        </div>
      )}
    </div>
  );
}
