import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { act, create } from 'react-test-renderer';

import { PerpDepthChart } from './PerpDepthChart';
import {
  DEPTH_MARKER_HIT_SLOP,
  getDepthChartHoverSelections,
} from './perpDepthChartGeometry';

import type { IDepthChartGestureProps } from './DepthChartGesture';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PointerEvent,
  PressableProps,
} from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('./perpDepthChartGeometry', () => {
  const actual = jest.requireActual<typeof import('./perpDepthChartGeometry')>(
    './perpDepthChartGeometry',
  );
  return {
    ...actual,
    getDepthChartHoverSelections: jest.fn(actual.getDepthChartHoverSelections),
  };
});

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

let mockNative = true;
const mockTheme = Object.fromEntries(
  [
    'borderSubdued',
    'borderStrong',
    'textSubdued',
    'bgAccent',
    'bgCriticalStrong',
    'bgHover',
  ].map((key) => [key, { val: '#888888' }]),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockNative;
    },
    isWebMobile: true,
  },
}));
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Platform: { select: ({ default: value }: { default: string }) => value },
}));
let mockGestureTracking = false;
let mockGestureActive = false;
let mockGestureBegin: ((event: { x: number }) => void) | undefined;
let mockGestureStart: (event: { x: number }) => void;
let mockGestureUpdate: (event: { x: number }) => void;
let mockGestureFinalize: () => void;
const mockActiveOffsetX = jest.fn().mockReturnThis();
const mockFailOffsetY = jest.fn().mockReturnThis();
const mockPan = jest.fn(() => ({
  activeOffsetX: mockActiveOffsetX,
  failOffsetY: mockFailOffsetY,
  maxPointers: jest.fn().mockReturnThis(),
  runOnJS: jest.fn().mockReturnThis(),
  onBegin(callback: typeof mockGestureStart) {
    mockGestureBegin = callback;
    return this;
  },
  onStart(callback: typeof mockGestureStart) {
    mockGestureStart = callback;
    return this;
  },
  onUpdate(callback: typeof mockGestureUpdate) {
    mockGestureUpdate = callback;
    return this;
  },
  onFinalize(callback: typeof mockGestureFinalize) {
    mockGestureFinalize = callback;
    return this;
  },
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: () => mockPan() },
  GestureDetector: ({ children }: { children: ReactElement }) => children,
}));
jest.mock('./DepthChartGesture', () => {
  const { DepthChartGesture: NativeGesture } = jest.requireActual<
    typeof import('./DepthChartGesture.native')
  >('./DepthChartGesture.native');
  const { DepthChartGesture: WebGesture } = jest.requireActual<
    typeof import('./DepthChartGesture')
  >('./DepthChartGesture');
  return {
    DepthChartGesture: (props: IDepthChartGestureProps) =>
      mockNative ? <NativeGesture {...props} /> : <WebGesture {...props} />,
  };
});
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Defs: 'Defs',
  G: 'G',
  Line: 'Line',
  LinearGradient: 'LinearGradient',
  Path: 'Path',
  Rect: 'Rect',
  Stop: 'Stop',
  Text: 'Text',
}));
jest.mock('@onekeyhq/components', () => ({
  webFontFamily: 'sans-serif',
  SizableText: 'span',
  Spinner: 'Spinner',
  Stack: 'Stack',
  XStack: 'XStack',
  YStack: 'YStack',
  TABULAR_NUMS: [],
  useTheme: () => mockTheme,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat('en', options).format(value),
  }),
}));

