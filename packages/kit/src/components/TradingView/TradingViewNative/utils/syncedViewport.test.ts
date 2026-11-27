import {
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import { getTradingViewNativeCandleX } from './chartViewport';
import {
  getTradingViewNativeFollowedViewport,
  getTradingViewNativeSyncedViewport,
} from './syncedViewport';

const START = Date.UTC(2024, 0, 1) / 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Candles from `start` up to, not including, `start + duration`.
function candles(interval: number, duration: number, start = START) {
  return Array.from({ length: duration / interval }, (_, index) => ({
    t: start + index * interval,
  }));
}

function chart(
  interval: number,
  duration: number,
  viewport = { offset: 0, zoomScale: 1 },
  chartWidth = 600,
) {
  return {
    candleIntervalSeconds: interval,
    chartWidth,
    points: candles(interval, duration),
    viewport,
  };
}

type IChart = ReturnType<typeof chart>;

// Where `time` is drawn, as a share of the plot width measured from the right
// edge. The candles are one interval apart, and a time moves through its
// candle in step with the pixels.
function gapOf(
  { candleIntervalSeconds, chartWidth, points }: IChart,
  viewport: { offset: number; zoomScale: number },
  time: number,
) {
  const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
  const oldestX = getTradingViewNativeCandleX({
    ...viewport,
    index: 0,
    pointCount: points.length,
    priceAxisX: plotRight,
  });
  const position = (time - points[0].t) / candleIntervalSeconds - 0.5;
  const x =
    oldestX + position * TRADING_VIEW_NATIVE_CANDLE_STEP * viewport.zoomScale;
  return (plotRight - x) / chartWidth;
}

function follow(leader: IChart, follower: IChart, { fitRange = false } = {}) {
  const followed = getTradingViewNativeSyncedViewport(leader);
  expect(followed).not.toBeNull();
  const viewport = getTradingViewNativeFollowedViewport({
    ...follower,
    fitRange,
    followed: followed!,
  });
  expect(viewport).not.toBeNull();
  return { followed: followed!, viewport: viewport! };
}

// The follower's viewport for each step of the leading chart.
function followSteps(
  leader: IChart,
  follower: IChart,
  steps: { offset: number; zoomScale: number }[],
  options?: { fitRange?: boolean },
) {
  return steps.map(
    (viewport) => follow({ ...leader, viewport }, follower, options).viewport,
  );
}

describe('lining a chart up with another one', () => {
  it('describes the times at the edges of the plot', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 200, zoomScale: 2 });
    const viewport = getTradingViewNativeSyncedViewport(leader);

    expect(viewport).not.toBeNull();
    const { fromTime, rightGap, span, toTime } = viewport!;
    // Candles fill the plot: the times are those at its edges.
    expect(rightGap).toBeCloseTo(0);
    expect(span).toBeCloseTo(1);
    expect(toTime).toBeGreaterThan(fromTime);
    expect(toTime).toBeLessThan(START + 10 * DAY);
    expect(gapOf(leader, leader.viewport, toTime)).toBeCloseTo(0);
    expect(gapOf(leader, leader.viewport, fromTime)).toBeCloseTo(1);
  });

  it('keeps the room past the newest candle', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: -60, zoomScale: 1 });
    const { rightGap, toTime } = getTradingViewNativeSyncedViewport(leader)!;

    // Where the newest candle ends, not a time still to come.
    expect(toTime).toBe(START + 10 * DAY);
    expect(rightGap).toBeGreaterThan(0);
    expect(gapOf(leader, leader.viewport, toTime)).toBeCloseTo(rightGap);
  });

  it('reproduces the viewport on a chart with the same candles', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 200, zoomScale: 2 });
    const follower = chart(HOUR, 10 * DAY, { offset: 0, zoomScale: 0.5 });

    const ranged = follow(leader, follower, { fitRange: true }).viewport;
    expect(ranged.zoomScale).toBeCloseTo(2);
    expect(ranged.offset).toBeCloseTo(200);
    // Without the range it only scrolls: the zoom stays its own.
    const { followed, viewport } = follow(leader, follower);
    expect(viewport.zoomScale).toBe(0.5);
    expect(gapOf(follower, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
  });

  it('keeps the place at the right as a share of the chart width', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: -60, zoomScale: 1 });
    const narrow = chart(HOUR, 10 * DAY, undefined, 300);
    const { followed, viewport } = follow(leader, narrow);

    expect(followed.rightGap).toBeGreaterThan(0);
    expect(gapOf(narrow, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
  });

  it('lines a finer or coarser chart up with the time at the right edge', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 300, zoomScale: 1 });
    for (const interval of [15 * MINUTE, 4 * HOUR]) {
      const follower = chart(interval, 10 * DAY);
      const { followed, viewport } = follow(leader, follower);
      expect(gapOf(follower, viewport, followed.toTime)).toBeCloseTo(
        followed.rightGap,
      );
    }
  });

  // OK-67840: a candle crossing the edge of the leading chart used to move
  // the anchor by a whole candle, and the others jumped back and forth.
  it('moves a chart with other candles in step with a pan of the leading one', () => {
    const leader = chart(HOUR, 10 * DAY);
    const pan = Array.from({ length: 61 }, (_, step) => ({
      offset: 300 + step,
      zoomScale: 1,
    }));
    for (const [follower, pixelsPerPixel] of [
      // A pixel of the leading chart holds 10 minutes.
      [chart(4 * HOUR, 10 * DAY), 0.25],
      [chart(15 * MINUTE, 10 * DAY), 4],
      [chart(HOUR, 10 * DAY, { offset: 0, zoomScale: 0.5 }), 0.5],
    ] as const) {
      const offsets = followSteps(leader, follower, pan).map(
        (viewport) => viewport.offset,
      );
      for (let step = 1; step < offsets.length; step += 1) {
        expect(offsets[step] - offsets[step - 1]).toBeCloseTo(
          pixelsPerPixel,
          6,
        );
      }
    }
  });

  it('zooms a chart with other candles in step with a zoom of the leading one', () => {
    const leader = chart(HOUR, 10 * DAY);
    const zoom = Array.from({ length: 51 }, (_, step) => ({
      offset: 300,
      zoomScale: 1 + step / 100,
    }));
    const follower = chart(15 * MINUTE, 10 * DAY);
    const followedZooms = followSteps(leader, follower, zoom, {
      fitRange: true,
    }).map((viewport) => viewport.zoomScale);

    followedZooms.forEach((zoomScale, step) => {
      // Four candles for every one of the leading chart, a quarter as wide.
      expect(zoomScale).toBeCloseTo(zoom[step].zoomScale / 4, 6);
    });
  });

  it('fits the same span of time into a chart with other candles', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 100, zoomScale: 1 });
    const follower = chart(15 * MINUTE, 10 * DAY);
    const { followed, viewport } = follow(leader, follower, {
      fitRange: true,
    });

    expect(viewport.zoomScale).toBeCloseTo(0.25);
    expect(gapOf(follower, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
    expect(gapOf(follower, viewport, followed.fromTime)).toBeCloseTo(
      followed.rightGap + followed.span,
    );
  });

  it('stops at the zoom limits when the span cannot fit', () => {
    const days = chart(DAY, 200 * DAY, { offset: 0, zoomScale: 1 });
    const minutes = chart(MINUTE, DAY);
    // 200 days of one-minute candles: far more than fits at any zoom.
    minutes.points = candles(MINUTE, DAY, START + 199 * DAY);
    expect(follow(days, minutes, { fitRange: true }).viewport.zoomScale).toBe(
      TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
    );

    const fewMinutes = chart(MINUTE, 10 * MINUTE, { offset: 0, zoomScale: 1 });
    expect(
      follow(fewMinutes, chart(MINUTE, DAY), { fitRange: true }).viewport
        .zoomScale,
    ).toBeLessThanOrEqual(TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE);
  });

  it('takes a time still to come as the end of the newest candle it has', () => {
    // The hourly chart's newest candle runs to the end of the hour; the
    // one-minute chart has only reached its twentieth minute.
    const leader = chart(HOUR, 2 * DAY);
    const follower = chart(MINUTE, 2 * DAY - 40 * MINUTE);
    const { followed, viewport } = follow(leader, follower);
    const latestEnd = follower.points[follower.points.length - 1].t + MINUTE;

    expect(followed.toTime).toBeGreaterThan(latestEnd);
    expect(gapOf(follower, viewport, latestEnd)).toBeCloseTo(followed.rightGap);
  });

  it('lines a time inside a gap in the data up with where the candle before it ends', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 300, zoomScale: 1 });
    const { toTime } = getTradingViewNativeSyncedViewport(leader)!;
    const follower = chart(HOUR, 10 * DAY);
    // No candles for the six hours around the time the leading chart ends on.
    const gapFrom = Math.floor(toTime / HOUR) * HOUR - 3 * HOUR;
    follower.points = follower.points.filter(
      (point) => point.t < gapFrom || point.t >= gapFrom + 6 * HOUR,
    );
    const { viewport } = follow(leader, follower);

    const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + 600;
    const beforeGap = follower.points.findIndex((point) => point.t >= gapFrom);
    const beforeGapEnd =
      getTradingViewNativeCandleX({
        ...viewport,
        index: beforeGap - 1,
        pointCount: follower.points.length,
        priceAxisX: plotRight,
      }) +
      (TRADING_VIEW_NATIVE_CANDLE_STEP * viewport.zoomScale) / 2;
    expect(beforeGapEnd).toBeCloseTo(plotRight);
  });

  it('goes as far back as its loaded candles reach', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 1000, zoomScale: 1 });
    // Only the last day is loaded here.
    const follower = chart(HOUR, DAY);
    follower.points = candles(HOUR, DAY, START + 9 * DAY);
    const { followed, viewport } = follow(leader, follower);

    expect(followed.toTime).toBeLessThan(follower.points[0].t);
    // The oldest candle is as far right as panning allows: history loads
    // from there.
    const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + 600;
    const oldestX = getTradingViewNativeCandleX({
      ...viewport,
      index: 0,
      pointCount: follower.points.length,
      priceAxisX: plotRight,
    });
    expect(oldestX).toBeGreaterThan(plotRight - 600 * 0.2);
    expect(oldestX).toBeLessThanOrEqual(plotRight);
  });

  it('has nothing to describe or line up without candles', () => {
    const empty = chart(HOUR, 0);
    expect(getTradingViewNativeSyncedViewport(empty)).toBeNull();
    expect(
      getTradingViewNativeFollowedViewport({
        ...empty,
        fitRange: true,
        followed: { toTime: START, rightGap: 0.1, fromTime: START, span: 0.5 },
      }),
    ).toBeNull();
  });
});
