import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Monitor, Wifi, WifiOff, Settings2, Tv, RefreshCw,
  Layout, Save, X, Play, ChevronRight, Info,
  GraduationCap,
} from 'lucide-react';
import {
  supabase,
  fetchAllTvDisplayData,
  fetchActiveDevices,
  type CmsTvAnnouncement,
  type CmsTvTicker,
  type CmsTvEvent,
  type CmsTvDevice,
} from '../lib/supabase';

export default function ControlPage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [displayConfig, setDisplayConfig] = useState<DisplayConfigV2 | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<AppStatus>({
    tvStatus: {},
    displays: 0,
    mappingIssues: {},
    snapshotMeta: [],
    mediaCache: { sizeBytes: 0, entries: 0, quotaBytes: 500 * 1024 * 1024 },
    preventDisplaySleep: true,
    launchAtLogin: false,
  });
  const [devices, setDevices] = useState<CmsTvDevice[]>([]);
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isElectron = !!window.electronAPI;

  // ── Fetch active devices from Supabase ──
  const refreshDevices = useCallback(async () => {
    try {
      const devs = await fetchActiveDevices();
      setDevices(devs);
      if (window.electronAPI && devs.length > 0) {
        const result = await window.electronAPI.syncActiveTargets(devs.map((device) => device.name));
        if (!result.success) throw new Error(result.error || 'Failed to synchronize TV devices.');
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  }, []);

  // ── Fetch Electron display/status info ──
  const refreshDisplays = useCallback(async () => {
    if (!window.electronAPI) return;
    const [dispList, dispConfig, appStatus] = await Promise.all([
      window.electronAPI.getDisplays(),
      window.electronAPI.getDisplayConfig(),
      window.electronAPI.getAppStatus(),
    ]);
    setDisplays(dispList);
    setDisplayConfig(dispConfig);
    setMapping(Object.fromEntries(
      Object.entries(dispConfig.assignments).map(([target, assignment]) => [
        target,
        assignment.displayId,
      ]),
    ));
    setStatus(appStatus);
  }, []);

  // ── Fetch current CMS TV content from Supabase ──
  const fetchTvContent = useCallback(async () => {
    try {
      const data = await fetchAllTvDisplayData();
      setAnnouncements(data.announcements);
      setTicker(data.ticker);
      setEvents(data.events);
    } catch (err) {
      console.error('Failed to fetch CMS content:', err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    refreshDisplays();
    fetchTvContent();

    const channel = supabase
      .channel('tv-content-control')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_announcements' }, () => fetchTvContent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_ticker' }, () => fetchTvContent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_events' }, () => fetchTvContent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_tv_devices' }, () => refreshDevices())
      .subscribe();

    if (window.electronAPI) {
      window.electronAPI.onDisplaysChanged(refreshDisplays);
    }

    const interval = setInterval(async () => {
      if (window.electronAPI) {
        const s = await window.electronAPI.getAppStatus();
        setStatus(s);
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.electronAPI?.removeDisplaysChanged(refreshDisplays);
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [refreshDisplays, refreshDevices, fetchTvContent]);

  // ── Actions ──
  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 4000);
  };

  const handleSaveConfig = async () => {
    if (!window.electronAPI) return;
    setSaving(true);
    try {
      const assigned = Object.values(mapping).filter((value): value is number => value !== null);
      if (new Set(assigned).size !== assigned.length) {
        throw new Error('Each TV must use a different display.');
      }
      const result = await window.electronAPI.saveDisplayConfig(mapping);
      if (!result.success) throw new Error(result.error || 'Failed to save display mapping.');
      showMessage('Display mapping saved and applied successfully.');
      await refreshDisplays();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Failed to save config.');
    }
    setSaving(false);
  };

  const handleOpenTvWindows = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openTvWindows();
    showMessage(result.success ? 'TV windows reconciled with mapped displays.' : (result.error || 'Failed to open TV windows.'));
    await refreshDisplays();
  };

  const handleCloseTvWindows = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.closeTvWindows();
    showMessage(result.success ? 'TV windows closed.' : (result.error || 'Failed to close TV windows.'));
    await refreshDisplays();
  };

  const updatePreference = async (
    key: 'preventDisplaySleep' | 'launchAtLogin',
    value: boolean,
  ) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.updatePreferences({ [key]: value });
    if (!result.success) {
      showMessage(result.error || 'Failed to update preference.');
      return;
    }
    await refreshDisplays();
    showMessage('Operational preference updated.');
  };

  // ── Derive TV names from devices or config ──
  const tvNames = devices.length > 0
    ? devices.map((d) => d.name)
    : displayConfig?.activeTargets.length
      ? displayConfig.activeTargets
      : ['TV1', 'TV2'];

  // ── Content preview helpers ──
  const countForTarget = (target: string) => {
    const a = announcements.filter((x) => x.target === target || x.target === 'all').length;
    const t = ticker.filter((x) => x.target === target || x.target === 'all').length;
    const e = events.filter((x) => x.target === target || x.target === 'all').length;
    return { a, t, e };
  };

  const renderContentPreview = (tv: string) => {
    const c = countForTarget(tv);
    const isRunning = status.tvStatus[tv] === 'running';
    return (
      <div key={tv} className="ctrl-card group">
        <h3 className="ctrl-card-title">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: isRunning
                ? 'linear-gradient(135deg, rgba(0,121,107,0.25), rgba(0,121,107,0.15))'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isRunning ? 'rgba(0,121,107,0.35)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <Tv className="w-4 h-4" style={{ color: isRunning ? '#26a69a' : 'rgba(255,255,255,0.3)' }} />
          </div>
          {tv} Content
        </h3>
        <div className="ctrl-content-preview">
          <div className="ctrl-content-row">
            <span className="ctrl-label">Announcements:</span>
            <span className="ctrl-badge ctrl-badge-notice">{c.a}</span>
          </div>
          <div className="ctrl-content-row">
            <span className="ctrl-label">Ticker Items:</span>
            <span className="ctrl-badge ctrl-badge-video">{c.t}</span>
          </div>
          <div className="ctrl-content-row">
            <span className="ctrl-label">Events:</span>
            <span className="ctrl-badge ctrl-badge-image">{c.e}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <div className="ctrl-page">
      {/* ── Premium Header ── */}
      <header className="ctrl-header">
        <h1>
          <span className="header-icon">
            <GraduationCap className="w-5 h-5 text-white" />
          </span>
          <span>
            <span style={{ color: '#ffc107', textShadow: '0 0 16px rgba(255,193,7,0.3)' }}>KUET</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 8px' }}>|</span>
            <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>TV Player — Control Panel</span>
          </span>
        </h1>
        {!isElectron && (
          <div className="ctrl-warning">
            <Info className="w-4 h-4 inline-block mr-2 opacity-80" />
            Running in browser mode. Electron features (display detection,
            TV window management) are unavailable.
          </div>
        )}
      </header>

      <div className="ctrl-body">
        {message && (
          <div className="ctrl-message">
            <ChevronRight className="w-4 h-4 inline-block mr-1 opacity-70" />
            {message}
          </div>
        )}

        {/* ── Status ── */}
        <section className="ctrl-section">
          <h2>
            <Wifi className="w-3.5 h-3.5" />
            Status
          </h2>
          <div className="ctrl-status-grid">
            {tvNames.map((name) => {
              const isRunning = status.tvStatus[name] === 'running';
              const mappingIssue = status.mappingIssues[name];
              return (
                <div
                  key={name}
                  className={`ctrl-status-item ${isRunning ? 'status-ok' : 'status-off'}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: isRunning ? '#26a69a' : '#ef5350',
                        boxShadow: isRunning
                          ? '0 0 8px rgba(38,166,154,0.5)'
                          : '0 0 8px rgba(239,83,80,0.3)',
                      }}
                    />
                    {isRunning ? (
                      <Wifi className="w-3.5 h-3.5 opacity-70" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 opacity-70" />
                    )}
                    <span>
                      {name}: {status.tvStatus[name] || 'stopped'}
                      {mappingIssue ? ` · ${mappingIssue.replace(/-/g, ' ')}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="ctrl-status-item">
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 opacity-70" />
                <span>Displays connected: {status.displays}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Display Mapping ── */}
        <section className="ctrl-section">
          <h2>
            <Layout className="w-3.5 h-3.5" />
            Display Mapping
          </h2>
          {displays.length === 0 ? (
            <p className="ctrl-text-muted">
              {isElectron
                ? 'No displays detected'
                : 'Display detection requires Electron'}
            </p>
          ) : (
            <>
              <div className="ctrl-display-list">
                {displays.map((d) => (
                  <div key={d.id} className="ctrl-display-item">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 flex-shrink-0" style={{ color: d.isPrimary ? '#ffc107' : '#26a69a' }} />
                      <strong style={{ color: d.isPrimary ? '#ffc107' : '#26a69a' }}>
                        {d.isPrimary ? 'Primary' : 'External'}
                      </strong>
                      <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>—</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                        ID: {d.id}, {d.bounds.width}×{d.bounds.height} at ({d.bounds.x}, {d.bounds.y}), Scale: {d.scaleFactor}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ctrl-mapping-form">
                {tvNames.map((name) => (
                  <div key={name} className="ctrl-form-row">
                    <label>
                      <Tv className="w-3.5 h-3.5 inline-block mr-2 opacity-60" />
                      {name} Display:
                    </label>
                    <select
                      value={mapping[name] ?? ''}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [name]: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Auto-detect</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.isPrimary ? 'Primary (control display — use with caution)' : 'External'} —{' '}
                          {d.bounds.width}×{d.bounds.height} (ID: {d.id})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="ctrl-form-actions">
                  <button onClick={handleSaveConfig} disabled={saving}>
                    <Save className="w-3.5 h-3.5 inline-block mr-1.5" />
                    {saving ? 'Saving…' : 'Save Mapping'}
                  </button>
                  <button onClick={handleOpenTvWindows}>
                    <Play className="w-3.5 h-3.5 inline-block mr-1.5" />
                    Reopen TV Windows
                  </button>
                  <button
                    onClick={handleCloseTvWindows}
                    className="ctrl-btn-danger"
                  >
                    <X className="w-3.5 h-3.5 inline-block mr-1.5" />
                    Close TV Windows
                  </button>
                  <button onClick={refreshDisplays}>
                    <RefreshCw className="w-3.5 h-3.5 inline-block mr-1.5" />
                    Refresh Displays
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="ctrl-section">
          <h2>
            <Settings2 className="w-3.5 h-3.5" />
            Operations &amp; Offline Readiness
          </h2>
          <div className="ctrl-mapping-form">
            <label className="ctrl-form-row">
              <span>Prevent display sleep</span>
              <input
                type="checkbox"
                checked={status.preventDisplaySleep}
                onChange={(event) => updatePreference('preventDisplaySleep', event.target.checked)}
              />
            </label>
            <label className="ctrl-form-row">
              <span>Launch at Windows sign-in</span>
              <input
                type="checkbox"
                checked={status.launchAtLogin}
                onChange={(event) => updatePreference('launchAtLogin', event.target.checked)}
              />
            </label>
            <div className="ctrl-content-grid">
              <div className="ctrl-card">
                <h3 className="ctrl-card-title">Offline snapshots</h3>
                <p>{status.snapshotMeta.length} TV snapshot(s) available</p>
                {status.snapshotMeta.map((entry) => (
                  <p key={entry.target} className="ctrl-text-muted">
                    {entry.target}: {new Date(entry.generatedAt).toLocaleString()}
                  </p>
                ))}
              </div>
              <div className="ctrl-card">
                <h3 className="ctrl-card-title">Media cache</h3>
                <p>{(status.mediaCache.sizeBytes / 1024 / 1024).toFixed(1)} MB · {status.mediaCache.entries} assets</p>
                <p className="ctrl-text-muted">
                  Quota: {(status.mediaCache.quotaBytes / 1024 / 1024).toFixed(0)} MB
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Current Content ── */}
        <section className="ctrl-section">
          <h2>
            <Settings2 className="w-3.5 h-3.5" />
            Current Content
          </h2>
          <div className="ctrl-content-grid">
            {tvNames.map((name) => renderContentPreview(name))}
          </div>
        </section>

        {/* ── Operational Notes ── */}
        <section className="ctrl-section ctrl-notes">
          <h2>
            <Info className="w-3.5 h-3.5" />
            Operational Notes
          </h2>
          <ul>
            <li>
              Windows must be in <strong>Extend</strong> display mode (not
              Duplicate/Mirror).
            </li>
            <li>
              Disable sleep and screen timeout on the PC for uninterrupted
              signage.
            </li>
            <li>
              TV windows stay visible even when this control panel is
              minimized or hidden.
            </li>
            <li>
              Use the system tray icon (bottom-right) to reopen this panel if
              closed.
            </li>
            <li>
              Content is updated in real-time from the admin panel via
              Supabase.
            </li>
            <li>
              If a TV is disconnected, use &quot;Reopen TV Windows&quot; after
              reconnecting.
            </li>
            <li>
              Add new TVs from the admin web panel — they appear here
              automatically.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
