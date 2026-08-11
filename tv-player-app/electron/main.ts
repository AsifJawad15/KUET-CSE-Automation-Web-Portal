import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  protocol,
  screen,
  Tray,
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import {
  DisplayConfigManager,
  type DisplayAssignment,
  type DisplayConfigV2,
  type DisplayFingerprint,
} from './displayConfig';
import { MediaCache } from './mediaCache';
import { SnapshotStore } from './snapshotStore';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tv-media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

const isDev = !app.isPackaged;
const rendererUrl = process.env.TV_PLAYER_DEV_URL || 'http://127.0.0.1:5173';
const configManager = new DisplayConfigManager();
const snapshotStore = new SnapshotStore();
const mediaCache = new MediaCache();

let controlWindow: BrowserWindow | null = null;
const tvWindows = new Map<string, BrowserWindow>();
const restartAttempts = new Map<string, number>();
let tray: Tray | null = null;
let appQuitting = false;
let closingTvWindows = false;
let tvWindowsEnabled = true;
let displayChangeTimer: ReturnType<typeof setTimeout> | null = null;
let powerSaveBlockerId: number | null = null;
let lastMappingIssues: Record<string, string | null> = {};

function loadWindowContent(win: BrowserWindow, hashPath: string): Promise<void> {
  if (isDev) return win.loadURL(`${rendererUrl}/#${hashPath}`);
  return win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: hashPath });
}

function secureWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(rendererUrl) : url.startsWith('file:');
    if (!allowed) event.preventDefault();
  });
}

function baseWebPreferences(): Electron.WebPreferences {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function createControlWindow(): void {
  if (controlWindow && !controlWindow.isDestroyed()) return;
  const primary = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 760,
    minHeight: 600,
    x: primary.workArea.x + 40,
    y: primary.workArea.y + 40,
    title: 'TV Player — Control Panel',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#060e1c',
    webPreferences: baseWebPreferences(),
  });
  controlWindow = win;
  secureWindow(win);
  win.once('ready-to-show', () => win.show());
  win.on('close', (event) => {
    if (!appQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    if (controlWindow === win) controlWindow = null;
  });
  void loadWindowContent(win, '/').catch((error) => {
    console.error('Failed to load control window:', error);
  });
}

function scheduleTvRestart(target: string): void {
  if (
    appQuitting ||
    !tvWindowsEnabled ||
    closingTvWindows ||
    !configManager.load().activeTargets.includes(target)
  ) return;
  const attempts = (restartAttempts.get(target) ?? 0) + 1;
  restartAttempts.set(target, attempts);
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts - 1, 5));
  setTimeout(() => {
    if (appQuitting) return;
    reconcileTvWindows();
  }, delay);
}

function createTvWindow(target: string, display: Electron.Display): BrowserWindow {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: true,
    kiosk: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    show: false,
    backgroundColor: '#060e1c',
    title: `TV Player — ${target}`,
    webPreferences: baseWebPreferences(),
  });

  secureWindow(win);
  win.once('ready-to-show', () => {
    restartAttempts.set(target, 0);
    win.show();
  });
  win.on('close', (event) => {
    if (!appQuitting && !closingTvWindows) event.preventDefault();
  });
  win.on('leave-full-screen', () => {
    if (!appQuitting) win.setFullScreen(true);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`${target} renderer exited:`, details.reason);
    tvWindows.delete(target);
    scheduleTvRestart(target);
  });
  win.webContents.on('unresponsive', () => {
    console.error(`${target} renderer became unresponsive.`);
    win.webContents.reloadIgnoringCache();
  });
  win.webContents.on('did-fail-load', (_event, code, description) => {
    if (code === -3) return;
    console.error(`${target} failed to load: ${code} ${description}`);
    scheduleTvRestart(target);
  });

  void loadWindowContent(win, `/player?target=${encodeURIComponent(target)}`).catch((error) => {
    console.error(`Failed to load ${target}:`, error);
    scheduleTvRestart(target);
  });
  return win;
}

