/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_CMS_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_CMS_SUPABASE_ANON_KEY: string;
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

interface DisplayConfig {
  tv1DisplayId: number | null;
  tv2DisplayId: number | null;
}

interface AppStatus {
  tv1: 'running' | 'stopped';
  tv2: 'running' | 'stopped';
  displays: number;
}

interface ElectronAPI {
  getDisplays: () => Promise<DisplayInfo[]>;
  getDisplayConfig: () => Promise<DisplayConfig>;
  saveDisplayConfig: (config: DisplayConfig) => Promise<{ success: boolean }>;
  openTvWindows: () => Promise<{ success: boolean }>;
  closeTvWindows: () => Promise<{ success: boolean }>;
  getAppStatus: () => Promise<AppStatus>;
  onDisplaysChanged: (callback: () => void) => void;
  removeDisplaysChanged: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
