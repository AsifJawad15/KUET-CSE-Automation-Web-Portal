// ==========================================
// Theme Context
// Single Responsibility: Manages dark/light theme toggle
// Dependency Inversion: Storage abstracted for testability
// ==========================================

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// ── Constants ──────────────────────────────────────────

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'dark';

// ── Storage Helpers ────────────────────────────────────

function loadTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

// ── Provider ───────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = loadTheme();
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextType>(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
