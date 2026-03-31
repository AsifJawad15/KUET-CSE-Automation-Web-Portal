# TV Player — Electron Desktop App

A Windows desktop application for displaying content on dual TVs connected via HDMI.  
One PC instance manages two fullscreen kiosk windows — one per TV — each independently controlled from the web admin panel through Supabase realtime.

**Integrated with existing CMS tables** — uses `cms_tv_announcements`, `cms_tv_ticker`, `cms_tv_events`, and `cms_tv_settings` from the main web app's Supabase project.

---

## 1. Architecture Overview

```
┌──────────────────┐      Supabase Realtime       ┌──────────────────────────────┐
│   ADMIN PANEL    │  ─── CRUD on CMS tables ──▶  │  SUPABASE (CMS PostgreSQL)   │
│  (Web / Next.js) │                               │  Tables:                     │
│  TVDisplay page  │                               │    cms_tv_announcements      │
└──────────────────┘                               │    cms_tv_ticker             │
                                                   │    cms_tv_events             │
                                                   │    cms_tv_settings           │
                                                   │  + target column per row     │
                                                   └───────┬───────┬──────────────┘
                                                           │       │
                                          Realtime subscribe (filtered by target)
                                                           │       │
                                         ┌─────────────────┼───────┼────────────────┐
                                         │   ELECTRON APP  │       │  (Windows PC)  │
                                         │                 │       │                │
                                         │  ┌──────────────▼──┐ ┌─▼──────────────┐ │
                                         │  │  TV1 Window     │ │  TV2 Window     │ │
                                         │  │  /player?TV1    │ │  /player?TV2    │ │
                                         │  │  Kiosk+Fullscr  │ │  Kiosk+Fullscr  │ │
                                         │  │  HDMI Port 1    │ │  HDMI Port 2    │ │
                                         │  └─────────────────┘ └─────────────────┘ │
                                         │                                          │
                                         │  ┌─────────────────────────────────────┐ │
                                         │  │  Control Window (PC primary monitor)│ │
                                         │  │  Display mapping, status, preview   │ │
                                         │  └─────────────────────────────────────┘ │
                                         │                                          │
                                         │  System Tray Icon                        │
                                         └──────────────────────────────────────────┘
```

**Key points:**
- Admin panel's TVDisplay page manages all content (announcements, ticker, events, settings)
- Each content item has a `target` field: `'all'` (both TVs), `'TV1'`, or `'TV2'`
- Electron app fetches content filtered by target (includes items targeted to `'all'`)
- One app instance, three windows: Control + TV1 + TV2
- Display mapping saved to a local JSON config file

---

## 2. Folder Structure

```
tv-player-app/
├── package.json              # Dependencies, scripts, electron-builder config
├── index.html                # Vite HTML entry
├── vite.config.ts            # Vite bundler config
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.mjs        # PostCSS config
├── tsconfig.json             # TypeScript config (React/Vite)
├── tsconfig.electron.json    # TypeScript config (Electron main process)
├── .env.example              # Environment variable template
│
├── database/
│   └── tv_content_setup.sql  # (Deprecated — see database/tv_target_migration.sql)
│
├── electron/
│   ├── main.ts               # Electron main process
│   ├── preload.ts            # Preload script (context bridge)
│   └── displayConfig.ts      # Display mapping config manager
│
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # React router
│   ├── env.d.ts              # TypeScript declarations
│   ├── index.css             # Tailwind + custom styles
│   ├── lib/
│   │   └── supabase.ts       # Supabase client + CMS types + fetch functions
│   ├── components/
│   │   └── ContentRenderer.tsx  # (Legacy — no longer used by PlayerPage)
│   └── pages/
│       ├── PlayerPage.tsx    # Fullscreen TV display (/player?target=TV1)
│       └── ControlPage.tsx   # Dashboard on PC monitor (/)
│
└── README.md
```

---

## 3. Database Setup

The TV Player uses **existing CMS tables** from the main web app. No new tables are needed.

### Required Tables (already exist)
Created by `database/tv_display_setup.sql` and `database/tv_display_v2_setup.sql`:

| Table | Description |
|---|---|
| `cms_tv_announcements` | Headlines that scroll in the marquee bar |
| `cms_tv_ticker` | Rotating ticker items (notices, updates, results) |
| `cms_tv_events` | Department events with images, speakers, dates |
| `cms_tv_settings` | Key-value settings (department name, headline prefix, etc.) |

### Target Column Migration
Run `database/tv_target_migration.sql` to add per-TV targeting:

```sql
-- Adds: target TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'TV1', 'TV2'))
-- To: cms_tv_announcements, cms_tv_ticker, cms_tv_events
-- Also enables realtime on all tables
```

### How Targeting Works
- Content with `target = 'all'` appears on **both** TVs
- Content with `target = 'TV1'` appears only on TV1
- Content with `target = 'TV2'` appears only on TV2
- The player queries with `.in('target', [targetName, 'all'])`

---

## 4. React Code Summary

