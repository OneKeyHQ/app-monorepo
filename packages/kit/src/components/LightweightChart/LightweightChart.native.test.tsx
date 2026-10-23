/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LightweightChart } from './LightweightChart.native';

import type { ILightweightChartProps } from './types';

const mockReactions = new Set<() => void>();
const mockGestureHandlers: Record<
  string,
  (event?: unknown, manager?: unknown) => void
> = {};
const mockDraws: {
  commands: {
    kind: string;
    customPaintId?: string;
    points?: { x: number; y: number }[];
  }[];
}[] = [];
let mockTypeface: object | null = null;
const mockFont = {
  getTypeface: () => ({}),
  measureText: (text: string) => ({ width: text.length * 6 }),
};
const mockSkiaFont = jest.fn((typeface: object | undefined) => {
  if (!typeface)
    throw new OneKeyLocalError('Value is undefined, expected an Object');
  return mockFont;
});

jest.mock('@onekeyhq/components', () => ({
  HeaderScrollGestureContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext({ excludeStartEdgeWidth: 0 }),
  Stack: ({
    children,
    onLayout,
  }: {
    children: ReactNode;
    onLayout: (event: { nativeEvent: { layout: { width: number } } }) => void;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const onLayoutRef = React.useRef(onLayout);
    React.useEffect(() => {
      onLayoutRef.current({ nativeEvent: { layout: { width: 402 } } });
    }, []);
    return <div>{children}</div>;
  },
}));
jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'brand.ttf' }) },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  Gesture: {
    Pan: () => {
      const gesture = {
        enabled: () => gesture,
        activateAfterLongPress: () => gesture,
        maxPointers: () => gesture,
        onTouchesDown: (fn: (event?: unknown, manager?: unknown) => void) => {
          mockGestureHandlers.down = fn;
          return gesture;
        },
        onStart: (fn: (event?: unknown) => void) => {
          mockGestureHandlers.start = fn;
          return gesture;
        },
        onUpdate: (fn: (event?: unknown) => void) => {
          mockGestureHandlers.update = fn;
          return gesture;
        },
        onFinalize: (fn: () => void) => {
          mockGestureHandlers.end = fn;
          return gesture;
        },
      };
      return gesture;
    },
  },
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useDerivedValue: (get: () => unknown) => ({
      get value() {
        return get();
      },
    }),
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
    ) => {
      const state = React.useRef({ prepare, react, previous: null as unknown });
      state.current.prepare = prepare;
      state.current.react = react;
      React.useEffect(() => {
        const run = () => {
          const next = state.current.prepare();
          state.current.react(next, state.current.previous);
          state.current.previous = next;
        };
        mockReactions.add(run);
        return () => {
          mockReactions.delete(run);
        };
      }, []);
    },
    cancelAnimation: jest.fn(),
    withRepeat: () => 0,
    withTiming: () => 0,
  };
});
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="skia-canvas">{children}</div>
  ),
  Circle: () => null,
  Group: ({ children }: { children: ReactNode }) => children,
  Picture: ({ picture }: { picture: { value: unknown } }) => {
    void picture.value;
    return null;
  },
  Skia: { Font: (typeface: object) => mockSkiaFont(typeface) },
  createPicture: (draw: (canvas: object) => void) => {
    draw({});
    return {};
  },
}));
jest.mock('./native/useChartTypeface', () => ({
  useChartTypeface: () => mockTypeface,
}));
jest.mock('../TradingView/TradingViewNative/native/chartSkiaRenderer', () => ({
  createTradingViewNativeSkiaFontForText: () => mockFont,
  createTradingViewNativeSkiaResources: () => ({}),
  createTradingViewNativeSkiaCommandPicture: (draw: {
    commands: {
      kind: string;
      customPaintId?: string;
      points?: { x: number; y: number }[];
    }[];
  }) => {
    mockDraws.push(draw);
    return {};
  },
}));
jest.mock('../TradingView/TradingViewNative/native/chartSkiaText', () => ({
  getTradingViewNativeSkiaDigitWidth: () => 6,
  getTradingViewNativeSkiaPriceAxisLabelWidth: (text: string) =>
    text.length * 6,
}));
jest.mock('./hooks/useChartConfig', () => ({
  useChartConfig: ({
    data,
    secondaryLineData,
  }: {
    data: [number, number][];
    secondaryLineData?: [number, number][];
  }) => ({
    theme: {
      lineColor: '#0a5',
      topColor: '#0a5333',
      bottomColor: 'transparent',
      textSubduedColor: '#666',
    },
    lineWidth: 2,
    showPriceScale: true,
    showTimeScale: true,
    priceScaleFormat: 'stock',
    data: data.map(([time, value]) => ({ time, value })),
    secondaryLineData: secondaryLineData?.map(([time, value]) => ({
      time,
      value,
    })),
  }),
}));

