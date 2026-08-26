export type UserRole = 'owner' | 'admin' | 'sa' | 'mekanik';

export type WorkOrderStatus =
  | 'queue'          // Antrean Masuk
  | 'estimating'     // Proses Estimasi
  | 'approved'       // Disetujui Pelanggan
  | 'servicing'      // Dalam Pengerjaan
  | 'waiting_parts'  // Menunggu Sparepart
  | 'completed'      // Selesai
  | 'cancelled';     // Dibatalkan

export type InvoiceType = 'estimation' | 'invoice';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';

export type PaymentMethod =
  | 'cash'
  | 'transfer_bca'
  | 'transfer_mandiri'
  | 'transfer_bri'
  | 'qris'
  | 'debit_card'
  | 'credit_card';

export type CRMStatus = 'pending' | 'contacted' | 'scheduled' | 'declined';

export type StockMovementType =
  | 'in_purchase'
  | 'out_work_order'
  | 'out_manual'
  | 'adjustment_opname';

export type CheckConditionStatus = 'baik' | 'lemah' | 'rusak' | 'buruk' | 'tidak_diperiksa';
export type InspectionPointStatus = 'baik' | 'perhatian' | 'kritis' | 'tidak_diperiksa';

export interface InspectionChecklistData {
  [key: string]: any;
}

export interface ChecklistPointItem {
  no?: number;
  label?: string;
  checked: boolean;
  suggest_replace: boolean;
  notes: string;
}

// 1. QUALITY CONTROL GENERAL CHECKUP (Image 1)
export interface QCGeneralCheckupData {
  document_number: string;
  check_date: string;
  technician_name: string;
  customer_name?: string;
  car_model?: string;
  license_plate: string;
  mileage: number;

  // 1. Kondisi Aki Basa/Kering
  battery_condition: 'baik' | 'buruk' | 'tidak_diperiksa';
  battery_health_percent?: number;
  battery_suggest_replace?: boolean;
  battery_notes?: string;

  // 2. Pembersihan Sensor (Wajib Contact Cleaner)
  sensor_maf_cleaned?: boolean;
  sensor_maf_damaged?: boolean;
  sensor_maf_suggest_replace?: boolean;
  sensor_maf_notes?: string;

  sensor_isc_cleaned?: boolean;
  sensor_isc_damaged?: boolean;
  sensor_isc_suggest_replace?: boolean;
  sensor_isc_notes?: string;

  sensor_airflow_cleaned?: boolean;
  sensor_airflow_damaged?: boolean;
  sensor_airflow_suggest_replace?: boolean;
  sensor_airflow_notes?: string;

  throttle_body_cleaned?: boolean;
  throttle_body_damaged?: boolean;
  throttle_body_suggest_replace?: boolean;
  throttle_body_notes?: string;

  spark_plug_checked?: boolean;
  spark_plug_damaged?: boolean;
  spark_plug_suggest_replace?: boolean;
  spark_plug_notes?: string;

  ignition_coil_checked?: boolean;
  ignition_coil_damaged?: boolean;
  ignition_coil_suggest_replace?: boolean;
  ignition_coil_notes?: string;

  // 3. Checklist Fisik 16 Titik
  filter_udara?: ChecklistPointItem;
  volume_oli_engine?: ChecklistPointItem;
  minyak_rem?: ChecklistPointItem;
  minyak_kopling_transmisi?: ChecklistPointItem;
  minyak_power_steering?: ChecklistPointItem;
  air_radiator_coolant?: ChecklistPointItem;
  vanbelt_engine_ac?: ChecklistPointItem;
  kekencangan_mur_ban?: ChecklistPointItem;
  fungsi_lampu_all?: ChecklistPointItem;
  fungsi_tape_audio?: ChecklistPointItem;
  klakson_horn?: ChecklistPointItem;
  wheldop_velg?: ChecklistPointItem;
  kebersihan_filter_cabin?: ChecklistPointItem;
  tekanan_freon_ac?: ChecklistPointItem;
  kebersihan_interior_plafon_stir?: ChecklistPointItem;
  riset_km_oli_engine?: ChecklistPointItem;

  // BBM Gauge & Technician Signature
  fuel_level_fraction?: string; // 'E', '1/4', '1/2', '3/4', 'F'
  technician_signature_url?: string;

