'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { BRANCHES, BranchId } from '@/lib/auth/users';
import { WorkOrder } from '@/lib/types/database';
import { formatPlate, formatKM, parseKM, formatDate } from '@/lib/utils';
import {
  FileEdit,
  X,
  User,
  Car,
  FileText,
  Save,
  Fuel,
  Clock,
  Wrench,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface EditSPKModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onSuccess?: (updatedOrder: WorkOrder) => void;
}

export function EditSPKModal({ workOrder, onClose, onSuccess }: EditSPKModalProps) {
  const {
    saveVehicleAsync,
    saveWorkOrderAsync,
    refreshData,
    syncWithSupabase,
    showToast,
  } = useApp();
  const { currentUser } = useAuth();

  const vehicle = workOrder.vehicle;

  // 1. Data Pelanggan & Pemilik
  const [customerName, setCustomerName] = useState(vehicle?.customer_name || '');
  const [phoneNumber, setPhoneNumber] = useState(vehicle?.phone_number || '');
  const [email, setEmail] = useState(vehicle?.email || '');
  const [address, setAddress] = useState(vehicle?.address || '');

  // 2. Data Kendaraan
  const [licensePlate, setLicensePlate] = useState(vehicle?.license_plate || '');
  const [carBrand, setCarBrand] = useState(vehicle?.car_brand || '');
  const [carModel, setCarModel] = useState(vehicle?.car_model || '');
  const [carYear, setCarYear] = useState(vehicle?.car_year ? String(vehicle.car_year) : '');
  const [chassisNumber, setChassisNumber] = useState(vehicle?.chassis_number || '');
  const [currentMileage, setCurrentMileage] = useState(
    vehicle?.current_mileage ? formatKM(vehicle.current_mileage, false) : ''
  );

  // 3. Detail SPK & Pengerjaan
  const [receivedAtBranch, setReceivedAtBranch] = useState<BranchId>(
    (workOrder.received_at_branch as BranchId) || 'MHS 1'
  );

  // Extract initial date & time from entry_date or created_at
  const initialEntryDate = workOrder.entry_date || workOrder.created_at || new Date().toISOString();
  const dateObj = new Date(initialEntryDate);
  const initialDateStr = !isNaN(dateObj.getTime())
    ? dateObj.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const initialTimeStr = !isNaN(dateObj.getTime())
    ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
    : '08:00';

  const [entryDate, setEntryDate] = useState(initialDateStr);
  const [entryTime, setEntryTime] = useState(initialTimeStr);
  const [petugasName, setPetugasName] = useState(
    workOrder.petugas_name ||
    (workOrder.checklist_data as any)?.petugas_name ||
    workOrder.sa_profile?.full_name ||
    ''
  );
  const [mechanicName, setMechanicName] = useState(workOrder.mechanic_name || '');

  const standardSources = ['REFERENSI', 'GOOGLE', 'INSTAGRAM', 'TIKTOK', 'PELANGGAN LAMA'];
  const currentSrc = workOrder.source_info || 'REFERENSI';
  const isCustomSrc = !standardSources.includes(currentSrc);

  const [sourceInfo, setSourceInfo] = useState<string>(isCustomSrc ? 'LAINNYA' : currentSrc);
  const [customSource, setCustomSource] = useState(isCustomSrc ? currentSrc : '');
  const [vehicleStatus, setVehicleStatus] = useState<'Ditunggu' | 'Ditinggal'>(
    workOrder.vehicle_status === 'Ditinggal' ? 'Ditinggal' : 'Ditunggu'
  );
  const [fuelLevel, setFuelLevel] = useState<number>(
    workOrder.fuel_level !== undefined ? Number(workOrder.fuel_level) : 50
  );
  const [complaints, setComplaints] = useState(workOrder.complaints || '');
  const [notes, setNotes] = useState(workOrder.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !phoneNumber.trim() || !licensePlate.trim() || !complaints.trim()) {
      showToast('Mohon lengkapi Nama Pelanggan, No. HP, Plat Nomor, dan Keluhan.', 'error');
      return;
    }

    setIsSubmitting(true);
    showToast('Menyimpan perubahan isi SPK ke database...', 'info');

    try {
      // 1. Simpan atau perbarui data kendaraan di Supabase
      const savedVehicle = await saveVehicleAsync({
        id: vehicle?.id || workOrder.vehicle_id,
        customer_name: customerName.trim().toUpperCase(),
        phone_number: phoneNumber.trim(),
        email: email.trim() || undefined,
        address: address.trim() ? address.trim().toUpperCase() : undefined,
        license_plate: formatPlate(licensePlate),
        car_brand: carBrand.trim() ? carBrand.trim().toUpperCase() : 'UMUM',
        car_model: carModel.trim() ? carModel.trim().toUpperCase() : 'STANDAR',
        car_year: carYear ? Number(carYear) : undefined,
        chassis_number: chassisNumber.trim() ? chassisNumber.trim().toUpperCase() : undefined,
        current_mileage: currentMileage ? parseKM(currentMileage) : 0,
      });

      // 2. Tentukan waktu entry gabungan tanggal & jam
      let finalEntryDateTime = new Date(workOrder.entry_date || new Date());
      if (entryDate && entryTime) {
        const [hh, mm] = entryTime.split(':');
        finalEntryDateTime = new Date(entryDate);
        if (hh && mm) {
          finalEntryDateTime.setHours(Number(hh), Number(mm), 0);
        }
      }

      const finalSource = sourceInfo === 'LAINNYA' ? (customSource.trim().toUpperCase() || 'LAINNYA') : sourceInfo;

      // 3. Simpan perubahan Work Order
      const updatedWorkOrder = await saveWorkOrderAsync({
        ...workOrder,
        id: workOrder.id,
        spk_number: workOrder.spk_number,
        vehicle_id: savedVehicle.id,
        petugas_name: petugasName.trim() ? petugasName.trim().toUpperCase() : undefined,
        mechanic_name: mechanicName.trim() ? mechanicName.trim().toUpperCase() : undefined,
        complaints: complaints.trim().toUpperCase(),
        fuel_level: Number(fuelLevel),
        notes: notes.trim() ? notes.trim().toUpperCase() : undefined,
        source_info: finalSource,
        vehicle_status: vehicleStatus,
        received_at_branch: receivedAtBranch,
        entry_date: finalEntryDateTime.toISOString(),
        status: workOrder.status, // Pertahankan status antrean saat ini
        checklist_data: {
          ...(workOrder.checklist_data || {}),
          petugas_name: petugasName.trim() ? petugasName.trim().toUpperCase() : undefined,
          source_info: finalSource,
          vehicle_status: vehicleStatus,
          received_at_branch: receivedAtBranch,
        },
      });

      // 4. Sinkronkan dengan Supabase & state lokal
      await syncWithSupabase();
      refreshData();

      showToast(`Berhasil! Isi SPK ${workOrder.spk_number} telah diperbarui di database.`, 'success');
      if (onSuccess) {
        onSuccess({
          ...updatedWorkOrder,
          vehicle: savedVehicle,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error updating SPK:', err);
      showToast('Gagal menyimpan perubahan: ' + (err?.message || 'Terjadi kesalahan pada database.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-maroon-900 via-slate-900 to-maroon-950 text-white flex items-center justify-between flex-shrink-0 border-b border-maroon-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold shadow-xs">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base tracking-tight">Edit Isi SPK (Surat Perintah Kerja)</h3>
                <span className="font-mono font-bold text-xs bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/20">
                  {workOrder.spk_number}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Perbarui data intake pelanggan, identitas unit mobil, keluhan, teknisi &amp; pengerjaan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Pelanggan & Kendaraan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
            {/* Kolom Kiri: Identitas Pemilik Kendaraan */}
            <div className="space-y-3.5">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  1. Identitas Pemilik Kendaraan
                </h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pemilik Kendaraan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="CONTOH: PAK ANDRA / BPK. AHMAD"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold uppercase focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp / HP <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081298765432"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-mono focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Pemilik Kendaraan</label>
                <input
                  type="text"
                  placeholder="CONTOH: MENGANTI RESIDENCE / SIDOARJO"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white uppercase font-medium outline-none focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600"
                />
              </div>
            </div>

            {/* Kolom Kanan: Identitas Kendaraan */}
            <div className="space-y-3.5">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Car className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  2. Identitas Kendaraan
                </h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Polisi (Plat Mobil) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: L 1857 CAV / W 1469 XN"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border-2 border-maroon-400 bg-maroon-50/40 font-black text-maroon-900 uppercase tracking-wider outline-none focus:ring-2 focus:ring-maroon-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Merek</label>
                  <input
                    type="text"
                    list="edit-brand-suggestions"
                    placeholder="HONDA / TOYOTA"
                    value={carBrand}
                    onChange={(e) => setCarBrand(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold uppercase outline-none focus:ring-2 focus:ring-maroon-600/20"
                  />
                  <datalist id="edit-brand-suggestions">
                    <option value="HONDA" />
                    <option value="TOYOTA" />
                    <option value="MITSUBISHI" />
                    <option value="SUZUKI" />
                    <option value="DAIHATSU" />
                    <option value="NISSAN" />
                    <option value="MAZDA" />
                    <option value="HYUNDAI" />
                    <option value="WULING" />
                    <option value="ISUZU" />
                    <option value="FORD" />
                    <option value="CHEVROLET" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Model / Tipe Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CR-V 2.0 / AVANZA"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold uppercase outline-none focus:ring-2 focus:ring-maroon-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Unit</label>
                  <input
                    type="number"
                    placeholder="2021"
                    value={carYear}
                    onChange={(e) => setCarYear(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">KM Masuk (Odo)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="35.000"
                      value={currentMileage}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        if (!raw) {
                          setCurrentMileage('');
                        } else {
                          const num = parseInt(raw, 10);
                          setCurrentMileage(new Intl.NumberFormat('id-ID').format(num));
                        }
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold pr-10 outline-none focus:ring-2 focus:ring-maroon-600/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                      KM
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nomor Rangka (Chassis)</label>
                <input
                  type="text"
                  placeholder="Contoh: MHKA..."
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-mono uppercase outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Detail SPK, Keluhan & Mekanik */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                3. Rincian SPK, Keluhan &amp; Pengerjaan Bengkel
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Keluhan Pemilik Kendaraan */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Keluhan Pemilik Kendaraan : <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tulis keluhan utama pemilik kendaraan..."
                  value={complaints}
                  onChange={(e) => setComplaints(e.target.value.toUpperCase())}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none leading-relaxed font-bold uppercase"
                />
              </div>

              {/* Uraian Pekerjaan */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Uraian Pekerjaan :
                </label>
                <textarea
                  rows={3}
                  placeholder="Tulis uraian instruksi pekerjaan teknisi..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none leading-relaxed font-bold uppercase"
                />
              </div>
            </div>

            {/* Baris Meta: Cabang, Petugas SA, Mekanik, Waktu Masuk, BBM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              {/* Cabang Penerimaan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Cabang Bengkel:</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setReceivedAtBranch(b)}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition text-center ${
                        receivedAtBranch === b
                          ? 'bg-maroon-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Petugas Bengkel / SA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                  <span>Petugas Bengkel / SA:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama petugas / SA..."
                  value={petugasName}
                  onChange={(e) => setPetugasName(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white font-bold uppercase outline-none focus:ring-2 focus:ring-maroon-600/20"
                />
              </div>

              {/* Nama Mekanik */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <Wrench className="w-3.5 h-3.5 text-slate-600" />
                  <span>Mekanik / Teknisi PIC:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama mekanik PIC..."
                  value={mechanicName}
                  onChange={(e) => setMechanicName(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white font-bold uppercase outline-none focus:ring-2 focus:ring-maroon-600/20"
                />
              </div>

              {/* Tanggal & Jam Masuk */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Tgl Masuk:</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 font-mono font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Jam:</label>
                  <input
                    type="time"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 font-mono font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Status Tunggu, Sumber & BBM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              {/* Status Kendaraan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Status Kendaraan:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleStatus('Ditunggu')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-black transition ${
                      vehicleStatus === 'Ditunggu'
                        ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⏱️ Ditunggu
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleStatus('Ditinggal')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-black transition ${
                      vehicleStatus === 'Ditinggal'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🚗 Ditinggal
                  </button>
                </div>
              </div>

              {/* Sumber Informasi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Sumber Informasi:</label>
                <select
                  value={sourceInfo}
                  onChange={(e) => setSourceInfo(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none"
                >
                  <option value="REFERENSI">REFERENSI</option>
                  <option value="GOOGLE">GOOGLE</option>
                  <option value="INSTAGRAM">INSTAGRAM</option>
                  <option value="TIKTOK">TIKTOK</option>
                  <option value="PELANGGAN LAMA">PELANGGAN LAMA</option>
                  <option value="LAINNYA">LAINNYA...</option>
                </select>
                {sourceInfo === 'LAINNYA' && (
                  <input
                    type="text"
                    placeholder="Ketik sumber lainnya..."
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value.toUpperCase())}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 mt-1.5 font-bold uppercase"
                  />
                )}
              </div>

              {/* Indikator Bahan Bakar */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center space-x-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    <span>Level Bahan Bakar (BBM):</span>
                  </span>
                  <span className="font-mono text-maroon-800 font-black">{fuelLevel}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-maroon-700 mt-2"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer Buttons */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            * Perubahan akan otomatis disinkronkan ke Supabase &amp; lembar cetak SPK.
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan ke Cloud...' : 'Simpan Perubahan SPK'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
