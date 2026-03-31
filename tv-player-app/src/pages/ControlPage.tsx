import { useEffect, useState, useCallback } from 'react';
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
  const [config, setConfig] = useState<DisplayConfig>({});
  const [status, setStatus] = useState<AppStatus>({
    tvStatus: {},
    displays: 0,
  });
  const [devices, setDevices] = useState<CmsTvDevice[]>([]);
  const [announcements, setAnnouncements] = useState<CmsTvAnnouncement[]>([]);
  const [ticker, setTicker] = useState<CmsTvTicker[]>([]);
  const [events, setEvents] = useState<CmsTvEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isElectron = !!window.electronAPI;

  // ── Fetch active devices from Supabase ──
  const refreshDevices = useCallback(async () => {
    try {
      const devs = await fetchActiveDevices();
      setDevices(devs);
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
    setConfig(dispConfig);
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
      window.electronAPI.onDisplaysChanged(() => refreshDisplays());
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
      window.electronAPI?.removeDisplaysChanged();
    };
  }, [refreshDisplays, refreshDevices, fetchTvContent]);

  // ── Actions ──
  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveConfig = async () => {
    if (!window.electronAPI) return;
    setSaving(true);
    try {
      await window.electronAPI.saveDisplayConfig(config);
      showMessage('Display mapping saved successfully.');
    } catch {
      showMessage('Failed to save config.');
    }
    setSaving(false);
  };

  const handleOpenTvWindows = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.openTvWindows();
    showMessage('TV windows reopened on mapped displays.');
    refreshDisplays();
  };

  const handleCloseTvWindows = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.closeTvWindows();
    showMessage('TV windows closed.');
    refreshDisplays();
  };

  // ── Derive TV names from devices or config ──
  const tvNames = devices.length > 0
    ? devices.map((d) => d.name)
    : Object.keys(config).length > 0
      ? Object.keys(config)
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
    return (
      <div key={tv} className="ctrl-card">
        <h3 className="ctrl-card-title">{tv} Content</h3>
        <div className="ctrl-content-preview">
          <div className="ctrl-content-row">
            <span className="ctrl-label">Announcements:</span>
            <span className={`ctrl-badge ctrl-badge-notice`}>{c.a}</span>
          </div>
          <div className="ctrl-content-row">
            <span className="ctrl-label">Ticker Items:</span>
            <span className={`ctrl-badge ctrl-badge-video`}>{c.t}</span>
          </div>
          <div className="ctrl-content-row">
            <span className="ctrl-label">Events:</span>
            <span className={`ctrl-badge ctrl-badge-image`}>{c.e}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <div className="ctrl-page">
      <header className="ctrl-header">
        <h1>📺 TV Player — Control Panel</h1>
        {!isElectron && (
          <div className="ctrl-warning">
            Running in browser mode. Electron features (display detection,
            TV window management) are unavailable.
          </div>
        )}
      </header>

      {message && <div className="ctrl-message">{message}</div>}

      {/* ── Status ── */}
      <section className="ctrl-section">
        <h2>Status</h2>
        <div className="ctrl-status-grid">
          {tvNames.map((name) => (
            <div
              key={name}
              className={`ctrl-status-item ${
                status.tvStatus[name] === 'running' ? 'status-ok' : 'status-off'
              }`}
            >
              {name}: {status.tvStatus[name] || 'stopped'}
            </div>
          ))}
          <div className="ctrl-status-item">
            Displays connected: {status.displays}
          </div>
        </div>
      </section>

      {/* ── Display Mapping ── */}
      <section className="ctrl-section">
        <h2>Display Mapping</h2>
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
                  <strong>
                    {d.isPrimary ? '🖥️ Primary' : '📺 External'}
                  </strong>{' '}
                  — ID: {d.id}, {d.bounds.width}×{d.bounds.height} at (
                  {d.bounds.x}, {d.bounds.y}), Scale: {d.scaleFactor}x
                </div>
              ))}
            </div>

            <div className="ctrl-mapping-form">
              {tvNames.map((name) => (
                <div key={name} className="ctrl-form-row">
                  <label>{name} Display:</label>
                  <select
                    value={config[name] ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [name]: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">Auto-detect</option>
                    {displays.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.isPrimary ? 'Primary' : 'External'} —{' '}
                        {d.bounds.width}×{d.bounds.height} (ID: {d.id})
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="ctrl-form-actions">
                <button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Mapping'}
                </button>
                <button onClick={handleOpenTvWindows}>
                  Reopen TV Windows
                </button>
                <button
                  onClick={handleCloseTvWindows}
                  className="ctrl-btn-danger"
                >
                  Close TV Windows
                </button>
                <button onClick={refreshDisplays}>Refresh Displays</button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Current Content ── */}
      <section className="ctrl-section">
        <h2>Current Content</h2>
        <div className="ctrl-content-grid">
          {tvNames.map((name) => renderContentPreview(name))}
        </div>
      </section>

      {/* ── Operational Notes ── */}
      <section className="ctrl-section ctrl-notes">
        <h2>Operational Notes</h2>
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
  );
}