const flush = () =>
  act(() => {
    for (const run of mockReactions) run();
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockDraws.length = 0;
  mockTypeface = null;
});

it('uses a real system font before the asynchronously loaded face is available', () => {
  const { rerender } = render(
    <LightweightChart data={[[100, 1]]} height={280} />,
  );
  expect(mockSkiaFont.mock.calls.every(([face]) => !!face)).toBe(true);
  mockTypeface = {};
  rerender(<LightweightChart data={[[100, 1]]} height={280} />);
  expect(mockSkiaFont).toHaveBeenCalledWith(mockTypeface);
});

it('paints late data into the same native canvas and applies subsequent resizing', () => {
  const { getByTestId, rerender } = render(
    <LightweightChart data={[]} height={280} />,
  );
  const canvas = getByTestId('skia-canvas');
  expect(mockDraws.at(-1)?.commands).toHaveLength(0);
  rerender(
    <LightweightChart
      data={[
        [100, 1],
        [200, 2],
      ]}
      height={280}
    />,
  );
  const original = mockDraws
    .at(-2)
    ?.commands.find((c) => c.kind === 'polyline');
  expect(original?.points).toHaveLength(2);
  rerender(
    <LightweightChart
      data={[
        [100, 1],
        [200, 2],
      ]}
      height={456}
    />,
  );
  const resized = mockDraws.at(-1)?.commands.find((c) => c.kind === 'polyline');
  expect(resized?.points?.[0].y).not.toBe(original?.points?.[0].y);
  expect(getByTestId('skia-canvas')).toBe(canvas);
});

it('reports scrub selection and releases it on gesture completion and unmount', () => {
  const onHover = jest.fn();
  const { unmount } = render(
    <LightweightChart
      data={[
        [100, 1],
        [200, 2],
      ]}
      height={280}
      onHover={onHover}
    />,
  );
  act(() => {
    mockGestureHandlers.start({ x: 2, y: 80 });
  });
  flush();
  expect(onHover).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 100, price: 1 }),
  );
  act(() => {
    mockGestureHandlers.update({ x: 300, y: 100 });
  });
  flush();
  expect(onHover).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 200, price: 2 }),
  );
  act(() => {
    mockGestureHandlers.end();
  });
  flush();
  expect(onHover).toHaveBeenLastCalledWith({});
  act(() => {
    mockGestureHandlers.start({ x: 2, y: 80 });
  });
  flush();
  unmount();
  expect(onHover).toHaveBeenLastCalledWith({});
});

it('leaves axis touches available to native page gestures', () => {
  render(
    <LightweightChart
      data={[
        [100, 1],
        [200, 2],
      ]}
      height={280}
      onHover={jest.fn()}
    />,
  );
  const manager = { fail: jest.fn() };
  mockGestureHandlers.down({ changedTouches: [{ x: 401, y: 100 }] }, manager);
  expect(manager.fail).toHaveBeenCalledTimes(1);
});

it('restores the full solid line when an active scrub leaves the plot and cuts it again on re-entry', () => {
  const props: ILightweightChartProps = {
    data: [
      [100, 1],
      [200, 2],
    ] as [number, number][],
    secondaryLineData: [
      [100, 1],
      [200, 2],
    ] as [number, number][],
    height: 280,
    nativeScrubOptions: {
      labels: {},
      largePrice: false,
      backgroundColor: '#fff',
      borderColor: '#ddd',
      textColor: '#000',
      timeColor: '#888',
    },
  };
  const { rerender } = render(<LightweightChart {...props} />);
  const hasSolidLine = () =>
    mockDraws
      .at(-2)
      ?.commands.some(
        (c) => c.kind === 'polyline' && c.customPaintId === 'secondary',
      );
  act(() => mockGestureHandlers.start({ x: 2, y: 80 }));
  rerender(<LightweightChart {...props} />);
  expect(hasSolidLine()).toBe(false);
  for (const point of [
    { x: 401, y: 80 },
    { x: 20, y: 270 },
    { x: -1, y: 80 },
  ]) {
    act(() => mockGestureHandlers.update(point));
    rerender(<LightweightChart {...props} />);
    expect(hasSolidLine()).toBe(true);
    expect(mockDraws.at(-1)?.commands).toHaveLength(0);
  }
  act(() => mockGestureHandlers.update({ x: 20, y: 80 }));
  rerender(<LightweightChart {...props} />);
  expect(hasSolidLine()).toBe(false);
});
