# KUET CSE TV Player

Windows Electron signage player for the KUET CSE TV Display system. One
installation owns a control window and one fullscreen kiosk window per active
TV device.

## Production architecture

- The web admin owns announcements, ticker items, events, layout settings, and
  the active TV device registry.
- `GET /api/tv-display/snapshot` is the canonical read contract. It returns
  target-filtered content, device settings, and 14 days of resolved schedules.
- Schedules include permanent routine slots and approved CR, teacher, and
  administrator bookings.
- The player subscribes to Supabase Realtime for low-latency invalidation and
  performs a jittered 60-second snapshot poll as a safety net.
- Snapshot dates and clock calculations always use `Asia/Dhaka`.
- Snapshot JSON is atomically persisted under Electron `userData`; referenced
  images are served by the disk-backed `tv-media://` cache.

## Requirements

- Windows 10/11 in **Extend** display mode.
- Node.js 20 or newer for development.
- A deployed web portal exposing `/api/tv-display/snapshot`.
- CMS and academic Supabase read access.

Copy `.env.example` to the repository root `.env.local` or provide the same
variables in the build environment. The snapshot URL is required for the
complete merged schedule; direct Supabase reads are retained only as a legacy
fallback.

## Development

```bash
cd tv-player-app
npm install
npm run dev
```

Vite intentionally owns `127.0.0.1:5173` with strict-port behavior. If that
port is occupied, stop the conflicting process; the TV player will not silently
connect to an unrelated development server.

## Verification and packaging

```bash
npm run typecheck
npm test
npm run build
npm run package
```

The NSIS installer is written to `release/`. Production renderer chunks are
route-split so kiosk windows do not load control-panel code.

## Display mapping behavior

- Active TV names come from `cms_tv_devices`.
- Auto-detection uses external monitors only; the primary control display is
  never selected automatically.
- Explicit assignments must be unique.
- Version-2 mappings store the Electron display ID plus label, resolution,
  scale, primary status, and last bounds.
- When Windows changes a display ID, the player attempts a unique fingerprint
  match. Ambiguous targets remain unmapped rather than opening on the wrong TV.
- HDMI add/remove/resolution events trigger debounced window reconciliation.

Use **Save Mapping** to validate, persist, and immediately apply assignments.
The control panel reports unmapped or unavailable monitors and never reports a
failed disk write as successful.

## Offline behavior

On startup, each kiosk loads its last-known snapshot before requesting the
network. Snapshots do not expire merely because they are old; the screen shows
their freshness. The image cache keeps up to 500 MB and protects media
referenced by the current snapshot from LRU eviction.

Cache locations are beneath:

```text
%APPDATA%/tv-player-app/
  display-config.json
  snapshots/
  media-cache/
```

Editorial breaking news remains separate from connection warnings. During an
outage the display keeps the administrator-authored breaking message and adds a
small cached/offline status ribbon.

## Operations

- **Prevent display sleep** defaults on while TV windows are active.
- **Launch at Windows sign-in** is optional and defaults off.
- A single-instance lock prevents duplicate kiosk sets.
- Crashed or unresponsive renderers are restarted with capped backoff.
- Closing the control window hides it; reopen it from the system tray.
- **Close TV Windows** is persistent until **Reconcile TV Windows** is chosen.

## Database setup

Run `database/tv_display_production_hardening.sql` in the relevant CMS and
academic projects. The migration adds `show_room_schedule`, display-query
indexes, schedule indexes, and idempotent Realtime publication membership.

RLS is not toggled automatically because existing deployments use different
CMS authentication claims. Establish project-specific public read and
authenticated-admin write policies before enabling RLS.

## Troubleshooting

- **No TV window:** verify the device is active, a unique external monitor is
  assigned, and Windows is in Extend mode.
- **Schedule differs from the portal:** confirm `NEXT_PUBLIC_APP_URL` or
  `VITE_TV_APP_URL` points to the deployed portal and the snapshot endpoint is
  reachable.
- **Cached ribbon remains:** inspect the endpoint, CMS credentials, and
  Supabase Realtime publication; the player will recover without restart.
- **Images missing offline:** reconnect once so current event media can be
  prefetched into `media-cache`.
