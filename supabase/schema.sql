-- ==============================================================================
-- AutoCare Workshop Management System (ACWMS)
-- Database Schema for Supabase (PostgreSQL)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE work_order_status AS ENUM ('queue', 'estimating', 'approved', 'servicing', 'waiting_parts', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM ('estimation', 'invoice');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'transfer_bca', 'transfer_mandiri', 'transfer_bri', 'qris', 'debit_card', 'credit_card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crm_status AS ENUM ('pending', 'contacted', 'scheduled', 'declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM ('in_purchase', 'out_work_order', 'out_manual', 'adjustment_opname');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (References Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE, -- REFERENCES auth.users(id) ON DELETE CASCADE
    role user_role NOT NULL DEFAULT 'sa',
    full_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VEHICLES & CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.vehicles_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    address TEXT,
    license_plate TEXT NOT NULL UNIQUE,
    car_brand TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_year INT,
    engine_number TEXT,
    chassis_number TEXT, -- No Rangka
    current_mileage INT NOT NULL DEFAULT 0,
    last_service_date DATE,
    next_service_due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_plate ON public.vehicles_customers(license_plate);
CREATE INDEX IF NOT EXISTS idx_customer_phone ON public.vehicles_customers(phone_number);

-- 5. INVENTORY ITEMS (Spareparts & Service Master)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'oli_cairan', 'ac_parts', 'mesin', 'rem', 'filter', 'jasa', 'lainnya'
    is_service BOOLEAN NOT NULL DEFAULT FALSE, -- True if labor/service item
    stock_qty INT NOT NULL DEFAULT 0,
    min_stock_alert INT NOT NULL DEFAULT 5,
    unit TEXT NOT NULL DEFAULT 'Pcs', -- 'Pcs', 'Liter', 'Set', 'Jasa'
    buy_price NUMERIC(15, 2) NOT NULL DEFAULT 0, -- HPP (Hanya Owner)
    sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    supplier TEXT,
    location_rack TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_code ON public.inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_item_category ON public.inventory_items(category);

-- 6. WORK ORDERS (SPK - Surat Perintah Kerja)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spk_number TEXT NOT NULL UNIQUE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles_customers(id) ON DELETE RESTRICT,
    sa_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mechanic_name TEXT,
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finish_date TIMESTAMPTZ,
    complaints TEXT NOT NULL,
    fuel_level INT DEFAULT 50, -- Percentage (0-100)
    checklist_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Technical Engine & AC checklist
    signature_url TEXT, -- Data URL or Supabase Storage URL
    status work_order_status NOT NULL DEFAULT 'queue',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spk_number ON public.work_orders(spk_number);
CREATE INDEX IF NOT EXISTS idx_spk_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_spk_vehicle ON public.work_orders(vehicle_id);

-- 7. ESTIMATIONS & INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    type invoice_type NOT NULL DEFAULT 'invoice', -- 'estimation' or 'invoice'
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles_customers(id) ON DELETE RESTRICT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{item_id, code, name, is_service, qty, price, subtotal}]
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0, -- PPN (e.g. 11%)
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    down_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method payment_method,
    paid_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_work_order ON public.invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_status ON public.invoices(payment_status);

-- 8. STOCK MOVEMENTS & OPNAME LOGS
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type stock_movement_type NOT NULL,
    qty_change INT NOT NULL, -- Positive for IN, Negative for OUT
    stock_before INT NOT NULL,
    stock_after INT NOT NULL,
    reference_number TEXT, -- SPK number, Purchase Invoice, or Opname ID
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);

-- 9. CRM & SERVICE REMINDER LOGS
CREATE TABLE IF NOT EXISTS public.crm_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles_customers(id) ON DELETE CASCADE,
    last_service_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    reminder_type TEXT NOT NULL DEFAULT 'periodic_service', -- 'periodic_service', 'ac_cleaning', 'oil_change'
    status crm_status NOT NULL DEFAULT 'pending',
    contacted_at TIMESTAMPTZ,
    scheduled_date DATE,
    notes TEXT,
    whatsapp_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_due_date ON public.crm_logs(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_status ON public.crm_logs(status);

-- 10. WORKSHOP SETTINGS
CREATE TABLE IF NOT EXISTS public.workshop_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Mardiono Home Service',
    phone TEXT NOT NULL DEFAULT '0812-3076-2930',
    email TEXT DEFAULT 'mardionoohomeservice@gmail.com',
    address TEXT NOT NULL DEFAULT 'Jl. Perum Beringin Indah No.D - 19, Bringin Kulon, Bringinbendo, Taman, Sidoarjo',
    logo_url TEXT DEFAULT '/header-banner.png',
    bank_account_info TEXT DEFAULT 'BCA: 541-098-7711 a.n Mardiono\nMandiri: 124-00-9876543-1 a.n Mardiono Home Service',
    terms_conditions TEXT DEFAULT 'Garansi servis & AC berlaku 1 bulan atau 1.000 KM mana yang tercapai lebih dulu. Nota ini adalah bukti sah pembayaran.',
    wa_template_reminder TEXT DEFAULT 'Halo Bpk/Ibu [Customer], mobil [Mobil] ([Plat]) sudah mendekati jadwal servis berkala pada [Tanggal]. Kunjungi Mardiono Home Service untuk menjaga performa mobil Anda tetap prima. Hubungi kami untuk reservasi!',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AUDIT LOGS (Owner Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_name TEXT NOT NULL,
    user_role user_role NOT NULL,
    action TEXT NOT NULL, -- 'CREATE_SPK', 'UPDATE_PRICE', 'STOCK_OPNAME', 'FINALIZE_INVOICE', etc.
    target_table TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DO $$ BEGIN
    CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    CREATE TRIGGER update_vehicles_modtime BEFORE UPDATE ON public.vehicles_customers FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    CREATE TRIGGER update_items_modtime BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    CREATE TRIGGER update_spk_modtime BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    CREATE TRIGGER update_invoices_modtime BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    CREATE TRIGGER update_crm_modtime BEFORE UPDATE ON public.crm_logs FOR EACH ROW EXECUTE FUNCTION update_modified_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 13. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (or anon with public key for demo/workshop intranet)
CREATE POLICY "Public read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.profiles FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.vehicles_customers FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.vehicles_customers FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.inventory_items FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.work_orders FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.work_orders FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.invoices FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.stock_movements FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.crm_logs FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.crm_logs FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.workshop_settings FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.workshop_settings FOR ALL USING (true);

CREATE POLICY "Public read access" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Public write access" ON public.audit_logs FOR ALL USING (true);