function fingerprintFor(display: Electron.Display): DisplayFingerprint {
  const primary = screen.getPrimaryDisplay();
  return {
    label: display.label || `Display ${display.id}`,
    width: display.bounds.width,
    height: display.bounds.height,
    scaleFactor: display.scaleFactor,
    wasPrimary: display.id === primary.id,
    lastBounds: { ...display.bounds },
  };
}

function exactFingerprintMatch(
  fingerprint: DisplayFingerprint | null,
  display: Electron.Display,
): boolean {
  if (!fingerprint) return true;
  const current = fingerprintFor(display);
  return (
    current.label === fingerprint.label &&
    current.width === fingerprint.width &&
    current.height === fingerprint.height &&
    Math.abs(current.scaleFactor - fingerprint.scaleFactor) < 0.01
  );
}

function geometryScore(fingerprint: DisplayFingerprint, display: Electron.Display): number {
  const current = fingerprintFor(display);
  const labelPenalty = current.label === fingerprint.label ? 0 : 10_000;
  return (
    labelPenalty +
    Math.abs(current.width - fingerprint.width) +
    Math.abs(current.height - fingerprint.height) +
    Math.abs(current.scaleFactor - fingerprint.scaleFactor) * 100 +
    Math.abs(current.lastBounds.x - fingerprint.lastBounds.x) / 10 +
    Math.abs(current.lastBounds.y - fingerprint.lastBounds.y) / 10
  );
}

function resolveDisplayMapping(): Map<string, Electron.Display | null> {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const config = configManager.load();
  const usedIds = new Set<number>();
  const result = new Map<string, Electron.Display | null>();
  const issues: Record<string, string | null> = {};
  let changed = false;

  for (const target of config.activeTargets) {
    const assignment = config.assignments[target] ?? { displayId: null, fingerprint: null };
    let matched: Electron.Display | undefined;

    if (assignment.displayId !== null) {
      const exact = displays.find((display) => display.id === assignment.displayId);
      if (exact && exactFingerprintMatch(assignment.fingerprint, exact) && !usedIds.has(exact.id)) {
        matched = exact;
      }
    }

    if (!matched && assignment.fingerprint) {
      const candidates = displays.filter((display) => !usedIds.has(display.id));
      const strong = candidates.filter((display) => {
        const current = fingerprintFor(display);
        return (
          current.label === assignment.fingerprint?.label &&
          current.width === assignment.fingerprint.width &&
          current.height === assignment.fingerprint.height &&
          Math.abs(current.scaleFactor - assignment.fingerprint.scaleFactor) < 0.01
        );
      });
      if (strong.length === 1) {
        matched = strong[0];
      } else if (strong.length === 0 && candidates.length > 0) {
        const ranked = candidates
          .map((display) => ({ display, score: geometryScore(assignment.fingerprint!, display) }))
          .sort((a, b) => a.score - b.score);
        if (ranked[0].score < 12_000 && (!ranked[1] || ranked[1].score - ranked[0].score > 50)) {
          matched = ranked[0].display;
        }
      }
    }

    if (matched) {
      usedIds.add(matched.id);
      result.set(target, matched);
      issues[target] = null;
      const nextFingerprint = fingerprintFor(matched);
      if (
        assignment.displayId !== matched.id ||
        JSON.stringify(assignment.fingerprint) !== JSON.stringify(nextFingerprint)
      ) {
        config.assignments[target] = { displayId: matched.id, fingerprint: nextFingerprint };
        changed = true;
      }
    } else {
      result.set(target, null);
      issues[target] = assignment.displayId === null ? 'unmapped' : 'saved-display-unavailable';
    }
  }

  const availableExternal = displays
    .filter((display) => display.id !== primary.id && !usedIds.has(display.id))
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y || a.id - b.id);
  for (const target of config.activeTargets) {
    if (result.get(target) || availableExternal.length === 0) continue;
    const assignment = config.assignments[target];
    if (assignment?.displayId !== null && assignment?.fingerprint) continue;
    const display = availableExternal.shift()!;
    usedIds.add(display.id);
    result.set(target, display);
    issues[target] = 'auto-assigned';
    config.assignments[target] = {
      displayId: display.id,
      fingerprint: fingerprintFor(display),
    };
    changed = true;
  }

  lastMappingIssues = issues;
  if (changed) {
    try {
      configManager.save(config);
    } catch (error) {
      console.error('Failed to persist resolved display mapping:', error);
    }
  }
  return result;
}

