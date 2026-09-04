const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Baca file backup yang sudah diekspor
const backupData = JSON.parse(fs.readFileSync('supabase_backup_clean.json', 'utf8'));

// Ambil URL dan KEY dari argumen CLI atau environment
const targetUrl = process.argv[2];
const targetKey = process.argv[3];

if (!targetUrl || !targetKey) {
  console.error('Usage: node scripts/migrate_to_new_supabase.js <NEW_SUPABASE_URL> <NEW_SUPABASE_ANON_KEY>');
  process.exit(1);
}

const supabase = createClient(targetUrl, targetKey);

async function migrate() {
  console.log('🚀 Memulai migrasi data ke Supabase Baru:', targetUrl);

  // 1. Masukkan data vehicles_customers
  if (backupData.vehicles_customers && backupData.vehicles_customers.length > 0) {
    console.log(`Mengimpor ${backupData.vehicles_customers.length} kendaraan & pelanggan...`);
    const { error } = await supabase.from('vehicles_customers').upsert(backupData.vehicles_customers, { onConflict: 'license_plate' });
    if (error) {
      console.error('❌ Error vehicles_customers:', error.message);
    } else {
      console.log('✅ vehicles_customers berhasil diimpor!');
    }
  }

  // 2. Masukkan data work_orders (SPK)
  if (backupData.work_orders && backupData.work_orders.length > 0) {
    console.log(`Mengimpor ${backupData.work_orders.length} work orders (SPK)...`);
    const { error } = await supabase.from('work_orders').upsert(backupData.work_orders, { onConflict: 'spk_number' });
    if (error) {
      console.error('❌ Error work_orders:', error.message);
    } else {
      console.log('✅ work_orders berhasil diimpor!');
    }
  }

  // 3. Masukkan data settings jika ada
  if (backupData.workshop_settings && backupData.workshop_settings.length > 0) {
    console.log('Mengimpor pengaturan bengkel...');
    const { error } = await supabase.from('workshop_settings').upsert(backupData.workshop_settings);
    if (!error) console.log('✅ workshop_settings berhasil diimpor!');
  }

  console.log('🎉 Migrasi data selesai dengan sukses!');
}

migrate();
