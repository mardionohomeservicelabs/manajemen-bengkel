const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function backup() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (fs.existsSync('.env.local')) {
      const env = fs.readFileSync('.env.local', 'utf8');
      const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
      const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
      if (urlMatch) url = urlMatch[1].trim();
      if (keyMatch) key = keyMatch[1].trim();
    }
  }

  if (!url || !key) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan.');
    process.exit(1);
  }

  console.log('🔄 Menghubungi Supabase database di:', url);
  const supabase = createClient(url, key);

  try {
    const { data: vehicles, error: vErr } = await supabase.from('vehicles_customers').select('*');
    if (vErr) throw vErr;

    const { data: workOrders, error: wErr } = await supabase.from('work_orders').select('*');
    if (wErr) throw wErr;

    const { data: invoices, error: iErr } = await supabase.from('invoices').select('*');
    if (iErr) throw iErr;

    const { data: settings, error: sErr } = await supabase.from('workshop_settings').select('*');
    if (sErr) throw sErr;

    const backupData = {
      timestamp: new Date().toISOString(),
      vehicles_customers: vehicles || [],
      work_orders: workOrders || [],
      invoices: invoices || [],
      workshop_settings: settings || []
    };

    fs.writeFileSync('supabase_backup_current.json', JSON.stringify(backupData, null, 2), 'utf8');
    console.log('✅ Backup berhasil diperbarui di supabase_backup_current.json');
    console.log(`📊 Total: ${backupData.vehicles_customers.length} kendaraan, ${backupData.work_orders.length} SPK, ${backupData.invoices.length} invoices/estimasi.`);
  } catch (err) {
    console.error('❌ Gagal melakukan backup:', err.message);
  }
}

backup();
