'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { useAuth } from '@/lib/context/AuthContext';
import { BRANCHES, BranchId } from '@/lib/auth/users';
import { DBService } from '@/lib/services/db-service';
import { WorkOrder } from '@/lib/types/database';
import { formatPlate, generateSpkNumber, formatKM, parseKM } from '@/lib/utils';
import {
  ClipboardCheck,
  Car,
  User,
  Wrench,
  PenTool,
  Save,
  ArrowLeft,
  CheckCircle2,
  Fuel,
  Shield,
  FileCheck,
  Clock,
  Radio,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { PrintableSPK } from '@/components/ui/PrintableSPK';

export default function NewSPKPage() {
  const router = useRouter();
  const { vehicles, refreshData, showToast, settings, saveVehicleAsync, saveWorkOrderAsync } = useApp();
  const { activeBranch, currentUser } = useAuth();

  // Form states - Customer & Vehicle
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [licensePlate, setLicensePlate] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState<string>('');
  const [currentMileage, setCurrentMileage] = useState<string>('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [fuelLevel, setFuelLevel] = useState<number>(60);
  const [mechanicName, setMechanicName] = useState('');

  // New PKB Fields
  const now = new Date();
  const defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const [entryTime, setEntryTime] = useState(defaultTimeStr);
  const [complaints, setComplaints] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceInfo, setSourceInfo] = useState('REFERENSI');
  const [customSource, setCustomSource] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState<'Ditunggu' | 'Ditinggal'>('Ditunggu');
  const [receivedAtBranch, setReceivedAtBranch] = useState<BranchId>(activeBranch);

  // 3 Digital Signatures
  const [signatureCustomer, setSignatureCustomer] = useState<string>('');
  const [signatureMechanic, setSignatureMechanic] = useState<string>('');
  const [signatureSA, setSignatureSA] = useState<string>('');

  const [createdOrder, setCreatedOrder] = useState<WorkOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill when typing known license plate
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLicensePlate(raw);

    const clean = raw.toUpperCase().replace(/\s+/g, '');
    if (clean.length >= 4) {
      const match = vehicles.find(
        (v) => v.license_plate.toUpperCase().replace(/\s+/g, '') === clean
      );
      if (match) {
        setCustomerName(match.customer_name);
        setPhoneNumber(match.phone_number);
        setEmail(match.email || '');
        setAddress(match.address || '');
        setCarBrand(match.car_brand ? match.car_brand.toUpperCase() : '');
        setCarModel(match.car_model ? match.car_model.toUpperCase() : '');
        if (match.car_year) setCarYear(String(match.car_year));
        if (match.chassis_number) setChassisNumber(match.chassis_number);
        if (match.current_mileage) setCurrentMileage(formatKM(match.current_mileage, false));
        showToast(`Data kendaraan ${match.license_plate} ditemukan!`, 'info');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber || !licensePlate || !complaints) {
      showToast('Mohon lengkapi Nama, No. WhatsApp, Plat Nomor, dan Keluhan.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Save or update vehicle in Supabase
      const savedVehicle = await saveVehicleAsync({
        customer_name: customerName,
        phone_number: phoneNumber,
        email,
        address,
        license_plate: formatPlate(licensePlate),
        car_brand: carBrand.trim() ? carBrand.trim().toUpperCase() : 'UMUM',
        car_model: carModel.trim() ? carModel.trim().toUpperCase() : 'STANDAR',
        car_year: carYear ? Number(carYear) : undefined,
        chassis_number: chassisNumber,
        current_mileage: currentMileage ? parseKM(currentMileage) : 0,
      });

      // Construct entry datetime with custom time
      const [hours, minutes] = entryTime.split(':');
      const entryDate = new Date();
      if (hours && minutes) {
        entryDate.setHours(Number(hours), Number(minutes), 0);
      }

      // 2. Save work order with 3 signatures & PKB fields in Supabase
      const finalSource = sourceInfo === 'LAINNYA' ? (customSource || 'Lainnya') : sourceInfo;
      const spkNumber = generateSpkNumber();
      const newWorkOrder = await saveWorkOrderAsync({
        spk_number: spkNumber,
        vehicle_id: savedVehicle.id,
        mechanic_name: mechanicName,
        complaints,
        fuel_level: Number(fuelLevel),
        notes: notes || 'Ganti oli mesin, filter, tune-up berkala, dan uji fungsi sistem.',
        source_info: finalSource,
        vehicle_status: vehicleStatus,
        received_at_branch: receivedAtBranch,
        signature_customer_url: signatureCustomer,
        signature_mechanic_url: signatureMechanic,
        signature_sa_url: signatureSA,
        status: 'queue',
        entry_date: entryDate.toISOString(),
      });

      showToast(`PKB ${spkNumber} berhasil disimpan permanen ke Supabase!`, 'success');
      setCreatedOrder(newWorkOrder);
    } catch (err: any) {
      console.error('Error saving SPK to Supabase:', err);
      showToast('Gagal menyimpan ke Supabase: ' + (err?.message || 'Terjadi kesalahan jaringan'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/spk"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-maroon-700 hover:bg-maroon-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <ClipboardCheck className="w-6 h-6 text-maroon-700" />
              <span>Penerimaan Kendaraan & Form PKB Baru</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Input data pengerjaan bengkel, keluhan, uraian pekerjaan, sumber referensi & tanda tangan digital.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer & Vehicle */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Data Pelanggan & Kendaraan</h2>
              <p className="text-[11px] text-slate-500">Ketik plat nomor untuk auto-fill data pelanggan lama</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Customer Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Identitas Pemilik</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan (Customer) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Andra / Bpk. Ahmad"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-medium"
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
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Customer</label>
                <input
                  type="text"
                  placeholder="Contoh: Menganti resident / Graha Candi, Sidoarjo"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jam Datang</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email (Opsional)</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right: Vehicle Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Identitas Kendaraan</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Polisi (Plat Mobil) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: L 1857 CAV / W 1469 XN"
                  value={licensePlate}
                  onChange={handlePlateChange}
                  className="w-full text-xs p-2.5 rounded-xl border-2 border-maroon-400 bg-maroon-50/40 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-black text-maroon-900 uppercase tracking-wider text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Merek Kendaraan
                  </label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    placeholder="Contoh: HONDA / TOYOTA"
                    value={carBrand}
                    onChange={(e) => setCarBrand(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold uppercase text-slate-900"
                  />
                  <datalist id="brand-suggestions">
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
                    Nama Unit / Model & Tipe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: CR-V 2.0 / AVANZA 1.3"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Unit</label>
                  <input
                    type="number"
                    placeholder="Contoh: 2021"
                    value={carYear}
                    onChange={(e) => setCarYear(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    KM Masuk (Odometer) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="Contoh: 35.000"
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
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono font-bold pr-12 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      KM
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Mekanik / Teknisi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ketik nama mekanik yang mengerjakan..."
                    value={mechanicName}
                    onChange={(e) => setMechanicName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center space-x-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    <span>Indikator Bahan Bakar (BBM) Masuk:</span>
                  </span>
                  <span className="font-bold font-mono text-maroon-800">{fuelLevel}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-maroon-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Detail Pengerjaan & Status PKB */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Rincian Keluhan, Uraian Pekerjaan & Status PKB</h2>
              <p className="text-[11px] text-slate-500">Keluhan customer, instruksi uraian pekerjaan, sumber informasi & status tunggu</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Keluhan Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                KELUHAN CUSTOMER : <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Perawatan berkala, AC kurang dingin, ada bunyi berdengung saat mesin hidup..."
                value={complaints}
                onChange={(e) => setComplaints(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none leading-relaxed font-medium"
              />
            </div>

            {/* Uraian Pekerjaan */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                URAIAN PEKERJAAN :
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Ganti oli mesin sama filter oli, kuras freon AC, flushing oli kompresor..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none leading-relaxed font-medium"
              />
            </div>
          </div>

          {/* Symmetrical Grid: Sumber Informasi & Status Kendaraan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {/* Sumber Informasi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Sumber Informasi :
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {['REFERENSI', 'GOOGLE', 'INSTAGRAM', 'TIKTOK', 'PELANGGAN LAMA', 'LAINNYA'].map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceInfo(src)}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition text-center ${
                      sourceInfo === src
                        ? 'bg-blue-50 border-[#001F7A] text-[#001F7A] shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
              {sourceInfo === 'LAINNYA' && (
                <input
                  type="text"
                  placeholder="Ketik sumber informasi lainnya..."
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 mt-2 font-medium"
                />
              )}
            </div>

            {/* Di Terima Di (Cabang) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Di Terima Di :
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BRANCHES.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setReceivedAtBranch(branch)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black transition text-center flex flex-col items-center space-y-0.5 ${
                      receivedAtBranch === branch
                        ? 'bg-maroon-50 border-maroon-600 text-maroon-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{branch === 'MHS 1' ? '🏠' : branch === 'MHS 2' ? '🏡' : '🏘️'}</span>
                    <span>{branch}</span>
                  </button>
                ))}
              </div>
              {!currentUser?.canAccessAllBranches && (
                <p className="text-[10px] text-slate-400 italic">
                  Otomatis sesuai cabang login Anda
                </p>
              )}
            </div>

            {/* Status Kendaraan */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Status Kendaraan :
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setVehicleStatus('Ditunggu')}
                  className={`py-3 px-4 rounded-xl border text-xs font-black transition flex items-center justify-center space-x-2 ${
                    vehicleStatus === 'Ditunggu'
                      ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>⏱️ Ditunggu oleh Pelanggan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleStatus('Ditinggal')}
                  className={`py-3 px-4 rounded-xl border text-xs font-black transition flex items-center justify-center space-x-2 ${
                    vehicleStatus === 'Ditinggal'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>🚗 Ditinggal di Bengkel</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: 3 Bagian Tanda Tangan Digital */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  3. Pengesahan & Tanda Tangan Digital (3 Pihak)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Wajib ditandatangani oleh Petugas Bengkel, Teknisi/Mekanik, dan Pemilik Kendaraan
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TTD 1: Petugas Bengkel */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="block font-bold text-xs text-maroon-900 uppercase">
                1. Petugas Bengkel (SA)
              </span>
              <SignatureCanvas onSave={(url) => setSignatureSA(url)} />
              <p className="text-[10px] text-slate-500 font-medium text-center">
                Verifikasi penerimaan: Dito Ade Prawira / Petugas
              </p>
            </div>

            {/* TTD 2: Teknisi / Mekanik */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="block font-bold text-xs text-blue-900 uppercase">
                2. Teknisi / Mekanik
              </span>
              <SignatureCanvas onSave={(url) => setSignatureMechanic(url)} />
              <p className="text-[10px] text-slate-500 font-medium text-center">
                Penerimaan unit oleh: {mechanicName}
              </p>
            </div>

            {/* TTD 3: Pemilik Kendaraan */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="block font-bold text-xs text-maroon-900 uppercase">
                3. Pemilik Kendaraan
              </span>
              <SignatureCanvas onSave={(url) => setSignatureCustomer(url)} />
              <p className="text-[10px] text-slate-500 font-medium text-center">
                Persetujuan intake: {customerName || 'Customer'}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Link
            href="/spk"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition text-center"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Menyimpan ke Supabase...' : 'Simpan & Terbitkan PKB'}</span>
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {createdOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between bg-emerald-600 text-white p-3.5 rounded-xl">
              <div className="flex items-center space-x-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dokumen PKB Berhasil Diterbitkan dengan 3 Tanda Tangan!</span>
              </div>
              <button
                onClick={() => router.push(`/antrean?branch=${receivedAtBranch}`)}
                className="bg-white text-emerald-800 text-xs font-bold px-3 py-1 rounded-lg hover:bg-emerald-50 transition"
              >
                Lihat di Board Antrean ({receivedAtBranch}) →
              </button>
            </div>

            <PrintableSPK
              workOrder={createdOrder}
              settings={settings}
              onClose={() => router.push(`/antrean?branch=${receivedAtBranch}`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
