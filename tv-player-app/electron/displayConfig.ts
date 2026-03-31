import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Maps TV device names (e.g., 'TV1', 'TV2', 'TV3') to display IDs
export interface DisplayMapping {
  [tvName: string]: number | null;
}

export class DisplayConfigManager {
  private configPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'display-config.json');
  }

  load(): DisplayMapping {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          // Migrate old format { tv1DisplayId, tv2DisplayId } to new format
          if ('tv1DisplayId' in parsed && !('TV1' in parsed)) {
            const migrated: DisplayMapping = {};
            if (parsed.tv1DisplayId) migrated['TV1'] = parsed.tv1DisplayId;
            if (parsed.tv2DisplayId) migrated['TV2'] = parsed.tv2DisplayId;
            this.save(migrated);
            return migrated;
          }
          return parsed as DisplayMapping;
        }
      }
    } catch (err) {
      console.warn('Failed to load display config, using defaults:', err);
    }
    return {};
  }

  save(config: DisplayMapping): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('Display config saved to:', this.configPath);
    } catch (err) {
      console.error('Failed to save display config:', err);
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
