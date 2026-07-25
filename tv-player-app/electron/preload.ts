import { contextBridge, ipcRenderer } from 'electron';

const displayListeners = new Map<() => void, () => void>();

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getDisplayConfig: () => ipcRenderer.invoke('get-display-config'),
  saveDisplayConfig: (mapping: Record<string, number | null>) =>
    ipcRenderer.invoke('save-display-config', mapping),
  syncActiveTargets: (targets: string[]) => ipcRenderer.invoke('sync-active-targets', targets),
  updatePreferences: (preferences: {
    preventDisplaySleep?: boolean;
    launchAtLogin?: boolean;
  }) => ipcRenderer.invoke('update-preferences', preferences),
  openTvWindows: () => ipcRenderer.invoke('open-tv-windows'),
  closeTvWindows: () => ipcRenderer.invoke('close-tv-windows'),
  getAppStatus: () => ipcRenderer.invoke('get-app-status'),
  loadTvSnapshot: (target: string) => ipcRenderer.invoke('load-tv-snapshot', target),
  saveTvSnapshot: (target: string, snapshot: unknown) =>
    ipcRenderer.invoke('save-tv-snapshot', target, snapshot),
  syncMediaCache: (urls: string[]) => ipcRenderer.invoke('sync-media-cache', urls),
  resolveMediaUrl: (url: string) =>
    url.startsWith('https://') ? `tv-media://asset/?url=${encodeURIComponent(url)}` : url,
  onDisplaysChanged: (callback: () => void) => {
    const listener = () => callback();
    displayListeners.set(callback, listener);
    ipcRenderer.on('displays-changed', listener);
  },
  removeDisplaysChanged: (callback: () => void) => {
    const listener = displayListeners.get(callback);
    if (listener) {
      ipcRenderer.removeListener('displays-changed', listener);
      displayListeners.delete(callback);
    }
  },
});
