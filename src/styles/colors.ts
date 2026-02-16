// ==========================================
// KUET CSE — Color Palette
// Warm Brown / Beige / Cream / Black
// ==========================================

export const colors = {
  // Primary — Warm Brown
  primary: {
    50: '#FAF0E6',
    100: '#F0DCC8',
    200: '#DEB89A',
    300: '#C4956A',
    400: '#A87B50',
    500: '#5D4037',
    600: '#4E342E',
    700: '#3E2723',
    800: '#2C1810',
    900: '#1A0F08',
    950: '#0F0A06',
  },

  // Secondary — Gold Brown
  secondary: {
    50: '#FFF8E7',
    100: '#FCEDC4',
    200: '#F5D68B',
    300: '#E8BA4E',
    400: '#C49A2E',
    500: '#8B6914',
    600: '#725610',
    700: '#5A430D',
    800: '#3D2E08',
    900: '#2A1F05',
    950: '#1A1206',
  },

  // Accent — Warm Beige
  accent: {
    50: '#FFF5EB',
    100: '#FFE8D0',
    200: '#F5D4B0',
    300: '#E8C09A',
    400: '#D4A574',
    500: '#C4956A',
    600: '#A8795A',
    700: '#8B6347',
    800: '#6B4D38',
    900: '#4A3528',
    950: '#2C1F18',
  },

  // Warning — Amber (unchanged)
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Error/Danger — Terracotta Red
  danger: {
    50: '#FFF5F5',
    100: '#FFE0E0',
    200: '#FBBFBF',
    300: '#F09090',
    400: '#E06060',
    500: '#C53030',
    600: '#A02020',
    700: '#801818',
    800: '#601010',
    900: '#400808',
  },

  // Neutral — Warm Gray
  neutral: {
    50: '#FDF8F3',
    100: '#F5EDE4',
    200: '#E8DDD1',
    300: '#D4C8BC',
    400: '#A89888',
    500: '#8B7355',
    600: '#6B5744',
    700: '#4A3D30',
    800: '#2C1810',
    900: '#1A0F08',
    950: '#0F0A06',
  },
};

// Theme-specific color mappings
export const lightTheme = {
  background: {
    primary: colors.neutral[50],
    secondary: colors.neutral[100],
    tertiary: '#FFFFFF',
  },
  text: {
    primary: colors.neutral[800],
    secondary: colors.neutral[600],
    tertiary: colors.neutral[500],
    inverse: '#FFFFFF',
  },
  border: {
    light: colors.neutral[200],
    default: colors.neutral[300],
    dark: colors.neutral[400],
  },
  surface: {
    card: '#FFFFFF',
    elevated: '#FFFBF7',
    overlay: 'rgba(44, 24, 16, 0.5)',
  },
};

export const darkTheme = {
  background: {
    primary: '#0b090a',    // onyx
    secondary: '#161a1d',  // carbon_black
    tertiary: '#3d4951',   // carbon_black-600
  },
  text: {
    primary: '#f5f3f4',    // white_smoke
    secondary: '#d3d3d3',  // dust_grey
    tertiary: '#b1a7a6',   // silver
    inverse: '#0b090a',    // onyx
  },
  border: {
    light: '#3d4951',      // carbon_black-600
    default: '#41353b',    // onyx-600
    dark: '#657786',       // carbon_black-700
  },
  surface: {
    card: '#161a1d',       // carbon_black
    elevated: '#3d4951',   // carbon_black-600
    overlay: 'rgba(11, 9, 10, 0.7)',
  },
};

// Gradient presets
export const gradients = {
  primary: 'from-[#5D4037] via-[#8B6914] to-[#D4A574]',
  secondary: 'from-[#D4A574] via-[#C4956A] to-[#8B6914]',
  accent: 'from-[#D4A574] to-[#E8C09A]',
  dark: 'from-[#0b090a] via-[#161a1d] to-[#0b090a]',
  light: 'from-[#FDF8F3] via-white to-[#F5EDE4]',
  mesh: 'from-[#5D4037]/10 via-[#8B6914]/10 to-[#D4A574]/10',
  warmOverlay: 'from-[#161a1d]/80 via-transparent to-[#0b090a]/90',
};
