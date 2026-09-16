/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { MorphOverlay, useMorphOverlay } from '.';

import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { useWindowDimensions } from 'react-native';
import {
  GestureDetector,
  PointerType,
  State,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isDualScreenDevice,
  useIsSpanningInDualScreen,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMedia } from '../../hooks/useStyle';

import type { IMorphOverlayPose, IMorphOverlayProps } from '.';
import type { Gesture } from 'react-native-gesture-handler';

// This UI suite needs RN Web, not the CLI's repository-wide manual mock.
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeAndroid: false, isNativeIOS: false },
}));
jest.mock('@onekeyhq/shared/src/modules/DualScreenInfo', () => ({
  isDualScreenDevice: jest.fn(),
  useIsSpanningInDualScreen: jest.fn(),
}));

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
  useMedia: jest.fn(),
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

beforeEach(() => {
  Object.assign(platformEnv, {
    isNative: false,
    isNativeAndroid: false,
    isNativeIOS: false,
  });
  jest.mocked(useWindowDimensions).mockReturnValue({
    width: 390,
    height: 844,
    scale: 1,
    fontScale: 1,
  });
  jest
    .mocked(useMedia)
    .mockReturnValue({ md: true } as ReturnType<typeof useMedia>);
  jest.mocked(isDualScreenDevice).mockReturnValue(false);
  jest.mocked(useIsSpanningInDualScreen).mockReturnValue(false);
});

function setup(extra?: Pick<IMorphOverlayProps<string>, 'modal' | 'scrim'>) {
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
      {...extra}
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

describe('MorphOverlay wall', () => {
  // OK-63431: RN's iOS hit test skips views whose alpha is under 0.01, so
  // the wall must never wear the scrim's fading paint — it stays a static
  // view of its own, and only the tint beside it carries color and opacity.
  it.each([true, false])(
    'keeps the blocking wall free of the scrim paint (scrim=%s)',
    (scrim) => {
      const { view } = setup({ modal: true, scrim });
      const wall = view.getByTestId('morph-overlay-wall');
      expect(wall.style.opacity).toBe('');
      expect(wall.style.backgroundColor).toBe('');
      const tint = wall.nextElementSibling as HTMLElement | null;
      expect(tint).not.toBeNull();
      if (!tint) throw new OneKeyLocalError('Missing scrim tint');
      expect(tint.style.backgroundColor).not.toBe('');
      expect(globalThis.getComputedStyle(tint).pointerEvents).toBe('none');
    },
  );

  it('mounts the wall only while blocking and shown', () => {
    const { view, setPose } = setup({ modal: true });
    expect(view.queryByTestId('morph-overlay-wall')).not.toBeNull();
    setPose('hidden');
    expect(view.queryByTestId('morph-overlay-wall')).toBeNull();
    setPose('card');
    expect(view.queryByTestId('morph-overlay-wall')).not.toBeNull();
    // Queries are bound to document.body, so the modal render must leave
    // before the non-modal one is judged.
    view.unmount();
    const open = setup();
    expect(open.view.queryByTestId('morph-overlay-wall')).toBeNull();
  });
});

describe('MorphOverlay viewport posture', () => {
  it.each([
    {
      name: 'Android spanning with phone media',
      platform: 'android',
      dual: true,
      spanning: true,
      md: true,
      width: 850,
      cardWidth: 400,
      bottom: true,
    },
    {
      name: 'Android spanning with wide media',
      platform: 'android',
      dual: true,
      spanning: true,
      md: false,
      width: 850,
      cardWidth: 400,
      bottom: true,
    },
    {
      name: 'Android folded',
      platform: 'android',
      dual: true,
      spanning: false,
      md: true,
      width: 440,
      cardWidth: 424,
      bottom: true,
    },
    {
      name: 'ordinary Android phone',
      platform: 'android',
      dual: false,
      spanning: false,
      md: true,
      width: 440,
      cardWidth: 424,
      bottom: true,
    },
    {
      name: 'desktop',
      platform: 'desktop',
      dual: false,
      spanning: false,
      md: false,
      width: 1200,
      cardWidth: 400,
      bottom: false,
    },
    {
      name: 'iOS phone',
      platform: 'ios',
      dual: false,
      spanning: false,
      md: true,
      width: 440,
      cardWidth: 424,
      bottom: true,
    },
    {
      name: 'iOS wide window',
      platform: 'ios',
      dual: false,
      spanning: false,
      md: false,
      width: 1024,
      cardWidth: 400,
      bottom: false,
    },
  ])(
    '$name preserves its width and anchor',
    ({ platform, dual, spanning, md, width, cardWidth, bottom }) => {
      Object.assign(platformEnv, {
        isNative: platform !== 'desktop',
        isNativeAndroid: platform === 'android',
        isNativeIOS: platform === 'ios',
      });
      jest.mocked(isDualScreenDevice).mockReturnValue(dual);
      jest.mocked(useIsSpanningInDualScreen).mockReturnValue(spanning);
      jest
        .mocked(useMedia)
        .mockReturnValue({ md } as ReturnType<typeof useMedia>);
      jest
        .mocked(useWindowDimensions)
        .mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

      const { state, view, gesture, onDismiss } = setup();
      expect(state.result.current.width.value).toBe(cardWidth);
      const layer = view.container.firstElementChild;
      expect(layer).not.toBeNull();
      if (!layer) throw new OneKeyLocalError('Missing overlay layer');
      expect(globalThis.getComputedStyle(layer).justifyContent).toBe(
        bottom ? 'flex-end' : 'flex-start',
      );
      act(() => {
        gesture.handlers.onEnd?.(
          { ...dragEvent, translationY: bottom ? 300 : -300 },
          true,
        );
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    },
  );
});
