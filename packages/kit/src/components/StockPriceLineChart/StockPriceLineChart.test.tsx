/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { createLocalTimeScale } from '../LightweightChart/utils/localTimeScale';

import {
  StockPriceLineChart,
  buildStockPriceLineChartTimeExtension,
} from './StockPriceLineChart';

let mockOnLayout:
  | ((event: { nativeEvent: { layout: { width: number } } }) => void)
  | undefined;
let mockOnPointerDown: (() => void) | undefined;
let mockChartData: IMarketTokenChart;
let mockSecondaryLineEndTime: number | undefined;
let mockResolveTimeScaleTimestamp: ((time: number) => number) | undefined;
let mockOnHover:
  | ((data: { time?: number; price?: number; x?: number; y?: number }) => void)
  | undefined;

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onLayout,
    onPointerDown,
    testID,
  }: {
    children?: ReactNode;
    onLayout?: typeof mockOnLayout;
    onPointerDown?: () => void;
    testID?: string;
  }) => {
    if (testID === 'simple-chart') {
      mockOnLayout = onLayout;
      mockOnPointerDown = onPointerDown;
    }
    return <div>{children}</div>;
  },
}));

jest.mock('@tamagui/core', () => ({
  useTheme: () => ({
    textCritical: { val: '#ff0000' },
    textSuccess: { val: '#00aa00' },
    textSubdued: { val: '#666666' },
    bgApp: { val: '#ffffff' },
    borderStrong: { val: '#aaaaaa' },
    primary10: { val: '#000000' },
    textInverse: { val: '#ffffff' },
    bgCriticalStrong: { val: '#ff0000' },
    bgSuccessStrong: { val: '#00aa00' },
    bg: { val: '#ffffff' },
    borderSubdued: { val: '#dddddd' },
    text: { val: '#000000' },
    textDisabled: { val: '#999999' },
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: () => '' }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('../LightweightChart', () => ({
  LightweightChart: ({
    data,
    secondaryLineEndTime,
    resolveTimeScaleTimestamp,
    onHover,
  }: {
    data: IMarketTokenChart;
    secondaryLineEndTime?: number;
    resolveTimeScaleTimestamp?: (time: number) => number;
    onHover?: typeof mockOnHover;
  }) => {
    mockChartData = data;
    mockSecondaryLineEndTime = secondaryLineEndTime;
    mockResolveTimeScaleTimestamp = resolveTimeScaleTimestamp;
    mockOnHover = onHover;
    return null;
  },
}));

const data: IMarketTokenChart = Array.from({ length: 288 }, (_, index) => [
  index * 300,
  100 + index,
]);

function measure(width: number) {
  act(() => mockOnLayout?.({ nativeEvent: { layout: { width } } }));
}

it('preserves the sampled series while a tab is hidden and shown at the same width', () => {
  render(
    <StockPriceLineChart data={data} height={240} testID="simple-chart" />,
  );
  measure(480);
  const sampled = mockChartData;
  expect(sampled.length).toBeLessThan(data.length);

  measure(0);
  expect(mockChartData).toBe(sampled);
  measure(480);
  expect(mockChartData).toBe(sampled);
});

it('keeps live updates and real width changes working after a hidden measurement', () => {
  const { rerender } = render(
    <StockPriceLineChart data={data} height={240} testID="simple-chart" />,
  );
  measure(480);
  const sampledCount = mockChartData.length;
  measure(0);

  const updated: IMarketTokenChart = [...data, [288 * 300, 500]];
  rerender(
    <StockPriceLineChart data={updated} height={240} testID="simple-chart" />,
  );
  // Web hands the chart local wall-clock times, so compare on that scale.
  const lastChartPoint = createLocalTimeScale(updated).data.at(-1);
  expect(mockChartData.length).toBeLessThan(updated.length);
  expect(mockChartData.at(-1)).toEqual(lastChartPoint);

  measure(960);
  expect(mockChartData.length).toBeGreaterThan(sampledCount);
  expect(mockChartData.at(-1)).toEqual(lastChartPoint);
});

it('resolves repeated-hour tick timestamps and updates held chartTime after a fall-back refresh', () => {
  // America/New_York fall-back: EDT (UTC-4) until 2026-11-01 06:00 UTC, EST (UTC-5) after.
  const dstEndMs = Date.UTC(2026, 10, 1, 6, 0);
  const tzSpy = jest
    .spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(function getOffset(this: Date) {
      return this.getTime() < dstEndMs ? 240 : 300;
    });
  try {
    const preFallback = Date.UTC(2026, 10, 1, 5, 55) / 1000; // 01:55 EDT
    const repeatedHourStart = Date.UTC(2026, 10, 1, 6, 0) / 1000; // 01:00 EST
    const repeatedHourHeld = Date.UTC(2026, 10, 1, 6, 30) / 1000; // 01:30 EST
    const later = Date.UTC(2026, 10, 1, 6, 55) / 1000; // 01:55 EST

    const initialSeries: IMarketTokenChart = [
      [preFallback, 100],
      [repeatedHourStart, 101],
      [repeatedHourHeld, 102],
      [later, 103],
    ];
    const onHoverChange = jest.fn();
    const { rerender } = render(
      <StockPriceLineChart
        data={initialSeries}
        height={240}
        testID="simple-chart"
        clearHoverOnTouchEnd
        onHoverChange={onHoverChange}
      />,
    );

    // Tick resolution maps the synthetic 01:55:01 chart time back to 06:00 UTC.
    const syntheticStartChartTime = mockChartData[1][0];
    expect(syntheticStartChartTime).toBe(mockChartData[0][0] + 1);
    expect(mockResolveTimeScaleTimestamp?.(syntheticStartChartTime)).toBe(
      repeatedHourStart,
    );

    // Hold the repeated-hour 01:30 EST candle (initially mapped synthetically).
    const initialHeldChartTime = mockChartData[2][0];
    expect(initialHeldChartTime).toBe(mockChartData[0][0] + 2);
    act(() => {
      mockOnPointerDown?.();
      mockOnHover?.({
        time: initialHeldChartTime,
        price: 102,
        x: 50,
        y: 50,
      });
    });
    expect(mockSecondaryLineEndTime).toBe(initialHeldChartTime);

    // Refresh drops preFallback, so the held candle moves to its true 01:30 EST chartTime.
    const refreshedSeries: IMarketTokenChart = [
      [repeatedHourStart, 101],
      [repeatedHourHeld, 110],
      [later, 115],
    ];
    rerender(
      <StockPriceLineChart
        data={refreshedSeries}
        height={240}
        testID="simple-chart"
        clearHoverOnTouchEnd
        onHoverChange={onHoverChange}
      />,
    );

    const refreshedHeldChartTime = mockChartData[1][0];
    expect(refreshedHeldChartTime).not.toBe(initialHeldChartTime);
    expect(mockSecondaryLineEndTime).toBe(refreshedHeldChartTime);
    expect(onHoverChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ time: repeatedHourHeld, price: 110 }),
    );
  } finally {
    tzSpy.mockRestore();
  }
});

describe('buildStockPriceLineChartTimeExtension', () => {
  const minute = 60;
  const open = 1_800_000_000;
  const series = (count: number, step = minute): IMarketTokenChart =>
    Array.from({ length: count }, (_, index) => [open + index * step, 100]);

  it('adds nothing to a series that spans its window', () => {
    const points = series(10);
    const last = points[points.length - 1][0];
    for (const timeSpanEnd of [undefined, last, last - minute, Number.NaN]) {
      expect(
        buildStockPriceLineChartTimeExtension({ data: points, timeSpanEnd }),
      ).toEqual([]);
    }
    expect(
      buildStockPriceLineChartTimeExtension({ data: [], timeSpanEnd: open }),
    ).toEqual([]);
  });

  it('repeats the series step out to the end of the window', () => {
    const points = series(10);
    const last = points[points.length - 1][0];
    expect(
      buildStockPriceLineChartTimeExtension({
        data: points,
        timeSpanEnd: last + 3 * minute,
      }),
    ).toEqual([last + minute, last + 2 * minute, last + 3 * minute]);
  });

  it('follows the step of a thinned series so the widths stay in proportion', () => {
    // Ten points five minutes apart cover 45 minutes of a 90 minute window.
    const points = series(10, 5 * minute);
    const extension = buildStockPriceLineChartTimeExtension({
      data: points,
      timeSpanEnd: open + 90 * minute,
    });
    expect(extension).toHaveLength(9);
    expect(extension.at(-1)).toBe(open + 90 * minute);
  });

  it('puts a slot on every half hour even when the step is uneven', () => {
    // A 97 second step drifts off the whole minutes after the first slot.
    const points = series(20, 97);
    const last = points[points.length - 1][0];
    const timeSpanEnd = open + 4 * 60 * minute;
    const extension = buildStockPriceLineChartTimeExtension({
      data: points,
      timeSpanEnd,
    });
    const halfHours: number[] = [];
    for (
      let mark = Math.ceil((last + 1) / 1800) * 1800;
      mark <= timeSpanEnd;
      mark += 1800
    ) {
      halfHours.push(mark);
    }
    expect(halfHours.length).toBeGreaterThan(5);
    for (const mark of halfHours) {
      expect(extension).toContain(mark);
    }
    // Still strictly increasing, and no slot moved by more than half a step.
    extension.forEach((time, index) => {
      expect(time).toBeGreaterThan(index === 0 ? last : extension[index - 1]);
      expect(Math.abs(time - Math.round(last + 97 * (index + 1)))).toBeLessThan(
        49,
      );
    });
  });

  it('steps by a minute from a single point', () => {
    expect(
      buildStockPriceLineChartTimeExtension({
        data: series(1),
        timeSpanEnd: open + 2 * minute,
      }),
    ).toEqual([open + minute, open + 2 * minute]);
  });

  it('never steps finer than a minute', () => {
    // The open and a live quote seven seconds later.
    const extension = buildStockPriceLineChartTimeExtension({
      data: series(2, 7),
      timeSpanEnd: open + 10 * minute,
    });
    // Nine whole minutes, then the window's own end seven seconds later.
    expect(extension).toHaveLength(10);
    expect(extension[1] - extension[0]).toBe(minute);
    expect(extension.at(-1)).toBe(open + 10 * minute);
  });

  it('leaves a remainder under half a step to the last point', () => {
    // Five-minute buckets, the last at 15:59 and the close at 16:00.
    const points = series(10, 5 * minute);
    const last = points[points.length - 1][0];
    expect(
      buildStockPriceLineChartTimeExtension({
        data: points,
        timeSpanEnd: last + minute,
      }),
    ).toEqual([]);
  });

  it('keeps a sparse series in proportion to the time left', () => {
    // 09:30, 12:45 and 15:59: one more minute must not take a third of the axis.
    const sparse: IMarketTokenChart = [
      [open, 100],
      [open + 195 * minute, 101],
      [open + 389 * minute, 102],
    ];
    expect(
      buildStockPriceLineChartTimeExtension({
        data: sparse,
        timeSpanEnd: open + 390 * minute,
      }),
    ).toEqual([]);
    // Two hours left on the same spacing is about one more slot, on the close.
    expect(
      buildStockPriceLineChartTimeExtension({
        data: sparse.slice(0, 2),
        timeSpanEnd: open + 390 * minute,
      }),
    ).toEqual([open + 390 * minute]);
  });

  it('ends on the window end, half a step off the grid at most', () => {
    const points = series(10);
    const last = points[points.length - 1][0];
    expect(
      buildStockPriceLineChartTimeExtension({
        data: points,
        timeSpanEnd: last + 90,
      }),
    ).toEqual([last + minute, last + 90]);
  });

  it('bounds the slots added for a long window', () => {
    expect(
      buildStockPriceLineChartTimeExtension({
        data: series(2),
        timeSpanEnd: open + 10_000_000,
      }),
    ).toHaveLength(1500);
  });
});