function closeTvWindow(target: string): void {
  const win = tvWindows.get(target);
  if (win && !win.isDestroyed()) {
    closingTvWindows = true;
    win.close();
    closingTvWindows = false;
  }
  tvWindows.delete(target);
}

function closeAllTvWindows(): void {
  for (const target of [...tvWindows.keys()]) closeTvWindow(target);
}

function reconcileTvWindows(): void {
  if (!tvWindowsEnabled) {
    closeAllTvWindows();
    return;
  }
  const mapping = resolveDisplayMapping();
  for (const target of [...tvWindows.keys()]) {
    if (!mapping.get(target)) closeTvWindow(target);
  }

  for (const [target, display] of mapping) {
    if (!display) continue;
    const existing = tvWindows.get(target);
    if (existing && !existing.isDestroyed()) {
      const bounds = existing.getBounds();
      if (
        bounds.x !== display.bounds.x ||
        bounds.y !== display.bounds.y ||
        bounds.width !== display.bounds.width ||
        bounds.height !== display.bounds.height
      ) {
        existing.setBounds(display.bounds);
        existing.setFullScreen(true);
      }
      continue;
    }
    tvWindows.set(target, createTvWindow(target, display));
  }
  updatePowerPreferences();
  controlWindow?.webContents.send('displays-changed');
}

function updatePowerPreferences(): void {
  const config = configManager.load();
  if (config.preventDisplaySleep && tvWindows.size > 0) {
    if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
  } else if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
  app.setLoginItemSettings({ openAtLogin: config.launchAtLogin });
}

function scheduleDisplayReconcile(): void {
  if (displayChangeTimer) clearTimeout(displayChangeTimer);
  displayChangeTimer = setTimeout(reconcileTvWindows, 750);
}

function createTray(): void {
  const iconPath = isDev
    ? path.join(app.getAppPath(), 'public', 'tray-icon.png')
    : path.join(process.resourcesPath, 'tray-icon.png');
  let icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromPath(app.getPath('exe'));
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAQApDs4AAAAASUVORK5CYII=',
    );
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('TV Player');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show Control Panel',
      click: () => {
        createControlWindow();
        controlWindow?.show();
        controlWindow?.focus();
      },
    },
    { label: 'Reconcile TV Windows', click: reconcileTvWindows },
    { type: 'separator' },
    {
      label: 'Quit TV Player',
      click: () => {
        appQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', () => {
    createControlWindow();
    controlWindow?.show();
    controlWindow?.focus();
  });
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? event.sender.getURL();
  const trusted = isDev ? url.startsWith(rendererUrl) : url.startsWith('file:');
  if (!trusted) throw new Error('Untrusted IPC sender.');
}

function mappingFromRenderer(value: unknown): DisplayConfigV2 {
  const current = configManager.load();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid display mapping.');
  }
  const raw = value as Record<string, unknown>;
  const assignments: Record<string, DisplayAssignment> = {};
  for (const target of current.activeTargets) {
    const id = raw[target];
    if (id !== null && id !== undefined && (!Number.isInteger(id) || Number(id) < 0)) {
      throw new Error(`Invalid display ID for ${target}.`);
    }
    const displayId = id === null || id === undefined ? null : Number(id);
    const display = displayId === null
      ? null
      : screen.getAllDisplays().find((candidate) => candidate.id === displayId);
    assignments[target] = {
      displayId,
      fingerprint: display ? fingerprintFor(display) : null,
    };
  }
  return { ...current, assignments };
}

