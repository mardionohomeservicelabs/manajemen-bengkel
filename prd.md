# Product Requirement Document (PRD)

**Project Name:** AutoCare Workshop Management System (ACWMS)

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL, Auth, Storage), Tailwind CSS, Vercel Deployment

**Theme:** Professional Maroon (`#800000` / `#4A0404` accents, crisp neutral slate background)

---

## 1. Project Overview & Role-Based Access Control (RBAC)

Sistem berbasis web untuk mendigitalkan alur operasional bengkel mobil mulai dari intake kendaraan, inspeksi teknis, estimasi biaya, inventaris suku cadang, penagihan, hingga retensi pelanggan (CRM).

### Role Hierarchy & Matrix Akses

| Fitur / Modul | Service Advisor (SA) | Admin | Owner |
| --- | --- | --- | --- |
| Buat SPK & Checklist Inspeksi (Tanda Tangan) | Ya | Lihat Saja | Ya |
| Buat Estimasi Biaya & Kirim PDF/WA | Tidak | Ya (Read-only Price) | Ya (Full Edit) |
| Manajemen Stok & Update Harga Sparepart | Tidak | Lihat Saja | Ya |
| Buat Nota Transaksi & Histori Penjualan | Tidak | Ya (Tanpa Ubah Harga) | Ya (Full Access) |
| Modul CRM & Follow-up Log | Tidak | Ya | Ya |
| Laporan Keuangan & Audit Log Global | Tidak | Tidak | Ya |

---

## 2. Core Functional Modules

### A. Reception, Digital SPK & Technical Inspection Checklist

* **Vehicle & Customer Intake:** Input data pelanggan, identitas kendaraan (Plat, No Rangka, KM), dan keluhan.
* **Touchscreen/Canvas Signature:** Tanda tangan digital pelanggan langsung di antarmuka web.
* **Technical Inspection Points:** Checklist interaktif area mesin dan AC mobil (kondisi kompresor, freon, belt, oli mesin, radiator, dll.) beserta catatan mekanik.
* **PDF Output:** Otomatis menghasilkan **Dokumen SPK & Lembar Hasil Inspeksi (PDF)** berlogo bengkel, siap dicetak atau dikirim via WhatsApp API/Web Share.

### B. Estimasi Biaya & Antrean Servis

* **Queue Board:** Visualisasi antrean servis berdasarkan status (*Waiting Estimate*, *In Progress*, *Waiting Parts*, *Done*).
* **Cost Estimation Builder:** Pemilihan item jasa dan sparepart dengan rincian biaya estimasi.
* **Customer Approval Slip (PDF):** Dokumen estimasi resmi berformat PDF untuk konfirmasi persetujuan pengerjaan oleh pemilik kendaraan.

### C. Inventory & Sparepart Management

* **Stock Movement:** Pencatatan stok masuk (Purchase/Restock) dan stok keluar (terpakai otomatis via nota/manual).
* **Stock Opname:** Fitur rekonsiliasi fisik vs data sistem dengan riwayat selisih (discrepancy log).
* **Dynamic Price Master:** Pembaruan harga beli (HPP) dan harga jual dinamis yang terkontrol (hanya Owner).

### D. Billing & Invoicing (Nota Servis)

* **Manual/Final Invoice Builder:** Penarikan item dari estimasi yang disetujui atau input manual item perbaikan final.
* **Role Lock:** Admin hanya dapat memilih item dengan harga yang sudah terkunci di database tanpa akses manipulasi nominal satuan.
* **Struk & Nota PDF:** Format cetak nota standar A4/Thermal invoice.

### E. Archive & Database History

* **Separated Data Views:** Tab terpisah antara **Histori Surat Perintah Kerja (SPK)** dan **Histori Nota & Pembayaran**.
* **Global Search & Filter:** Filter berdasarkan plat nomor, rentang tanggal, status pengerjaan, dan nama pelanggan.

### F. CRM & Service Reminder Engine

* **Automated Reminder Scheduler:** Identifikasi otomatis kendaraan yang mendekati jadwal servis berkala (berdasarkan interval waktu 3/6 bulan atau estimasi KM).
* **Follow-up Action Center:** Tombol kirim pesan WhatsApp templated langsung ke customer.
* **Contacted Log:** Status pelacakan (*Belum Dihubungi*, *Sudah Dihubungi*, *Booking Dibuat*, *Ditolak*).

---

## 3. Database Schema Blueprint (Supabase)

```
profiles
├── id (UUID, PK, references auth.users)
├── role (ENUM: 'owner', 'admin', 'sa')
└── full_name (TEXT)

vehicles & customers
├── id (UUID, PK)
├── customer_name (TEXT)
├── phone_number (TEXT)
├── license_plate (TEXT, UNIQUE)
├── car_model (TEXT)
└── current_mileage (INT)

work_orders (SPK)
├── id (UUID, PK)
├── vehicle_id (UUID, FK)
├── sa_id (UUID, FK)
├── complaints (TEXT)
├── checklist_data (JSONB)
├── signature_url (TEXT)
└── status (ENUM: 'queue', 'estimating', 'servicing', 'completed', 'cancelled')

inventory_items
├── id (UUID, PK)
├── item_code (TEXT, UNIQUE)
├── name (TEXT)
├── stock_qty (INT)
├── buy_price (NUMERIC)
└── sell_price (NUMERIC)

invoices & estimations
├── id (UUID, PK)
├── type (ENUM: 'estimation', 'invoice')
├── work_order_id (UUID, FK)
├── items (JSONB: [{item_id, name, qty, price, subtotal}])
├── total_amount (NUMERIC)
└── payment_status (ENUM: 'pending', 'paid')

crm_logs
├── id (UUID, PK)
├── vehicle_id (UUID, FK)
├── due_date (DATE)
├── contacted_at (TIMESTAMPTZ)
├── status (ENUM: 'pending', 'contacted', 'scheduled')
└── notes (TEXT)

```

---

## 4. UI/UX & Design System

* **Color Palette:** Primary Maroon (`#800000`), Dark Crimson Accent (`#4A0404`), Surface Neutral (`#F8FAFC`), Card Background (`#FFFFFF`), Border Slate (`#E2E8F0`).
* **Design Philosophy:** Antarmuka responsif ramah tablet (untuk SA saat inspeksi fisik mobil) dan desktop (untuk workstation Admin/Owner).

---

Apakah struktur alur kerja dan skema data dalam PRD ini sudah sesuai dengan kebutuhan operasional bengkel Anda, atau ada modul tambahan yang ingin disesuaikan sebelum masuk ke tahap implementasi kode?