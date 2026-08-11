import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

import {
  createDefaultDisplayConfig,
  migrateLegacyConfig,
  validateDisplayConfig,
  type DisplayConfigV2,
} from './displayConfigCore';

export {
  createDefaultDisplayConfig,
  migrateLegacyConfig,
  validateDisplayConfig,
  type DisplayAssignment,
  type DisplayConfigV2,
  type DisplayFingerprint,
} from './displayConfigCore';

function isVersionTwo(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { version?: unknown }).version === 2;
}

export class DisplayConfigManager {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'display-config.json');
  }

  load(): DisplayConfigV2 {
    try {
      if (!fs.existsSync(this.configPath)) return createDefaultDisplayConfig();
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (isVersionTwo(parsed)) return validateDisplayConfig(parsed);

      const migrated = migrateLegacyConfig(parsed);
      if (migrated) {
        const backupPath = `${this.configPath}.v1-backup-${Date.now()}`;
        fs.copyFileSync(this.configPath, backupPath);
        this.save(migrated);
        console.log('Migrated legacy display config. Backup:', backupPath);
        return migrated;
      }
    } catch (error) {
      console.warn('Failed to load display config, using safe defaults:', error);
    }
    return createDefaultDisplayConfig();
  }

  save(input: unknown): DisplayConfigV2 {
    const config = validateDisplayConfig(input);
    const directory = path.dirname(this.configPath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.configPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(temporaryPath, this.configPath);
    return config;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
