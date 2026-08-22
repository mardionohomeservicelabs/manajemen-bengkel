'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppUser, authenticateUser, BranchId } from '../auth/users';

const AUTH_STORAGE_KEY = 'acwms_auth_v2';

interface AuthContextType {
  currentUser: AppUser | null;
  activeBranch: BranchId;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  setActiveBranch: (branch: BranchId) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface StoredAuth {
  user: AppUser;
  activeBranch: BranchId;
  timestamp: number;
}

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 jam

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeBranch, setActiveBranchState] = useState<BranchId>('MHS 1');
  const [isLoading, setIsLoading] = useState(true);

  // Load session dari localStorage saat mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: StoredAuth = JSON.parse(stored);
        const now = Date.now();
        // Cek apakah session masih valid (12 jam)
        if (parsed.user && (now - parsed.timestamp) < SESSION_DURATION_MS) {
          setCurrentUser(parsed.user);
          setActiveBranchState(parsed.activeBranch || parsed.user.branch);
        } else {
          // Session expired
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    (email: string, password: string): { success: boolean; error?: string } => {
      const user = authenticateUser(email, password);
      if (!user) {
        return { success: false, error: 'Email atau password salah. Silakan coba lagi.' };
      }

      const branch = user.branch;
      setCurrentUser(user);
      setActiveBranchState(branch);

      const stored: StoredAuth = {
        user,
        activeBranch: branch,
        timestamp: Date.now(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));

      return { success: true };
    },
    []
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('acwms_role');
  }, []);

  const setActiveBranch = useCallback(
    (branch: BranchId) => {
      if (!currentUser?.canAccessAllBranches) return;
      setActiveBranchState(branch);
      // Update stored session
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: StoredAuth = JSON.parse(stored);
        parsed.activeBranch = branch;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      }
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeBranch,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        logout,
        setActiveBranch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
