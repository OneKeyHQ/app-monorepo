/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { DottedSlider } from './DottedSlider.native';

import type { LayoutChangeEvent } from 'react-native';

jest.unmock('react-native');

type IEvent = { x: number; translationX: number; translationY: number };
type IHandler = (event: IEvent) => void;
const mockHandlers: Partial<
  Record<'begin' | 'update' | 'end' | 'finalize', IHandler>
> = {};
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
  useDerivedValue: () => ({ value: 1 }),
  withTiming: (value: unknown) => value,
}));
jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: '#000000' },
    neutral3: { val: '#eeeeee' },
    textSubdued: { val: '#888888' },
  }),
}));
jest.mock('../../content/LinearGradient', () => ({
  LinearGradient: () => null,
}));
jest.mock('../../primitives/Haptics', () => ({
  Haptics: { selection: jest.fn() },
}));
jest.mock('./DottedSliderTrack.native', () => ({
  DottedSliderTrack: () => null,
}));

function setup(snapTapToSegment = true) {
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
      nativeEvent: { layout: { width: 124, height: 40, x: 0, y: 0 } },
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
    send('begin', 45);
    send('update', 46, 1);
    expect(change).not.toHaveBeenCalled();
    send('end', 46, 1);
    send('finalize', 46, 1);
    expect(change.mock.calls).toEqual([[25]]);
  });

  it('keeps dragging continuous without snapping when the finger returns near its start', () => {
    const change = setup();
    send('begin', 45);
    send('update', 62, 17);
    send('update', 45, 0);
    send('end', 45, 0);
    expect(change.mock.calls).toEqual([[50], [33]]);
  });

  it('uses the final drag position even without an intermediate update', () => {
    const change = setup();
    send('begin', 45);
    send('end', 76, 31);
    expect(change.mock.calls).toEqual([[64]]);
  });

  it('updates immediately when tap snapping is disabled', () => {
    const change = setup(false);
    send('begin', 45);
    expect(change.mock.calls).toEqual([[33]]);
  });
});
