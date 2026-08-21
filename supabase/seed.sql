-- ==============================================================================
-- AutoCare Workshop Management System (ACWMS)
-- Seed Data for Supabase (PostgreSQL)
-- ==============================================================================

-- 1. PROFILES
INSERT INTO public.profiles (id, full_name, role, phone) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Budi Santoso (Owner)', 'owner', '081211112222'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Siti Rahmawati (Admin)', 'admin', '081233334444'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Eko Prasetyo (Service Advisor)', 'sa', '081255556666')
ON CONFLICT DO NOTHING;

-- 2. VEHICLES & CUSTOMERS
INSERT INTO public.vehicles_customers (id, customer_name, phone_number, email, address, license_plate, car_brand, car_model, car_year, chassis_number, current_mileage, last_service_date, next_service_due_date) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'Ahmad Fadillah', '081298765432', 'ahmad.f@gmail.com', 'Jl. Tebet Barat No. 12, Jakarta Selatan', 'B 1984 RFS', 'Toyota', 'Avanza 1.3 G M/T', 2020, 'MHFM1BA3JK019283', 45200, '2026-06-15', '2026-09-15'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'Dewi Lestari', '081388776655', 'dewi.lestari@gmail.com', 'Jl. Kalimalang Raya No. 45, Jakarta Timur', 'B 2341 TZA', 'Honda', 'HR-V 1.5 E CVT', 2021, 'MHRRU1850MK882190', 32400, '2026-07-10', '2026-10-10'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'Hendra Gunawan', '081122334455', 'hendra.gun@corp.id', 'Jl. Kelapa Gading Boulevard Blok C1', 'B 8899 HND', 'Mitsubishi', 'Pajero Sport Dakar 4x2', 2022, 'MMBJRKS10NH991201', 58100, '2026-05-20', '2026-08-20'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'Rian Hidayat', '087811229900', 'rian.h@yahoo.com', 'Jl. Margonda No. 101, Depok', 'B 1402 PQM', 'Suzuki', 'All New Ertiga GX A/T', 2019, 'MHYNC32S0KJ441029', 67300, '2026-04-12', '2026-08-15'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'Maya Indah', '085799881122', 'maya.indah@gmail.com', 'Jl. Cempaka Putih Tengah No. 8', 'B 9012 KLP', 'Daihatsu', 'Rocky 1.0 Turbo R', 2023, 'MHKDA2010PK331002', 18900, '2026-08-01', '2026-11-01')
ON CONFLICT DO NOTHING;

-- 3. INVENTORY ITEMS (Spareparts & Jasa)
INSERT INTO public.inventory_items (id, item_code, name, category, is_service, stock_qty, min_stock_alert, unit, buy_price, sell_price, supplier, location_rack) VALUES
-- Oli & Cairan
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'OIL-SYN-5W30', 'Oli Mesin Shell Helix Ultra 5W-30 (1L)', 'oli_cairan', FALSE, 48, 12, 'Liter', 125000, 175000, 'PT Shell Indonesia', 'Rak A1-01'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'OIL-SYN-0W20', 'Oli Mesin Castrol Magnatec 0W-20 (1L)', 'oli_cairan', FALSE, 36, 10, 'Liter', 135000, 185000, 'Distributor Castrol', 'Rak A1-02'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'CLT-RAD-GREEN', 'Air Radiator Coolant Prestone 4L (Hijau)', 'oli_cairan', FALSE, 18, 5, 'Galon', 85000, 125000, 'PT Laris Chandra', 'Rak A2-01'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'BRK-FLD-DOT4', 'Minyak Rem Brembo DOT 4 (500ml)', 'oli_cairan', FALSE, 24, 6, 'Botol', 60000, 95000, 'PT Sumber Berkat', 'Rak A2-02'),

