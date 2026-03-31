import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getDisplayConfig: () => ipcRenderer.invoke('get-display-config'),
  saveDisplayConfig: (config: { tv1DisplayId: number | null; tv2DisplayId: number | null }) =>
    ipcRenderer.invoke('save-display-config', config),
  openTvWindows: () => ipcRenderer.invoke('open-tv-windows'),
  closeTvWindows: () => ipcRenderer.invoke('close-tv-windows'),
  getAppStatus: () => ipcRenderer.invoke('get-app-status'),
  onDisplaysChanged: (callback: () => void) => {
    ipcRenderer.on('displays-changed', callback);
  },
  removeDisplaysChanged: () => {
    ipcRenderer.removeAllListeners('displays-changed');
  },
});
