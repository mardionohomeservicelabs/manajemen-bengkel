// ============================================================
// AUTH CONFIG — Data User Per Cabang MHS
// Passwords disimpan sebagai plain text untuk kemudahan operasional
// di lingkungan intranet/LAN bengkel.
// Untuk keamanan lebih tinggi, ganti dengan bcrypt hashing.
// ============================================================

export type BranchId = 'MHS 1' | 'MHS 2' | 'MHS 3';
export type UserRole = 'owner' | 'admin' | 'sa' | 'mekanik' | 'estimator';

export interface AppUser {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  branch: BranchId;
  /** Owner bisa akses semua cabang */
  canAccessAllBranches?: boolean;
}

// ============================================================
// DATA PENGGUNA PER CABANG
// ============================================================
export const APP_USERS: AppUser[] = [
  // ─────────── MHS 1 ───────────
  {
    id: 'mhs1-admin-arida',
    email: 'arida@mhs1.mardiono',
    password: 'mhs1admin',
    full_name: 'Arida',
    role: 'admin',
    branch: 'MHS 1',
  },
  {
    id: 'mhs1-sa-dito',
    email: 'dito@mhs1.mardiono',
    password: 'mhs1sa',
    full_name: 'Dito Ade',
    role: 'sa',
    branch: 'MHS 1',
  },
  {
    id: 'mhs1-mekanik',
    email: 'mekanik@mhs1.mardiono',
    password: 'mhs1mekanik',
    full_name: 'Mekanik MHS 1',
    role: 'mekanik',
    branch: 'MHS 1',
  },
  {
    id: 'mhs1-owner-ardiyanto',
    email: 'ardiyanto@mardiono',
    password: 'owner123',
    full_name: 'ARDIYANTO WIJAYA',
    role: 'owner',
    branch: 'MHS 1',
    canAccessAllBranches: true,
  },

  // ─────────── MHS 2 ───────────
  {
    id: 'mhs2-estimator-via',
    email: 'via@mhs2.mardiono',
    password: 'mhs2admin',
    full_name: 'Via Rizkiana',
    role: 'estimator',
    branch: 'MHS 2',
    canAccessAllBranches: true,
  },
  {
    id: 'global-estimator-via',
    email: 'via@mardiono',
    password: 'via123',
    full_name: 'Via Rizkiana',
    role: 'estimator',
    branch: 'MHS 2',
    canAccessAllBranches: true,
  },
  {
    id: 'mhs2-sa-mey',
    email: 'mey@mhs2.mardiono',
    password: 'mhs2sa',
    full_name: 'Mey Wulandari',
    role: 'admin',
    branch: 'MHS 2',
  },
  {
    id: 'mhs2-mekanik',
    email: 'mekanik@mhs2.mardiono',
    password: 'mhs2mekanik',
    full_name: 'Mekanik MHS 2',
    role: 'mekanik',
    branch: 'MHS 2',
  },
  {
    id: 'mhs2-owner-navira',
    email: 'navira@mardiono',
    password: 'owner456',
    full_name: 'Navira Ilham',
    role: 'owner',
    branch: 'MHS 2',
    canAccessAllBranches: true,
  },

  // ─────────── MHS 3 ───────────
  {
    id: 'mhs3-admin-arida',
    email: 'arida@mhs3.mardiono',
    password: 'mhs3admin',
    full_name: 'Arida',
    role: 'admin',
    branch: 'MHS 3',
  },
  {
    id: 'mhs3-sa-dito',
    email: 'dito@mhs3.mardiono',
    password: 'mhs3sa',
    full_name: 'Dito Ade',
    role: 'sa',
    branch: 'MHS 3',
  },
  {
    id: 'mhs3-mekanik',
    email: 'mekanik@mhs3.mardiono',
    password: 'mhs3mekanik',
    full_name: 'Mekanik MHS 3',
    role: 'mekanik',
    branch: 'MHS 3',
  },
  {
    id: 'mhs3-owner-ardiyanto',
    email: 'ardiyanto3@mardiono',
    password: 'owner789',
    full_name: 'ARDIYANTO WIJAYA',
    role: 'owner',
    branch: 'MHS 3',
    canAccessAllBranches: true,
  },

  // ─────────── AKUN GLOBAL MEKANIK (KEMUDAHAN TESTING) ───────────
  {
    id: 'global-mekanik',
    email: 'mekanik@mardiono',
    password: 'mekanik123',
    full_name: 'Mekanik MHS',
    role: 'mekanik',
    branch: 'MHS 1',
  },
];

// ============================================================
// FUNGSI AUTENTIKASI
// ============================================================

/**
 * Autentikasi user berdasarkan email/username dan password.
 * Mendukung login dengan email lengkap (misal ardiyanto@mardiono) maupun username (misal ardiyanto, navira, arida, dito, mey, via, mekanik).
 * Mengembalikan AppUser jika cocok, atau null jika gagal.
 */
