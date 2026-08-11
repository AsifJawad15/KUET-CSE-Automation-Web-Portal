// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TvStartupCurtain from './TvStartupCurtain';

describe('TvStartupCurtain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('stays closed until the TV content is ready', () => {
    const { container, rerender } = render(
      <TvStartupCurtain ready={false} target="TV1" />,
    );

    act(() => vi.advanceTimersByTime(3_000));
    expect(container.querySelector('.tv-startup-curtain--closed')).not.toBeNull();

    rerender(<TvStartupCurtain ready target="TV1" />);
    expect(container.querySelector('.tv-startup-curtain--opening')).not.toBeNull();
  });

  it('runs the stage approach, curtain opening, title hold, and final reveal in order', () => {
    const { container } = render(
      <TvStartupCurtain ready target="TV2" />,
    );

    act(() => vi.advanceTimersByTime(1_899));
    expect(container.querySelector('.tv-startup-curtain--closed')).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('.tv-startup-curtain--opening')).not.toBeNull();

    act(() => vi.advanceTimersByTime(1_450));
    expect(container.querySelector('.tv-startup-curtain--title')).not.toBeNull();

    act(() => vi.advanceTimersByTime(1_300));
    expect(container.querySelector('.tv-startup-curtain--departing')).not.toBeNull();

    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelector('.tv-startup-curtain')).toBeNull();
  });
});
