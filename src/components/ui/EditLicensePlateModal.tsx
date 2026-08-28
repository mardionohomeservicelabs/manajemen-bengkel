'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { formatPlate } from '@/lib/utils';
import { Car, X, CheckCircle2, Lock } from 'lucide-react';

interface EditLicensePlateModalProps {
  vehicleId: string;
  currentPlate: string;
  customerName?: string;
  carModel?: string;
  onClose: () => void;
  onSuccess?: (newPlate: string) => void;
}

export function EditLicensePlateModal({
  vehicleId,
  currentPlate,
  customerName,
  carModel,
  onClose,
  onSuccess,
}: EditLicensePlateModalProps) {
  const { updateVehiclePlateAsync, showToast } = useApp();
  const [newPlate, setNewPlate] = useState(currentPlate);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = formatPlate(newPlate);
    if (!formatted || formatted.length < 3) {
      showToast('Masukkan plat nomor yang valid (misal: L 1234 ABC)', 'warning');
      return;
    }

    if (formatted === formatPlate(currentPlate)) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await updateVehiclePlateAsync(vehicleId, formatted);
      if (ok) {
        if (onSuccess) onSuccess(formatted);
        onClose();
      }
    } catch (err: any) {
      showToast('Gagal mengubah plat nomor: ' + (err?.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-xs">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm">Ganti Plat Nomor Kendaraan</h3>
              <p className="text-[11px] text-slate-300">Dapat diubah bebas meskipun pekerjaan terkunci</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Info Card */}
          {(customerName || carModel) && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-0.5">
              {customerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Pelanggan:</span>
                  <span className="font-bold text-slate-900">{customerName}</span>
                </div>
              )}
              {carModel && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Unit Kendaraan:</span>
                  <span className="font-bold text-slate-800">{carModel}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200/80">
                <span className="text-slate-500 font-semibold">Plat Lama:</span>
                <span className="font-mono font-black text-[#8B0000]">{formatPlate(currentPlate)}</span>
              </div>
            </div>
          )}

          {/* Plat Input Field */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Plat Nomor Baru: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value)}
              placeholder="Contoh: L 1234 ABC / W 5678 XY"
              className="w-full text-center font-mono font-black text-lg p-3 rounded-xl border-2 border-blue-500 bg-blue-50/20 text-slate-900 outline-none uppercase tracking-wider focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start space-x-2">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="leading-tight">
              Sesuai SOP bengkel, plat nomor tetap dapat diganti kapan saja bila terjadi kesalahan pengetikan, sementara rincian PKB, Estimasi &amp; QC tetap aman terkunci.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Plat'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