-- AC Parts & Freon
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'AC-FRN-R134A', 'Freon R134a Dupont Suva Original (Isi Ulang)', 'ac_parts', FALSE, 30, 8, 'Kg', 90000, 160000, 'PT Denso Aircon', 'Area AC Tabung 1'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'AC-EXP-UNIV', 'Ekspansi Valve AC Denso Original Avanza/Xenia', 'ac_parts', FALSE, 8, 3, 'Pcs', 175000, 260000, 'PT Denso Sales', 'Rak B1-01'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c07', 'AC-EVA-AVZ', 'Evaporator AC Depan Denso Avanza/Rush', 'ac_parts', FALSE, 4, 2, 'Pcs', 580000, 850000, 'PT Denso Sales', 'Rak B1-03'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c08', 'AC-MAG-HRV', 'Magnetic Clutch AC Honda HR-V 1.5', 'ac_parts', FALSE, 3, 2, 'Set', 420000, 650000, 'Honda Genuine Parts', 'Rak B2-01'),

-- Filter & Perawatan
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', 'FLT-OIL-TYT', 'Filter Oli Toyota Original (Avanza/Innova/Yaris)', 'filter', FALSE, 28, 10, 'Pcs', 32000, 55000, 'Auto2000 Part Shop', 'Rak C1-01'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c10', 'FLT-AIR-HRV', 'Filter Udara Sakura Honda HR-V', 'filter', FALSE, 12, 4, 'Pcs', 65000, 110000, 'Sakura Filterindo', 'Rak C1-04'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'FLT-CAB-CARB', 'Filter Kabin AC Karbon Anti Bakteri Universal', 'filter', FALSE, 15, 5, 'Pcs', 55000, 95000, 'Denso Cabin Filter', 'Rak C2-01'),

-- Mesin & Rem
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'SPK-PLG-IRID', 'Busi Iridium NGK Laser (Set 4 Pcs)', 'mesin', FALSE, 10, 3, 'Set', 280000, 420000, 'PT NGK Busi Indonesia', 'Rak D1-01'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'BRK-PAD-FRT', 'Kampas Rem Depan Bendix GCT Avanza/Xenia', 'rem', FALSE, 7, 3, 'Set', 220000, 340000, 'Bendix Brake Shop', 'Rak D2-01'),

-- Jasa / Labor
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'SRV-TUNEUP-4CYL', 'Jasa Tune Up Lengkap + Carbon Clean 4 Silinder', 'jasa', TRUE, 999, 0, 'Jasa', 0, 350000, '-', '-'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 'SRV-AC-FULL', 'Jasa Servis AC Total (Bongkar Dashboard + Cuci Evaporator)', 'jasa', TRUE, 999, 0, 'Jasa', 0, 650000, '-', '-'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c16', 'SRV-AC-LIGHT', 'Jasa Servis Ringan AC + Fogging Disinfektan Kabin', 'jasa', TRUE, 999, 0, 'Jasa', 0, 200000, '-', '-'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c17', 'SRV-OIL-CHANGE', 'Jasa Ganti Oli Mesin + General Check 20 Titik', 'jasa', TRUE, 999, 0, 'Jasa', 0, 75000, '-', '-'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c18', 'SRV-BRAKE-4W', 'Jasa Servis & Pembersihan Rem 4 Roda', 'jasa', TRUE, 999, 0, 'Jasa', 0, 180000, '-', '-')
ON CONFLICT DO NOTHING;

