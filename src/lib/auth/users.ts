// ============================================================
// AUTH CONFIG — Data User Per Cabang MHS
// Passwords disimpan sebagai plain text untuk kemudahan operasional
// di lingkungan intranet/LAN bengkel.
// Untuk keamanan lebih tinggi, ganti dengan bcrypt hashing.
// ============================================================

export type BranchId = 'MHS 1' | 'MHS 2' | 'MHS 3';
export type UserRole = 'owner' | 'admin' | 'sa' | 'mekanik';

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
    id: 'mhs1-mekanik-agus',
    email: 'mekanik@mhs1.mardiono',
    password: 'mhs1mekanik',
    full_name: 'Agus Susanto',
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
    id: 'mhs2-admin-via',
    email: 'via@mhs2.mardiono',
    password: 'mhs2admin',
    full_name: 'Via Rizkiana',
    role: 'admin',
    branch: 'MHS 2',
  },
  {
    id: 'mhs2-sa-mey',
    email: 'mey@mhs2.mardiono',
    password: 'mhs2sa',
    full_name: 'Mey Wulandari',
    role: 'sa',
    branch: 'MHS 2',
  },
  {
    id: 'mhs2-mekanik-budi',
    email: 'mekanik@mhs2.mardiono',
    password: 'mhs2mekanik',
    full_name: 'Budi Santoso',
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

  // ─────────── MHS 3 (susunan sama dengan MHS 1) ───────────
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
    id: 'mhs3-mekanik-agus',
    email: 'mekanik@mhs3.mardiono',
    password: 'mhs3mekanik',
    full_name: 'Agus Susanto',
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
    full_name: 'Mekanik Servis',
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
};