### PlayerPage (`/player?target=TV1` or `/player?target=TV2`)
- Rich TV info-board layout adapted from the web `/tv-display` page
- Events carousel with auto-rotation and navigation dots
- Headlines marquee bar (gold background, scrolling announcements)
- Ticker bar with rotating items and type badges
- Header with KUET branding, clock, and target badge
- Subscribes to realtime on all 4 CMS tables
- Falls back to polling every 30 seconds
- Uses framer-motion for smooth transitions, Tailwind CSS for layout

### ControlPage (`/`)
- Shows connected displays via Electron IPC
- Display mapping dropdowns (TV1 → Display, TV2 → Display)
- Content summary per-TV (announcement/ticker/event counts)
- Buttons: Reopen TV Windows, Close TV Windows, Refresh Displays
- Subscribes to realtime for live content count updates

---

## 5. Electron Code Summary

### main.ts
- Creates 3 windows: Control (normal), TV1 (kiosk), TV2 (kiosk)
- Detects displays via `screen.getAllDisplays()`
- Maps displays to TV1/TV2 using saved config or auto-detection
- TV windows: `frame:false, fullscreen:true, kiosk:true, skipTaskbar:true`
- System tray with Show Control / Reopen TVs / Quit

### preload.ts
- Exposes `window.electronAPI` via `contextBridge`

### displayConfig.ts
- Reads/writes `display-config.json` in Electron's `userData` directory

---

## 6. Local Config / Display Mapping

The display mapping is saved to:
```
%APPDATA%/tv-player-app/display-config.json
```

---

## 7. Step-by-Step Run Guide

### Prerequisites
- Node.js 18+ installed
- The CMS Supabase project URL and anon key (from main web app's `.env`)
- Two TVs connected via HDMI (Windows Extend mode)

### A) Setup Supabase

1. Ensure the CMS tables exist (run `database/tv_display_setup.sql` and `database/tv_display_v2_setup.sql` if needed)
2. Run `database/tv_target_migration.sql` to add the `target` column
3. In Supabase Dashboard → Database → Replication, confirm all 4 CMS TV tables are in the publication

### B) Setup the Electron App

```bash
cd tv-player-app
npm install
copy .env.example .env
# Edit .env with your CMS Supabase credentials
```

### C) Run in Development

```bash
npm run dev
```

### D) Build for Production

```bash
npm run package
```

The installer is at `release/TV Player Setup X.X.X.exe`.

---

## 8. Troubleshooting

### TV windows not opening on correct monitors
- Ensure Windows is in **Extend** mode (not Duplicate)
- Use Control Panel → Refresh Displays → assign TV1/TV2 → Save Mapping → Reopen TV Windows

### Realtime updates not arriving
- Verify `database/tv_target_migration.sql` was run (enables realtime publication)
- Check Supabase Dashboard → Database → Replication
- Ensure `.env` has correct CMS Supabase credentials

### Content shows on wrong TV
- Check the `target` column value in each CMS table
- If physical TVs are swapped, remap in Control Panel

### PC goes to sleep / screen turns off
- Windows Settings → System → Power & sleep → set to **Never**

```bash
npm run dev
```

This starts:
1. Vite dev server at http://localhost:5173
2. Electron app connecting to the Vite server

The Control Panel opens on your primary monitor. If external displays are connected, TV1 and TV2 kiosk windows open on them.

### D) Build for Production

```bash
# Build only (no installer)
npm run build

# Build + create Windows installer
npm run package
```

The installer is at `release/TV Player Setup X.X.X.exe`.

### E) Run in Production

1. Install the `.exe` on the TV PC
2. The `.env` values are baked in at build time
3. Launch "TV Player" from Start Menu
4. Use the Control Panel to configure display mapping
5. The mapping is saved and persists across restarts

---

## 9. Troubleshooting

### TV windows not opening on correct monitors
- Ensure Windows is in **Extend** mode (not Duplicate)
- Open Control Panel → Refresh Displays → manually assign TV1/TV2 → Save Mapping → Reopen TV Windows

### "No external displays detected" warning
- Check HDMI cables and connections
- Windows Settings → System → Display → verify both TVs are visible
- Some TVs need to be turned on before they're detected

### Realtime updates not arriving
- Verify `ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_content;` was run
- In Supabase Dashboard → Database → Replication → confirm `tv_content` listed
- Check browser/Electron DevTools console for subscription status messages
- Ensure `.env` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Content shows on wrong TV
- Each player subscribes to `target=eq.TV1` or `target=eq.TV2`
- Verify in Supabase: `SELECT * FROM tv_content;` to confirm which target has which content
- If physical TVs are swapped, remap in Control Panel

### PC goes to sleep / screen turns off
- Windows Settings → System → Power & sleep → set to **Never**

---

## 9. Operational Assumptions

- **Windows Extend mode:** Both HDMI TVs must appear as separate monitors in Windows Display Settings
- **No sleep:** The PC should never go to sleep or turn off the screen
- **Signage-style:** The app is designed for always-on, unattended operation
- **Network required:** The PC needs internet access for Supabase realtime
- **TV windows persist:** Minimizing or hiding the Control Panel does NOT affect TV windows
- **Tray access:** If Control Panel is closed, double-click the system tray icon to reopen it
