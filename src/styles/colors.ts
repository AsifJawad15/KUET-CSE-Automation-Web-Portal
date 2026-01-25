// ==========================================
// KUET CSE Automation - Color Palette
// Fixed color system for consistent theming
// ==========================================

export const colors = {
  // Primary Brand Colors - Blue/Indigo gradient
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1', // Main primary
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  
  // Secondary - Cyan/Teal accent
  secondary: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4', // Main secondary
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    950: '#083344',
  },
  
  // Accent - Emerald for success states
  accent: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981', // Main accent
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  
  // Warning - Amber
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  // Error/Danger - Rose
  danger: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
  },
  
  // Neutral - Slate (for backgrounds, text)
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
};

// Theme-specific color mappings
export const lightTheme = {
  background: {
    primary: colors.neutral[50],
    secondary: colors.neutral[100],
    tertiary: '#ffffff',
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    tertiary: colors.neutral[500],
    inverse: '#ffffff',
  },
  border: {
    light: colors.neutral[200],
    default: colors.neutral[300],
    dark: colors.neutral[400],
  },
  surface: {
    card: '#ffffff',
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
};

export const darkTheme = {
  background: {
    primary: colors.neutral[950],
    secondary: colors.neutral[900],
    tertiary: colors.neutral[800],
  },
  text: {
    primary: colors.neutral[50],
    secondary: colors.neutral[300],
    tertiary: colors.neutral[400],
    inverse: colors.neutral[900],
  },
  border: {
    light: colors.neutral[800],
    default: colors.neutral[700],
    dark: colors.neutral[600],
  },
  surface: {
    card: colors.neutral[900],
    elevated: colors.neutral[800],
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// Gradient presets
export const gradients = {
  primary: 'from-indigo-600 via-purple-600 to-blue-600',
  secondary: 'from-cyan-500 via-teal-500 to-emerald-500',
  accent: 'from-pink-500 via-rose-500 to-red-500',
  dark: 'from-slate-900 via-slate-800 to-slate-900',
  light: 'from-slate-50 via-white to-slate-100',
  mesh: 'from-indigo-500/10 via-purple-500/10 to-cyan-500/10',
};
