// ==========================================
// Shared constants for ClassRoutine module
// ==========================================

export const TERMS = [
  { value: '1-1', label: '1st Year 1st Term' },
  { value: '1-2', label: '1st Year 2nd Term' },
  { value: '2-1', label: '2nd Year 1st Term' },
  { value: '2-2', label: '2nd Year 2nd Term' },
  { value: '3-1', label: '3rd Year 1st Term' },
  { value: '3-2', label: '3rd Year 2nd Term' },
  { value: '4-1', label: '4th Year 1st Term' },
  { value: '4-2', label: '4th Year 2nd Term' },
];

export const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
];

export const PERIODS = [
  { id: 1, start: '08:00', end: '08:50', label: '8:00 AM – 8:50 AM' },
  { id: 2, start: '08:50', end: '09:40', label: '8:50 AM – 9:40 AM' },
  { id: 3, start: '09:40', end: '10:30', label: '9:40 AM – 10:30 AM' },
  { id: 4, start: '10:40', end: '11:30', label: '10:40 AM – 11:30 AM' },
  { id: 5, start: '11:30', end: '12:20', label: '11:30 AM – 12:20 PM' },
  { id: 6, start: '12:20', end: '13:10', label: '12:20 PM – 1:10 PM' },
  { id: 7, start: '14:30', end: '15:20', label: '2:30 PM – 3:20 PM' },
  { id: 8, start: '15:20', end: '16:10', label: '3:20 PM – 4:10 PM' },
  { id: 9, start: '16:10', end: '17:00', label: '4:10 PM – 5:00 PM' },
];

export const SECTIONS = ['A', 'B'];

export const BREAK_AFTER_PERIOD = [3, 6];

export const SESSIONS = [
  '2021-2022',
  '2022-2023',
  '2023-2024',
  '2024-2025',
  '2025-2026',
];
