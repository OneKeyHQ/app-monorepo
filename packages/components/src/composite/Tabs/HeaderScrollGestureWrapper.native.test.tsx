/** @jest-environment jsdom */
import type { ContextType, PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';
import { I18nManager } from 'react-native';

import { HeaderScrollGestureContext } from './HeaderScrollGestureContext';
import { HeaderScrollGestureWrapper } from './HeaderScrollGestureWrapper.native';

import type { LayoutChangeEvent } from 'react-native';

const edgeContext: ContextType<typeof HeaderScrollGestureContext> = {
  gestures: [],
  excludeStartEdgeWidth: 32,
};

const mockHitSlops: Array<{ left?: number; right?: number }> = [];
let mockOnLayout: (event: LayoutChangeEvent) => void;

jest.mock('react-native', () => ({ I18nManager: { isRTL: false } }));
jest.mock('../../primitives/Haptics', () => ({ Haptics: {} }));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: PropsWithChildren) => children,
  Gesture: {
    Pan: () => {
      const builder: Record<string, unknown> = {};
      for (const name of [
        'enabled',
        'activeOffsetY',
        'failOffsetX',
        'onStart',
        'onUpdate',
        'onEnd',
        'onFinalize',
        'cancelsTouchesInView',
      ]) {
        builder[name] = () => builder;
      }
      builder.hitSlop = (value: { left?: number; right?: number }) => {
        mockHitSlops.push(value);
        return builder;
      };
      return builder;
    },
  },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({
      children,
      onLayout,
    }: PropsWithChildren<{ onLayout: typeof mockOnLayout }>) => {
      mockOnLayout = onLayout;
      return children;
    },
  },
  useSharedValue: <T,>(value: T) =>
    jest.requireActual<typeof import('react')>('react').useRef({ value })
      .current,
  useAnimatedReaction: () => undefined,
}));

beforeEach(() => {
  mockHitSlops.length = 0;
  I18nManager.isRTL = false;
});

it.each([false, true])('reserves the logical start edge (RTL=%s)', (isRTL) => {
  I18nManager.isRTL = isRTL;
  render(
    <HeaderScrollGestureContext.Provider value={edgeContext}>
      <HeaderScrollGestureWrapper>
        <span>chart</span>
      </HeaderScrollGestureWrapper>
    </HeaderScrollGestureContext.Provider>,
  );
  expect(mockHitSlops).toEqual([isRTL ? { right: -32 } : { left: -32 }]);
});

it('keeps the wider right-side exclusion when it shares the RTL navigation edge', () => {
  I18nManager.isRTL = true;
  render(
    <HeaderScrollGestureContext.Provider value={edgeContext}>
      <HeaderScrollGestureWrapper excludeRightEdgeRatio={0.1}>
        <span>chart</span>
      </HeaderScrollGestureWrapper>
    </HeaderScrollGestureContext.Provider>,
  );
  act(() =>
    mockOnLayout({
      nativeEvent: { layout: { width: 400, height: 300, x: 0, y: 0 } },
    } as LayoutChangeEvent),
  );
  expect(mockHitSlops.at(-1)).toEqual({ right: -40 });
});

it('does not reserve an edge outside the Market navigation context', () => {
  render(
    <HeaderScrollGestureWrapper>
      <span>chart</span>
    </HeaderScrollGestureWrapper>,
  );
  expect(mockHitSlops).toEqual([]);
});
