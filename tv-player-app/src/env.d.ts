/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_CMS_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_APP_URL?: string;
  readonly VITE_TV_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  scaleFactor: number;
}

interface DisplayFingerprint {
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  wasPrimary: boolean;
  lastBounds: { x: number; y: number; width: number; height: number };
}

interface DisplayConfigV2 {
  version: 2;
  assignments: Record<string, {
    displayId: number | null;
    fingerprint: DisplayFingerprint | null;
  }>;
  activeTargets: string[];
  preventDisplaySleep: boolean;
  launchAtLogin: boolean;
}

interface SnapshotMeta {
  target: string;
  generatedAt: string;
  savedAt: string;
  sizeBytes: number;
}

interface MediaCacheStats {
  sizeBytes: number;
  entries: number;
  quotaBytes: number;
}

interface AppStatus {
  tvStatus: Record<string, 'running' | 'stopped'>;
  displays: number;
  mappingIssues: Record<string, string | null>;
  snapshotMeta: SnapshotMeta[];
  mediaCache: MediaCacheStats;
  preventDisplaySleep: boolean;
  launchAtLogin: boolean;
}

interface ActionResult<T = unknown> {
  success: boolean;
  config?: DisplayConfigV2;
  meta?: T;
  stats?: MediaCacheStats;
  error?: string;
}

interface ElectronAPI {
  getDisplays: () => Promise<DisplayInfo[]>;
  getDisplayConfig: () => Promise<DisplayConfigV2>;
  saveDisplayConfig: (mapping: Record<string, number | null>) => Promise<ActionResult>;
  syncActiveTargets: (targets: string[]) => Promise<ActionResult>;
  updatePreferences: (preferences: {
    preventDisplaySleep?: boolean;
    launchAtLogin?: boolean;
  }) => Promise<ActionResult>;
  openTvWindows: () => Promise<ActionResult>;
  closeTvWindows: () => Promise<ActionResult>;
  getAppStatus: () => Promise<AppStatus>;
  loadTvSnapshot: (target: string) => Promise<unknown | null>;
  saveTvSnapshot: (target: string, snapshot: unknown) => Promise<ActionResult<SnapshotMeta>>;
  syncMediaCache: (urls: string[]) => Promise<ActionResult>;
  resolveMediaUrl: (url: string) => string;
  onDisplaysChanged: (callback: () => void) => void;
  removeDisplaysChanged: (callback: () => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
