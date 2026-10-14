/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';
import { useContext, useLayoutEffect } from 'react';

import { render } from '@testing-library/react';
import {
  GestureDetector,
  PointerType,
  State,
} from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  withDecay,
} from 'react-native-reanimated';

import { HeaderScrollGestureChildPanContext } from './HeaderScrollGestureContext';
import { HeaderScrollGestureWrapper } from './HeaderScrollGestureWrapper.native';

import type { IHeaderScrollGestureWrapperProps } from './HeaderScrollGestureWrapper';
import type {
  GestureTouchEvent,
  PanGesture,
} from 'react-native-gesture-handler';

jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native'),
);
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual<typeof import('react-native-gesture-handler')>(
    'react-native-gesture-handler',
  ),
  GestureDetector: jest.fn(({ children }: { children: ReactNode }) => children),
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: jest.fn(),
    runOnJS: <T,>(callback: T) => callback,
    scrollTo: jest.fn(),
    useAnimatedReaction: jest.fn(),
    useSharedValue: <T,>(value: T) => useRef({ value }).current,
    withDecay: jest.fn(),
  };
});
jest.mock('../../primitives/Haptics', () => ({
  Haptics: { impact: jest.fn() },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('./CollapsibleTabContext', () => ({
  CollapsibleTabContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));

function touchEvent(dx = 0, dy = 0, numberOfTouches = 1): GestureTouchEvent {
  const touch = {
    id: 0,
    x: 100 + dx,
    y: 200 + dy,
    absoluteX: 100 + dx,
    absoluteY: 200 + dy,
  };
  return {
    handlerTag: 1,
    state: State.BEGAN,
    eventType: 2,
    pointerType: PointerType.TOUCH,
    numberOfTouches,
    changedTouches: [touch],
    allTouches: [touch],
  };
}

const panEvent = {
  handlerTag: 1,
  state: State.ACTIVE,
  oldState: State.BEGAN,
  numberOfPointers: 1,
  pointerType: PointerType.TOUCH,
  x: 100,
  y: 200,
  absoluteX: 100,
  absoluteY: 200,
  translationX: 0,
  translationY: 0,
  velocityX: 0,
  velocityY: 0,
};

const panOffsets: [number, number] = [-12, 12];

function ChartTouch({ canPan }: { canPan: boolean }) {
  const canChildHandlePan = useContext(HeaderScrollGestureChildPanContext);
  useLayoutEffect(() => {
    if (canChildHandlePan) {
      canChildHandlePan.value = canPan;
    }
  }, [canChildHandlePan, canPan]);
  return <div />;
}

function setup(
  props: IHeaderScrollGestureWrapperProps = {},
  childCanPan = true,
) {
  render(
    <HeaderScrollGestureWrapper
      panActiveOffsetY={panOffsets}
      panFailOffsetX={panOffsets}
      verticalPanMinVelocity={400}
      verticalPanMaxPointers={1}
      {...props}
    >
      <ChartTouch canPan={childCanPan} />
    </HeaderScrollGestureWrapper>,
  );
  const gesture = jest.mocked(GestureDetector).mock.calls.at(-1)?.[0]
    .gesture as PanGesture;
  const manager = {
    handlerTag: 1,
    begin: jest.fn(),
    activate: jest.fn(),
    fail: jest.fn(),
    end: jest.fn(),
  };
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  gesture.handlers.onTouchesDown?.(touchEvent(), manager);
  const move = (dx: number, dy: number, elapsed: number) => {
    now.mockReturnValue(1000 + elapsed);
    gesture.handlers.onTouchesMove?.(touchEvent(dx, dy), manager);
  };
  const getScrollY = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[0];
  return { gesture, manager, move, now, getScrollY };
}

describe('header scroll speed arbitration', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it.each([-1, 1])(
    'scrolls a fast vertical swipe (direction %i)',
    (direction) => {
      const { gesture, manager, move } = setup();
      move(1, 8 * direction, 10);
      move(2, 20 * direction, 25);
      expect(gesture.config.manualActivation).toBe(true);
      expect(manager.activate).toHaveBeenCalledTimes(1);
      expect(manager.fail).not.toHaveBeenCalled();
      // Deceleration must not hand an active page scroll back to the chart.
      move(3, 25 * direction, 200);
      expect(manager.activate).toHaveBeenCalledTimes(1);
      expect(manager.fail).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 1])(
    'yields a slow vertical drag (direction %i)',
    (direction) => {
      const { manager, move } = setup();
      move(1, 10 * direction, 100);
      move(2, 20 * direction, 160);
      expect(manager.fail).toHaveBeenCalledTimes(1);
      expect(manager.activate).not.toHaveBeenCalled();
      // Acceleration must not steal a drag already owned by the chart.
      move(3, 200 * direction, 180);
      expect(manager.fail).toHaveBeenCalledTimes(1);
      expect(manager.activate).not.toHaveBeenCalled();
    },
  );

  it('waits for touch slop before classifying movement', () => {
    const { manager, move } = setup();
    move(1, -3, 1);
    move(2, -12, 20);
    expect(manager.activate).not.toHaveBeenCalled();
    expect(manager.fail).not.toHaveBeenCalled();
    move(2, -20, 30);
    expect(manager.activate).toHaveBeenCalledTimes(1);
  });

  it('preserves the horizontal failure threshold', () => {
    const { manager, move } = setup();
    move(13, -20, 20);
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
  });

  it('keeps UIKit recognition behind the same slop as the speed decision', () => {
    const { gesture } = setup();
    expect(gesture.config).toMatchObject({
      manualActivation: true,
      activeOffsetYStart: -12,
      activeOffsetYEnd: 12,
      failOffsetXStart: -12,
      failOffsetXEnd: 12,
    });
  });

  it('releases a pending page pan when a second finger starts a pinch', () => {
    const { gesture, manager, move } = setup();
    gesture.handlers.onTouchesDown?.(touchEvent(0, 0, 2), manager);
    move(0, -40, 20);
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
  });

  it('stops an active scroll when a second finger is added', () => {
    const { gesture, manager, move, getScrollY } = setup();
    move(0, -8, 10);
    move(0, -20, 20);
    gesture.handlers.onStart?.(panEvent);
    gesture.handlers.onUpdate?.({ ...panEvent, translationY: -40 });
    expect(getScrollY?.()).toBe(40);
    gesture.handlers.onTouchesDown?.(touchEvent(0, 0, 2), manager);
    gesture.handlers.onUpdate?.({ ...panEvent, translationY: -80 });
    expect(getScrollY?.()).toBe(40);
  });

  it('resets classification after cancellation', () => {
    const { gesture, manager, move, now } = setup();
    move(0, -6, 50);
    gesture.handlers.onFinalize?.(panEvent, false);
    now.mockReturnValue(1000);
    gesture.handlers.onTouchesDown?.(touchEvent(), manager);
    move(0, -8, 10);
    move(0, -20, 20);
    expect(manager.activate).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 1])(
    'recognizes a fast swipe after a hold without stationary events (direction %i)',
    (direction) => {
      const { manager, move } = setup();
      move(0, 5 * direction, 110);
      move(0, 20 * direction, 125);
      expect(manager.activate).toHaveBeenCalledTimes(1);
      expect(manager.fail).not.toHaveBeenCalled();
    },
  );

  it('waits for another move when the first sample crosses touch slop', () => {
    const { manager, move } = setup();
    move(0, -20, 120);
    expect(manager.activate).not.toHaveBeenCalled();
    expect(manager.fail).not.toHaveBeenCalled();
    move(0, -40, 140);
    expect(manager.activate).toHaveBeenCalledTimes(1);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it('discards a stale sample after a pause within touch slop', () => {
    const { manager, move } = setup();
    move(0, -1, 5);
    move(0, -20, 140);
    expect(manager.fail).not.toHaveBeenCalled();
    move(0, -40, 160);
    expect(manager.activate).toHaveBeenCalledTimes(1);
  });

  it('still yields a slow drag after an initial hold', () => {
    const { manager, move } = setup();
    move(0, -10, 150);
    move(0, -20, 210);
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
  });

  it('yields slow dragging even when move events arrive infrequently', () => {
    const { manager, move } = setup();
    move(0, -5, 100);
    move(0, -10, 200);
    move(0, -20, 300);
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
  });

  it('scrolls slowly when no child can handle the touch', () => {
    const { manager, move } = setup({}, false);
    move(0, -20, 160);
    expect(manager.activate).toHaveBeenCalledTimes(1);
    expect(manager.fail).not.toHaveBeenCalled();
  });

  it('stops page inertia before handing the next slow drag to a child', () => {
    const { gesture, manager, move, now } = setup();
    move(0, -8, 10);
    move(0, -20, 20);
    gesture.handlers.onStart?.(panEvent);
    gesture.handlers.onUpdate?.({ ...panEvent, translationY: -40 });
    gesture.handlers.onEnd?.(
      { ...panEvent, translationY: -40, velocityY: -700 },
      true,
    );
    gesture.handlers.onFinalize?.(panEvent, true);
    expect(withDecay).toHaveBeenCalledTimes(1);
    const scrollAnimation = jest.mocked(cancelAnimation).mock.calls.at(-1)?.[0];
    jest.mocked(cancelAnimation).mockClear();
    manager.activate.mockClear();
    manager.fail.mockClear();
    now.mockReturnValue(1000);
    gesture.handlers.onTouchesDown?.(touchEvent(), manager);
    expect(cancelAnimation).toHaveBeenCalledWith(scrollAnimation);
    move(0, -10, 100);
    move(0, -20, 160);
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
  });

  it.each([-20, 0, 20])(
    'starts page scrolling from the activation translation (%i pt)',
    (translationY) => {
      const { gesture, getScrollY } = setup({ scrollScale: 1.2 });
      gesture.handlers.onStart?.({ ...panEvent, translationY });
      gesture.handlers.onUpdate?.({ ...panEvent, translationY });
      expect(getScrollY?.()).toBe(0);
      gesture.handlers.onUpdate?.({
        ...panEvent,
        translationY: translationY - 30,
      });
      expect(getScrollY?.()).toBe(36);
    },
  );

  it('does not count movement before activation toward refresh', () => {
    const onRefresh = jest.fn();
    const { gesture } = setup({ onRefresh });
    gesture.handlers.onStart?.({ ...panEvent, translationY: 30 });
    gesture.handlers.onEnd?.({ ...panEvent, translationY: 100 }, true);
    expect(onRefresh).not.toHaveBeenCalled();
    gesture.handlers.onEnd?.({ ...panEvent, translationY: 120 }, true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps automatic direction-based activation for other headers', () => {
    const { gesture } = setup({ verticalPanMinVelocity: undefined });
    expect(gesture.config.manualActivation).toBeUndefined();
    expect(gesture.handlers.onTouchesMove).toBeUndefined();
    expect(gesture.config).toMatchObject({
      activeOffsetYStart: -12,
      activeOffsetYEnd: 12,
      failOffsetXStart: -12,
      failOffsetXEnd: 12,
    });
  });
});
