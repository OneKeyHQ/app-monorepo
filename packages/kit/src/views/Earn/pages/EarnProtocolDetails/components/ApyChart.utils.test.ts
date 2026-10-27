import {
  buildChartHistory,
  buildChartHistoryWithGaps,
  getLatestTimestamp,
} from './ApyChart.utils';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// 2026-09-09 12:00 UTC, the base line's newest snapshot
const NOW_MS = Date.UTC(2026, 8, 9, 12);

function hourly(fromMs: number, toMs: number, apy: string) {
  const items: { timestamp: number; apy: string }[] = [];
  for (let timestamp = fromMs; timestamp <= toMs; timestamp += HOUR_MS) {
    items.push({ timestamp, apy });
  }
  return items;
}

describe('buildChartHistory', () => {
  const baseLine = hourly(NOW_MS - 30 * DAY_MS, NOW_MS, '3.3');

  it('windows a series on its own newest point when no anchor is given', () => {
    const points = buildChartHistory(baseLine, '1h');

    expect(points[0].timestamp).toBe(NOW_MS - 7 * DAY_MS);
    expect(points[points.length - 1].timestamp).toBe(NOW_MS);
  });

  it('cuts the second line from the base line window, not its own', () => {
    // A campaign that stopped eight days ago has nothing inside the base
    // line's last seven days, so the orange line stays off instead of being
    // drawn over its own last week.
    const campaignLine = hourly(
      NOW_MS - 30 * DAY_MS,
      NOW_MS - 8 * DAY_MS,
      '30',
    );

    expect(
      buildChartHistory(campaignLine, '1h', getLatestTimestamp(baseLine)),
    ).toEqual([]);
  });

  it('keeps the tail of a second line that stopped inside the window', () => {
    const campaignLine = hourly(
      NOW_MS - 30 * DAY_MS,
      NOW_MS - 3 * DAY_MS,
      '30',
    );

    const points = buildChartHistory(
      campaignLine,
      '1h',
      getLatestTimestamp(baseLine),
    );

    expect(points[0].timestamp).toBe(NOW_MS - 7 * DAY_MS);
    expect(points[points.length - 1].timestamp).toBe(NOW_MS - 3 * DAY_MS);
  });

  it('drops second line points newer than the base line', () => {
    // A line that keeps updating after the base line's newest snapshot would
    // otherwise be drawn past the end of the base line.
    const rewardLine = hourly(NOW_MS - 10 * DAY_MS, NOW_MS + 2 * DAY_MS, '2');

    const points = buildChartHistory(
      rewardLine,
      '1h',
      getLatestTimestamp(baseLine),
    );

    expect(points[0].timestamp).toBe(NOW_MS - 7 * DAY_MS);
    expect(points[points.length - 1].timestamp).toBe(NOW_MS);
  });

  it('anchors the daily and weekly buckets the same way', () => {
    const campaignLine = hourly(
      NOW_MS - 60 * DAY_MS,
      NOW_MS - 40 * DAY_MS,
      '30',
    );
    const anchor = getLatestTimestamp(baseLine);

    expect(buildChartHistory(campaignLine, '1d', anchor)).toEqual([]);
    expect(
      buildChartHistory(campaignLine, '1w', anchor).every(
        (item) => item.timestamp >= NOW_MS - 365 * DAY_MS,
      ),
    ).toBe(true);
  });

  it('leaves the max range untouched', () => {
    const campaignLine = hourly(
      NOW_MS - 60 * DAY_MS,
      NOW_MS - 40 * DAY_MS,
      '30',
    );

    expect(
      buildChartHistory(campaignLine, 'max', getLatestTimestamp(baseLine)),
    ).toHaveLength(campaignLine.length);
  });
});

describe('getLatestTimestamp', () => {
  it('returns the newest finite point regardless of input order', () => {
    expect(
      getLatestTimestamp([
        { timestamp: NOW_MS, apy: '1' },
        { timestamp: NOW_MS - HOUR_MS, apy: '1' },
        { timestamp: NOW_MS + HOUR_MS, apy: 'oops' },
      ]),
    ).toBe(NOW_MS);
    expect(getLatestTimestamp([])).toBeUndefined();
    expect(getLatestTimestamp(undefined)).toBeUndefined();
  });
});

describe('buildChartHistoryWithGaps', () => {
  // The campaign APY rides on the base points: present while a campaign ran,
  // absent otherwise (prod: 08-13 for a day, then again from 10-12).
  const augustRun = { from: NOW_MS - 27 * DAY_MS, to: NOW_MS - 26 * DAY_MS };
  const history = hourly(NOW_MS - 30 * DAY_MS, NOW_MS, '3.3').map((item) => ({
    timestamp: item.timestamp,
    apy:
      (item.timestamp >= augustRun.from && item.timestamp <= augustRun.to) ||
      item.timestamp === NOW_MS
        ? '20'
        : undefined,
  }));

  it('keeps the points without a value as gaps between two runs', () => {
    const points = buildChartHistoryWithGaps(history, 'max');

    expect(points).toHaveLength(history.length);
    const lastAugustIndex = points.findIndex(
      (point) => point.timestamp === augustRun.to,
    );
    expect(points[lastAugustIndex].apy).toBe(20);
    expect(points[lastAugustIndex + 1].apy).toBeNull();
    expect(points[points.length - 2].apy).toBeNull();
    expect(points[points.length - 1].apy).toBe(20);
  });

  it('samples the daily buckets at the same moments as the base line', () => {
    const base = buildChartHistory(
      history.map((item) => ({ ...item, apy: '3.3' })),
      '1d',
    );
    const extra = buildChartHistoryWithGaps(history, '1d', NOW_MS);

    expect(extra.map((point) => point.timestamp)).toEqual(
      base.map((point) => point.timestamp),
    );
    // The August day and the day after it (the run ends an hour into it)
    // carry the campaign; so does the newest point.
    expect(extra.filter((point) => point.apy !== null)).toHaveLength(3);
  });

  it('keeps a campaign shorter than a bucket on the day and week it ran', () => {
    // A campaign of a few hours in the middle of a day, three weeks back:
    // the day's and the week's last snapshots are gaps, yet the bucket
    // shows the campaign.
    const start = NOW_MS - 20 * DAY_MS - 12 * 60 * 60 * 1000;
    const short = hourly(NOW_MS - 30 * DAY_MS, NOW_MS, '3.3').map((item) => ({
      timestamp: item.timestamp,
      apy:
        item.timestamp >= start && item.timestamp <= start + 3 * 60 * 60 * 1000
          ? '15'
          : undefined,
    }));
    const daily = buildChartHistoryWithGaps(short, '1d', NOW_MS);
    const weekly = buildChartHistoryWithGaps(short, '1w', NOW_MS);
    expect(daily.filter((point) => point.apy === 15)).toHaveLength(1);
    expect(weekly.filter((point) => point.apy === 15)).toHaveLength(1);
    // every other bucket stays a gap
    expect(daily.filter((point) => point.apy !== null)).toHaveLength(1);
  });

  it('drops nothing but unusable timestamps', () => {
    expect(
      buildChartHistoryWithGaps(
        [
          { timestamp: NOW_MS, apy: 'oops' },
          { timestamp: Number.NaN, apy: '1' },
        ],
        'max',
      ),
    ).toEqual([{ timestamp: NOW_MS, apy: null }]);
  });
});