-- 4. WORK ORDERS (SPK)
INSERT INTO public.work_orders (id, spk_number, vehicle_id, sa_id, mechanic_name, entry_date, complaints, fuel_level, checklist_data, status, notes) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'SPK-20260820-001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Agus Susanto', '2026-08-20 09:15:00+07', 'AC kurang dingin saat macet, tarikan awal terasa berat, bunyi mendecit di area fan belt.', 65, 
'{"engine_oil": "perhatian", "oil_filter": "perhatian", "radiator_coolant": "baik", "battery": "baik", "fan_belt": "kritis", "spark_plugs": "perhatian", "ac_compressor": "baik", "freon_pressure": "perhatian", "ac_condenser": "perhatian", "cabin_filter": "kritis", "blower_motor": "baik", "brake_pads": "baik"}', 
'servicing', 'Mekanik mengonfirmasi fan belt pecah-pecah halus, freon kurang 20 psi.'),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'SPK-20260820-002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Bambang Irawan', '2026-08-20 10:30:00+07', 'Servis rutin berkala 30.000 KM, cek bau apek di AC saat baru dinyalakan.', 80, 
'{"engine_oil": "baik", "oil_filter": "baik", "radiator_coolant": "baik", "battery": "baik", "fan_belt": "baik", "spark_plugs": "baik", "ac_compressor": "baik", "freon_pressure": "baik", "ac_condenser": "baik", "cabin_filter": "kritis", "blower_motor": "perhatian", "brake_pads": "baik"}', 
'estimating', 'Perlu penggantian filter kabin karbon dan fogging disinfektan.'),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'SPK-20260819-005', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Agus Susanto', '2026-08-19 13:00:00+07', 'Ganti oli rutin 60.000 KM dan pembersihan rem 4 roda.', 50, 
'{"engine_oil": "kritis", "oil_filter": "kritis", "radiator_coolant": "baik", "battery": "baik", "fan_belt": "baik", "spark_plugs": "baik", "ac_compressor": "baik", "freon_pressure": "baik", "ac_condenser": "baik", "cabin_filter": "baik", "blower_motor": "baik", "brake_pads": "perhatian"}', 
'completed', 'Pengerjaan selesai tepat waktu. Pelanggan puas.')
ON CONFLICT DO NOTHING;

-- 5. INVOICES
INSERT INTO public.invoices (id, invoice_number, type, work_order_id, vehicle_id, items, subtotal, discount_amount, tax_percent, tax_amount, total_amount, down_payment, balance_due, payment_status, payment_method, paid_at, admin_notes) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'INV-20260819-001', 'invoice', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 
'[
  {"item_id": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01", "code": "OIL-SYN-5W30", "name": "Oli Mesin Shell Helix Ultra 5W-30 (1L)", "is_service": false, "qty": 7, "price": 175000, "subtotal": 1225000},
  {"item_id": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c09", "code": "FLT-OIL-TYT", "name": "Filter Oli Toyota Original", "is_service": false, "qty": 1, "price": 55000, "subtotal": 55000},
  {"item_id": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c17", "code": "SRV-OIL-CHANGE", "name": "Jasa Ganti Oli Mesin + General Check 20 Titik", "is_service": true, "qty": 1, "price": 75000, "subtotal": 75000},
  {"item_id": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c18", "code": "SRV-BRAKE-4W", "name": "Jasa Servis & Pembersihan Rem 4 Roda", "is_service": true, "qty": 1, "price": 180000, "subtotal": 180000}
]',
1535000, 35000, 0, 0, 1500000, 0, 0, 'paid', 'qris', '2026-08-19 16:45:00+07', 'Pembayaran QRIS lunas.');

-- 6. CRM REMINDERS
INSERT INTO public.crm_logs (id, vehicle_id, due_date, reminder_type, status, notes, whatsapp_message) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', '2026-08-15', 'periodic_service', 'pending', 'Sudah 4 bulan sejak servis terakhir, estimasi KM 70.000.', 'Halo Bpk Rian Hidayat, mobil Suzuki Ertiga (B 1402 PQM) Anda sudah waktunya servis berkala.'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', '2026-08-20', 'ac_cleaning', 'contacted', 'Pelanggan dikonfirmasi via WA, merencanakan datang akhir pekan.', 'Halo Bpk Hendra Gunawan, reminder perawatan AC berkala untuk Mitsubishi Pajero (B 8899 HND).'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', '2026-09-15', 'oil_change', 'pending', 'Jadwal ganti oli berikutnya.', 'Halo Bpk Ahmad Fadillah, jadwal ganti oli Avanza (B 1984 RFS) Anda pada September 2026.')
ON CONFLICT DO NOTHING;
