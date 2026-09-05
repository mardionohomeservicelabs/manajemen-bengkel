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
    full_name: 'Ardiyanto Wijaya',
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
    full_name: 'Ardiyanto Wijaya',
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
 * Autentikasi user berdasarkan email dan password.
 * Mengembalikan AppUser jika cocok, atau null jika gagal.
 */
export function authenticateUser(email: string, password: string): AppUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  // Dukungan alias login khusus Via Rizkiana (estimator seluruh cabang)
  if (
    (normalizedEmail === 'via@mardiono' ||
      normalizedEmail === 'via@mhs2.mardiono' ||
      normalizedEmail === 'via@estimasi.mardiono') &&
    (password === 'mhs2admin' || password === 'via123' || password === 'admin123')
  ) {
    return {
      id: 'mhs2-estimator-via',
      email: normalizedEmail,
      password: password,
      full_name: 'Via Rizkiana',
      role: 'estimator',
      branch: 'MHS 2',
      canAccessAllBranches: true,
    };
  }

  // Dukungan alias login khusus Mey Wulandari
  if (
    (normalizedEmail === 'mey@mardiono' || normalizedEmail === 'mey@mhs2.mardiono') &&
    (password === 'mhs2sa' || password === 'mey123')
  ) {
    return {
      id: 'mhs2-sa-mey',
      email: normalizedEmail,
      password: password,
      full_name: 'Mey Wulandari',
      role: 'admin',
      branch: 'MHS 2',
    };
  }

  const user = APP_USERS.find(
    (u) =>
      u.email.toLowerCase() === normalizedEmail &&
      u.password === password
  );
  return user || null;
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
