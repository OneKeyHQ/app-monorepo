/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LightweightChart } from './LightweightChart.native';

import type { INativeChartScene } from './native/chartScene';
import type { ILightweightChartProps } from './types';

const mockPictures: { readonly value: unknown }[] = [];
const mockReactions = new Set<() => void>();
type IMockGestureHandler = (event?: unknown, manager?: unknown) => void;
const mockGestureHandlers: Record<string, IMockGestureHandler> = {};
type IMockDraw = Pick<INativeChartScene, 'commands'>;
const mockDraws: IMockDraw[] = [];
const chartData: ILightweightChartProps['data'] = [
  [100, 1],
  [200, 2],
];
let mockTypeface: object | null = null;
const mockLoadData = jest.fn<Promise<object>, [string]>();
const mockLoadedFace = {};
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
        onTouchesDown: (fn: IMockGestureHandler) => {
          mockGestureHandlers.down = fn;
          return gesture;
        },
        onStart: (fn: IMockGestureHandler) => {
          mockGestureHandlers.start = fn;
          return gesture;
        },
        onUpdate: (fn: IMockGestureHandler) => {
          mockGestureHandlers.update = fn;
          return gesture;
        },
        onFinalize: (fn: IMockGestureHandler) => {
          mockGestureHandlers.end = fn;
          return gesture;
        },
      };
      return gesture;
    },
  },
}));
jest.mock('react-native-reanimated', () => {
  type IValue = { readonly value: unknown };
  let reads: Map<IValue, unknown> | undefined;
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: unknown) => {
      const ref = React.useRef(initial);
      return React.useMemo(() => {
        const node = {
          get value() {
            reads?.set(node, ref.current);
            return ref.current;
          },
          set value(next: unknown) {
            ref.current = next;
          },
        };
        return node;
      }, []);
    },
    // Track shared-value dependencies and suppress equal derived values, as the native mapper does.
    useDerivedValue: (get: () => unknown) => {
      let initialized = false;
      let cached: unknown;
      let inputs = new Map<IValue, unknown>();
      const node: IValue = {
        get value() {
          const parent = reads;
          reads = undefined;
          const changed =
            !initialized ||
            [...inputs].some(
              ([input, previous]) => !Object.is(input.value, previous),
            );
          if (changed) {
            reads = new Map<IValue, unknown>();
            cached = get();
            inputs = reads;
            initialized = true;
          }
          reads = parent;
          reads?.set(node, cached);
          return cached;
        },
      };
      return node;
    },
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
    ) => {
      const previous = React.useRef<unknown>(null);
      React.useEffect(() => {
        const run = () => {
          const next = prepare();
          react(next, previous.current);
          previous.current = next;
        };
        mockReactions.add(run);
        return () => {
          mockReactions.delete(run);
        };
      }, [prepare, react]);
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
    mockPictures.push(picture);
    void picture.value;
    return null;
  },
  Skia: {
    Font: (typeface: object) => mockSkiaFont(typeface),
    Data: { fromURI: (uri: string) => mockLoadData(uri) },
    Typeface: { MakeFreeTypeFaceFromData: () => mockLoadedFace },
  },
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
  createTradingViewNativeSkiaCommandPicture: (draw: IMockDraw) => {
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
  mockPictures.length = 0;
  mockTypeface = null;
});

it('paints late data into the same native canvas and applies subsequent resizing', () => {
  const { getByTestId, rerender } = render(
    <LightweightChart data={[]} height={280} />,
  );
  const canvas = getByTestId('skia-canvas');
  expect(mockDraws.at(-1)?.commands).toHaveLength(0);
  mockTypeface = {};
  rerender(<LightweightChart data={[]} height={280} />);
  expect(mockSkiaFont).toHaveBeenCalledWith(mockTypeface);
  rerender(<LightweightChart data={chartData} height={280} />);
  const original = mockDraws
    .at(-2)
    ?.commands.find((c) => c.kind === 'polyline');
  expect(original?.points).toHaveLength(2);
  rerender(<LightweightChart data={chartData} height={456} />);
  const resized = mockDraws.at(-1)?.commands.find((c) => c.kind === 'polyline');
  expect(resized?.points?.[0].y).not.toBe(original?.points?.[0].y);
  expect(getByTestId('skia-canvas')).toBe(canvas);
});

