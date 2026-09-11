import {
  Profile,
  VehicleCustomer,
  InventoryItem,
  WorkOrder,
  Invoice,
  CRMLog,
  WorkshopSettings,
  StockMovement,
  AuditLog,
  CheckupRecord,
} from '../types/database';

export const initialProfiles: Profile[] = [
  {
    id: 'prof-owner-1',
    full_name: 'ARDIYANTO WIJAYA (Owner)',
    role: 'owner',
    phone: '081211112222',
  },
  {
    id: 'prof-admin-1',
    full_name: 'Mey Wulandari (Admin)',
    role: 'admin',
    phone: '081233334444',
  },
  {
    id: 'prof-sa-1',
    full_name: 'Dito Ade Prawira (Service Advisor)',
    role: 'sa',
    phone: '081255556666',
  },
];

export const initialSettingsMHS1: WorkshopSettings = {
  id: 'workshop-mhs1',
  name: 'MARDIONO HOME SERVICE 1',
  tagline: 'Engine - Tune Up - AC Mobil - Understeel - Electrical',
  phone: '0812-3076-2930',
  email: 'mardionoohomeservice@gmail.com',
  address: 'Jl. Perum Beringin Indah No.D - 19, Bringin Kulon, Bringinbendo, Taman, Sidoarjo',
  city: 'Sidoarjo',
  logo_url: '/header-banner.png',
  bank_account_info: 'Bank BCA: 2711235398 a.n ARDIYANTO WIJAYA\nBank BRI: 0086-0113-1974-508 a.n ARDIYANTO WIJAYA',
  terms_conditions: '1. Garansi servis mesin & AC berlaku 1 bulan atau 1.000 KM mana yang tercapai lebih dulu.\n2. Sparepart elektrikal tidak bergaransi kecuali cacat pabrik saat pemasangan.\n3. Kendaraan yang tidak diambil dalam tempo 7 hari setelah selesai dikenakan biaya inap.',
  wa_template_reminder: 'Halo Bpk/Ibu [Customer], mobil kesayangan Anda [Mobil] ([Plat]) sudah mendekati jadwal servis berkala pada [Tanggal]. Kunjungi Mardiono Home Service 1 untuk menjaga performa mobil Anda tetap prima. Balas pesan ini untuk reservasi antrean!',
};

export const initialSettingsMHS2: WorkshopSettings = {
  id: 'workshop-mhs2',
  name: 'MARDIONO HOME SERVICE 2',
  tagline: 'Spesialis Mesin & AC Mobil Trosobo',
  phone: '0812-3076-2931',
  email: 'mhs2.trosobo@gmail.com',
  address: 'Jl. Raya Trosobo No. 88, Krian, Sidoarjo',
  city: 'Sidoarjo',
  logo_url: '/header-banner.png',
  bank_account_info: 'Bank BCA: 2711235398 a.n ARDIYANTO WIJAYA\nBank BRI: 0086-0113-1974-508 a.n ARDIYANTO WIJAYA',
  terms_conditions: '1. Garansi servis mesin & AC berlaku 1 bulan atau 1.000 KM mana yang tercapai lebih dulu.\n2. Sparepart elektrikal tidak bergaransi kecuali cacat pabrik saat pemasangan.\n3. Kendaraan yang tidak diambil dalam tempo 7 hari setelah selesai dikenakan biaya inap.',
  wa_template_reminder: 'Halo Bpk/Ibu [Customer], mobil Anda [Mobil] ([Plat]) sudah mendekati jadwal servis berkala di Mardiono Home Service 2 (Trosobo). Balas pesan ini untuk reservasi antrean!',
};

export const initialSettingsMHS3: WorkshopSettings = {
  id: 'workshop-mhs3',
  name: 'MARDIONO HOME SERVICE 3',
  tagline: 'Engine • AC • Understeel Specialist Cabang 3',
  phone: '0812-3076-2932',
  email: 'mhs3.surabaya@gmail.com',
  address: 'Jl. Mastrip No. 12, Karangpilang, Surabaya',
  city: 'Surabaya',
  logo_url: '/header-banner.png',
  bank_account_info: 'Bank BCA: 2711235398 a.n ARDIYANTO WIJAYA\nBank BRI: 0086-0113-1974-508 a.n ARDIYANTO WIJAYA',
  terms_conditions: '1. Garansi servis mesin & AC berlaku 1 bulan atau 1.000 KM mana yang tercapai lebih dulu.\n2. Sparepart elektrikal tidak bergaransi kecuali cacat pabrik saat pemasangan.\n3. Kendaraan yang tidak diambil dalam tempo 7 hari setelah selesai dikenakan biaya inap.',
  wa_template_reminder: 'Halo Bpk/Ibu [Customer], mobil Anda [Mobil] ([Plat]) sudah mendekati jadwal servis berkala di Mardiono Home Service 3. Balas pesan ini untuk reservasi antrean!',
};

export const initialSettings: WorkshopSettings = initialSettingsMHS1;

export const initialVehicles: VehicleCustomer[] = [];
export const initialInventory: InventoryItem[] = [];
export const initialWorkOrders: WorkOrder[] = [];
export const initialInvoices: Invoice[] = [];
export const initialCheckups: CheckupRecord[] = [];
export const initialCRMLogs: CRMLog[] = [];
export const initialStockMovements: StockMovement[] = [];
export const initialAuditLogs: AuditLog[] = [];
