'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { PrintableSPK } from '@/components/ui/PrintableSPK';

type SourceInfo = string;
type VehicleStatus = 'Ditunggu' | 'Ditinggal';

function NewSPKContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch') as BranchId | null;

  const {
    vehicles,
    refreshData,
    showToast,
    settings,
    saveVehicleAsync,
    saveWorkOrderAsync,
    generateUniqueSpkNumberAsync,
  } = useApp();
  const { activeBranch, currentUser, setActiveBranch } = useAuth();
  const canAccessAll = !!currentUser?.canAccessAllBranches;

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');

  const validBranchParam = (branchParam && (branchParam === 'MHS 1' || branchParam === 'MHS 2' || branchParam === 'MHS 3'))
    ? branchParam
    : null;

  const [receivedAtBranch, setReceivedAtBranch] = useState<BranchId>(
    validBranchParam || activeBranch || 'MHS 1'
  );

  useEffect(() => {
    if (validBranchParam) {
      setReceivedAtBranch(validBranchParam);
    } else if (activeBranch) {
      setReceivedAtBranch(activeBranch);
    }
  }, [validBranchParam, activeBranch]);

  const [entryTime, setEntryTime] = useState('08:00');
  const [petugasName, setPetugasName] = useState(currentUser?.full_name || '');
  const [mechanicName, setMechanicName] = useState('');
  const [sourceInfo, setSourceInfo] = useState<SourceInfo>('REFERENSI');
  const [customSource, setCustomSource] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>('Ditunggu');
  const [fuelLevel, setFuelLevel] = useState<number>(50);
  const [complaints, setComplaints] = useState('');
  const [notes, setNotes] = useState('');

  // 3 Signatures
  const [signatureCustomer, setSignatureCustomer] = useState('');
  const [signatureMechanic, setSignatureMechanic] = useState('');
  const [signatureSA, setSignatureSA] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<WorkOrder | null>(null);

  // Set default entry time to current time and sync petugasName
  useEffect(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setEntryTime(`${hh}:${mm}`);
    if (!petugasName && currentUser?.full_name) {
      setPetugasName(currentUser.full_name);
    }
  }, [currentUser]);

  // When license plate is typed, auto-fill existing vehicle data
  const handlePlateChange = (val: string) => {
    const upperPlate = val.toUpperCase();
    setLicensePlate(upperPlate);
    const cleaned = upperPlate.replace(/\s+/g, '');
    const existing = vehicles.find(
      (v) => v.license_plate.replace(/\s+/g, '').toUpperCase() === cleaned
    );
    if (existing) {
      setCustomerName(existing.customer_name?.toUpperCase() || '');
      setPhoneNumber(existing.phone_number);
      if (existing.email) setEmail(existing.email);
      if (existing.address) setAddress(existing.address?.toUpperCase() || '');
      setCarBrand(existing.car_brand?.toUpperCase() || '');
      setCarModel(existing.car_model?.toUpperCase() || '');
      if (existing.car_year) setCarYear(String(existing.car_year));
      if (existing.chassis_number) setChassisNumber(existing.chassis_number?.toUpperCase() || '');
      if (existing.current_mileage) setCurrentMileage(formatKM(existing.current_mileage, false));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber || !licensePlate || !complaints) {
      showToast('Mohon lengkapi Nama, No. WhatsApp, Plat Nomor, dan Keluhan.', 'error');
      return;
    }

    setIsSubmitting(true);
    showToast('Menyimpan SPK ke database...', 'info');

    try {
      // 1. Save or update vehicle in Supabase (semua teks dikapitalisasi otomatis)
      const savedVehicle = await saveVehicleAsync({
        customer_name: customerName.trim().toUpperCase(),
        phone_number: phoneNumber.trim(),
        email: email.trim(),
        address: address.trim().toUpperCase(),
        license_plate: formatPlate(licensePlate),
        car_brand: carBrand.trim() ? carBrand.trim().toUpperCase() : 'UMUM',
        car_model: carModel.trim() ? carModel.trim().toUpperCase() : 'STANDAR',
        car_year: carYear ? Number(carYear) : undefined,
        chassis_number: chassisNumber.trim().toUpperCase(),
        current_mileage: currentMileage ? parseKM(currentMileage) : 0,
      }, receivedAtBranch);

      // Construct entry datetime with custom time
      const [hours, minutes] = entryTime.split(':');
      const entryDate = new Date();
      if (hours && minutes) {
        entryDate.setHours(Number(hours), Number(minutes), 0);
      }

      // 2. Generate guaranteed unique SPK number and save work order (kapitalisasi otomatis)
      const finalSource = (sourceInfo === 'LAINNYA' ? (customSource || 'Lainnya') : sourceInfo).toUpperCase();
      const spkNumber = await generateUniqueSpkNumberAsync(receivedAtBranch);
      const newWorkOrder = await saveWorkOrderAsync({
        spk_number: spkNumber,
        vehicle_id: savedVehicle.id,
        petugas_name: (petugasName || '').trim().toUpperCase(),
        mechanic_name: (mechanicName || '').trim().toUpperCase(),
        complaints: complaints.trim().toUpperCase(),
        fuel_level: Number(fuelLevel),
        notes: (notes || 'PEMERIKSAAN MENYELURUH, TUNE-UP, SERVIS BERKALA, DAN UJI FUNGSI SISTEM KENDARAAN.').trim().toUpperCase(),
        source_info: finalSource,
        vehicle_status: (vehicleStatus || 'Ditunggu').toUpperCase(),
        received_at_branch: receivedAtBranch,
        checklist_data: {
          received_at_branch: receivedAtBranch,
          source_info: finalSource,
          vehicle_status: (vehicleStatus || 'Ditunggu').toUpperCase(),
          petugas_name: (petugasName || '').trim().toUpperCase(),
        },
        signature_customer_url: signatureCustomer,
        signature_mechanic_url: signatureMechanic,
        signature_sa_url: signatureSA,
        status: 'queue',
        entry_date: entryDate.toISOString(),
      });

      // Sinkronkan activeBranch jika user memiliki akses lintas cabang
      if (canAccessAll && setActiveBranch) {
        setActiveBranch(receivedAtBranch);
      }

      refreshData();
      showToast(`Tersimpan! SPK ${newWorkOrder.spk_number || spkNumber} berhasil disimpan ke database cloud.`, 'success');
      setCreatedOrder(newWorkOrder);
    } catch (err: any) {
      console.error('Error saving SPK to Supabase:', err);
      showToast('Gagal disimpan: ' + (err?.message || 'Terjadi kesalahan jaringan atau server database'), 'error');
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-maroon-100 text-maroon-800 flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">1. Data Pelanggan & Kendaraan</h2>
                <p className="text-[11px] text-slate-500">Ketik plat nomor untuk auto-fill data pelanggan lama</p>
              </div>
            </div>

            {/* Cabang Penerimaan / Intake */}
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Building2 className="w-4 h-4 text-maroon-700" />
              <span className="text-xs font-bold text-slate-700">Cabang Intake:</span>
              {canAccessAll ? (
                <div className="flex items-center space-x-1">
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setReceivedAtBranch(b)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                        receivedAtBranch === b
                          ? 'bg-maroon-700 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-black px-2 py-0.5 rounded bg-maroon-100 text-maroon-800 border border-maroon-300">
                  {receivedAtBranch}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Pemilik Kendaraan Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Identitas Pemilik Kendaraan</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pemilik Kendaraan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Andra / Bpk. Ahmad"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold uppercase"
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Pemilik Kendaraan</label>
                <input
                  type="text"
                  placeholder="Contoh: Menganti resident / Graha Candi, Sidoarjo"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none uppercase font-medium"
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
                  onChange={(e) => handlePlateChange(e.target.value)}
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
                    Nama Petugas Bengkel / SA
                  </label>
                  <input
                    type="text"
                    placeholder="Nama SA / Petugas yang menerima..."
                    value={petugasName}
                    onChange={(e) => setPetugasName(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold uppercase text-slate-900"
                  />
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
                    onChange={(e) => setMechanicName(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold uppercase text-slate-900"
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
            {/* Keluhan Pemilik Kendaraan */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                KELUHAN PEMILIK KENDARAAN : <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Perawatan berkala, AC kurang dingin, ada bunyi berdengung saat mesin hidup..."
                value={complaints}
                onChange={(e) => setComplaints(e.target.value.toUpperCase())}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none leading-relaxed font-bold uppercase"
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
                onChange={(e) => setNotes(e.target.value.toUpperCase())}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none leading-relaxed font-bold uppercase"
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
                  onChange={(e) => setCustomSource(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 mt-2 font-bold uppercase"
                />
              )}
            </div>

            {/* Di Terima Di (Cabang) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Di Terima Di :
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BRANCHES.map((branch) => {
                  const isLockedOther = !currentUser?.canAccessAllBranches && branch !== activeBranch;
                  return (
                    <button
                      key={branch}
                      type="button"
                      disabled={isLockedOther}
                      onClick={() => !isLockedOther && setReceivedAtBranch(branch)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition text-center flex flex-col items-center space-y-0.5 ${
                        isLockedOther
                          ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : receivedAtBranch === branch
                          ? 'bg-maroon-50 border-maroon-600 text-maroon-900 shadow-xs cursor-pointer'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <span className="text-base">{branch === 'MHS 1' ? '🏠' : branch === 'MHS 2' ? '🏡' : '🏘️'}</span>
                      <span>{branch}</span>
                      {isLockedOther && <span className="text-[9px] text-slate-400 font-normal">Terkunci</span>}
                    </button>
                  );
                })}
              </div>
              {!currentUser?.canAccessAllBranches && (
                <p className="text-[10px] text-slate-500 font-semibold italic">
                  Cabang terkunci sesuai penugasan akun Anda ({activeBranch})
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
                Verifikasi penerimaan: {petugasName || 'Petugas Bengkel'}
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

export default function NewSPKPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500 font-medium">
          Memuat formulir penerimaan SPK...
        </div>
      }
    >
      <NewSPKContent />
    </Suspense>
  );
}
