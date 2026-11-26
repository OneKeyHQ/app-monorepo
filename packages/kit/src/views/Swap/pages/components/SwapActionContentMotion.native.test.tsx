/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { SwapActionContentMotion } from './SwapActionContentMotion.native';

let mockReducedMotion = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false },
}));

// Each layer renders the layout animation it would mount with, so the tests
// read where it starts and where it goes.
jest.mock('react-native-reanimated', () => {
  const linear = (progress: number) => progress;
  function MockAnimatedView({
    children,
    entering,
    'aria-hidden': ariaHidden,
  }: PropsWithChildren<{
    entering?: () => { initialValues: unknown; animations: unknown };
    'aria-hidden'?: boolean;
  }>) {
    const animation = entering?.();
    return (
      <div
        data-testid={ariaHidden ? 'leaving' : 'content'}
        data-from={animation ? JSON.stringify(animation.initialValues) : ''}
        data-to={animation ? JSON.stringify(animation.animations) : ''}
      >
        {children}
      </div>
    );
  }
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    Easing: {
      bezier: () => ({ factory: () => linear }),
      bezierFn: () => linear,
    },
    ReduceMotion: { Never: 'never' },
    useReducedMotion: () => mockReducedMotion,
    withTiming: (toValue: number, config: { duration: number }) => ({
      toValue,
      duration: config.duration,
    }),
  };
});

function renderMotion(contentKey: string | null, fillKey: boolean) {
  return (
    <SwapActionContentMotion contentKey={contentKey} fillKey={fillKey}>
      <span>{contentKey ?? 'dots'}</span>
    </SwapActionContentMotion>
  );
}

const layer = (testId: 'content' | 'leaving') => {
  const node = screen.getByTestId(testId);
  return {
    text: node.textContent,
    from: node.dataset.from ? (JSON.parse(node.dataset.from) as unknown) : null,
    to: node.dataset.to ? (JSON.parse(node.dataset.to) as unknown) : null,
  };
};

describe('SwapActionContentMotion (native)', () => {
  let now = 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the first content without motion', () => {
    render(renderMotion('Enter amount', true));

    expect(layer('content')).toEqual({
      text: 'Enter amount',
      from: null,
      to: null,
    });
    expect(screen.queryByTestId('leaving')).toBeNull();
  });

  it('raises new content in and lets the old content leave on the same fill', () => {
    const { rerender } = render(renderMotion('Enter amount', true));

    rerender(renderMotion(null, true));

    expect(layer('content')).toEqual({
      text: 'dots',
      from: { opacity: 0, transform: [{ translateY: 8 }] },
      to: {
        opacity: { toValue: 1, duration: 180 },
        transform: [{ translateY: { toValue: 0, duration: 260 } }],
      },
    });
    expect(layer('leaving')).toEqual({
      text: 'Enter amount',
      from: { opacity: 1, transform: [{ translateY: 0 }] },
      to: {
        opacity: { toValue: 0, duration: 120 },
        transform: [{ translateY: { toValue: -4, duration: 120 } }],
      },
    });

    act(() => {
      jest.advanceTimersByTime(140);
    });
    expect(screen.queryByTestId('leaving')).toBeNull();
    expect(layer('content').text).toBe('dots');
  });

  it('drops the old content without an exit when the fill flips', () => {
    const { rerender } = render(renderMotion(null, true));

    rerender(renderMotion('Review', false));

    expect(screen.queryByTestId('leaving')).toBeNull();
    expect(layer('content').from).toEqual({
      opacity: 0,
      transform: [{ translateY: 8 }],
    });
  });

  it('only fades with reduced motion', () => {
    mockReducedMotion = true;
    const { rerender } = render(renderMotion('Enter amount', true));

    rerender(renderMotion(null, true));

    expect(layer('content').from).toEqual({
      opacity: 0,
      transform: [{ translateY: 0 }],
    });
    expect(layer('leaving').to).toEqual({
      opacity: { toValue: 0, duration: 120 },
      transform: [{ translateY: { toValue: 0, duration: 120 } }],
    });
  });

  it('carries on from where an interrupted entrance got to', () => {
    const { rerender } = render(renderMotion('Enter amount', true));
    rerender(renderMotion(null, true));

    // Halfway through the fade (90 of 180ms) and 90 of 260ms into the rise.
    now += 90;
    rerender(renderMotion('Insufficient balance', true));

    const y = 8 * (1 - 90 / 260);
    expect(layer('content').from).toEqual({
      opacity: 0.5,
      transform: [{ translateY: y }],
    });
    expect(layer('content').to).toEqual({
      opacity: { toValue: 1, duration: 90 },
      transform: [{ translateY: { toValue: 0, duration: 260 * (y / 8) } }],
    });
    expect(layer('leaving')).toMatchObject({
      text: 'dots',
      from: { opacity: 0.5, transform: [{ translateY: y }] },
    });
  });

  it('lets a later change leave with content that changed in place', () => {
    const { rerender } = render(
      <SwapActionContentMotion contentKey="Swap" fillKey={false}>
        <span>Swap (old color)</span>
      </SwapActionContentMotion>,
    );
    rerender(
      <SwapActionContentMotion contentKey="Swap" fillKey={false}>
        <span>Swap (new color)</span>
      </SwapActionContentMotion>,
    );
    expect(screen.queryByTestId('leaving')).toBeNull();

    rerender(renderMotion('Enter amount', false));

    expect(layer('leaving').text).toBe('Swap (new color)');
  });
});
