/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { HeightTransition } from '.';

import { act, render } from '@testing-library/react';

let mockOnLayout:
  | ((event: { nativeEvent: { layout: { height: number } } }) => void)
  | undefined;
const mockWithTiming = jest.fn(
  (
    value: number,
    _config?: { duration?: number; easing?: unknown },
    _callback?: () => void,
  ) => value,
);
const linearEasing = (value: number) => value;

jest.mock('react-native', () => ({
  PixelRatio: { roundToNearestPixel: (value: number) => value },
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    absoluteFill: {},
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: false },
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      View: ({
        children,
        onLayout,
      }: {
        children?: ReactNode;
        onLayout?: (event: {
          nativeEvent: { layout: { height: number } };
        }) => void;
      }) => {
        if (onLayout) mockOnLayout = onLayout;
        return React.createElement('div', null, children);
      },
    },
    runOnJS: <T,>(callback: T) => callback,
    useAnimatedStyle: (create: () => unknown) => create(),
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
    withTiming: (
      value: number,
      config?: { duration?: number; easing?: unknown },
      callback?: () => void,
    ) => mockWithTiming(value, config, callback),
  };
});

describe('HeightTransition initial rendering', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockOnLayout = undefined;
    mockWithTiming.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('shows the first measured height before enabling animation', () => {
    const onHeightDidAnimate = jest.fn();
    render(
      <HeightTransition
        skipInitialAnimation
        onHeightDidAnimate={onHeightDidAnimate}
      >
        content
      </HeightTransition>,
    );
    expect(mockWithTiming).not.toHaveBeenCalled();
    act(() => mockOnLayout?.({ nativeEvent: { layout: { height: 40 } } }));
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(onHeightDidAnimate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(40));
    expect(mockWithTiming).toHaveBeenCalled();
    expect(onHeightDidAnimate).not.toHaveBeenCalled();
  });

  it('cancels the pending animation frame when unmounted', () => {
    const view = render(
      <HeightTransition skipInitialAnimation>content</HeightTransition>,
    );
    act(() => mockOnLayout?.({ nativeEvent: { layout: { height: 40 } } }));
    view.unmount();
    act(() => jest.advanceTimersByTime(40));
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('preserves separate opacity duration and easing when the default animation is used', () => {
    render(
      <HeightTransition
        duration={150}
        opacityDuration={75}
        easing={linearEasing}
      >
        content
      </HeightTransition>,
    );
    expect(mockWithTiming).toHaveBeenCalledWith(
      0,
      { duration: 75, easing: linearEasing },
      undefined,
    );
    expect(mockWithTiming).toHaveBeenCalledWith(
      0,
      { duration: 150, easing: linearEasing },
      expect.any(Function),
    );
  });
});
