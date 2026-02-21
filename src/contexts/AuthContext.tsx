// ==========================================
// Authentication Context
// Single Responsibility: Manages auth state only
// Open/Closed: Auth strategy can be swapped without changing the context
// Dependency Inversion: Storage and credentials are injected abstractions
// ==========================================

"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ── Types ──────────────────────────────────────────────

export type UserRole = 'admin' | 'teacher' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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

// ── Demo Credentials (isolate so they're easy to replace) ──

interface DemoCredential extends User {
  password: string;
}

const DEMO_USERS: Record<string, DemoCredential> = {
  'admin@gmail.com': {
    id: 'admin-001',
    email: 'admin@gmail.com',
    name: 'System Administrator',
    role: 'admin',
    avatar: '/avatars/admin.png',
    department: 'Computer Science & Engineering',
    designation: 'System Admin',
    password: 'admin123',
  },
  'teacher@kuet.ac.bd': {
    id: 'teacher-001',
    email: 'teacher@kuet.ac.bd',
    name: 'Dr. M. M. A. Hashem',
    role: 'teacher',
    avatar: '/avatars/teacher.png',
    department: 'Computer Science & Engineering',
    designation: 'Professor',
    password: 'teacher123',
  },
};

function authenticateDemo(email: string, password: string): LoginResult & { user?: User } {
  const normalizedEmail = email.toLowerCase().trim();
  const credential = DEMO_USERS[normalizedEmail];

  if (!credential) {
    return { success: false, error: 'Invalid email address. Use admin@gmail.com or teacher@kuet.ac.bd' };
  }
  if (credential.password !== password) {
    return { success: false, error: 'Invalid password. Try admin123 or teacher123' };
  }

  const { password: _, ...user } = credential;
  return { success: true, user };
}

// ── Provider ───────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    setUser(loadPersistedUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const result = authenticateDemo(email, password);

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
