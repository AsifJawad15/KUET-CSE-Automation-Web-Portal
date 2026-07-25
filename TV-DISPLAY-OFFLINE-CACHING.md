# TV Display Offline Storage and Recovery

## Current behavior

The production Electron player uses snapshot schema version 2. A snapshot
contains target-filtered CMS content, validated settings, device configuration,
and a 14-day resolved schedule in the `Asia/Dhaka` timezone.

The player loads its disk snapshot before contacting the network. Last-known
data is retained indefinitely; age is metadata shown to operators and is not a
reason to erase the only usable screen.

## Storage

Electron stores atomic JSON snapshots and cached images beneath its `userData`
directory:

```text
snapshots/<target>.json
media-cache/<sha256>.bin
media-cache/<sha256>.json
```

Snapshot writes use a temporary file followed by rename. Media requests use the
`tv-media://` protocol, accept HTTPS image content only, enforce a 20 MB
per-asset limit, and keep a 500 MB LRU cache. Assets referenced by the current
snapshot are retained during pruning.

The web viewer still maintains a last-known localStorage fallback. It no longer
deletes data at a fixed 24-hour boundary; the interface displays its timestamp.

## Connectivity state

- Realtime events are coalesced and refresh only the affected snapshot sections.
- A jittered 60-second full refresh protects against missed Realtime events.
- Obsolete requests are aborted and cannot overwrite newer state.
- Reconnection triggers an immediate refresh and media prefetch.
- Editorial breaking news and connectivity status are independent UI elements.

## Schedule accuracy

The canonical snapshot endpoint resolves routine slots plus approved CR,
teacher, and administrator bookings. Date, weekday, current-period, and
midnight rollover calculations use `Asia/Dhaka`, regardless of the Windows or
hosting-machine timezone.

## Recovery checklist

1. Launch once while online and confirm the control panel lists snapshot and
   media-cache entries.
2. Disconnect networking and restart the application.
3. Confirm content, current schedule, local fonts, and event images load.
4. Restore networking and confirm the cached ribbon clears without restart.
5. Edit each CMS content type and confirm its TV updates within five seconds.

Do not manually delete the snapshot or media-cache directories during an
outage. They are the player's recovery source.