describe.each([true, false])(
  'depth touch interaction (native=%s)',
  (native) => {
    let view: ReactTestRenderer;
    beforeEach(() => {
      mockNative = native;
      mockPan.mockClear();
      mockActiveOffsetX.mockClear();
      mockFailOffsetY.mockClear();
      mockGestureBegin = undefined;
      mockGestureTracking = false;
      mockGestureActive = false;
      act(() => {
        view = create(
          <PerpDepthChart
            bids={[
              { price: '99.9', cumSize: '1' },
              { price: '99.8', cumSize: '10' },
              { price: '99.7', cumSize: '20' },
            ]}
            asks={[
              { price: '100.1', cumSize: '2' },
              { price: '100.2', cumSize: '12' },
              { price: '100.3', cumSize: '24' },
            ]}
            quoteSymbol="USDC"
            priceDecimals={1}
            sizeDecimals={2}
            status="ready"
            targetKey="BTC"
            tickLabel="0.1"
            showHeader={false}
            referenceMidPrice={100}
          />,
          {
            createNodeMock: () => ({
              getBoundingClientRect: () => ({ left: -DEPTH_MARKER_HIT_SLOP }),
            }),
          },
        );
      });
      act(() => {
        const props = view.root.findByProps({ testID: 'perp-depth-chart' })
          .props as { onLayout: (event: LayoutChangeEvent) => void };
        props.onLayout({
          nativeEvent: { layout: { width: 360, height: 228 } },
        } as LayoutChangeEvent);
      });
    });
    afterEach(() => act(() => view.unmount()));

    const input = () =>
      view.root.findByProps({ testID: 'perp-depth-plot-input' })
        .props as PressableProps;
    const touch = (phase: 'start' | 'move' | 'end' | 'cancel', x = 72) => {
      if (native) {
        act(() => {
          const event = { x: x + DEPTH_MARKER_HIT_SLOP };
          if (phase === 'start') {
            mockGestureTracking = true;
            mockGestureBegin?.(event);
          } else if (phase === 'move') {
            if (!mockGestureTracking) return;
            if (!mockGestureActive) {
              mockGestureActive = true;
              mockGestureStart(event);
            }
            mockGestureUpdate(event);
          } else {
            mockGestureTracking = false;
            mockGestureActive = false;
            mockGestureFinalize();
          }
        });
        return;
      }
      const handlers = {
        start: 'onPointerDown',
        move: 'onPointerMove',
        end: 'onPointerUp',
        cancel: 'onPointerCancel',
      } as const;
      act(() => {
        input()[handlers[phase]]?.({
          nativeEvent: {
            locationX: x + DEPTH_MARKER_HIT_SLOP,
            clientX: x,
            pointerType: 'touch',
          },
        } as GestureResponderEvent & PointerEvent);
      });
    };
    const tooltip = (side: string) =>
      view.root.findAllByProps({ testID: `perp-depth-tooltip-${side}` });

    const getTooltipText = (side: string) =>
      tooltip(side)[0]
        .findAll((node) => node.type === 'span')
        .map((node) => (node.props as { children: ReactNode }).children);
    const updateChart = (
      props: Partial<ComponentProps<typeof PerpDepthChart>>,
      width = 360,
    ) => {
      const current = view.root.findByType(PerpDepthChart)
        .props as ComponentProps<typeof PerpDepthChart>;
      act(() => view.update(<PerpDepthChart {...current} {...props} />));
      act(() => {
        const chart = view.root.findByProps({ testID: 'perp-depth-chart' })
          .props as { onLayout: (event: LayoutChangeEvent) => void };
        chart.onLayout({
          nativeEvent: { layout: { width, height: 228 } },
        } as LayoutChangeEvent);
      });
    };

    const getDescription = () => {
      const props = view.root.findByProps({ testID: 'perp-depth-chart' })
        .props as {
        accessibilityLabel?: string;
        'aria-label'?: string;
      };
      return native ? props.accessibilityLabel : props['aria-label'];
    };

    it('exposes the visible midpoint when the chart header is hidden', () => {
      expect(getDescription()).toContain('perp.order_mid_price_title 100');
      updateChart({ showHeader: true });
      expect(getDescription()).not.toContain('perp.order_mid_price_title');
    });

    it.each([
      ['empty', 'global.no_data'],
      ['error', 'global.network_error'],
      ['stale', 'global.updating'],
    ] as const)(
      'exposes the %s placeholder on headerless native charts',
      (status, message) => {
        updateChart({ status, bids: [], asks: [] });
        expect(getDescription()).toBe(
          native
            ? `perp.order_book_depth, ${message}`
            : 'perp.order_book_depth',
        );
        updateChart({ showHeader: true });
        expect(getDescription()).toBe('perp.order_book_depth');
      },
    );

    it('keeps the accessible midpoint when stale data is visible and clears the status on recovery', () => {
      const readyDescription =
        'perp.order_book_depth, perp.order_mid_price_title 100';
      updateChart({ status: 'stale' });
      expect(getDescription()).toBe(
        native ? `${readyDescription}, global.updating` : readyDescription,
      );
      updateChart({ status: 'ready' });
      expect(getDescription()).toBe(readyDescription);
      updateChart({ status: 'loading' });
      expect(getDescription()).toBe('perp.order_book_depth');
    });

    it('keeps nonzero compact distances visible and leaves zero unsigned', () => {
      updateChart({
        bids: [
          { price: '59999', cumSize: '1' },
          { price: '59998', cumSize: '10' },
        ],
        asks: [
          { price: '60001', cumSize: '2' },
          { price: '60002', cumSize: '12' },
        ],
        referenceMidPrice: 60_000,
      });
      touch('start', 80);
      expect(getTooltipText('bid')).toContain('−0.002%');
      expect(getTooltipText('ask')).toContain('+0.002%');
      touch('end');

      updateChart({
        bids: [
          { price: '100', cumSize: '1' },
          { price: '99.9', cumSize: '10' },
        ],
        asks: [
          { price: '100.1', cumSize: '2' },
          { price: '100.2', cumSize: '12' },
        ],
        referenceMidPrice: 100,
      });
      touch('start', 180);
      expect(getTooltipText('bid')).toContain('0%');
      expect(getTooltipText('bid')).not.toContain('−0%');
    });

    it('omits duplicate tight-axis prices without adding quote precision', () => {
      updateChart(
        {
          bids: [{ price: '100.00', cumSize: '1' }],
          asks: [{ price: '100.01', cumSize: '2' }],
          priceDecimals: 2,
          referenceMidPrice: 100.005,
        },
        600,
      );
      const { Text: svgTextType } = jest.requireMock<{ Text: string }>(
        'react-native-svg',
      );
      const axisPrices = view.root
        .findAll(
          (node) =>
            node.type === svgTextType &&
            node.props.textAnchor === 'middle' &&
            node.props.testID !== 'perp-depth-mid-price',
        )
        .map((node) => (node.props as { children: ReactNode }).children);
      expect(axisPrices).toEqual(['100.00', '100.01']);
    });

    it('passes a touch in the edge hit slop to geometry', () => {
      jest.mocked(getDepthChartHoverSelections).mockClear();
      touch('start', -4);
      expect(getDepthChartHoverSelections).toHaveBeenLastCalledWith(
        expect.anything(),
        -4,
      );
    });

    it('shows both sides on touch down, tracks movement, and clears on release', () => {
      expect(tooltip('bid')).toHaveLength(0);
      touch('start');
      if (native) {
        expect(mockActiveOffsetX).toHaveBeenCalledWith([-6, 6]);
        expect(mockFailOffsetY).toHaveBeenCalledWith([-6, 6]);
      }
      for (const side of ['bid', 'ask']) {
        expect(tooltip(side)).toHaveLength(1);
        expect(tooltip(side)[0].props.elevation).toBe(0);
        expect(tooltip(side)[0].props.w).toBeLessThanOrEqual(150);
      }
      touch('move', 18);
      if (native) {
        expect(mockPan).toHaveBeenCalledTimes(1);
      }
      const values = getTooltipText('bid');
      expect(values).toContain('99.8');
      expect(values).toContain('10');
      touch('end');
      expect(tooltip('bid')).toHaveLength(0);
      expect(tooltip('ask')).toHaveLength(0);
      touch('move');
      expect(tooltip('bid')).toHaveLength(0);
    });

    it('follows the curve without flipping touch cards below the selected points', () => {
      touch('start');
      const positions: number[] = [];
      for (const x of [72, 18, 342, 288]) {
        touch('move', x);
        const points = view.root.findAllByProps({ r: 3 });
        for (const [index, side] of ['bid', 'ask'].entries()) {
          const card = tooltip(side)[0].props as {
            left: number;
            top: number;
            w: number;
          };
          expect(card.w).toBeLessThanOrEqual(128);
          expect(card.left).toBeGreaterThanOrEqual(side === 'bid' ? 8 : 188);
          expect(card.left + card.w).toBeLessThanOrEqual(
            side === 'bid' ? 172 : 352,
          );
          const point = points[index].props as { cy: number };
          expect(card.top).toBeGreaterThanOrEqual(8);
          expect(card.top + 64).toBeLessThanOrEqual(192);
          if (card.top > 8)
            expect(card.top + 64).toBeLessThanOrEqual(point.cy - 8);
          if (side === 'bid') positions.push(card.top);
        }
      }
      expect(positions[1]).toBeLessThan(positions[0]);
      expect(positions[2]).toBe(positions[1]);
      expect(positions[3]).toBe(positions[0]);
      touch('end');
    });

    it('skips selection work when the horizontal touch position has not changed', () => {
      const select = jest.mocked(getDepthChartHoverSelections);
      touch('start', 72);
      const selectionsAfterStart = select.mock.calls.length;
      touch('move', 72);
      touch('move', 72);
      expect(select).toHaveBeenCalledTimes(selectionsAfterStart);
      touch('move', 18);
      expect(select.mock.calls.length).toBeGreaterThan(selectionsAfterStart);
    });

    it('refreshes a stationary tooltip when the live book changes', () => {
      touch('start', 18);
      const values = () =>
        tooltip('bid')[0]
          .findAll((node) => node.type === 'span')
          .map((node) => (node.props as { children: ReactNode }).children);
      expect(values()).toContain('10');
      const props = view.root.findByType(PerpDepthChart)
        .props as ComponentProps<typeof PerpDepthChart>;
      act(() => {
        view.update(
          <PerpDepthChart
            {...props}
            bids={[
              { price: '99.9', cumSize: '1' },
              { price: '99.8', cumSize: '15' },
              { price: '99.7', cumSize: '20' },
            ]}
          />,
        );
      });
      expect(values()).toContain('15');
      expect(values()).not.toContain('10');
    });

    if (!native) {
      it('follows the curve without vertical flips while keeping desktop cards in bounds', () => {
        act(() => {
          const props = view.root.findByProps({ testID: 'perp-depth-chart' })
            .props as { onLayout: (event: LayoutChangeEvent) => void };
          props.onLayout({
            nativeEvent: { layout: { width: 1200, height: 500 } },
          } as LayoutChangeEvent);
        });
        for (const x of [330, 18, 1182, 870]) {
          act(() => {
            input().onPointerMove?.({
              nativeEvent: { clientX: x, pointerType: 'mouse' },
            } as PointerEvent);
          });
          const points = view.root.findAllByProps({ r: 3 });
          for (const [index, side] of ['bid', 'ask'].entries()) {
            const card = tooltip(side)[0].props as {
              left: number;
              top: number;
              w: number;
            };
            const point = points[index].props as { cx: number; cy: number };
            expect(card.w).toBe(180);
            expect(card.left).toBeGreaterThanOrEqual(side === 'bid' ? 8 : 608);
            expect(card.left + card.w).toBeLessThanOrEqual(
              side === 'bid' ? 592 : 1192,
            );
            const outside = x === 330 || x === 870;
            if ((side === 'bid') === outside) {
              expect(card.left + card.w).toBeLessThanOrEqual(point.cx - 8);
            } else {
              expect(card.left).toBeGreaterThanOrEqual(point.cx + 8);
            }
            expect(card.top).toBeGreaterThanOrEqual(8);
            expect(card.top + 92).toBeLessThanOrEqual(464);
            if (card.top > 8)
              expect(card.top + 92).toBeLessThanOrEqual(point.cy - 8);
          }
        }
      });

      it('preserves desktop hover until the pointer leaves', () => {
        act(() => {
          input().onPointerEnter?.({
            nativeEvent: { clientX: 72, pointerType: 'mouse' },
          } as PointerEvent);
        });
        expect(tooltip('bid')[0].props.elevation).toBe(4);
        const values = tooltip('bid')[0]
          .findAll((node) => node.type === 'span')
          .map((node) => (node.props as { children: ReactNode }).children);
        expect(values).toContain('99.9');
        expect(values).toContain('1');
        expect(values.some((value) => /BTC|USDC/.test(String(value)))).toBe(
          false,
        );
        act(() => {
          input().onPointerUp?.({} as PointerEvent);
        });
        expect(tooltip('bid')).toHaveLength(1);
        act(() => {
          input().onPointerLeave?.({
            nativeEvent: { pointerType: 'mouse' },
          } as PointerEvent);
        });
        expect(tooltip('bid')).toHaveLength(0);
      });
    }

    it('clears on cancellation and ignores further moves', () => {
      touch('start');
      if (native) touch('cancel');
      else
        act(() => {
          input().onPressOut?.({} as GestureResponderEvent);
        });
      touch('move', 18);
      expect(tooltip('bid')).toHaveLength(0);
      touch('start');
      touch('cancel');
      expect(tooltip('ask')).toHaveLength(0);
    });
  },
);
