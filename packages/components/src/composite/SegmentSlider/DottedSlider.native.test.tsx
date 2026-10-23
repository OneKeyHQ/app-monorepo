/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import { DottedSlider } from './DottedSlider.native';

import type { LayoutChangeEvent } from 'react-native';

jest.unmock('react-native');

type IEvent = { x: number; translationX: number; translationY: number };
type IHandler = (event: IEvent, success: boolean) => void;
type IPhase = 'begin' | 'start' | 'update' | 'end' | 'finalize';
const mockHandlers: Record<'pan' | 'tap', Partial<Record<IPhase, IHandler>>> = {
  pan: {},
  tap: {},
};
const mockDragProgress = { value: 0 };
let mockLayout: ((event: LayoutChangeEvent) => void) | undefined;

jest.mock('react-native-gesture-handler', () => {
  const createGesture = (kind: 'pan' | 'tap') => {
    const gesture = {
      enabled: () => gesture,
      minDistance: () => gesture,
      onBegin: (handler: IHandler) => {
        mockHandlers[kind].begin = handler;
        return gesture;
      },
      onStart: (handler: IHandler) => {
        mockHandlers[kind].start = handler;
        return gesture;
      },
      onUpdate: (handler: IHandler) => {
        mockHandlers[kind].update = handler;
        return gesture;
      },
      onEnd: (handler: IHandler) => {
        mockHandlers[kind].end = handler;
        return gesture;
      },
      onFinalize: (handler: IHandler) => {
        mockHandlers[kind].finalize = handler;
        return gesture;
      },
    };
    return gesture;
  };
  return {
    GestureDetector: ({ children }: { children: ReactNode }) => children,
    Gesture: {
      Pan: () => createGesture('pan'),
      Tap: () => createGesture('tap'),
      Race: (...gestures: unknown[]) => gestures,
    },
  };
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (component: unknown) => component,
    View: ({
      children,
      onLayout,
    }: {
      children?: ReactNode;
      onLayout?: typeof mockLayout;
    }) => {
      if (onLayout) mockLayout = onLayout;
      return children;
    },
  },
  runOnJS: (fn: unknown) => fn,
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useDerivedValue: () => mockDragProgress,
  Easing: { cubic: jest.fn(), out: jest.fn() },
  withTiming: (value: unknown) => value,
}));
jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: '#000000' },
    bg: { val: '#1b1b1b' },
    neutral3: { val: '#eeeeee' },
    bgApp: { val: '#000000' },
    neutral5: { val: '#dddddd' },
    textSubdued: { val: '#888888' },
    text: { val: '#ffffff' },
    bgSubdued: { val: '#222222' },
    borderSubdued: { val: '#333333' },
  }),
}));
jest.mock('../../content/LinearGradient', () => ({
  LinearGradient: () => null,
}));
jest.mock('../../primitives/Haptics', () => ({
  Haptics: { selection: jest.fn(), impact: jest.fn() },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('./DottedSliderTrack.native', () => ({
  DottedSliderTrack: () => null,
}));

function setup(
  snapTapToSegment = true,
  value = 0,
  onSlideComplete?: () => void,
  onSlideStart?: () => void,
) {
  mockDragProgress.value = 0;
  const onChange = jest.fn();
  render(
    <DottedSlider
      value={value}
      segments={4}
      onChange={onChange}
      snapTapToSegment={snapTapToSegment}
      showBubble={false}
      onSlideComplete={onSlideComplete}
      onSlideStart={onSlideStart}
    />,
  );
  act(() =>
    mockLayout?.({
      nativeEvent: { layout: { width: 128, height: 44, x: 0, y: 0 } },
    } as LayoutChangeEvent),
  );
  return onChange;
}
function send(
  phase: IPhase,
  x: number,
  translationX = 0,
  success = true,
  kind: keyof typeof mockHandlers = 'pan',
) {
  act(() =>
    mockHandlers[kind][phase]?.({ x, translationX, translationY: 0 }, success),
  );
}

function releaseTap(x: number) {
  send('finalize', x, 0, false);
  send('end', x, 0, true, 'tap');
  send('finalize', x, 0, true, 'tap');
}

describe('native dotted slider gestures', () => {
  it('emits only the snapped value for a tap, including small finger jitter', () => {
    const change = setup();
    send('begin', 41);
    expect(change).not.toHaveBeenCalled();
    releaseTap(42);
    expect(change.mock.calls).toEqual([[25]]);
  });

  it.each([14, 39, 64, 89, 114])(
    'commits a successful stationary tap at x=%s without a pan end callback',
    (x) => {
      const change = setup();
      send('begin', x);
      expect(change).not.toHaveBeenCalled();
      releaseTap(x);
      const expected = x - 14;
      if (expected === 0) expect(change).not.toHaveBeenCalled();
      else expect(change.mock.calls).toEqual([[expected]]);
      expect(change).toHaveBeenCalledTimes(expected === 0 ? 0 : 1);
    },
  );

  it.each([27, 47, 80, 101])(
    'selects the exact percentage between mark hot zones at x=%s',
    (x) => {
      const change = setup();
      send('begin', x);
      releaseTap(x);
      expect(change.mock.calls).toEqual([[x - 14]]);
      expect(change).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a tapped value stable as the track grows and maps dragging through that scale', () => {
    const change = setup();
    send('begin', 47);
    mockDragProgress.value = 1;
    releaseTap(47);
    expect(change.mock.calls).toEqual([[33]]);
    mockDragProgress.value = 0;
    send('begin', 47);
    send('start', 47);
    mockDragProgress.value = 1;
    send('update', 64 + (78 - 64) * 1.04, 31);
    expect(change).toHaveBeenLastCalledWith(64);
  });

  it('uses medium feedback while throttling fast value changes', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    jest.mocked(Haptics.impact).mockClear();
    try {
      setup(false);
      send('begin', 47);
      send('start', 47);
      expect(Haptics.impact).toHaveBeenLastCalledWith(
        ImpactFeedbackStyle.Medium,
      );
      now.mockReturnValue(1020);
      send('update', 60, 13);
      expect(Haptics.impact).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1050);
      send('update', 70, 23);
      expect(Haptics.impact).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  it('keeps dragging continuous without snapping when the finger returns near its start', () => {
    const change = setup();
    send('begin', 47);
    send('start', 47);
    send('update', 64, 17);
    send('update', 47, 0);
    send('end', 47, 0);
    expect(change.mock.calls).toEqual([[33], [50], [33]]);
  });

  it('uses the final drag position even without an intermediate update', () => {
    const change = setup();
    send('begin', 47);
    send('start', 47);
    send('end', 78, 31);
    expect(change.mock.calls).toEqual([[33], [64]]);
  });

  it('commits a successful tap when snapping is disabled', () => {
    const change = setup(false);
    send('begin', 47);
    expect(change).not.toHaveBeenCalled();
    releaseTap(47);
    expect(change.mock.calls).toEqual([[33]]);
  });

  it('does not commit a gesture that fails before activation', () => {
    const complete = jest.fn();
    const change = setup(true, 50, complete);
    send('begin', 89);
    send('finalize', 89, 0, false);
    send('finalize', 89, 0, false, 'tap');
    expect(change).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('restores the starting value when an active drag is cancelled', () => {
    const complete = jest.fn();
    const change = setup(true, 50, complete);
    send('begin', 89);
    send('start', 89);
    send('finalize', 89, 0, false, 'tap');
    send('update', 100, 11);
    send('end', 114, 25, false);
    send('finalize', 114, 25, false);
    expect(change.mock.calls).toEqual([[75], [86], [50]]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('starts dragging again after a stationary press outlasts the tap timeout', () => {
    const start = jest.fn();
    const complete = jest.fn();
    const change = setup(true, 50, complete, start);
    send('begin', 89);
    send('finalize', 89, 0, false, 'tap');
    expect(change).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    send('start', 100, 11);
    expect(start).toHaveBeenCalledTimes(2);
    send('end', 114, 25);
    send('finalize', 114, 25);
    expect(change.mock.calls).toEqual([[86], [100]]);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
