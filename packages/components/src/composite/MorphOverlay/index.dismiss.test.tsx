/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { MorphOverlay, useMorphOverlay } from '.';

import { act, fireEvent, render, renderHook } from '@testing-library/react';
import {
  GestureDetector,
  PointerType,
  State,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { IMorphOverlayPose, IMorphOverlayProps } from '.';
import type { Gesture } from 'react-native-gesture-handler';

// This UI suite needs RN Web, not the CLI's repository-wide manual mock.
jest.unmock('react-native');

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual<typeof import('react-native-gesture-handler')>(
    'react-native-gesture-handler',
  ),
  GestureDetector: jest.fn(({ children }: { children: ReactNode }) => children),
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  TamaguiTheme: ({ children }: { children: ReactNode }) => children,
  getTokenValue: () => '#222',
  useThemeName: () => 'dark',
}));
jest.mock('../../primitives', () => ({
  Stack: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../../actions/IconButton', () => ({
  IconButton:
    jest.requireActual<typeof import('react-native')>('react-native').Pressable,
}));
jest.mock('../../hocs', () => ({
  Portal: {
    Body: ({ children }: { children: ReactNode }) => children,
    Constant: { HARDWARE_UI_STATE_DIALOG: 'stage' },
  },
}));
jest.mock('../../hooks/useLayout', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../hooks/useStyle', () => ({
  useMedia: () => ({ md: true }),
}));
jest.mock('../../content/deviceScene', () => ({
  easeInFn: (value: number) => value,
  easeOutFn: (value: number) => value,
}));

// Keep shared values stable across renders and settle animations immediately.
// The real gesture callbacks remain intact so an old recognizer can deliver
// its final events after React has committed the hidden pose.
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const identity = <T,>(value: T): T => value;
  const fade = { duration: () => ({ delay: () => undefined }) };
  return {
    __esModule: true,
    default: { View },
    FadeIn: fade,
    FadeOut: fade,
    Easing: { bezierFn: () => identity },
    Extrapolation: { CLAMP: 'clamp' },
    cancelAnimation: jest.fn(),
    makeMutable: <T,>(value: T) => ({ value }),
    runOnJS: jest.fn(identity),
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: <T,>(value: T) => useRef({ value }).current,
    withSpring: identity,
    withTiming: identity,
  };
});

const seats: IMorphOverlayProps<string>['seats'] = [];
const dragEvent = {
  handlerTag: 1,
  state: State.ACTIVE,
  oldState: State.BEGAN,
  numberOfPointers: 1,
  pointerType: PointerType.TOUCH,
  x: 0,
  y: 0,
  absoluteX: 0,
  absoluteY: 0,
  translationX: 0,
  translationY: 24,
  velocityX: 0,
  velocityY: 0,
};

function setup() {
  const onDismiss = jest.fn();
  const state = renderHook(
    ({ pose }: { pose: IMorphOverlayPose }) =>
      useMorphOverlay({ pose, key: 'card', value: 'card' }),
    { initialProps: { pose: 'card' as IMorphOverlayPose } },
  );
  const overlay = () => (
    <MorphOverlay
      morph={state.result.current}
      cardInnerHeight={240}
      cardContentMeasured
      onDismiss={state.result.current.pose === 'hidden' ? undefined : onDismiss}
      capsuleKey="capsule"
      capsule={null}
      seats={seats}
    />
  );
  const view = render(overlay());
  const latestGesture = () => {
    const calls = jest.mocked(GestureDetector).mock.calls;
    return calls[calls.length - 1][0].gesture as ReturnType<typeof Gesture.Pan>;
  };
  const gesture = latestGesture();
  const setPose = (pose: IMorphOverlayPose) => {
    state.rerender({ pose });
    view.rerender(overlay());
  };
  return { state, view, gesture, latestGesture, onDismiss, setPose };
}

describe('MorphOverlay dismiss gesture', () => {
  it.each(['update', 'end', 'cancel'] as const)(
    'ignores a late %s from the drag that was active when the stage hid',
    (event) => {
      const { state, gesture, setPose, onDismiss } = setup();
      act(() => gesture.handlers.onUpdate?.(dragEvent));
      expect(state.result.current.presence.value).toBeLessThan(1);

      setPose('hidden');
      expect(state.result.current.presence.value).toBe(0);
      act(() => {
        if (event === 'update') gesture.handlers.onUpdate?.(dragEvent);
        if (event === 'end') gesture.handlers.onEnd?.(dragEvent, true);
        if (event === 'cancel') {
          gesture.handlers.onEnd?.(dragEvent, false);
          gesture.handlers.onFinalize?.(dragEvent, false);
        }
      });
      expect(state.result.current.presence.value).toBe(0);
      expect(onDismiss).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    'returns a visible card to rest after a short drag (success=%s)',
    (success) => {
      const { state, gesture, onDismiss } = setup();
      act(() => {
        gesture.handlers.onUpdate?.(dragEvent);
        gesture.handlers.onEnd?.(dragEvent, success);
        gesture.handlers.onFinalize?.(dragEvent, success);
      });
      expect(state.result.current.presence.value).toBe(1);
      expect(onDismiss).not.toHaveBeenCalled();
    },
  );

  it('allows a new drag to dismiss after the stage is shown again', () => {
    const { state, latestGesture, setPose, onDismiss } = setup();
    setPose('hidden');
    setPose('card');
    act(() => {
      latestGesture().handlers.onEnd?.(
        { ...dragEvent, translationY: 300 },
        true,
      );
    });
    expect(state.result.current.presence.value).toBe(0);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each(['update', 'end', 'cancel', 'dismiss'] as const)(
    'ignores an old drag %s after the stage is shown again',
    (event) => {
      const { state, gesture, latestGesture, setPose, onDismiss } = setup();
      act(() => gesture.handlers.onUpdate?.(dragEvent));
      setPose('hidden');
      setPose('card');
      act(() => {
        latestGesture().handlers.onUpdate?.({ ...dragEvent, translationY: 48 });
      });
      const reopenedPresence = state.result.current.presence.value;
      expect(reopenedPresence).toBeLessThan(1);

      act(() => {
        if (event === 'update') gesture.handlers.onUpdate?.(dragEvent);
        if (event === 'end') gesture.handlers.onEnd?.(dragEvent, true);
        if (event === 'cancel') {
          gesture.handlers.onFinalize?.(dragEvent, false);
        }
        if (event === 'dismiss') {
          gesture.handlers.onEnd?.({ ...dragEvent, translationY: 300 }, true);
        }
      });
      expect(state.result.current.presence.value).toBe(reopenedPresence);
      expect(onDismiss).not.toHaveBeenCalled();
    },
  );

  it('ignores a queued drag dismissal after the stage is shown again', () => {
    const { state, gesture, setPose, onDismiss } = setup();
    jest.mocked(runOnJS).mockImplementationOnce(() => jest.fn());
    act(() => {
      gesture.handlers.onEnd?.({ ...dragEvent, translationY: 300 }, true);
    });
    const queuedDismiss = jest.mocked(runOnJS).mock.calls.at(-1)?.[0];
    expect(queuedDismiss).toBeInstanceOf(Function);
    expect(onDismiss).not.toHaveBeenCalled();

    setPose('hidden');
    setPose('card');
    act(() => {
      if (typeof queuedDismiss === 'function') queuedDismiss();
    });
    expect(state.result.current.presence.value).toBe(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('keeps the close button wired to dismissal', () => {
    const { view, onDismiss } = setup();
    fireEvent.click(view.getByTestId('morph-overlay-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
