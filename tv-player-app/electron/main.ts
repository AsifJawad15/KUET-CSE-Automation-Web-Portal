import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DisplayConfigManager, DisplayMapping } from './displayConfig';

// ── Globals ──────────────────────────────────────────

const isDev = !app.isPackaged;
const VITE_DEV_URL = 'http://localhost:5173';

let controlWindow: BrowserWindow | null = null;
// Dynamic map of TV name → BrowserWindow
const tvWindows = new Map<string, BrowserWindow>();
let tray: Tray | null = null;
let appQuitting = false;

const configManager = new DisplayConfigManager();

// ── Window Content Loading ───────────────────────────

function loadWindowContent(win: BrowserWindow, hashPath: string) {
  if (isDev) {
    win.loadURL(`${VITE_DEV_URL}/#${hashPath}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: hashPath,
    });
  }
}

// ── Control Window ───────────────────────────────────

function createControlWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();

  controlWindow = new BrowserWindow({
    width: 960,
    height: 720,
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    title: 'TV Player — Control Panel',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindowContent(controlWindow, '/');

  // Hide instead of close (accessible from tray)
  controlWindow.on('close', (e) => {
    if (!appQuitting) {
      e.preventDefault();
      controlWindow?.hide();
    }
  });

  controlWindow.on('closed', () => {
    controlWindow = null;
  });

  if (isDev) {
    controlWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ── TV Window ────────────────────────────────────────

function createTvWindow(
  target: string,
  display: Electron.Display
): BrowserWindow {
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
    title: `TV Player — ${target}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindowContent(win, `/player?target=${target}`);

  // Prevent accidental closing — only quit can close TV windows
  win.on('close', (e) => {
    if (!appQuitting) {
      e.preventDefault();
    }
  });

  // Re-enter fullscreen if somehow exited
  win.on('leave-full-screen', () => {
    if (!appQuitting) {
      win.setFullScreen(true);
    }
  });

  return win;
}

// ── Display Mapping ──────────────────────────────────

function getDisplayMapping(): Map<string, Electron.Display | null> {
  const displays = screen.getAllDisplays();
  const config = configManager.load();
  const primary = screen.getPrimaryDisplay();
  const externals = displays.filter((d) => d.id !== primary.id);

  const result = new Map<string, Electron.Display | null>();
  const tvNames = Object.keys(config);

  // If no config saved, default to TV1/TV2
  if (tvNames.length === 0) {
    tvNames.push('TV1', 'TV2');
  }

  const usedDisplayIds = new Set<number>();

  // First pass: resolve configured display IDs
  for (const name of tvNames) {
    const savedId = config[name];
    if (savedId != null) {
      const found = displays.find((d) => d.id === savedId);
      if (found) {
        result.set(name, found);
        usedDisplayIds.add(found.id);
      } else {
        result.set(name, null);
      }
    } else {
      result.set(name, null);
    }
  }

  // Second pass: auto-assign unresolved TVs to available externals
  const availableExternals = externals.filter(
    (d) => !usedDisplayIds.has(d.id)
  );
  let extIdx = 0;
  for (const name of tvNames) {
    if (result.get(name) === null && extIdx < availableExternals.length) {
      const ext = availableExternals[extIdx++];
      result.set(name, ext);
      console.log(
        `Auto-assigned ${name} to external display ${ext.id} (${ext.bounds.width}×${ext.bounds.height})`
      );
    }
  }

  if (externals.length === 0) {
    console.warn(
      'No external displays detected. Ensure Windows is in EXTEND display mode.'
    );
  }

  return result;
}

// ── Open / Close TV Windows ──────────────────────────

function closeTvWindow(name: string): void {
  const win = tvWindows.get(name);
  if (win && !win.isDestroyed()) {
    appQuitting = true;
    win.close();
    appQuitting = false;
  }
  tvWindows.delete(name);
}

function closeAllTvWindows(): void {
  for (const name of Array.from(tvWindows.keys())) {
    closeTvWindow(name);
  }
}

function openTvWindows() {
  closeAllTvWindows();

  const mapping = getDisplayMapping();

  for (const [name, display] of mapping) {
    if (display) {
      const win = createTvWindow(name, display);
      tvWindows.set(name, win);
      console.log(
        `${name} window opened on display ${display.id} — ${display.bounds.width}×${display.bounds.height} at (${display.bounds.x}, ${display.bounds.y})`
      );
    }
  }
}

// ── System Tray ──────────────────────────────────────

function createTray() {
  let icon: Electron.NativeImage;

  // Try loading a custom tray icon
  const iconPath = isDev
    ? path.join(app.getAppPath(), 'public', 'tray-icon.png')
    : path.join(process.resourcesPath, 'tray-icon.png');

  if (fs.existsSync(iconPath)) {
    icon = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
  } else {
    // Fallback: extract icon from the Electron executable
    try {
      icon = nativeImage
        .createFromPath(app.getPath('exe'))
        .resize({ width: 16, height: 16 });
    } catch {
      // Last resort: minimal 1×1 white pixel resized
      icon = nativeImage
        .createFromDataURL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAQApDs4AAAAASUVORK5CYII='
        )
        .resize({ width: 16, height: 16 });
    }
  }

  tray = new Tray(icon);
  tray.setToolTip('TV Player');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Control Panel',
      click: () => {
        if (controlWindow) {
          controlWindow.show();
          controlWindow.focus();
        }
      },
    },
    {
      label: 'Reopen TV Windows',
      click: () => openTvWindows(),
    },
    { type: 'separator' },
    {
      label: 'Quit TV Player',
      click: () => {
        appQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (controlWindow) {
      controlWindow.show();
      controlWindow.focus();
    }
  });
}

