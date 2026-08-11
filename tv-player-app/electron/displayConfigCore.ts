export interface DisplayRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayFingerprint {
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  wasPrimary: boolean;
  lastBounds: DisplayRectangle;
}

export interface DisplayAssignment {
  displayId: number | null;
  fingerprint: DisplayFingerprint | null;
}

export interface DisplayConfigV2 {
  version: 2;
  assignments: Record<string, DisplayAssignment>;
  activeTargets: string[];
  preventDisplaySleep: boolean;
  launchAtLogin: boolean;
}

const MAX_TARGETS = 16;
const SAFE_TARGET = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

export function createDefaultDisplayConfig(): DisplayConfigV2 {
  return {
    version: 2,
    assignments: {},
    activeTargets: ['TV1', 'TV2'],
    preventDisplaySleep: true,
    launchAtLogin: false,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRectangle(value: unknown): value is DisplayRectangle {
  if (!isPlainObject(value)) return false;
  return ['x', 'y', 'width', 'height'].every(
    (key) => Number.isFinite(value[key]) && Number.isInteger(value[key]),
  );
}

function normalizeFingerprint(value: unknown): DisplayFingerprint | null {
  if (!isPlainObject(value) || !isRectangle(value.lastBounds)) return null;
  if (
    typeof value.label !== 'string' ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    !Number.isFinite(value.scaleFactor) ||
    typeof value.wasPrimary !== 'boolean'
  ) return null;

  return {
    label: value.label.slice(0, 200),
    width: Math.max(1, Math.round(Number(value.width))),
    height: Math.max(1, Math.round(Number(value.height))),
    scaleFactor: Math.max(0.25, Math.min(8, Number(value.scaleFactor))),
    wasPrimary: value.wasPrimary,
    lastBounds: {
      x: Number(value.lastBounds.x),
      y: Number(value.lastBounds.y),
      width: Number(value.lastBounds.width),
      height: Number(value.lastBounds.height),
    },
  };
}

export function validateDisplayConfig(value: unknown): DisplayConfigV2 {
  if (!isPlainObject(value) || value.version !== 2 || !isPlainObject(value.assignments)) {
    throw new Error('Unsupported or malformed display configuration.');
  }

  const entries = Object.entries(value.assignments);
  if (entries.length > MAX_TARGETS) {
    throw new Error(`A maximum of ${MAX_TARGETS} TV targets is supported.`);
  }

  const assignments: Record<string, DisplayAssignment> = {};
  const usedIds = new Set<number>();
  for (const [target, rawAssignment] of entries) {
    if (!SAFE_TARGET.test(target) || !isPlainObject(rawAssignment)) {
      throw new Error(`Invalid TV target in display configuration: ${target}`);
    }
    const rawId = rawAssignment.displayId;
    if (rawId !== null && (!Number.isInteger(rawId) || Number(rawId) < 0)) {
      throw new Error(`Invalid display ID for ${target}.`);
    }
    const displayId = rawId === null ? null : Number(rawId);
    if (displayId !== null && usedIds.has(displayId)) {
      throw new Error(`Display ${displayId} is assigned to more than one TV.`);
    }
    if (displayId !== null) usedIds.add(displayId);
    assignments[target] = {
      displayId,
      fingerprint: normalizeFingerprint(rawAssignment.fingerprint),
    };
  }

  const rawTargets = Array.isArray(value.activeTargets) ? value.activeTargets : Object.keys(assignments);
  const activeTargets = [...new Set(rawTargets)]
    .filter((target): target is string => typeof target === 'string' && SAFE_TARGET.test(target))
    .slice(0, MAX_TARGETS);

  return {
    version: 2,
    assignments,
    activeTargets: activeTargets.length > 0 ? activeTargets : ['TV1', 'TV2'],
    preventDisplaySleep: value.preventDisplaySleep !== false,
    launchAtLogin: value.launchAtLogin === true,
  };
}

export function migrateLegacyConfig(value: unknown): DisplayConfigV2 | null {
  if (!isPlainObject(value)) return null;
  const migrated = createDefaultDisplayConfig();
  const assignments: Record<string, DisplayAssignment> = {};

  if ('tv1DisplayId' in value || 'tv2DisplayId' in value) {
    for (const [target, id] of [
      ['TV1', value.tv1DisplayId],
      ['TV2', value.tv2DisplayId],
    ] as Array<[string, unknown]>) {
      if (Number.isInteger(id) && Number(id) >= 0) {
        assignments[target] = { displayId: Number(id), fingerprint: null };
      }
    }
  } else {
    for (const [target, id] of Object.entries(value)) {
      if (!SAFE_TARGET.test(target)) continue;
      if (id === null || (Number.isInteger(id) && Number(id) >= 0)) {
        assignments[target] = {
          displayId: id === null ? null : Number(id),
          fingerprint: null,
        };
      }
    }
  }

  if (Object.keys(assignments).length === 0) return null;
  migrated.assignments = assignments;
  migrated.activeTargets = Object.keys(assignments);
  return migrated;
}