it('reports scrub selection and releases it on gesture completion and unmount', () => {
  const onHover = jest.fn();
  const { unmount } = render(
    <LightweightChart data={chartData} height={280} onHover={onHover} />,
  );
  act(() => mockGestureHandlers.start({ x: 2, y: 80 }));
  flush();
  expect(onHover).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 100, price: 1 }),
  );
  act(() => mockGestureHandlers.update({ x: 300, y: 100 }));
  flush();
  expect(onHover).toHaveBeenLastCalledWith(
    expect.objectContaining({ time: 200, price: 2 }),
  );
  act(() => mockGestureHandlers.end());
  flush();
  expect(onHover).toHaveBeenLastCalledWith({});
  act(() => mockGestureHandlers.start({ x: 2, y: 80 }));
  flush();
  unmount();
  expect(onHover).toHaveBeenLastCalledWith({});
});

it('leaves axis touches available to native page gestures', () => {
  render(
    <LightweightChart data={chartData} height={280} onHover={jest.fn()} />,
  );
  const manager = { fail: jest.fn() };
  mockGestureHandlers.down({ changedTouches: [{ x: 401, y: 100 }] }, manager);
  expect(manager.fail).toHaveBeenCalledTimes(1);
});

it('reuses the static picture inside the plot and restores the full line outside it', () => {
  render(
    <LightweightChart
      data={chartData}
      secondaryLineData={chartData}
      height={280}
      nativeScrubOptions={{
        labels: {},
        largePrice: false,
        backgroundColor: '#fff',
        borderColor: '#ddd',
        textColor: '#000',
        timeColor: '#888',
      }}
    />,
  );
  const base = mockPictures.at(-2)!;
  const overlay = mockPictures.at(-1)!;
  const full = base.value;
  act(() => mockGestureHandlers.start({ x: 20, y: 80 }));
  const cut = base.value;
  expect(cut).not.toBe(full);
  const hasSolidLine = () =>
    mockDraws
      .at(-1)
      ?.commands.some(
        (command) =>
          command.kind === 'polyline' && command.customPaintId === 'secondary',
      );
  expect(hasSolidLine()).toBe(false);
  let crosshair = overlay.value;
  for (const x of [30, 50, 100]) {
    act(() => mockGestureHandlers.update({ x, y: 80 }));
    expect(base.value).toBe(cut);
    const next = overlay.value;
    expect(next).not.toBe(crosshair);
    crosshair = next;
  }
  act(() => mockGestureHandlers.update({ x: 401, y: 80 }));
  const outside = base.value;
  expect(outside).not.toBe(cut);
  expect(hasSolidLine()).toBe(true);
  for (const point of [
    { x: 402, y: 80 },
    { x: 20, y: 270 },
    { x: -1, y: 80 },
  ]) {
    act(() => mockGestureHandlers.update(point));
    expect(base.value).toBe(outside);
    void overlay.value;
    expect(mockDraws.at(-1)?.commands).toHaveLength(0);
  }
  act(() => mockGestureHandlers.update({ x: 20, y: 80 }));
  expect(base.value).not.toBe(outside);
  expect(hasSolidLine()).toBe(false);
  act(() => mockGestureHandlers.end());
  expect(base.value).not.toBe(cut);
  expect(hasSolidLine()).toBe(true);
});

it('keeps the fallback on failure, shares the pending font and reuses it immediately on remount', async () => {
  const { useChartTypeface } = jest.requireActual<
    typeof import('./native/useChartTypeface')
  >('./native/useChartTypeface');
  mockLoadData.mockRejectedValueOnce(new OneKeyLocalError('Unavailable font'));
  const failed = renderHook(useChartTypeface);
  await act(async () => Promise.resolve());
  expect(failed.result.current).toBeNull();
  failed.unmount();

  let resolveFont: (value: object) => void = () => undefined;
  mockLoadData.mockImplementationOnce(
    () =>
      new Promise<object>((resolve) => {
        resolveFont = resolve;
      }),
  );
  const first = renderHook(useChartTypeface);
  const second = renderHook(useChartTypeface);
  expect(first.result.current).toBeNull();
  expect(second.result.current).toBeNull();
  first.unmount();
  await act(async () => resolveFont({}));
  expect(second.result.current).toBe(mockLoadedFace);

  const remounted = renderHook(useChartTypeface);
  expect(remounted.result.current).toBe(mockLoadedFace);
  expect(mockLoadData).toHaveBeenCalledTimes(2);
});