  // Saran Perbaikan (Points 1 - 9)
  improvement_suggestions?: string[];
}

// 2. FORMULIR PEMERIKSAAN AC & PENDINGIN (Image 2)
export interface ACCheckupData {
  document_number: string;
  customer_name: string;
  car_model: string;
  mileage: number;
  license_plate: string;
  check_date: string;
  technician_name: string;
  location_city: string; // e.g. "Sidoarjo"

  // 1. Pemeriksaan Visual & Fisik (Mesin Mati)
  compressor_clutch: CheckConditionStatus;
  drive_belt: CheckConditionStatus;
  condenser_radiator: CheckConditionStatus;
  hoses_pipes: CheckConditionStatus;
  air_coolant: CheckConditionStatus;

  // 2. Pemeriksaan Operasional (AC & Mesin Menyala)
  func_magnetic_clutch: CheckConditionStatus;
  radiator_condenser_fan: CheckConditionStatus;
  blower_airflow: CheckConditionStatus;
  sight_glass_odour: CheckConditionStatus;

  // 3. Pengukuran Parameter Teknis
  air_vent_temperature?: string; // e.g. "6.5 °C"
  low_pressure_psi?: string; // e.g. "30 Psi"
  high_pressure_psi?: string; // e.g. "200 Psi"
  cabin_filter_condition: CheckConditionStatus;
  evaporator_drain_condition: CheckConditionStatus;

  // Rekomendasi Tindakan / Catatan Tambahan
  recommendations?: string;

  // Signatures
  customer_signature_url?: string;
  technician_signature_url?: string;
}

// 3. FORM KELUHAN UNDERSTEEL (Kaki-Kaki & Suspensi)
export interface UndersteelPointItem {
  no: number;
  label: string;
  sub_label?: string;
  replace: boolean; // DIGANTI
  service: boolean; // SERVICE
  notes: string;    // KETERANGAN
}

export interface UndersteelCheckupData {
  document_number: string;
  check_date: string;
  technician_name: string;
  customer_name?: string;
  license_plate: string;
  car_brand?: string;
  car_model?: string;
  car_year?: number;
  car_color?: string;
  mileage?: number;
  items: UndersteelPointItem[];
  custom_items?: { label: string; replace: boolean; service: boolean; notes: string }[];
  technicians_assigned?: string[]; // Mekanik 1, 2, 3
  mechanic_signature_url?: string;
}

export type CheckupType = 'qc_general' | 'ac_specialist' | 'understeel';

export interface CheckupRecord {
  id: string;
  type: CheckupType;
  document_number: string;
  work_order_id?: string;
  vehicle_id?: string;
  customer_name: string;
  license_plate: string;
  car_model: string;
  technician_name: string;
  check_date: string;
  qc_data?: QCGeneralCheckupData;
  ac_data?: ACCheckupData;
  understeel_data?: UndersteelCheckupData;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  user_id?: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  created_at?: string;
}

export interface VehicleCustomer {
  id: string;
  customer_name: string;
  phone_number: string;
  email?: string;
  address?: string;
  license_plate: string;
  car_brand: string;
  car_model: string;
  car_year?: number;
  engine_number?: string;
  chassis_number?: string;
  current_mileage: number;
  last_service_date?: string;
  next_service_due_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  category: 'oli_cairan' | 'ac_parts' | 'mesin' | 'rem' | 'filter' | 'jasa' | 'lainnya';
  is_service: boolean;
  stock_qty: number;
  min_stock_alert: number;
  unit: string;
  buy_price: number; // HPP (Owner only)
  sell_price: number;
  supplier?: string;
  location_rack?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorkOrder {
  id: string;
  spk_number: string;
  vehicle_id: string;
  sa_id?: string;
  mechanic_name?: string;
  entry_date: string;
  finish_date?: string;
  complaints: string;
  fuel_level?: number;
  notes?: string;

  // 3 Digital Signatures
  signature_customer_url?: string;
  signature_mechanic_url?: string;
  signature_sa_url?: string;

  source_info?: string;
  vehicle_status?: string;
  received_at_branch?: string; // MHS 1 | MHS 2 | MHS 3

  status: WorkOrderStatus;
  created_at?: string;
  updated_at?: string;

  // Joined fields
  vehicle?: VehicleCustomer;
  sa_profile?: Profile;
}

export interface InvoiceItem {
  item_id?: string; // Optional for custom on-the-fly items
  code?: string;
  name: string;
  is_service: boolean;
  is_custom?: boolean;
  qty: number;
  unit?: string; // 'SET', 'PCS', 'LTR', 'UNIT', 'JASA', 'BOTOL', 'PAKET', etc.
  /** Unit price — kept for backward compatibility with legacy single-price data */
  price: number | string;
  buy_price?: number; // HPP for profit analytics
  /** Subtotal — kept for backward compatibility */
  subtotal: number | string;

