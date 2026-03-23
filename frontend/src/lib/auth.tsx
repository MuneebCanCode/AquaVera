'use client';

/**
 * Auth context provider and helpers.
 * Auth is handled entirely by the backend — no Supabase client needed.
 * Tokens are stored in memory and localStorage for persistence across refreshes.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { setAccessToken, api } from './api';
import { clearExploreMode } from './explore';
import type { User } from '@/types';

interface AuthContextValue {
  session: { access_token: string } | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (data: RegisterData) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
  role: string;
  industry?: string;
  water_footprint_liters_annual?: number;
  evm_address?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'aquavera_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const res = await api.get<User>('/auth/me');
    if (res.success && res.data) {
      setUser(res.data);
    } else {
      // Token invalid — clear it
      setUser(null);
      setSession(null);
      setAccessToken(null);
      if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    // Restore token from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        setSession({ access_token: stored });
        setAccessToken(stored);
        fetchUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User; accessToken: string }>('/auth/login', { email, password });
    if (!res.success || !res.data) {
      return { error: res.error?.message || 'Login failed' };
    }
    const token = res.data.accessToken;
    setSession({ access_token: token });
    setAccessToken(token);
    setUser(res.data.user);
    if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
    return {};
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post<User>('/auth/register', data);
    if (!res.success) return { error: res.error?.message || 'Registration failed' };

    // Auto-login after registration
    const loginRes = await api.post<{ user: User; accessToken: string }>('/auth/login', {
      email: data.email,
      password: data.password,
    });
    if (loginRes.success && loginRes.data) {
      const token = loginRes.data.accessToken;
      setSession({ access_token: token });
      setAccessToken(token);
      setUser(loginRes.data.user);
      if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
    }
    return {};
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setSession(null);
    setAccessToken(null);
    clearExploreMode();
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
