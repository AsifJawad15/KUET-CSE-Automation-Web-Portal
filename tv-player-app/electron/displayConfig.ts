import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface DisplayMapping {
  tv1DisplayId: number | null;
  tv2DisplayId: number | null;
}

const DEFAULT_CONFIG: DisplayMapping = {
  tv1DisplayId: null,
  tv2DisplayId: null,
};

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
        return {
          tv1DisplayId: typeof parsed.tv1DisplayId === 'number' ? parsed.tv1DisplayId : null,
          tv2DisplayId: typeof parsed.tv2DisplayId === 'number' ? parsed.tv2DisplayId : null,
        };
      }
    } catch (err) {
      console.warn('Failed to load display config, using defaults:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  save(config: DisplayMapping): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('✅ Display config saved to:', this.configPath);
    } catch (err) {
      console.error('Failed to save display config:', err);
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