export function authenticateUser(rawEmailOrUsername: string, rawPassword: string): AppUser | null {
  const input = (rawEmailOrUsername || '').trim().toLowerCase();
  const password = (rawPassword || '').trim();

  if (!input || !password) return null;

  // 1. Alias username cepat
  const usernameAliases: Record<string, string[]> = {
    'ardiyanto': ['ardiyanto@mardiono', 'ardiyanto3@mardiono'],
    'owner': ['ardiyanto@mardiono', 'navira@mardiono'],
    'owner1': ['ardiyanto@mardiono'],
    'navira': ['navira@mardiono'],
    'owner2': ['navira@mardiono'],
    'arida': ['arida@mhs1.mardiono', 'arida@mhs3.mardiono'],
    'admin': ['arida@mhs1.mardiono', 'mey@mhs2.mardiono'],
    'admin1': ['arida@mhs1.mardiono'],
    'admin2': ['mey@mhs2.mardiono'],
    'admin3': ['arida@mhs3.mardiono'],
    'dito': ['dito@mhs1.mardiono', 'dito@mhs3.mardiono'],
    'sa': ['dito@mhs1.mardiono', 'mey@mhs2.mardiono'],
    'sa1': ['dito@mhs1.mardiono'],
    'sa2': ['mey@mhs2.mardiono'],
    'sa3': ['dito@mhs3.mardiono'],
    'via': ['via@mardiono', 'via@mhs2.mardiono', 'via@estimasi.mardiono'],
    'estimator': ['via@mardiono', 'via@mhs2.mardiono'],
    'mey': ['mey@mhs2.mardiono', 'mey@mardiono'],
    'mekanik': ['mekanik@mhs1.mardiono', 'mekanik@mhs2.mardiono', 'mekanik@mhs3.mardiono', 'mekanik@mardiono'],
    'mekanik1': ['mekanik@mhs1.mardiono'],
    'mekanik2': ['mekanik@mhs2.mardiono'],
    'mekanik3': ['mekanik@mhs3.mardiono'],
  };

  const candidateEmails: string[] = [input];
  if (usernameAliases[input]) {
    candidateEmails.push(...usernameAliases[input]);
  }
  if (!input.includes('@')) {
    candidateEmails.push(`${input}@mardiono`);
    candidateEmails.push(`${input}@mhs1.mardiono`);
    candidateEmails.push(`${input}@mhs2.mardiono`);
    candidateEmails.push(`${input}@mhs3.mardiono`);
  }

  // 2. Dukungan alias login khusus Via Rizkiana (estimator seluruh cabang)
  const isVia = candidateEmails.some((e) =>
    ['via@mardiono', 'via@mhs2.mardiono', 'via@estimasi.mardiono'].includes(e)
  );
  if (
    isVia &&
    (password === 'mhs2admin' || password === 'via123' || password === 'admin123' || password === 'via')
  ) {
    return {
      id: 'mhs2-estimator-via',
      email: 'via@mardiono',
      password: password,
      full_name: 'Via Rizkiana',
      role: 'estimator',
      branch: 'MHS 2',
      canAccessAllBranches: true,
    };
  }

  // 3. Dukungan alias login khusus Mey Wulandari
  const isMey = candidateEmails.some((e) => ['mey@mardiono', 'mey@mhs2.mardiono'].includes(e));
  if (
    isMey &&
    (password === 'mhs2sa' || password === 'mey123' || password === 'mhs2admin' || password === 'mey')
  ) {
    return {
      id: 'mhs2-sa-mey',
      email: 'mey@mhs2.mardiono',
      password: password,
      full_name: 'Mey Wulandari',
      role: 'admin',
      branch: 'MHS 2',
    };
  }

  // 4. Dukungan fleksibel Owner Ardiyanto
  const isArdiyanto = candidateEmails.some((e) => ['ardiyanto@mardiono', 'ardiyanto3@mardiono'].includes(e));
  if (
    isArdiyanto &&
    (password === 'owner123' || password === 'owner789' || password === 'owner' || password === 'ardiyanto123')
  ) {
    const matched = APP_USERS.find((u) => u.email === 'ardiyanto@mardiono');
    if (matched) return matched;
  }

  // 5. Dukungan fleksibel Owner Navira
  const isNavira = candidateEmails.some((e) => ['navira@mardiono'].includes(e));
  if (
    isNavira &&
    (password === 'owner456' || password === 'owner' || password === 'navira123')
  ) {
    const matched = APP_USERS.find((u) => u.email === 'navira@mardiono');
    if (matched) return matched;
  }

  // 6. Pencocokan langsung pada seluruh user APP_USERS
  for (const emailTry of candidateEmails) {
    const user = APP_USERS.find(
      (u) =>
        u.email.toLowerCase() === emailTry &&
        (u.password === password || u.password.trim() === password)
    );
    if (user) return user;
  }

  return null;
}

/**
 * Mendapatkan semua cabang yang tersedia
 */
export const BRANCHES: BranchId[] = ['MHS 1', 'MHS 2', 'MHS 3'];

/**
 * Label role dalam bahasa Indonesia
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sa: 'Service Advisor',
  mekanik: 'Mekanik',
  estimator: 'Estimator & CRM',
};

/**
 * Pengecekan otorisasi akses Laporan Keuangan:
 * Sesuai instruksi: Yang bisa mengakses laporan keuangan adalah Owner, Mey, Via, dan Arida.
 */
export function canUserAccessFinancialReports(user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  const lowerEmail = (user.email || '').toLowerCase();
  const lowerId = (user.id || '').toLowerCase();
  const lowerName = (user.full_name || '').toLowerCase();
  return (
    lowerEmail.includes('mey') ||
    lowerId.includes('mey') ||
    lowerName.includes('mey') ||
    lowerEmail.includes('via') ||
    lowerId.includes('via') ||
    lowerName.includes('via') ||
    lowerEmail.includes('arida') ||
    lowerId.includes('arida') ||
    lowerName.includes('arida')
  );
}
