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
let tv1Window: BrowserWindow | null = null;
let tv2Window: BrowserWindow | null = null;
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
  target: 'TV1' | 'TV2',
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

function getDisplayMapping(): {
  tv1Display: Electron.Display | null;
  tv2Display: Electron.Display | null;
} {
  const displays = screen.getAllDisplays();
  const config = configManager.load();
  const primary = screen.getPrimaryDisplay();

  // External displays (not the primary monitor)
  const externals = displays.filter((d) => d.id !== primary.id);

  let tv1Display: Electron.Display | null = null;
  let tv2Display: Electron.Display | null = null;

  // Try saved config first
  if (config.tv1DisplayId) {
    tv1Display =
      displays.find((d) => d.id === config.tv1DisplayId) || null;
  }
  if (config.tv2DisplayId) {
    tv2Display =
      displays.find((d) => d.id === config.tv2DisplayId) || null;
  }

  // Fallback: auto-assign external displays
  if (!tv1Display && externals.length >= 1) {
    tv1Display = externals[0];
    console.log(
      `Auto-assigned TV1 to external display ${tv1Display.id} (${tv1Display.bounds.width}×${tv1Display.bounds.height})`
    );
  }
  if (!tv2Display && externals.length >= 2) {
    // Avoid assigning the same display as TV1
    const remaining = externals.filter(
      (d) => d.id !== tv1Display?.id
    );
    if (remaining.length > 0) {
      tv2Display = remaining[0];
      console.log(
        `Auto-assigned TV2 to external display ${tv2Display.id} (${tv2Display.bounds.width}×${tv2Display.bounds.height})`
      );
    }
  }

  // Warning logs
  if (externals.length === 0) {
    console.warn(
      '⚠️  No external displays detected. Ensure Windows is in EXTEND display mode.'
    );
    console.warn(
      '    Right-click Desktop → Display Settings → Multiple displays → Extend these displays'
    );
  }
  if (!tv1Display) {
    console.warn(
      '⚠️  No display found for TV1. Connect a second monitor via HDMI.'
    );
  }
  if (!tv2Display) {
    console.warn(
      '⚠️  No display found for TV2. Connect a third monitor via HDMI.'
    );
  }

  return { tv1Display, tv2Display };
}

// ── Open / Close TV Windows ──────────────────────────

function closeTvWindow(win: BrowserWindow | null): null {
  if (win && !win.isDestroyed()) {
    // Temporarily allow close
    appQuitting = true;
    win.close();
    appQuitting = false;
  }
  return null;
}

function openTvWindows() {
  // Close existing TV windows first
  tv1Window = closeTvWindow(tv1Window);
  tv2Window = closeTvWindow(tv2Window);

  const { tv1Display, tv2Display } = getDisplayMapping();

  if (tv1Display) {
    tv1Window = createTvWindow('TV1', tv1Display);
    console.log(
      `✅ TV1 window opened on display ${tv1Display.id} — ${tv1Display.bounds.width}×${tv1Display.bounds.height} at (${tv1Display.bounds.x}, ${tv1Display.bounds.y})`
    );
  }

  if (tv2Display) {
    tv2Window = createTvWindow('TV2', tv2Display);
    console.log(
      `✅ TV2 window opened on display ${tv2Display.id} — ${tv2Display.bounds.width}×${tv2Display.bounds.height} at (${tv2Display.bounds.x}, ${tv2Display.bounds.y})`
    );
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
    tv1Window = closeTvWindow(tv1Window);
    tv2Window = closeTvWindow(tv2Window);
    return { success: true };
  });

  ipcMain.handle('get-app-status', () => {
    return {
      tv1:
        tv1Window && !tv1Window.isDestroyed() ? 'running' : 'stopped',
      tv2:
        tv2Window && !tv2Window.isDestroyed() ? 'running' : 'stopped',
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
