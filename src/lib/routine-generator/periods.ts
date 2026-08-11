import { PERIODS } from '@/modules/ClassRoutine/constants';

/**
 * Returns a list of period numbers from start to end inclusive.
 */
export function getPeriodRange(startPeriod: number, endPeriod: number): number[] {
  const range: number[] = [];
  for (let p = startPeriod; p <= endPeriod; p++) {
    range.push(p);
  }
  return range;
}

/**
 * Get start and end times for a specific period number.
 */
export function periodToTime(periodNo: number): { start: string; end: string } | null {
  const match = PERIODS.find((p) => p.id === periodNo);
  if (!match) return null;
  return { start: match.start, end: match.end };
}

/**
 * Get standard start and end times for a range of periods.
 */
export function periodRangeToTime(
  startPeriod: number,
  endPeriod: number
): { start: string; end: string } | null {
  const startObj = PERIODS.find((p) => p.id === startPeriod);
  const endObj = PERIODS.find((p) => p.id === endPeriod);
  if (!startObj || !endObj) return null;
  return { start: startObj.start, end: endObj.end };
}

/**
 * Get valid blocks of 3 consecutive periods for labs/sessionals.
 */
export function validLabBlocks(): [number, number][] {
  return [
    [1, 3], // 08:00 - 10:30
    [4, 6], // 10:40 - 13:10
    [7, 9], // 14:30 - 17:00
  ];
}

/**
 * Check if two period blocks overlap.
 * Range inclusive.
 */
export function periodsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Converts numeric day of week to human readable string.
 */
export function dayNumberToName(dayNo: number): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[dayNo] || `Day ${dayNo}`;
}
