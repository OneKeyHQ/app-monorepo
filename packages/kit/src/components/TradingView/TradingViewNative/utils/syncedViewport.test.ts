import {
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

// Candles from `START` up to, not including, `START + duration`.
function candles(interval: number, duration: number) {
  return Array.from({ length: duration / interval }, (_, index) => ({
    t: START + index * interval,
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

// Where the candle that holds `time` is drawn, as a share of the plot width
// measured from the right edge.
function gapOf(
  { candleIntervalSeconds, chartWidth, points }: IChart,
  viewport: { offset: number; zoomScale: number },
  time: number,
) {
  const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
  const x = getTradingViewNativeCandleX({
    ...viewport,
    index: Math.floor((time - START) / candleIntervalSeconds),
    pointCount: points.length,
    priceAxisX: plotRight,
  });
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

describe('lining a chart up with another one', () => {
  it('describes the newest and oldest candles in view', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 200, zoomScale: 2 });
    const viewport = getTradingViewNativeSyncedViewport(leader);

    expect(viewport).not.toBeNull();
    const { fromTime, rightGap, span, toTime } = viewport!;
    // The newest candle ends one second before the next one opens.
    expect((toTime + 1 - START) % HOUR).toBe(0);
    expect((fromTime - START) % HOUR).toBe(0);
    expect(toTime).toBeLessThan(START + 10 * DAY);
    // Both sit inside the plot, a candle or less from its edges.
    expect(rightGap).toBeGreaterThanOrEqual(0);
    expect(rightGap).toBeLessThan(12 / 600);
    expect(rightGap + span).toBeLessThanOrEqual(1);
    expect(rightGap + span).toBeGreaterThan(1 - 12 / 600);
    expect(gapOf(leader, leader.viewport, toTime)).toBeCloseTo(rightGap);
    expect(gapOf(leader, leader.viewport, fromTime)).toBeCloseTo(
      rightGap + span,
    );
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
    const leader = chart(HOUR, 10 * DAY, { offset: 150, zoomScale: 1 });
    const narrow = chart(HOUR, 10 * DAY, undefined, 300);
    const { followed, viewport } = follow(leader, narrow);

    expect(gapOf(narrow, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
  });

  it('scrolls a finer chart to the last candle of the coarser one in view', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 300, zoomScale: 1 });
    const follower = chart(15 * MINUTE, 10 * DAY);
    const { followed, viewport } = follow(leader, follower);

    // The quarter hour that closes the leading chart's newest hour.
    expect((followed.toTime + 1 - 15 * MINUTE - START) % HOUR).toBe(
      45 * MINUTE,
    );
    expect(gapOf(follower, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
  });

  it('scrolls a coarser chart to the candle that holds the time', () => {
    const leader = chart(15 * MINUTE, 10 * DAY, { offset: 500, zoomScale: 1 });
    const follower = chart(4 * HOUR, 10 * DAY);
    const { followed, viewport } = follow(leader, follower);

    expect(gapOf(follower, viewport, followed.toTime)).toBeCloseTo(
      followed.rightGap,
    );
  });

  it('fits the same span of time into a chart with other candles', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 100, zoomScale: 1 });
    const follower = chart(15 * MINUTE, 10 * DAY);
    const { followed, viewport } = follow(leader, follower, {
      fitRange: true,
    });

    // Four candles for every one of the leading chart, a quarter as wide.
    expect(viewport.zoomScale).toBeCloseTo(0.25, 1);
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
    minutes.points = candles(MINUTE, DAY).map((point) => ({
      t: point.t + 199 * DAY,
    }));
    expect(follow(days, minutes, { fitRange: true }).viewport.zoomScale).toBe(
      TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
    );

    const fewMinutes = chart(MINUTE, 10 * MINUTE, { offset: 0, zoomScale: 1 });
    expect(
      follow(fewMinutes, chart(MINUTE, DAY), { fitRange: true }).viewport
        .zoomScale,
    ).toBeLessThanOrEqual(TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE);
  });

  it('takes a candle that is still to come as the newest one it has', () => {
    // The hourly chart's newest candle runs to the end of the hour; the
    // one-minute chart has only reached its twentieth minute.
    const leader = chart(HOUR, 2 * DAY);
    const follower = chart(MINUTE, 2 * DAY - 40 * MINUTE);
    const { followed, viewport } = follow(leader, follower);
    const latest = follower.points[follower.points.length - 1].t;

    expect(followed.toTime).toBeGreaterThan(latest + MINUTE);
    expect(gapOf(follower, viewport, latest)).toBeCloseTo(followed.rightGap);
  });

  it('goes as far back as its loaded candles reach', () => {
    const leader = chart(HOUR, 10 * DAY, { offset: 1000, zoomScale: 1 });
    // Only the last day is loaded here.
    const follower = chart(HOUR, DAY);
    follower.points = follower.points.map((point) => ({
      t: point.t + 9 * DAY,
    }));
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
