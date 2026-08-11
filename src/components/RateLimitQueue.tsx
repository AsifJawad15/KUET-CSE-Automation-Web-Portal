'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RateLimitQueueProps {
  queuePosition?: number;
  estimatedWaitMs?: number;
  onRetry?: () => void;
  message?: string;
}

/**
 * RateLimitQueue — Full-screen loading overlay shown when an API request is
 * queued due to the 15-concurrent-request server limit.
 *
 * Features:
 *  • Animated queue counter
 *  • Live countdown timer
 *  • Animated particle background
 *  • Retry button after countdown expires
 */
export default function RateLimitQueue({
  queuePosition = 1,
  estimatedWaitMs = 10000,
  onRetry,
  message,
}: RateLimitQueueProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(estimatedWaitMs / 1000));
  const [dots, setDots] = useState('');
  const [pulse, setPulse] = useState(false);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated dots
  useEffect(() => {
    dotsRef.current = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => {
      if (dotsRef.current) clearInterval(dotsRef.current);
    };
  }, []);

  const progress = Math.max(
    0,
    Math.min(100, ((estimatedWaitMs / 1000 - secondsLeft) / (estimatedWaitMs / 1000)) * 100),
  );

  return (
    <div style={styles.overlay}>
      {/* Animated grid background */}
      <div style={styles.gridBg} />

      {/* Floating orbs */}
      <div style={{ ...styles.orb, ...styles.orb1 }} />
      <div style={{ ...styles.orb, ...styles.orb2 }} />
      <div style={{ ...styles.orb, ...styles.orb3 }} />

      {/* Card */}
      <div style={styles.card}>
        {/* Icon + spinner */}
        <div style={styles.iconWrapper}>
          <div style={styles.spinnerRing} />
          <div style={styles.iconInner}>
            <ServerIcon />
          </div>
        </div>

        {/* Heading */}
        <h2 style={styles.heading}>Server Queue</h2>
        <p style={styles.subHeading}>
          {message ?? 'The server is handling maximum concurrent requests.'}
        </p>

        {/* Queue badge */}
        <div style={styles.queueBadge}>
          <span style={styles.queueLabel}>Your position</span>
          <span style={{ ...styles.queueNumber, ...(pulse ? styles.queueNumberPulse : {}) }}>
            #{queuePosition}
          </span>
          <span style={styles.queueLabel}>in queue</span>
        </div>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${progress}%`,
              transition: 'width 1s linear',
            }}
          />
          <div style={{ ...styles.progressGlow, left: `${progress}%` }} />
        </div>

        {/* Timer */}
        <div style={styles.timerRow}>
          <ClockIcon />
          {expired ? (
            <span style={styles.timerText}>Processing{dots}</span>
          ) : (
            <span style={styles.timerText}>
              Estimated wait:{' '}
              <span style={{ ...styles.timerHighlight, ...(pulse ? styles.timerPulse : {}) }}>
                {secondsLeft}s
              </span>
            </span>
          )}
        </div>

        {/* Status dots */}
        <div style={styles.statusRow}>
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.statusDot,
                backgroundColor:
                  i < 15
                    ? `hsl(${200 + i * 5}, 80%, 60%)`
                    : 'rgba(255,255,255,0.15)',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
        <p style={styles.statusLabel}>15 / 15 slots active</p>

        {/* Retry button (shown after countdown or on expiry) */}
        {(expired || onRetry) && (
          <button
            style={styles.retryBtn}
            onClick={onRetry}
            onMouseEnter={(e) =>
              Object.assign((e.target as HTMLButtonElement).style, styles.retryBtnHover)
            }
            onMouseLeave={(e) =>
              Object.assign((e.target as HTMLButtonElement).style, styles.retryBtn)
            }
          >
            {expired ? '↻ Retry Now' : 'Cancel'}
          </button>
        )}
      </div>

      <style>{keyframes}</style>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────

function ServerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <rect x="2" y="10" width="20" height="5" rx="1" />
      <rect x="2" y="17" width="20" height="5" rx="1" />
      <circle cx="6" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="6" cy="12.5" r="0.8" fill="currentColor" />
      <circle cx="6" cy="19.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ opacity: 0.7 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────

const keyframes = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes orb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(40px, -30px) scale(1.15); }
}
@keyframes orb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(-30px, 40px) scale(1.1); }
}
@keyframes orb3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(20px, 20px) scale(1.2); }
}
@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.4); opacity: 0.6; }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(99,179,237,0.4); }
  50%       { box-shadow: 0 0 40px rgba(99,179,237,0.8); }
}
`;

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1b2a 50%, #0a1628 100%)',
    overflow: 'hidden',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(99,179,237,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,179,237,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
  orb1: {
    width: 400,
    height: 400,
    background: 'radial-gradient(circle, rgba(99,179,237,0.12) 0%, transparent 70%)',
    top: '-10%',
    left: '-10%',
    animation: 'orb1 8s ease-in-out infinite',
  },
  orb2: {
    width: 350,
    height: 350,
    background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',
    bottom: '-10%',
    right: '-5%',
    animation: 'orb2 10s ease-in-out infinite',
  },
  orb3: {
    width: 250,
    height: 250,
    background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)',
    top: '50%',
    right: '20%',
    animation: 'orb3 7s ease-in-out infinite',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '48px 40px',
    borderRadius: '24px',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(99,179,237,0.2)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    maxWidth: '480px',
    width: '90vw',
    animation: 'fadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    textAlign: 'center',
  },
  iconWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: 'rgba(99,179,237,0.8)',
    borderRightColor: 'rgba(99,179,237,0.3)',
    animation: 'spin 1.2s linear infinite',
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(99,179,237,0.2) 0%, rgba(167,139,250,0.15) 100%)',
    border: '1px solid rgba(99,179,237,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#63b3ed',
    animation: 'glowPulse 2s ease-in-out infinite',
  },
  heading: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
    color: '#f0f8ff',
    letterSpacing: '-0.5px',
  },
  subHeading: {
    margin: 0,
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    maxWidth: '320px',
  },
  queueBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    borderRadius: '50px',
    background: 'linear-gradient(135deg, rgba(99,179,237,0.15) 0%, rgba(167,139,250,0.12) 100%)',
    border: '1px solid rgba(99,179,237,0.25)',
  },
  queueLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
  },
  queueNumber: {
    fontSize: '28px',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #63b3ed, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
    transition: 'transform 0.2s',
  },
  queueNumberPulse: {
    transform: 'scale(1.15)',
  },
  progressTrack: {
    position: 'relative',
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.08)',
    overflow: 'visible',
  },
  progressBar: {
    height: '100%',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, #63b3ed, #a78bfa)',
    boxShadow: '0 0 12px rgba(99,179,237,0.6)',
    position: 'relative',
  },
  progressGlow: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#a78bfa',
    boxShadow: '0 0 16px rgba(167,139,250,0.9)',
    transition: 'left 1s linear',
  },
  timerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  timerText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
  },
  timerHighlight: {
    color: '#63b3ed',
    fontWeight: 700,
    fontSize: '16px',
    display: 'inline-block',
    transition: 'transform 0.2s',
    fontVariantNumeric: 'tabular-nums',
  },
  timerPulse: {
    transform: 'scale(1.2)',
    color: '#a78bfa',
  },
  statusRow: {
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'dotPulse 1.5s ease-in-out infinite',
  },
  statusLabel: {
    margin: 0,
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '0.5px',
  },
  retryBtn: {
    padding: '12px 32px',
    borderRadius: '12px',
    border: '1px solid rgba(99,179,237,0.4)',
    background: 'linear-gradient(135deg, rgba(99,179,237,0.15) 0%, rgba(167,139,250,0.12) 100%)',
    color: '#63b3ed',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.3px',
  },
  retryBtnHover: {
    padding: '12px 32px',
    borderRadius: '12px',
    border: '1px solid rgba(99,179,237,0.7)',
    background: 'linear-gradient(135deg, rgba(99,179,237,0.25) 0%, rgba(167,139,250,0.2) 100%)',
    color: '#90cdf4',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.3px',
    boxShadow: '0 0 20px rgba(99,179,237,0.3)',
  },
};
