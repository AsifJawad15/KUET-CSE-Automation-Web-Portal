// ==========================================
// Authentication Context
// Single Responsibility: Manages auth state only
// Open/Closed: Auth strategy can be swapped without changing the context
// Dependency Inversion: Storage and credentials are injected abstractions
// ==========================================

"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ── Types ──────────────────────────────────────────────

export type UserRole = 'admin' | 'teacher' | 'head' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: {
    all?: boolean;
    menus?: string[];
    source?: string;
  } | null;
  avatar?: string;
  department?: string;
  designation?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

// ── Storage Abstraction ────────────────────────────────

const STORAGE_KEY = 'kuet_user';

function persistUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function loadPersistedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearPersistedUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function isWebUserRole(role: unknown): role is Exclude<UserRole, null> {
  return role === 'admin' || role === 'teacher' || role === 'head';
}

async function restoreVerifiedUser(): Promise<User | null> {
  const persistedUser = loadPersistedUser();

  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    const sessionUser = payload?.success ? payload.data : null;

    if (!response.ok || !sessionUser || !isWebUserRole(sessionUser.role)) {
      clearPersistedUser();
      return null;
    }

    const verifiedUser: User = {
      ...(persistedUser?.id === sessionUser.id ? persistedUser : {}),
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      role: sessionUser.role,
      permissions: sessionUser.permissions ?? null,
    };
    persistUser(verifiedUser);
    return verifiedUser;
  } catch {
    clearPersistedUser();
    return null;
  }
}

// ── Database Authentication ────────────────────────────

async function authenticateViaAPI(email: string, password: string): Promise<LoginResult & { user?: User }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Invalid email or password' };
    }

    const data = json.data;
    return {
      success: true,
      user: {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as UserRole,
        permissions: data.permissions ?? null,
        department: data.department,
        designation: data.designation,
      },
    };
  } catch {
    return { success: false, error: 'Unable to connect to server. Please try again.' };
  }
}

// ── Provider ───────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore browser display state only after the signed server session is valid.
  // localStorage alone is not proof that the HttpOnly session still exists.
  useEffect(() => {
    let active = true;

    void restoreVerifiedUser().then((verifiedUser) => {
      if (!active) return;
      setUser(verifiedUser);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);

    const result = await authenticateViaAPI(email, password);

    if (result.success && result.user) {
      setUser(result.user);
      persistUser(result.user);
    }

    setIsLoading(false);
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearPersistedUser();
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  }), [user, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
