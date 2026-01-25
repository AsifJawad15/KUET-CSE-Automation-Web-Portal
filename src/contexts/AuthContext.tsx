// ==========================================
// Authentication Context
// Handles user authentication state and role management
// ==========================================

"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Static user credentials for demo
const DEMO_USERS = {
  'admin@gmail.com': {
    id: 'admin-001',
    email: 'admin@gmail.com',
    name: 'System Administrator',
    role: 'admin' as UserRole,
    avatar: '/avatars/admin.png',
    department: 'Computer Science & Engineering',
    designation: 'System Admin',
    password: 'admin123',
  },
  'teacher@kuet.ac.bd': {
    id: 'teacher-001',
    email: 'teacher@kuet.ac.bd',
    name: 'Dr. M. M. A. Hashem',
    role: 'teacher' as UserRole,
    avatar: '/avatars/teacher.png',
    department: 'Computer Science & Engineering',
    designation: 'Professor',
    password: 'teacher123',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('kuet_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('kuet_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const normalizedEmail = email.toLowerCase().trim();
    const demoUser = DEMO_USERS[normalizedEmail as keyof typeof DEMO_USERS];
    
    if (!demoUser) {
      setIsLoading(false);
      return { success: false, error: 'Invalid email address. Use admin@gmail.com or teacher@kuet.ac.bd' };
    }
    
    if (demoUser.password !== password) {
      setIsLoading(false);
      return { success: false, error: 'Invalid password. Try admin123 or teacher123' };
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = demoUser;
    setUser(userWithoutPassword);
    localStorage.setItem('kuet_user', JSON.stringify(userWithoutPassword));
    setIsLoading(false);
    
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kuet_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
