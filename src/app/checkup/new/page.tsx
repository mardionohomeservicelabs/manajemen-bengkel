'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context/AppContext';
import { DBService } from '@/lib/services/db-service';
import {
  CheckupType,
  QCGeneralCheckupData,
  ACCheckupData,
  CheckConditionStatus,
  CheckupRecord,
  WorkOrder,
} from '@/lib/types/database';
import { formatPlate } from '@/lib/utils';
import {
  ShieldAlert,
  ThermometerSnowflake,
  Wrench,
  Car,
  User,
  PenTool,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { PrintableGeneralCheckup } from '@/components/ui/PrintableGeneralCheckup';
import { PrintableACCheckup } from '@/components/ui/PrintableACCheckup';

function NewCheckupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spkIdParam = searchParams.get('spkId');

  const { vehicles, workOrders, refreshData, showToast, settings } = useApp();

  const [checkupType, setCheckupType] = useState<CheckupType>('qc_general');

  // Selected Active SPK
  const [selectedSpkId, setSelectedSpkId] = useState<string>(spkIdParam || '');

  // Common Header Info
  const [customerName, setCustomerName] = useState('Ahmad Fadillah');
  const [licensePlate, setLicensePlate] = useState('W 1984 RFS');
  const [carModel, setCarModel] = useState('Toyota Avanza 1.3 G');
  const [mileage, setMileage] = useState<number>(45200);
  const [technicianName, setTechnicianName] = useState('Agus Susanto');
  const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Auto-fill when an active SPK is selected
  useEffect(() => {
    if (selectedSpkId && workOrders.length > 0) {
      const spk = workOrders.find((w) => w.id === selectedSpkId);
      if (spk) {
        if (spk.vehicle) {
          setCustomerName(spk.vehicle.customer_name);
          setLicensePlate(spk.vehicle.license_plate);
          setCarModel(`${spk.vehicle.car_brand} ${spk.vehicle.car_model}`);
          setMileage(spk.vehicle.current_mileage || 40000);
        }
        if (spk.mechanic_name) {
          setTechnicianName(spk.mechanic_name);
        }
        showToast(`Data SPK ${spk.spk_number} berhasil dimuat ke formulir checkup!`, 'info');
      }
    }
  }, [selectedSpkId, workOrders]);

  // --- FORM 1: QC GENERAL CHECKUP STATES ---
  const [batteryCondition, setBatteryCondition] = useState<'baik' | 'buruk'>('baik');
  const [batteryHealth, setBatteryHealth] = useState<number>(85);
  const [batterySuggestReplace, setBatterySuggestReplace] = useState<boolean>(false);
  const [batteryNotes, setBatteryNotes] = useState('Aki kering 12.6V normal');

  // Sensor Cleanings
  const [sensorMAF, setSensorMAF] = useState({ clean: true, damaged: false, repl: false, notes: '' });
  const [sensorISC, setSensorISC] = useState({ clean: true, damaged: false, repl: false, notes: '' });
  const [sensorAirflow, setSensorAirflow] = useState({ clean: true, damaged: false, repl: false, notes: '' });
  const [throttleBody, setThrottleBody] = useState({ clean: true, damaged: false, repl: false, notes: '' });
  const [sparkPlug, setSparkPlug] = useState({ clean: true, damaged: false, repl: false, notes: '' });
  const [ignitionCoil, setIgnitionCoil] = useState({ clean: true, damaged: false, repl: false, notes: '' });

  // 16 Checklist Points
  const [checklistItems, setChecklistItems] = useState([
    { no: 8, label: 'Cek Filter Udara', checked: true, suggest_replace: false, notes: 'Dibersihkan' },
    { no: 9, label: 'Cek Volume Oli Engine', checked: true, suggest_replace: false, notes: 'Level MAX' },
    { no: 10, label: 'Cek Minyak Rem', checked: true, suggest_replace: false, notes: 'Normal' },
    { no: 11, label: 'Cek Minyak Kopling / Level Transmisi Matic', checked: true, suggest_replace: false, notes: 'Normal' },
    { no: 12, label: 'Cek Minyak Power Steering', checked: true, suggest_replace: false, notes: 'Normal' },
    { no: 13, label: 'Cek Air Radiator Coolant', checked: true, suggest_replace: false, notes: 'Jernih' },
    { no: 14, label: 'Cek Vanbelt Engine / AC', checked: true, suggest_replace: false, notes: 'Ketegangan baik' },
    { no: 15, label: 'Cek Kekencangan Mur Ban Roda', checked: true, suggest_replace: false, notes: '110 Nm' },
    { no: 16, label: 'Cek Fungsi Lampu All', checked: true, suggest_replace: false, notes: 'Semua nyala' },
    { no: 17, label: 'Cek Fungsi Tape / Audio', checked: true, suggest_replace: false, notes: 'Normal' },
    { no: 18, label: 'Cek Klakson Horn', checked: true, suggest_replace: false, notes: 'Normal' },
    { no: 19, label: 'Cek Wheldop Velg', checked: true, suggest_replace: false, notes: 'Kencang' },
    { no: 20, label: 'Kebersihan Filter Cabin', checked: true, suggest_replace: false, notes: 'Bersih' },
    { no: 21, label: 'Cek Tekanan Freon AC (Teknisi AC)', checked: true, suggest_replace: false, notes: '28 Psi' },
    { no: 22, label: 'Cek Kebersihan Plafon, Doortrim, Stir', checked: true, suggest_replace: false, notes: 'Bersih' },
    { no: 23, label: 'Riset Kilometer Oli Engine', checked: true, suggest_replace: false, notes: 'Sudah direset' },
  ]);

  const [fuelLevelFraction, setFuelLevelFraction] = useState('3/4');
  const [saranList, setSaranList] = useState<string[]>([
    'Pergantian oli rutin setiap 5.000 KM / 3 bulan.',
    'Perawatan berkala ke bengkel setiap 10.000 KM / 6 bulan.',
    'Bersihkan filter udara dan filter kabin secara rutin.',
    'Gunakan selalu bahan bakar dengan oktan sesuai rasio kompresi mesin.',
    'Pastikan air radiator coolant tidak dicampur air kran biasa.',
    'Cek kebocoran oli mesin, transmisi, dan minyak rem berkala.',
    'Perhatikan bunyi asing pada kaki-kaki dan sistem pengereman.',
    'Lakukan rotasi dan spooring balancing ban setiap 10.000 KM.',
    'Segera konsultasikan ke Mardiono Home Service jika indikator check engine menyala.',
  ]);

  // --- FORM 2: AC CHECKUP STATES ---
  const [acCompressor, setAcCompressor] = useState<CheckConditionStatus>('baik');
  const [acDriveBelt, setAcDriveBelt] = useState<CheckConditionStatus>('baik');
  const [acCondenser, setAcCondenser] = useState<CheckConditionStatus>('baik');
  const [acHoses, setAcHoses] = useState<CheckConditionStatus>('baik');
  const [acCoolant, setAcCoolant] = useState<CheckConditionStatus>('baik');

  const [acFuncClutch, setAcFuncClutch] = useState<CheckConditionStatus>('baik');
  const [acRadiatorFan, setAcRadiatorFan] = useState<CheckConditionStatus>('baik');
  const [acBlower, setAcBlower] = useState<CheckConditionStatus>('baik');
  const [acSightGlass, setAcSightGlass] = useState<CheckConditionStatus>('baik');

  const [acVentTemp, setAcVentTemp] = useState('6.5 °C');
  const [acLowPsi, setAcLowPsi] = useState('30 Psi');
  const [acHighPsi, setAcHighPsi] = useState('195 Psi');
  const [acCabinFilter, setAcCabinFilter] = useState<CheckConditionStatus>('baik');
  const [acDrain, setAcDrain] = useState<CheckConditionStatus>('baik');
  const [acRecommendations, setAcRecommendations] = useState(
    'Kondisi kompresor dan tekanan freon optimal. Lakukan servis ringan dan penggantian filter kabin berkala.'
  );

  // Signatures
  const [signatureTech, setSignatureTech] = useState<string>('');
  const [signatureCustomer, setSignatureCustomer] = useState<string>('');

  const [savedRecord, setSavedRecord] = useState<CheckupRecord | null>(null);

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLicensePlate(raw);
    const clean = raw.toUpperCase().replace(/\s+/g, '');
    const found = vehicles.find((v) => v.license_plate.toUpperCase().replace(/\s+/g, '') === clean);
    if (found) {
      setCustomerName(found.customer_name);
      setCarModel(`${found.car_brand} ${found.car_model}`);
      setMileage(found.current_mileage || 40000);
      showToast(`Data mobil ${found.license_plate} dimuat!`, 'info');
    }
  };

  const handleSpkSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const spkId = e.target.value;
    setSelectedSpkId(spkId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedSpk = workOrders.find((w) => w.id === selectedSpkId);

    if (checkupType === 'qc_general') {
      const docNo = `QC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        100 + Math.random() * 900
      )}`;

      const qcData: QCGeneralCheckupData = {
        document_number: docNo,
        check_date: checkDate,
        technician_name: technicianName,
        customer_name: customerName,
        car_model: carModel,
        license_plate: formatPlate(licensePlate),
        mileage: Number(mileage),
        battery_condition: batteryCondition,
        battery_health_percent: Number(batteryHealth),
        battery_suggest_replace: batterySuggestReplace,
        battery_notes: batteryNotes,
        sensor_maf_cleaned: sensorMAF.clean,
        sensor_maf_damaged: sensorMAF.damaged,
        sensor_maf_suggest_replace: sensorMAF.repl,
        sensor_maf_notes: sensorMAF.notes,
        sensor_isc_cleaned: sensorISC.clean,
        sensor_isc_damaged: sensorISC.damaged,
        sensor_isc_suggest_replace: sensorISC.repl,
        sensor_isc_notes: sensorISC.notes,
        sensor_airflow_cleaned: sensorAirflow.clean,
        sensor_airflow_damaged: sensorAirflow.damaged,
        sensor_airflow_suggest_replace: sensorAirflow.repl,
        sensor_airflow_notes: sensorAirflow.notes,
        throttle_body_cleaned: throttleBody.clean,
        throttle_body_damaged: throttleBody.damaged,
        throttle_body_suggest_replace: throttleBody.repl,
        throttle_body_notes: throttleBody.notes,
        spark_plug_checked: sparkPlug.clean,
        spark_plug_damaged: sparkPlug.damaged,
        spark_plug_suggest_replace: sparkPlug.repl,
        spark_plug_notes: sparkPlug.notes,
        ignition_coil_checked: ignitionCoil.clean,
        ignition_coil_damaged: ignitionCoil.damaged,
        ignition_coil_suggest_replace: ignitionCoil.repl,
        ignition_coil_notes: ignitionCoil.notes,
        filter_udara: checklistItems[0],
        volume_oli_engine: checklistItems[1],
        minyak_rem: checklistItems[2],
        minyak_kopling_transmisi: checklistItems[3],
        minyak_power_steering: checklistItems[4],
        air_radiator_coolant: checklistItems[5],
        vanbelt_engine_ac: checklistItems[6],
        kekencangan_mur_ban: checklistItems[7],
        fungsi_lampu_all: checklistItems[8],
        fungsi_tape_audio: checklistItems[9],
        klakson_horn: checklistItems[10],
        wheldop_velg: checklistItems[11],
        kebersihan_filter_cabin: checklistItems[12],
        tekanan_freon_ac: checklistItems[13],
        kebersihan_interior_plafon_stir: checklistItems[14],
        riset_km_oli_engine: checklistItems[15],
        fuel_level_fraction: fuelLevelFraction,
        technician_signature_url: signatureTech,
        improvement_suggestions: saranList.filter((s) => s.trim().length > 0),
      };

      const record = DBService.saveCheckup({
        type: 'qc_general',
        document_number: docNo,
        work_order_id: selectedSpkId || undefined,
        vehicle_id: selectedSpk?.vehicle_id || undefined,
        customer_name: customerName,
        license_plate: formatPlate(licensePlate),
        car_model: carModel,
        technician_name: technicianName,
        check_date: checkDate,
        qc_data: qcData,
        created_at: new Date().toISOString(),
      });

      refreshData();
      showToast('Formulir QC General Checkup berhasil disimpan secara otomatis!', 'success');
      setSavedRecord(record);
    } else {
      const docNo = `AC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        100 + Math.random() * 900
      )}`;

      const acData: ACCheckupData = {
        document_number: docNo,
        customer_name: customerName,
        car_model: carModel,
        mileage: Number(mileage),
        license_plate: formatPlate(licensePlate),
        check_date: checkDate,
        technician_name: technicianName,
        location_city: settings.city || 'Sidoarjo',
        compressor_clutch: acCompressor,
        drive_belt: acDriveBelt,
        condenser_radiator: acCondenser,
        hoses_pipes: acHoses,
        air_coolant: acCoolant,
        func_magnetic_clutch: acFuncClutch,
        radiator_condenser_fan: acRadiatorFan,
        blower_airflow: acBlower,
        sight_glass_odour: acSightGlass,
        air_vent_temperature: acVentTemp,
        low_pressure_psi: acLowPsi,
        high_pressure_psi: acHighPsi,
        cabin_filter_condition: acCabinFilter,
        evaporator_drain_condition: acDrain,
        recommendations: acRecommendations,
        customer_signature_url: signatureCustomer,
        technician_signature_url: signatureTech,
      };

      const record = DBService.saveCheckup({
        type: 'ac_specialist',
        document_number: docNo,
        work_order_id: selectedSpkId || undefined,
        vehicle_id: selectedSpk?.vehicle_id || undefined,
        customer_name: customerName,
        license_plate: formatPlate(licensePlate),
        car_model: carModel,
        technician_name: technicianName,
        check_date: checkDate,
        ac_data: acData,
        created_at: new Date().toISOString(),
      });

      refreshData();
      showToast('Formulir Pemeriksaan AC & Pendingin berhasil disimpan secara otomatis!', 'success');
      setSavedRecord(record);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/checkup"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-maroon-700 hover:bg-maroon-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-maroon-700" />
              <span>Input Lembar Pemeriksaan / General Checkup</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Pilih dari SPK aktif atau input langsung, pilih jenis formulir, lalu data otomatis tersimpan di riwayat checkup.
            </p>
          </div>
        </div>
      </div>

      {/* SELECTOR: PILIH MOBIL DARI SPK AKTIF */}
      <div className="bg-white p-5 rounded-2xl border-2 border-maroon-800/30 shadow-card space-y-2 bg-gradient-to-r from-maroon-50/50 via-white to-white">
        <label className="block text-xs font-black text-maroon-950 uppercase tracking-wider flex items-center space-x-2">
          <ClipboardList className="w-4 h-4 text-maroon-700" />
          <span>Pilih Mobil Dari SPK Aktif (Otomatis Isi Data Pemeriksaan):</span>
        </label>
        <select
          value={selectedSpkId}
          onChange={handleSpkSelect}
          className="w-full text-xs p-3 rounded-xl border border-maroon-300 bg-white focus:ring-2 focus:ring-maroon-600/20 focus:border-maroon-600 outline-none font-bold text-slate-900 shadow-xs"
        >
          <option value="">-- Atau Input Manual / Tanpa SPK --</option>
          {workOrders.map((wo) => (
            <option key={wo.id} value={wo.id}>
              {wo.spk_number} • {wo.vehicle?.license_plate ? formatPlate(wo.vehicle.license_plate) : ''} •{' '}
              {wo.vehicle?.customer_name} ({wo.vehicle?.car_brand} {wo.vehicle?.car_model}) - Status: {wo.status.toUpperCase()}
            </option>
          ))}
        </select>

        {selectedSpkId && (
          <div className="flex items-center space-x-2 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>
              Terhubung dengan SPK: {workOrders.find((w) => w.id === selectedSpkId)?.spk_number}. Hasil checkup akan otomatis tersimpan & terlampir!
            </span>
          </div>
        )}
      </div>

      {/* Form Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setCheckupType('qc_general')}
          className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 ${
            checkupType === 'qc_general'
              ? 'bg-red-50 border-red-600 shadow-md ring-2 ring-red-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-sm text-slate-900">
              1. Quality Control General Checkup (23 Titik)
            </div>
            <p className="text-[11px] text-slate-500">
              Pemeriksaan aki, pembersihan sensor contact cleaner & checklist fisik 16 titik
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCheckupType('ac_specialist')}
          className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 ${
            checkupType === 'ac_specialist'
              ? 'bg-blue-50 border-blue-600 shadow-md ring-2 ring-blue-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold">
            <ThermometerSnowflake className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-sm text-slate-900">
              2. Formulir Pemeriksaan AC & Pendingin
            </div>
            <p className="text-[11px] text-slate-500">
              Pemeriksaan mesin mati/nyala, suhu hembusan & tekanan freon psi
            </p>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Common Info Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
            Identitas Kendaraan & Pelanggan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nomor Polisi (Plat Mobil)</label>
              <input
                type="text"
                required
                value={licensePlate}
                onChange={handlePlateChange}
                className="w-full p-2 rounded-xl border border-maroon-400 bg-maroon-50/30 font-black text-maroon-900 uppercase tracking-wide text-sm"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Pemilik / Pelanggan</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipe / Model Mobil</label>
              <input
                type="text"
                required
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">KM / Odometer</label>
              <input
                type="number"
                required
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Teknisi Pemeriksa</label>
              <input
                type="text"
                required
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tanggal Pemeriksaan</label>
              <input
                type="date"
                required
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- RENDER FORM 1: QC GENERAL CHECKUP --- */}
        {checkupType === 'qc_general' && (
          <div className="space-y-6">
            {/* Section 1: Aki */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                1. Cek Kondisi Aki Basa / Kering
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Status Kondisi</label>
                  <select
                    value={batteryCondition}
                    onChange={(e) => setBatteryCondition(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="baik">🟢 BAIK</option>
                    <option value="buruk">🔴 BURUK</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kesehatan Aki (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batterySuggestReplace}
                      onChange={(e) => setBatterySuggestReplace(e.target.checked)}
                      className="w-4 h-4 rounded text-red-600 accent-red-600"
                    />
                    <span className="font-bold text-red-700">Saran Ganti Aki</span>
                  </label>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Keterangan Aki</label>
                  <input
                    type="text"
                    value={batteryNotes}
                    onChange={(e) => setBatteryNotes(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Pembersihan Sensor */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                  2. Pembersihan Sensor (Wajib Gunakan Cairan Contact Cleaner)
                </h3>
                <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                  *Wajib Contact Cleaner
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { label: '2. Bersihkan Sensor MAF', state: sensorMAF, set: setSensorMAF },
                  { label: '3. Bersihkan Sensor ISC', state: sensorISC, set: setSensorISC },
                  { label: '4. Bersihkan Sensor Airflow', state: sensorAirflow, set: setSensorAirflow },
                  { label: '5. Bersihkan Throttle Body Module', state: throttleBody, set: setThrottleBody },
                  { label: '6. Cek Busi Spark Plug', state: sparkPlug, set: setSparkPlug },
                  { label: '7. Cek Coil Pengapian', state: ignitionCoil, set: setIgnitionCoil },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 gap-2 text-xs"
                  >
                    <span className="font-bold text-slate-800 sm:w-60">{row.label}</span>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.state.clean}
                          onChange={(e) => row.set({ ...row.state, clean: e.target.checked })}
                          className="w-4 h-4 accent-red-700"
                        />
                        <span className="font-medium text-slate-700">Wajib Clean</span>
                      </label>
                      <label className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.state.damaged}
                          onChange={(e) => row.set({ ...row.state, damaged: e.target.checked })}
                          className="w-4 h-4 accent-red-700"
                        />
                        <span className="font-medium text-red-600">Rusak</span>
                      </label>
                      <label className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.state.repl}
                          onChange={(e) => row.set({ ...row.state, repl: e.target.checked })}
                          className="w-4 h-4 accent-red-700"
                        />
                        <span className="font-bold text-red-700">Saran Ganti</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan temuan..."
                      value={row.state.notes}
                      onChange={(e) => row.set({ ...row.state, notes: e.target.value })}
                      className="text-xs p-1.5 rounded-lg border border-slate-200 bg-white sm:w-64"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Checklist 16 Titik */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                3. Checklist Fisik 16 Titik Pengecekan
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {checklistItems.map((item, idx) => (
                  <div
                    key={item.no}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {item.no}. {item.label}
                      </span>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const updated = [...checklistItems];
                              updated[idx].checked = e.target.checked;
                              setChecklistItems(updated);
                            }}
                            className="w-4 h-4 accent-red-700"
                          />
                          <span className="text-[11px] font-medium text-slate-600">Cek</span>
                        </label>
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.suggest_replace}
                            onChange={(e) => {
                              const updated = [...checklistItems];
                              updated[idx].suggest_replace = e.target.checked;
                              setChecklistItems(updated);
                            }}
                            className="w-4 h-4 accent-red-700"
                          />
                          <span className="text-[11px] font-bold text-red-600">Ganti</span>
                        </label>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Catatan / keterangan..."
                      value={item.notes}
                      onChange={(e) => {
                        const updated = [...checklistItems];
                        updated[idx].notes = e.target.value;
                        setChecklistItems(updated);
                      }}
                      className="w-full text-[11px] p-1.5 rounded border border-slate-200 bg-white"
                    />
                  </div>
                ))}
              </div>

              {/* BBM Gauge */}
              <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 flex items-center justify-between text-xs mt-3">
                <span className="font-bold text-red-900">Pengecekan BBM (Fuel Gauge):</span>
                <div className="flex items-center space-x-2">
                  {['E', '1/4', '1/2', '3/4', 'F'].map((frac) => (
                    <button
                      key={frac}
                      type="button"
                      onClick={() => setFuelLevelFraction(frac)}
                      className={`px-3 py-1 rounded-lg font-bold transition ${
                        fuelLevelFraction === frac
                          ? 'bg-red-700 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {frac}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 4: Saran Perbaikan (Points 1 - 9) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                4. Saran Perbaikan (Maks. 9 Catatan Rekomendasi)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {saranList.map((saran, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="font-bold text-slate-500 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder={`Saran perbaikan ${idx + 1}...`}
                      value={saran}
                      onChange={(e) => {
                        const updated = [...saranList];
                        updated[idx] = e.target.value;
                        setSaranList(updated);
                      }}
                      className="w-full p-2 rounded-xl border border-slate-200"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Technician Signature */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                5. Tanda Tangan Teknisi Pemeriksa
              </h3>
              <div className="max-w-md">
                <SignatureCanvas onSave={(url) => setSignatureTech(url)} />
              </div>
            </div>
          </div>
        )}

        {/* --- RENDER FORM 2: AC SPECIALIST CHECKUP --- */}
        {checkupType === 'ac_specialist' && (
          <div className="space-y-6">
            {/* 1. Visual Mesin Mati */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-red-900 pb-2 border-b border-slate-100">
                1. Pemeriksaan Visual & Fisik (Mesin Mati)
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Kompresor & Clutch', val: acCompressor, set: setAcCompressor },
                  { name: 'Drive Belt (Tali Kipas)', val: acDriveBelt, set: setAcDriveBelt },
                  { name: 'Kondensor AC & Radiator', val: acCondenser, set: setAcCondenser },
                  { name: 'Selang & Pipa AC', val: acHoses, set: setAcHoses },
                  { name: 'Air Coolant (Air Radiator)', val: acCoolant, set: setAcCoolant },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                  >
                    <span className="font-bold text-slate-800">{row.name}</span>
                    <div className="flex space-x-1.5">
                      {(['baik', 'lemah', 'rusak'] as CheckConditionStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => row.set(status)}
                          className={`px-3 py-1 rounded-lg font-bold uppercase text-[10px] transition ${
                            row.val === status
                              ? status === 'baik'
                                ? 'bg-emerald-600 text-white'
                                : status === 'lemah'
                                ? 'bg-amber-500 text-white'
                                : 'bg-red-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Operasional Mesin Menyala */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-red-900 pb-2 border-b border-slate-100">
                2. Pemeriksaan Operasional (AC & Mesin Menyala)
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Fungsi Magnetic Clutch', val: acFuncClutch, set: setAcFuncClutch },
                  { name: 'Kipas Radiator & Kondensor', val: acRadiatorFan, set: setAcRadiatorFan },
                  { name: 'Blower & Aliran Udara', val: acBlower, set: setAcBlower },
                  { name: 'Sight Glass & Aroma Kabin', val: acSightGlass, set: setAcSightGlass },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                  >
                    <span className="font-bold text-slate-800">{row.name}</span>
                    <div className="flex space-x-1.5">
                      {(['baik', 'lemah', 'rusak'] as CheckConditionStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => row.set(status)}
                          className={`px-3 py-1 rounded-lg font-bold uppercase text-[10px] transition ${
                            row.val === status
                              ? status === 'baik'
                                ? 'bg-emerald-600 text-white'
                                : status === 'lemah'
                                ? 'bg-amber-500 text-white'
                                : 'bg-red-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Parameter Teknis */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-red-900 pb-2 border-b border-slate-100">
                3. Pengukuran Parameter Teknis
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Suhu Embusan Kisi AC (°C)
                  </label>
                  <input
                    type="text"
                    value={acVentTemp}
                    onChange={(e) => setAcVentTemp(e.target.value)}
                    placeholder="Contoh: 6.5 °C"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tekanan Rendah (Low Psi)
                  </label>
                  <input
                    type="text"
                    value={acLowPsi}
                    onChange={(e) => setAcLowPsi(e.target.value)}
                    placeholder="Normal: 20-35 Psi"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tekanan Tinggi (High Psi)
                  </label>
                  <input
                    type="text"
                    value={acHighPsi}
                    onChange={(e) => setAcHighPsi(e.target.value)}
                    placeholder="Normal: 150-250 Psi"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700 mb-1 text-xs">
                  Rekomendasi Tindakan / Catatan Tambahan:
                </label>
                <textarea
                  rows={3}
                  value={acRecommendations}
                  onChange={(e) => setAcRecommendations(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 leading-relaxed font-medium"
                />
              </div>
            </div>

            {/* Signatures: Customer & Tech */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-2">
                <span className="block font-bold text-xs text-slate-900 uppercase">
                  Tanda Tangan Pelanggan
                </span>
                <SignatureCanvas onSave={(url) => setSignatureCustomer(url)} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-2">
                <span className="block font-bold text-xs text-slate-900 uppercase">
                  Tanda Tangan Teknisi
                </span>
                <SignatureCanvas onSave={(url) => setSignatureTech(url)} />
              </div>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-3 pt-4">
          <Link
            href="/checkup"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
          >
            Batal
          </Link>
          <button
            type="submit"
            className="inline-flex items-center space-x-2 bg-maroon-700 hover:bg-maroon-800 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan & Terbitkan Formulir Checkup</span>
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {savedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between bg-emerald-600 text-white p-3.5 rounded-xl">
              <div className="flex items-center space-x-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Formulir Pemeriksaan Berhasil Disimpan & Siap Dicetak!</span>
              </div>
              <button
                onClick={() => router.push('/checkup')}
                className="bg-white text-emerald-800 text-xs font-bold px-3 py-1 rounded-lg hover:bg-emerald-50 transition"
              >
                Kembali ke Daftar Checkup →
              </button>
            </div>

            {savedRecord.type === 'qc_general' && savedRecord.qc_data && (
              <PrintableGeneralCheckup
                checkup={savedRecord.qc_data}
                settings={settings}
                onClose={() => router.push('/checkup')}
              />
            )}
            {savedRecord.type === 'ac_specialist' && savedRecord.ac_data && (
              <PrintableACCheckup
                checkup={savedRecord.ac_data}
                settings={settings}
                onClose={() => router.push('/checkup')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewCheckupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat formulir checkup...</div>}>
      <NewCheckupPageContent />
    </Suspense>
  );
}

