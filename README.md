# Sistem Manajemen Bengkel & Spesialis AC Mobil (AutoCare)

Aplikasi manajemen operasional bengkel modern berbasis web yang dibangun dengan Next.js 15, TypeScript, Tailwind CSS, dan Supabase. Dirancang khusus untuk mempermudah alur kerja bengkel dari penerimaan kendaraan, checkup fisik & AC, pembuatan SPK, estimasi biaya, kasir / invoice, CRM pelanggan, hingga laporan keuangan.

## 🚀 Fitur Utama

- **📊 Dashboard Interaktif**: Ringkasan omzet harian, antrean aktif, unit selesai, stok menipis, dan grafik performa bengkel.
- **🚗 Manajemen Antrean & Kendaraan**: Pantau status servis kendaraan (Menunggu, Dikerjakan, Selesai, Dibatalkan) secara real-time.
- **🔍 Checkup Digital**:
  - General Checkup (Mesin, Rem, Kelistrikan, Kaki-kaki, Ban, Fluida).
  - AC Checkup Khusus (Tekanan Low/High, Suhu Blower, Kompresor, Kondensor, Evaporator, Filter Kabin).
- **📋 Surat Perintah Kerja (SPK)**: Pembuatan SPK resmi dengan checklist pengerjaan, estimasi waktu, tanda tangan digital teknisi & pelanggan.
- **💰 Estimasi Biaya**: Kalkulasi otomatis jasa & spare part, diskon, PPN, dan opsi cetak format surat penawaran resmi.
- **💳 Kasir & Invoice (POS)**: Multi-metode pembayaran (Cash, Transfer, QRIS, Debit), cetak invoice / struk resmi, update status pembayaran.
- **📦 Inventaris & Stok Spare Part**: Manajemen stok barang, harga modal/jual, peringatan minimum stok, log mutasi barang.
- **👥 CRM & Pengingat Servis**: Database pelanggan, riwayat servis per nopol, integrasi reminder WhatsApp otomatis (servis berkala, ganti oli, servis AC).
- **📈 Laporan Keuangan**: Laporan laba/rugi, pendapatan jasa vs part, ringkasan transaksi kasir per periode.
- **⚙️ Pengaturan Profil Bengkel**: Kustomisasi nama bengkel, alamat, logo, kontak, kop surat resmi, dan rekening pembayaran.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database & Backend**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Komponen Interaktif**: Canvas Confetti, Digital Signature Pad, Printable Official Document Templates

## 📦 Panduan Instalasi Lokal

1. **Clone repositori**:
   ```bash
   git clone https://github.com/mardionohomeservicelabs/manajemen-bengkel.git
   cd manajemen-bengkel
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin file `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Isi konfigurasi Supabase Anda:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_WORKSHOP_NAME="AutoCare Workshop & Car AC Specialist"
   NEXT_PUBLIC_WORKSHOP_PHONE="081234567890"
   NEXT_PUBLIC_WORKSHOP_ADDRESS="Jl. Otista Raya No. 88, Jakarta Timur"
   ```

4. **Setup Database**:
   Jalankan query yang ada di folder `supabase/schema.sql` dan `supabase/seed.sql` pada SQL Editor Supabase project Anda.

5. **Jalankan server pengembangan**:
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

## 🌐 Panduan Deploy ke Vercel

1. Buka [Vercel](https://vercel.com/) dan login.
2. Klik **Add New...** -> **Project**.
3. Hubungkan akun GitHub Anda dan pilih repositori `mardionohomeservicelabs/manajemen-bengkel`.
4. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WORKSHOP_NAME`
   - `NEXT_PUBLIC_WORKSHOP_PHONE`
   - `NEXT_PUBLIC_WORKSHOP_ADDRESS`
5. Klik **Deploy**.

## 📄 Lisensi

Distributed under the MIT License.
# Manajemen-Bengkel-Mobil
# Manajemen-Bengkel-Mobil
# Manajemen-Bengkel-Mobil