function setupIPC(): void {
  ipcMain.handle('get-displays', (event) => {
    assertTrustedSender(event);
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      isPrimary: display.id === primary.id,
      scaleFactor: display.scaleFactor,
    }));
  });

  ipcMain.handle('get-display-config', (event) => {
    assertTrustedSender(event);
    return configManager.load();
  });

  ipcMain.handle('save-display-config', (event, mapping: unknown) => {
    try {
      assertTrustedSender(event);
      const config = configManager.save(mappingFromRenderer(mapping));
      updatePowerPreferences();
      reconcileTvWindows();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('sync-active-targets', (event, targets: unknown) => {
    try {
      assertTrustedSender(event);
      if (!Array.isArray(targets)) throw new Error('Targets must be an array.');
      const current = configManager.load();
      const activeTargets = [...new Set(targets)]
        .filter((target): target is string =>
          typeof target === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(target),
        )
        .slice(0, 16);
      if (activeTargets.length === 0) throw new Error('At least one active TV target is required.');
      const assignments = Object.fromEntries(
        activeTargets.map((target) => [
          target,
          current.assignments[target] ?? { displayId: null, fingerprint: null },
        ]),
      );
      const config = configManager.save({ ...current, activeTargets, assignments });
      reconcileTvWindows();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('update-preferences', (event, preferences: unknown) => {
    try {
      assertTrustedSender(event);
      if (!preferences || typeof preferences !== 'object') throw new Error('Invalid preferences.');
      const raw = preferences as Record<string, unknown>;
      const current = configManager.load();
      const config = configManager.save({
        ...current,
        preventDisplaySleep:
          typeof raw.preventDisplaySleep === 'boolean'
            ? raw.preventDisplaySleep
            : current.preventDisplaySleep,
        launchAtLogin:
          typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : current.launchAtLogin,
      });
      updatePowerPreferences();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('open-tv-windows', (event) => {
    assertTrustedSender(event);
    tvWindowsEnabled = true;
    reconcileTvWindows();
    return { success: true };
  });
  ipcMain.handle('close-tv-windows', (event) => {
    assertTrustedSender(event);
    tvWindowsEnabled = false;
    closeAllTvWindows();
    updatePowerPreferences();
    return { success: true };
  });

  ipcMain.handle('load-tv-snapshot', (event, target: string) => {
    assertTrustedSender(event);
    return snapshotStore.load(target);
  });
  ipcMain.handle('save-tv-snapshot', (event, target: string, snapshot: unknown) => {
    try {
      assertTrustedSender(event);
      return { success: true, meta: snapshotStore.save(target, snapshot) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('sync-media-cache', async (event, urls: unknown) => {
    try {
      assertTrustedSender(event);
      if (!Array.isArray(urls)) throw new Error('Media URLs must be an array.');
      await mediaCache.retainAndPrefetch(
        urls.filter((url): url is string => typeof url === 'string'),
      );
      return { success: true, stats: mediaCache.getStats() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('get-app-status', (event) => {
    assertTrustedSender(event);
    const config = configManager.load();
    const tvStatus: Record<string, 'running' | 'stopped'> = {};
    for (const target of config.activeTargets) {
      const win = tvWindows.get(target);
      tvStatus[target] = win && !win.isDestroyed() ? 'running' : 'stopped';
    }
    return {
      tvStatus,
      displays: screen.getAllDisplays().length,
      mappingIssues: lastMappingIssues,
      snapshotMeta: snapshotStore.listMeta(),
      mediaCache: mediaCache.getStats(),
      preventDisplaySleep: config.preventDisplaySleep,
      launchAtLogin: config.launchAtLogin,
    };
  });
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    createControlWindow();
    controlWindow?.show();
    controlWindow?.focus();
  });

  app.whenReady().then(() => {
    mediaCache.registerProtocol();
    setupIPC();
    createControlWindow();
    reconcileTvWindows();
    createTray();
    updatePowerPreferences();

    screen.on('display-added', scheduleDisplayReconcile);
    screen.on('display-removed', scheduleDisplayReconcile);
    screen.on('display-metrics-changed', scheduleDisplayReconcile);
  });
}

app.on('before-quit', () => {
  appQuitting = true;
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', createControlWindow);
