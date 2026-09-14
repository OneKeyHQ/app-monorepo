import { buildChartHistory, getLatestTimestamp } from './ApyChart.utils';

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
