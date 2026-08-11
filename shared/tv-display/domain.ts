export const TV_DISPLAY_TIME_ZONE = 'Asia/Dhaka' as const;
export const TV_SNAPSHOT_SCHEMA_VERSION = 2 as const;

export type TvSnapshotSection =
  | 'announcements'
  | 'ticker'
  | 'events'
  | 'settings'
  | 'device'
  | 'schedule';

export const TV_SNAPSHOT_SECTIONS: readonly TvSnapshotSection[] = [
  'announcements',
  'ticker',
  'events',
  'settings',
  'device',
  'schedule',
] as const;

export type RoutineDisplaySource =
  | 'routine'
  | 'cr-booking'
  | 'teacher-booking'
  | 'admin-booking';

export interface RoutineDisplaySlot {
  id: string;
  source: RoutineDisplaySource;
  date: string;
  roomNumber: string;
  startTime: string;
  endTime: string;
  section: string | null;
  courseCode: string;
  courseTitle: string;
  teacherName: string | null;
  term: string | null;
  session: string | null;
  bookingType: string | null;
}

export interface TvSnapshotDevice {
  name: string;
  label: string | null;
  location: string | null;
  showRoomSchedule: boolean;
}

export interface TvSnapshotSchedule {
  from: string;
  through: string;
  days: Record<string, RoutineDisplaySlot[]>;
}

export interface TvSnapshotContent {
  announcements?: unknown[];
  ticker?: unknown[];
  events?: unknown[];
  settings?: Record<string, string>;
}

export interface TvSnapshotV2 {
  schemaVersion: typeof TV_SNAPSHOT_SCHEMA_VERSION;
  target: string;
  generatedAt: string;
  timezone: typeof TV_DISPLAY_TIME_ZONE;
  revisions: Partial<Record<TvSnapshotSection, string>>;
  content?: TvSnapshotContent;
  device?: TvSnapshotDevice | null;
  schedule?: TvSnapshotSchedule;
  errors?: Partial<Record<TvSnapshotSection, string>>;
}

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

export function getZonedDateParts(
  date: Date = new Date(),
  timeZone: string = TV_DISPLAY_TIME_ZONE,
): ZonedDateParts {
  const values: Record<string, number> = {};
  for (const part of getDateTimeFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function toDateKey(parts: Pick<ZonedDateParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getZonedDateKey(
  date: Date = new Date(),
  timeZone: string = TV_DISPLAY_TIME_ZONE,
): string {
  return toDateKey(getZonedDateParts(date, timeZone));
}

export function getDateKeyWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDaysToDateKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function getZonedMinutes(
  date: Date = new Date(),
  timeZone: string = TV_DISPLAY_TIME_ZONE,
): number {
  const parts = getZonedDateParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function clampSetting(
  value: string | number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function isSafeTvTarget(value: string): boolean {
  return value === 'all' || /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(value);
}

export function parseSnapshotSections(value: string | null): Set<TvSnapshotSection> {
  if (!value) return new Set(TV_SNAPSHOT_SECTIONS);
  const sections = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is TvSnapshotSection =>
      (TV_SNAPSHOT_SECTIONS as readonly string[]).includes(item),
    );
  return new Set(sections);
}

export function isTvSnapshotV2(value: unknown): value is TvSnapshotV2 {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<TvSnapshotV2>;
  return (
    snapshot.schemaVersion === TV_SNAPSHOT_SCHEMA_VERSION &&
    typeof snapshot.target === 'string' &&
    isSafeTvTarget(snapshot.target) &&
    typeof snapshot.generatedAt === 'string' &&
    snapshot.timezone === TV_DISPLAY_TIME_ZONE &&
    !!snapshot.revisions &&
    typeof snapshot.revisions === 'object'
  );
}

export function mergeTvSnapshots(
  current: TvSnapshotV2 | null,
  patch: TvSnapshotV2,
): TvSnapshotV2 {
  if (!current || current.target !== patch.target) return patch;
  const errors = { ...(current.errors ?? {}) };
  for (const section of Object.keys(patch.revisions) as TvSnapshotSection[]) {
    delete errors[section];
  }
  Object.assign(errors, patch.errors ?? {});
  return {
    ...current,
    ...patch,
    revisions: { ...current.revisions, ...patch.revisions },
    content: {
      ...current.content,
      ...patch.content,
      settings: {
        ...(current.content?.settings ?? {}),
        ...(patch.content?.settings ?? {}),
      },
    },
    device: patch.device === undefined ? current.device : patch.device,
    schedule: patch.schedule ?? current.schedule,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
