import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface StoredSnapshot {
  schemaVersion: 2;
  target: string;
  generatedAt: string;
  timezone: 'Asia/Dhaka';
  revisions: Record<string, string>;
  [key: string]: unknown;
}

export interface SnapshotMeta {
  target: string;
  generatedAt: string;
  savedAt: string;
  sizeBytes: number;
}

const SAFE_TARGET = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

function validateSnapshot(value: unknown, expectedTarget: string): StoredSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Snapshot must be an object.');
  }
  const snapshot = value as Partial<StoredSnapshot>;
  if (
    snapshot.schemaVersion !== 2 ||
    snapshot.target !== expectedTarget ||
    snapshot.timezone !== 'Asia/Dhaka' ||
    typeof snapshot.generatedAt !== 'string' ||
    !snapshot.revisions ||
    typeof snapshot.revisions !== 'object'
  ) {
    throw new Error('Unsupported or malformed TV snapshot.');
  }
  return snapshot as StoredSnapshot;
}

export class SnapshotStore {
  private readonly directory: string;

  constructor() {
    this.directory = path.join(app.getPath('userData'), 'snapshots');
  }

  private filePath(target: string): string {
    if (!SAFE_TARGET.test(target)) throw new Error('Invalid TV target.');
    return path.join(this.directory, `${target}.json`);
  }

  load(target: string): StoredSnapshot | null {
    const filePath = this.filePath(target);
    if (!fs.existsSync(filePath)) return null;
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return validateSnapshot(parsed, target);
    } catch (error) {
      console.warn(`Failed to load cached snapshot for ${target}:`, error);
      return null;
    }
  }

  save(target: string, value: unknown): SnapshotMeta {
    const snapshot = validateSnapshot(value, target);
    fs.mkdirSync(this.directory, { recursive: true });
    const filePath = this.filePath(target);
    const temporaryPath = `${filePath}.tmp`;
    const serialized = JSON.stringify(snapshot);
    fs.writeFileSync(temporaryPath, serialized, 'utf-8');
    fs.renameSync(temporaryPath, filePath);
    return {
      target,
      generatedAt: snapshot.generatedAt,
      savedAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength(serialized),
    };
  }

  listMeta(): SnapshotMeta[] {
    if (!fs.existsSync(this.directory)) return [];
    const result: SnapshotMeta[] = [];
    for (const entry of fs.readdirSync(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const target = entry.name.slice(0, -5);
      if (!SAFE_TARGET.test(target)) continue;
      const snapshot = this.load(target);
      if (!snapshot) continue;
      const stat = fs.statSync(this.filePath(target));
      result.push({
        target,
        generatedAt: snapshot.generatedAt,
        savedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      });
    }
    return result;
  }
}
