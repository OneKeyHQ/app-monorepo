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

import type { IMorphOverlayPose, IMorphOverlayProps } from '.';
import type { Gesture } from 'react-native-gesture-handler';

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const element = (tag: 'button' | 'div') => {
    const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(
      ({ children, onPress, testID }, ref) =>
        React.createElement(
          tag,
          {
            ref,
            'data-testid': testID,
            ...(onPress ? { onClick: onPress } : {}),
          },
          children as ReactNode,
        ),
    );
    Component.displayName = `Mock${tag}`;
    return Component;
  };
  return {
    Pressable: element('button'),
    StyleSheet: {
      absoluteFill: {},
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
    },
    View: element('div'),
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  };
});

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: jest.fn(() => {
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      const gesture = {
        handlers,
        enabled: () => gesture,
        activeOffsetY: () => gesture,
        onUpdate: (handler: (...args: unknown[]) => void) => {
          handlers.onUpdate = handler;
          return gesture;
        },
        onEnd: (handler: (...args: unknown[]) => void) => {
          handlers.onEnd = handler;
          return gesture;
        },
        onFinalize: (handler: (...args: unknown[]) => void) => {
          handlers.onFinalize = handler;
          return gesture;
        },
      };
      return gesture;
    }),
  },
  GestureDetector: jest.fn(({ children }: { children: ReactNode }) => children),
  PointerType: { TOUCH: 0 },
  State: { ACTIVE: 4, BEGAN: 2 },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  TamaguiTheme: ({ children }: { children: ReactNode }) => children,
  getTokenValue: () => '#222',
  useThemeName: () => 'dark',
}));
jest.mock('../../primitives', () => ({
  Stack: jest.requireMock<typeof import('react-native')>('react-native').View,
}));
jest.mock('../../actions/IconButton', () => ({
  IconButton:
    jest.requireMock<typeof import('react-native')>('react-native').Pressable,
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
    jest.requireMock<typeof import('react-native')>('react-native');
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
    runOnJS: identity,
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

  it('keeps the close button wired to dismissal', () => {
    const { view, onDismiss } = setup();
    fireEvent.click(view.getByTestId('morph-overlay-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
