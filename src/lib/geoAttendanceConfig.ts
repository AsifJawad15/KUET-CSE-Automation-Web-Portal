export const GEO_ATTENDANCE_DEFAULTS = {
  rangeMeters: 30,
  durationMinutes: 50,
  absenceGraceMinutes: 5,
} as const;

export const GEO_ATTENDANCE_LIMITS = {
  rangeMeters: { min: 1, max: 500 },
  durationMinutes: { min: 1, max: 600 },
  absenceGraceMinutes: { min: 1, max: 600 },
} as const;

type GeoAttendanceIntegerField =
  | 'range_meters'
  | 'duration_minutes'
  | 'absence_grace_minutes';

export class GeoAttendanceInputError extends Error {}

export function parseGeoAttendanceInteger(
  value: unknown,
  field: GeoAttendanceIntegerField,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  const candidate =
    value == null || value === ''
      ? fallback
      : typeof value === 'string'
      ? Number.parseInt(value.trim(), 10)
      : Number(value);

  if (!Number.isFinite(candidate) || !Number.isInteger(candidate)) {
    throw new GeoAttendanceInputError(`${field} must be a whole number.`);
  }

  if (candidate < bounds.min || candidate > bounds.max) {
    throw new GeoAttendanceInputError(
      `${field} must be between ${bounds.min} and ${bounds.max}.`,
    );
  }

  return candidate;
}