// ── IPC Handlers ─────────────────────────────────────

function setupIPC() {
  ipcMain.handle('get-displays', () => {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === primary.id,
      scaleFactor: d.scaleFactor,
    }));
  });

  ipcMain.handle('get-display-config', () => {
    return configManager.load();
  });

  ipcMain.handle(
    'save-display-config',
    (_event: Electron.IpcMainInvokeEvent, config: DisplayMapping) => {
      configManager.save(config);
      return { success: true };
    }
  );

  ipcMain.handle('open-tv-windows', () => {
    openTvWindows();
    return { success: true };
  });

  ipcMain.handle('close-tv-windows', () => {
    closeAllTvWindows();
    return { success: true };
  });

  ipcMain.handle('get-app-status', () => {
    const tvStatus: Record<string, 'running' | 'stopped'> = {};
    const config = configManager.load();
    const names = Object.keys(config).length > 0 ? Object.keys(config) : ['TV1', 'TV2'];
    for (const name of names) {
      const win = tvWindows.get(name);
      tvStatus[name] = win && !win.isDestroyed() ? 'running' : 'stopped';
    }
    return {
      tvStatus,
      displays: screen.getAllDisplays().length,
    };
  });
}

// ── App Lifecycle ────────────────────────────────────

app.whenReady().then(() => {
  console.log('═══════════════════════════════════════');
  console.log('  TV Player — Starting');
  console.log('  Dev mode:', isDev);
  console.log('  Displays:', screen.getAllDisplays().length);
  console.log('═══════════════════════════════════════');

  setupIPC();
  createControlWindow();
  openTvWindows();
  createTray();

  // React to display changes (hot-plug HDMI)
  screen.on('display-added', (_event, newDisplay) => {
    console.log(
      `📺 Display added: ${newDisplay.id} (${newDisplay.bounds.width}×${newDisplay.bounds.height})`
    );
    controlWindow?.webContents.send('displays-changed');
  });

  screen.on('display-removed', (_event, oldDisplay) => {
    console.log(`📺 Display removed: ${oldDisplay.id}`);
    controlWindow?.webContents.send('displays-changed');
  });
});

app.on('before-quit', () => {
  appQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!controlWindow) {
    createControlWindow();
  }
});
