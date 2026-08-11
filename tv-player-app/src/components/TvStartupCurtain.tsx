import { GraduationCap } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';

import './TvStartupCurtain.css';

type CurtainPhase = 'closed' | 'opening' | 'title' | 'departing' | 'finished';

interface TvStartupCurtainProps {
  ready: boolean;
  target: string;
}

const APPROACH_TIME_MS = 1_900;
const OPENING_TIME_MS = 1_450;
const TITLE_HOLD_TIME_MS = 1_300;
const DEPARTURE_TIME_MS = 500;

const REDUCED_APPROACH_TIME_MS = 160;
const REDUCED_OPENING_TIME_MS = 280;
const REDUCED_TITLE_HOLD_TIME_MS = 350;
const REDUCED_DEPARTURE_TIME_MS = 180;

const ARCHES = [
  { id: 'outer', lightCount: 21 },
  { id: 'middle', lightCount: 17 },
  { id: 'inner', lightCount: 13 },
  { id: 'stage', lightCount: 9 },
] as const;

/**
 * A compact theatrical opener inspired by a camera move through an illuminated
 * award-stage tunnel. It holds on the closed curtain until validated content
 * (or an actionable error screen) is ready, then reveals the TV safely.
 */
export default function TvStartupCurtain({ ready, target }: TvStartupCurtainProps) {
  const [phase, setPhase] = useState<CurtainPhase>('closed');
  const [approachComplete, setApproachComplete] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const approachTimer = window.setTimeout(
      () => setApproachComplete(true),
      reduceMotion ? REDUCED_APPROACH_TIME_MS : APPROACH_TIME_MS,
    );
    return () => window.clearTimeout(approachTimer);
  }, [reduceMotion]);

  useEffect(() => {
    if (ready && approachComplete && phase === 'closed') {
      setPhase('opening');
    }
  }, [approachComplete, phase, ready]);

  useEffect(() => {
    if (phase !== 'opening') return;
    const openingTimer = window.setTimeout(
      () => setPhase('title'),
      reduceMotion ? REDUCED_OPENING_TIME_MS : OPENING_TIME_MS,
    );
    return () => window.clearTimeout(openingTimer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== 'title') return;
    const titleTimer = window.setTimeout(
      () => setPhase('departing'),
      reduceMotion ? REDUCED_TITLE_HOLD_TIME_MS : TITLE_HOLD_TIME_MS,
    );
    return () => window.clearTimeout(titleTimer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== 'departing') return;
    const departureTimer = window.setTimeout(
      () => setPhase('finished'),
      reduceMotion ? REDUCED_DEPARTURE_TIME_MS : DEPARTURE_TIME_MS,
    );
    return () => window.clearTimeout(departureTimer);
  }, [phase, reduceMotion]);

  if (phase === 'finished') return null;

  return (
    <div
      className={`tv-startup-curtain tv-startup-curtain--${phase} ${
        reduceMotion ? 'tv-startup-curtain--reduced' : ''
      }`}
      aria-hidden="true"
    >
      <div className="tv-startup-curtain__theatre">
        <div className="tv-startup-curtain__void" />

        <div className="tv-startup-curtain__arches">
          {ARCHES.map((arch) => (
            <div
              key={arch.id}
              className={`tv-startup-curtain__arch tv-startup-curtain__arch--${arch.id}`}
            >
              {Array.from({ length: arch.lightCount }, (_, index) => (
                <i
                  key={index}
                  className="tv-startup-curtain__stage-light"
                  style={{
                    '--light-angle': `${-74 + (148 * index) / (arch.lightCount - 1)}deg`,
                  } as CSSProperties}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="tv-startup-curtain__runway">
          <i />
          <i />
          <i />
        </div>

        <div className="tv-startup-curtain__title-screen">
          <div className="tv-startup-curtain__title-ambient" />
          <div className="tv-startup-curtain__title-lockup">
            <div className="tv-startup-curtain__crest">
              <GraduationCap className="tv-startup-curtain__crest-icon" strokeWidth={1.8} />
            </div>
            <p className="tv-startup-curtain__eyebrow">
              Khulna University of Engineering &amp; Technology
            </p>
            <h1 className="tv-startup-curtain__title">
              KUET <span>CSE</span>
            </h1>
            <div className="tv-startup-curtain__rule">
              <i />
              <b />
              <i />
            </div>
            <p className="tv-startup-curtain__subtitle">
              Department Digital Display
            </p>
            <span className="tv-startup-curtain__target">{target}</span>
          </div>
        </div>

        <div className="tv-startup-curtain__velvet tv-startup-curtain__velvet--left">
          <div className="tv-startup-curtain__velvet-folds" />
          <div className="tv-startup-curtain__velvet-sheen" />
          <div className="tv-startup-curtain__velvet-hem" />
        </div>
        <div className="tv-startup-curtain__velvet tv-startup-curtain__velvet--right">
          <div className="tv-startup-curtain__velvet-folds" />
          <div className="tv-startup-curtain__velvet-sheen" />
          <div className="tv-startup-curtain__velvet-hem" />
        </div>

        <div className="tv-startup-curtain__curtain-seam" />
        <div className="tv-startup-curtain__proscenium" />
      </div>
    </div>
  );
}
