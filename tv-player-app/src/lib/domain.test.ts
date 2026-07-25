import { describe, expect, it } from 'vitest';

import {
  TV_DISPLAY_TIME_ZONE,
  addDaysToDateKey,
  clampSetting,
  getDateKeyWeekday,
  getZonedDateKey,
  getZonedMinutes,
  isSafeTvTarget,
  isTvSnapshotV2,
  mergeTvSnapshots,
  type TvSnapshotV2,
} from '../../../shared/tv-display/domain';

function snapshot(overrides: Partial<TvSnapshotV2> = {}): TvSnapshotV2 {
  return {
    schemaVersion: 2,
    target: 'TV1',
    generatedAt: '2026-07-25T18:01:00.000Z',
    timezone: TV_DISPLAY_TIME_ZONE,
    revisions: {},
    ...overrides,
  };
}

describe('TV display date utilities', () => {
  it('uses the next Bangladesh date around UTC midnight boundaries', () => {
    const instant = new Date('2026-07-25T18:30:00.000Z');
    expect(getZonedDateKey(instant, TV_DISPLAY_TIME_ZONE)).toBe('2026-07-26');
    expect(getZonedMinutes(instant, TV_DISPLAY_TIME_ZONE)).toBe(30);
  });

  it('adds days and derives weekdays without host timezone drift', () => {
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(getDateKeyWeekday('2026-07-26')).toBe(0);
  });
});

describe('TV setting and boundary validation', () => {
  it('clamps malformed and out-of-range numeric settings', () => {
    expect(clampSetting('not-a-number', 8, 3, 120)).toBe(8);
    expect(clampSetting('-4', 8, 3, 120)).toBe(3);
    expect(clampSetting('999', 8, 3, 120)).toBe(120);
  });

  it('accepts safe dynamic targets and rejects URL-like values', () => {
    expect(isSafeTvTarget('TV_CSE-3')).toBe(true);
    expect(isSafeTvTarget('../TV1')).toBe(false);
    expect(isSafeTvTarget('TV1?admin=true')).toBe(false);
  });

  it('validates and merges partial versioned snapshots', () => {
    const base = snapshot({
      revisions: { events: 'one', settings: 'one' },
      content: { events: [{ id: 'event-1' }], settings: { department: 'CSE' } },
      errors: { settings: 'temporarily unavailable' },
    });
    const patch = snapshot({
      generatedAt: '2026-07-25T18:02:00.000Z',
      revisions: { settings: 'two' },
      content: { settings: { headline: 'Updates' } },
    });
    const merged = mergeTvSnapshots(base, patch);
    expect(isTvSnapshotV2(merged)).toBe(true);
    expect(merged.content?.events).toEqual([{ id: 'event-1' }]);
    expect(merged.content?.settings).toEqual({ department: 'CSE', headline: 'Updates' });
    expect(merged.revisions).toEqual({ events: 'one', settings: 'two' });
    expect(merged.errors).toBeUndefined();
  });
});