  // --- Multi-Option (Opsi 1 & Opsi 2 per row) ---
  price_opsi1?: number | string;
  total_opsi1?: number | string;
  price_opsi2?: number | string;
  total_opsi2?: number | string;
  discount_percent?: number;
  discount_nominal?: number;

  // --- Price Range (Min–Max) ---
  /** Minimum unit price. If set, price range mode is active. */
  price_min?: number;
  /** Maximum unit price. Defaults to price_min if omitted (i.e., a fixed price). */
  price_max?: number;
  /** Qty × price_min */
  subtotal_min?: number;
  /** Qty × price_max */
  subtotal_max?: number;

  // --- Option 1 / Option 2 legacy grouping ---
  /** Which option this row belongs to. Undefined = no option grouping. */
  option_label?: 'opsi1' | 'opsi2';
  /** Shared UUID grouping Opsi 1 & Opsi 2 rows together */
  option_group?: string;
  /** Whether this option row is the selected/active one for total calculation */
  is_active_option?: boolean;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  type: InvoiceType;
  work_order_id?: string;
  vehicle_id: string;
  items: InvoiceItem[];
  subtotal: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  down_payment: number;
  balance_due: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  paid_at?: string;
  admin_notes?: string;
  signature_customer_url?: string;
  signature_admin_url?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;

  // --- Estimasi Biaya Spesifik Sesuai UI ---
  estimation_type?: string; // 'Umum', 'Estimasi Awal', 'Estimasi Tambahan', dll.
  estimation_tab?: string; // Identifier tab ('Umum', 'Tab 2', dll.)
  estimation_date?: string; // Tanggal format 'YYYY-MM-DD' atau 'DD/MM/YYYY'
  estimation_time?: string; // Jam format 'HH:mm'
  vehicle_status?: string; // 'Ditinggal' | 'Ditunggu' | 'Derek / Towing' | 'Home Service'
  payment_plan?: string; // 'Transfer' | 'Cash' | 'QRIS' | 'Debit' | 'Tempo'
  has_discount?: boolean;
  has_opsi2?: boolean;
  has_tax?: boolean;
  total_opsi1?: number;
  total_opsi2?: number;

  // --- Digital Signature & Customer Approval ---
  customer_signature?: string; // Base64 data URL
  customer_signed_at?: string; // ISO Timestamp
  customer_signed_name?: string;
  customer_approved_option?: 'opsi1' | 'opsi2';
  ttd_status?: 'pending' | 'signed' | 'declined';
  ttd_token?: string;

  // Joined fields
  vehicle?: VehicleCustomer;
  work_order?: WorkOrder;
}

export interface StockMovement {
  id: string;
  item_id: string;
  item_name?: string;
  movement_type: StockMovementType;
  qty_change: number;
  stock_before: number;
  stock_after: number;
  reference_number?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface CRMLog {
  id: string;
  vehicle_id: string;
  last_service_id?: string;
  due_date: string;
  reminder_type: 'periodic_service' | 'ac_cleaning' | 'oil_change' | 'general_check';
  status: CRMStatus;
  contacted_at?: string;
  scheduled_date?: string;
  notes?: string;
  whatsapp_message?: string;
  created_at?: string;
  updated_at?: string;

  // Joined fields
  vehicle?: VehicleCustomer;
}

export interface WorkshopSettings {
  id: string;
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logo_url?: string;
  bank_account_info: string;
  terms_conditions: string;
  wa_template_reminder: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  user_name: string;
  user_role: UserRole;
  action: string;
  target_table: string;
  target_id?: string;
  details?: Record<string, any>;
  created_at: string;
}
