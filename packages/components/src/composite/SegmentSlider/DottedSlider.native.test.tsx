/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import { DottedSlider } from './DottedSlider.native';

import type { LayoutChangeEvent } from 'react-native';

jest.unmock('react-native');

type IEvent = { x: number; translationX: number; translationY: number };
type IHandler = (event: IEvent) => void;
const mockHandlers: Partial<
  Record<'begin' | 'update' | 'end' | 'finalize', IHandler>
> = {};
const mockDragProgress = { value: 0 };
let mockLayout: ((event: LayoutChangeEvent) => void) | undefined;

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  Gesture: {
    Pan: () => {
      const gesture = {
        enabled: () => gesture,
        minDistance: () => gesture,
        onBegin: (handler: IHandler) => {
          mockHandlers.begin = handler;
          return gesture;
        },
        onUpdate: (handler: IHandler) => {
          mockHandlers.update = handler;
          return gesture;
        },
        onEnd: (handler: IHandler) => {
          mockHandlers.end = handler;
          return gesture;
        },
        onFinalize: (handler: IHandler) => {
          mockHandlers.finalize = handler;
          return gesture;
        },
      };
      return gesture;
    },
  },
}));
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

function setup(snapTapToSegment = true) {
  mockDragProgress.value = 0;
  const onChange = jest.fn();
  render(
    <DottedSlider
      value={0}
      segments={4}
      onChange={onChange}
      snapTapToSegment={snapTapToSegment}
      showBubble={false}
    />,
  );
  act(() =>
    mockLayout?.({
      nativeEvent: { layout: { width: 128, height: 44, x: 0, y: 0 } },
    } as LayoutChangeEvent),
  );
  return onChange;
}
function send(phase: keyof typeof mockHandlers, x: number, translationX = 0) {
  act(() => mockHandlers[phase]?.({ x, translationX, translationY: 0 }));
}

describe('native dotted slider gestures', () => {
  it('emits only the snapped value for a tap, including small finger jitter', () => {
    const change = setup();
    send('begin', 41);
    send('update', 42, 1);
    expect(change.mock.calls).toEqual([[25]]);
    send('end', 42, 1);
    send('finalize', 42, 1);
    expect(change.mock.calls).toEqual([[25]]);
  });

  it.each([14, 39, 64, 89, 114])(
    'jumps immediately on a stationary press at x=%s without a pan end callback',
    (x) => {
      const change = setup();
      send('begin', x);
      const expected = x - 14;
      if (expected === 0) expect(change).not.toHaveBeenCalled();
      else expect(change.mock.calls).toEqual([[expected]]);
      send('finalize', x);
      expect(change).toHaveBeenCalledTimes(expected === 0 ? 0 : 1);
    },
  );

  it.each([27, 47, 80, 101])(
    'selects the exact percentage between mark hot zones at x=%s',
    (x) => {
      const change = setup();
      send('begin', x);
      expect(change.mock.calls).toEqual([[x - 14]]);
      send('finalize', x);
      expect(change).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a tapped value stable as the track grows and maps dragging through that scale', () => {
    const change = setup();
    send('begin', 47);
    mockDragProgress.value = 1;
    send('end', 47);
    expect(change.mock.calls).toEqual([[33]]);
    send('finalize', 47);
    mockDragProgress.value = 0;
    send('begin', 47);
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
    send('update', 64, 17);
    send('update', 47, 0);
    send('end', 47, 0);
    expect(change.mock.calls).toEqual([[33], [50], [33]]);
  });

  it('uses the final drag position even without an intermediate update', () => {
    const change = setup();
    send('begin', 47);
    send('end', 78, 31);
    expect(change.mock.calls).toEqual([[33], [64]]);
  });

  it('updates immediately when tap snapping is disabled', () => {
    const change = setup(false);
    send('begin', 47);
    expect(change.mock.calls).toEqual([[33]]);
  });
});
