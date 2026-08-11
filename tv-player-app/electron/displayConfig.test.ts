import { describe, expect, it } from 'vitest';

import {
  createDefaultDisplayConfig,
  migrateLegacyConfig,
  validateDisplayConfig,
} from './displayConfigCore';

describe('display configuration migration and validation', () => {
  it('migrates a legacy configuration containing only TV2', () => {
    const migrated = migrateLegacyConfig({ tv2DisplayId: 0 });
    expect(migrated?.assignments.TV2.displayId).toBe(0);
    expect(migrated?.activeTargets).toEqual(['TV2']);
  });

  it('rejects duplicate explicit display assignments', () => {
    const config = createDefaultDisplayConfig();
    config.assignments = {
      TV1: { displayId: 22, fingerprint: null },
      TV2: { displayId: 22, fingerprint: null },
    };
    expect(() => validateDisplayConfig(config)).toThrow(/more than one TV/);
  });

  it('rejects unsafe target names', () => {
    const config = createDefaultDisplayConfig();
    config.assignments = {
      '../TV1': { displayId: null, fingerprint: null },
    };
    expect(() => validateDisplayConfig(config)).toThrow(/Invalid TV target/);
  });
});
