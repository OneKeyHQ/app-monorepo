/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { SwapActionContentMotion } from './SwapActionContentMotion.native';

const LAID_OUT_WIDTH = 132;
let mockReducedAtStartup = false;
// The startup read never settles here; the tests switch the setting through
// the change event.
const mockAccessibility: { onChange?: (reduced: boolean) => void } = {};

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  AccessibilityInfo: {
    isReduceMotionEnabled: () => new Promise<boolean>(() => {}),
    addEventListener: (_event: string, handler: (reduced: boolean) => void) => {
      mockAccessibility.onChange = handler;
      return { remove: () => {} };
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false },
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    fn(...args),
}));

// Each layer runs its layout animation once, when it mounts, and renders where
// it starts and where it goes. The content layer reports a laid-out width, and
// an animation's callback runs once its longest timing has played.
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const linear = (progress: number) => progress;
  interface IMockTiming {
    toValue: number;
    duration: number;
  }
  interface IMockAnimation {
    initialValues: unknown;
    animations: {
      opacity: IMockTiming;
      transform: [{ translateY: IMockTiming }];
    };
    callback?: () => void;
  }
  function MockAnimatedView({
    children,
    entering,
    onLayout,
    style,
  }: PropsWithChildren<{
    entering?: () => IMockAnimation;
    onLayout?: (event: unknown) => void;
    style?: unknown;
  }>) {
    const [animation] = React.useState(() => entering?.());
    React.useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 132, height: 24 } } });
      if (!animation?.callback) {
        return undefined;
      }
      const { opacity, transform } = animation.animations;
      const timer = setTimeout(
        animation.callback,
        Math.max(opacity.duration, transform[0].translateY.duration),
      );
      return () => clearTimeout(timer);
    }, [animation, onLayout]);
    const flat = Object.assign({}, ...[style].flat()) as { width?: number };
    return (
      <div
        data-testid={onLayout ? 'content' : 'leaving'}
        data-from={animation ? JSON.stringify(animation.initialValues) : ''}
        data-to={animation ? JSON.stringify(animation.animations) : ''}
        data-width={flat.width ?? ''}
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
    useReducedMotion: () => mockReducedAtStartup,
    useSharedValue: <T,>(initial: T) =>
      React.useRef({ value: initial }).current,
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
    width: node.dataset.width ? Number(node.dataset.width) : null,
  };
};

describe('SwapActionContentMotion (native)', () => {
  let now = 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedAtStartup = false;
    mockAccessibility.onChange = undefined;
    now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the first content without motion', () => {
    render(renderMotion('Enter amount', true));

    expect(layer('content')).toMatchObject({
      text: 'Enter amount',
      from: null,
      to: null,
    });
    expect(screen.queryByTestId('leaving')).toBeNull();
  });

  it('raises new content in and lets the old content leave at its width', () => {
    const { rerender } = render(renderMotion('Enter amount', true));

    rerender(renderMotion(null, true));

    expect(layer('content')).toMatchObject({
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
      width: LAID_OUT_WIDTH,
    });

    // The copy goes when its exit has played.
    act(() => {
      jest.advanceTimersByTime(119);
    });
    expect(screen.queryByTestId('leaving')).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(1);
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

  it('takes away a leaving copy when the fill flips under it', () => {
    const { rerender } = render(renderMotion(null, true));
    rerender(renderMotion('Review', true));
    expect(layer('leaving').text).toBe('dots');

    // The same label turns enabled while the dots are still fading out.
    rerender(renderMotion('Review', false));

    expect(screen.queryByTestId('leaving')).toBeNull();
    expect(layer('content').text).toBe('Review');
  });

  it('only fades once the system turns on reduced motion', () => {
    const { rerender } = render(renderMotion('Enter amount', true));
    act(() => {
      mockAccessibility.onChange?.(true);
    });

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

    // Halfway through the fade (90 of 180ms) and 90 of 260ms into the rise,
    // timed from when that entrance's animation started.
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
