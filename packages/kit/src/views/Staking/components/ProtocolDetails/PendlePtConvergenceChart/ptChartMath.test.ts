import {
  DAY_MS,
  buildFuturePrices,
  buildLinePath,
  buildPastPrices,
  createTimeScale,
  findNearestPointIndex,
  formatPtRate,
  getFuturePrice,
  getPriceDomain,
  getPtPriceFromImpliedApy,
  getSampleStep,
  keepRoomBelow,
  parseMaturityDate,
  resolveMaturityTime,
  snapToStep,
} from './ptChartMath';

const HOUR_MS = 60 * 60 * 1000;
// 2026-10-20 09:00 UTC, the newest point of the live PT-sUSDe history
const NOW_MS = Date.UTC(2026, 9, 20, 9);
const MATURITY_MS = Date.UTC(2026, 10, 26);

function hourly(fromMs: number, toMs: number, apy: (time: number) => string) {
  const items: { timestamp: number; apy: string }[] = [];
  for (let timestamp = fromMs; timestamp <= toMs; timestamp += HOUR_MS) {
    items.push({ timestamp, apy: apy(timestamp) });
  }
  return items;
}

describe('parseMaturityDate', () => {
  it('reads the server date as 00:00 UTC of that day', () => {
    expect(parseMaturityDate('26 Nov 2026')).toBe(MATURITY_MS);
    expect(parseMaturityDate('05 Nov 2026')).toBe(Date.UTC(2026, 10, 5));
    expect(parseMaturityDate(' 30 Dec 2027 ')).toBe(Date.UTC(2027, 11, 30));
  });

  it('reads an ISO date as 00:00 UTC of that day', () => {
    expect(parseMaturityDate('2026-11-26')).toBe(MATURITY_MS);
    expect(parseMaturityDate(' 2027-12-30 ')).toBe(Date.UTC(2027, 11, 30));
  });

  it('gives up on any other format', () => {
    expect(parseMaturityDate(undefined)).toBeUndefined();
    expect(parseMaturityDate('11/26/2026')).toBeUndefined();
    expect(parseMaturityDate('26 Foo 2026')).toBeUndefined();
  });

  it('falls back to the days left when the date cannot be read', () => {
    expect(
      resolveMaturityTime({ maturityDate: '', remainingDays: 37, now: NOW_MS }),
    ).toBe(NOW_MS + 37 * DAY_MS);
    expect(
      resolveMaturityTime({
        maturityDate: '26 Nov 2026',
        remainingDays: 37,
        now: NOW_MS,
      }),
    ).toBe(MATURITY_MS);
    expect(
      resolveMaturityTime({
        maturityDate: '2026-11-26',
        remainingDays: 37,
        now: NOW_MS,
      }),
    ).toBe(MATURITY_MS);
  });
});

describe('getPtPriceFromImpliedApy', () => {
  it('discounts the redemption value at the implied APY', () => {
    // PT-sUSDe: 5.09% with 36.6 days left
    expect(
      getPtPriceFromImpliedApy({ apyPercent: 5.09, daysToMaturity: 36.625 }),
    ).toBeCloseTo(0.995_03, 5);
  });

  it('is worth the redemption value at maturity', () => {
    expect(
      getPtPriceFromImpliedApy({ apyPercent: 34.23, daysToMaturity: 0 }),
    ).toBe(1);
    expect(
      getPtPriceFromImpliedApy({ apyPercent: 34.23, daysToMaturity: -3 }),
    ).toBe(1);
  });
});

describe('buildPastPrices', () => {
  const history = hourly(NOW_MS - 60 * DAY_MS, NOW_MS, () => '5.09');

  it('goes back as far as maturity is ahead, one point a day', () => {
    const { points, stepMs } = buildPastPrices({
      history,
      maturityTime: MATURITY_MS,
      currentRate: 0.9947,
      now: NOW_MS,
    });

    // 36.6 days left, so 36 whole days back from the newest point
    expect(stepMs).toBe(DAY_MS);
    expect(points).toHaveLength(37);
    expect(points[0].time).toBe(NOW_MS - 36 * DAY_MS);
    expect(points[points.length - 1].time).toBe(NOW_MS);
    points.slice(1).forEach((point, index) => {
      expect(point.time - points[index].time).toBe(DAY_MS);
    });
  });

  it('keeps all the history when maturity is further away than it reaches', () => {
    const { points } = buildPastPrices({
      history,
      maturityTime: NOW_MS + 400 * DAY_MS,
      currentRate: 0.95,
      now: NOW_MS,
    });

    expect(points).toHaveLength(61);
    expect(points[0].time).toBe(NOW_MS - 60 * DAY_MS);
  });

  it('draws a market’s last days with hourly points', () => {
    const { points, stepMs } = buildPastPrices({
      history,
      maturityTime: NOW_MS + 2 * DAY_MS,
      currentRate: 0.9997,
      now: NOW_MS,
    });

    expect(stepMs).toBe(HOUR_MS);
    expect(points).toHaveLength(49);
    expect(points[0].time).toBe(NOW_MS - 2 * DAY_MS);
  });

  it('pins the newest point to today’s price', () => {
    const { points } = buildPastPrices({
      history,
      maturityTime: MATURITY_MS,
      currentRate: 0.9947,
      now: NOW_MS,
    });

    expect(points[points.length - 1].price).toBeCloseTo(0.9947, 10);
    // A constant rate makes the price rise toward 1 over time
    expect(points[0].price).toBeLessThan(points[points.length - 1].price);
  });

  it('skips gaps and unreadable points', () => {
    const withGaps = [
      { timestamp: NOW_MS - 2 * DAY_MS, apy: '5' },
      { timestamp: NOW_MS - DAY_MS - HOUR_MS },
      { timestamp: NOW_MS - DAY_MS, apy: 'n/a' },
      { timestamp: NOW_MS - 3 * HOUR_MS, apy: '5' },
    ];
    const { points } = buildPastPrices({
      history: withGaps,
      maturityTime: MATURITY_MS,
      currentRate: 0.995,
      now: NOW_MS,
    });

    expect(points.map((point) => point.time)).toEqual([
      NOW_MS - 2 * DAY_MS,
      NOW_MS - 3 * HOUR_MS,
    ]);
  });

  it('skips a missing APY instead of reading it as 0%', () => {
    const withMissing = [
      { timestamp: NOW_MS - 3 * DAY_MS, apy: '5' },
      { timestamp: NOW_MS - 2 * DAY_MS, apy: null },
      { timestamp: NOW_MS - DAY_MS, apy: '' },
      { timestamp: NOW_MS, apy: '5' },
    ];
    const { points } = buildPastPrices({
      history: withMissing,
      maturityTime: MATURITY_MS,
      currentRate: 0.995,
      now: NOW_MS,
    });

    expect(points.map((point) => point.time)).toEqual([
      NOW_MS - 3 * DAY_MS,
      NOW_MS,
    ]);
  });

  it('draws no history that is stale, too short or off today’s price', () => {
    const base = { maturityTime: MATURITY_MS, now: NOW_MS };
    expect(
      buildPastPrices({
        ...base,
        history: hourly(NOW_MS - 10 * DAY_MS, NOW_MS - 3 * DAY_MS, () => '5'),
        currentRate: 0.995,
      }).points,
    ).toEqual([]);
    expect(
      buildPastPrices({
        ...base,
        history: [{ timestamp: NOW_MS, apy: '5' }],
        currentRate: 0.995,
      }).points,
    ).toEqual([]);
    expect(
      buildPastPrices({ ...base, history, currentRate: 0.9 }).points,
    ).toEqual([]);
    expect(
      buildPastPrices({ ...base, history: null, currentRate: 0.995 }).points,
    ).toEqual([]);
  });
});

describe('getSampleStep', () => {
  it('uses days for long spans and hours for a market’s last days', () => {
    expect(getSampleStep(36 * DAY_MS)).toBe(DAY_MS);
    expect(getSampleStep(14 * DAY_MS)).toBe(DAY_MS);
    expect(getSampleStep(10 * DAY_MS)).toBe(6 * HOUR_MS);
    expect(getSampleStep(2 * DAY_MS)).toBe(HOUR_MS);
  });
});

describe('future prices', () => {
  const params = {
    now: NOW_MS,
    maturityTime: MATURITY_MS,
    currentRate: 0.9947,
    targetRate: 1,
  };

  it('runs from today’s price to the redemption value', () => {
    expect(getFuturePrice({ ...params, time: NOW_MS })).toBe(0.9947);
    expect(getFuturePrice({ ...params, time: MATURITY_MS })).toBeCloseTo(1, 12);
    const middle = getFuturePrice({
      ...params,
      time: (NOW_MS + MATURITY_MS) / 2,
    });
    expect(middle).toBeCloseTo(Math.sqrt(0.9947), 12);
  });

  it('caps the drawn points and ends on the maturity time', () => {
    const points = buildFuturePrices({ ...params, maxSteps: 10 });

    expect(points).toHaveLength(11);
    expect(points[0]).toEqual({ time: NOW_MS, price: 0.9947 });
    expect(points[10].time).toBe(MATURITY_MS);
    expect(points[10].price).toBeCloseTo(1, 12);
  });

  it('draws nothing after maturity', () => {
    expect(
      buildFuturePrices({ ...params, maturityTime: NOW_MS - DAY_MS }),
    ).toEqual([]);
  });
});

describe('createTimeScale', () => {
  it('puts Today in the middle when the history mirrors the time left', () => {
    const left = MATURITY_MS - NOW_MS;
    const scale = createTimeScale({
      startTime: NOW_MS - left,
      maturityTime: MATURITY_MS,
      left: 6,
      right: 306,
    });

    expect(scale.x(NOW_MS - left)).toBe(6);
    expect(scale.x(NOW_MS)).toBe(156);
    expect(scale.x(MATURITY_MS)).toBe(306);
    [20, 156, 200, 306].forEach((x) => {
      expect(scale.x(scale.time(x))).toBeCloseTo(x, 6);
    });
  });

  it('keeps the cursor inside the chart', () => {
    const scale = createTimeScale({
      startTime: NOW_MS,
      maturityTime: MATURITY_MS,
      left: 0,
      right: 300,
    });

    expect(scale.x(NOW_MS)).toBe(0);
    expect(scale.time(-20)).toBe(NOW_MS);
    expect(scale.time(400)).toBe(MATURITY_MS);
  });
});

describe('helpers', () => {
  it('pads the price range more below than above', () => {
    const domain = getPriceDomain([0.99, 1]);
    expect(domain.min).toBeCloseTo(0.9886, 6);
    expect(domain.max).toBeCloseTo(1.0004, 6);
    expect(getPriceDomain([])).toEqual({ min: 0, max: 1 });
  });

  it('makes room under a point that sits too low', () => {
    const domain = { min: 0.97, max: 1 };
    const roomy = keepRoomBelow({ domain, price: 0.971, share: 0.2 });
    expect((0.971 - roomy.min) / (roomy.max - roomy.min)).toBeCloseTo(0.2, 10);
    expect(roomy.max).toBe(1);
    // already high enough
    expect(keepRoomBelow({ domain, price: 0.99, share: 0.2 })).toEqual(domain);
  });

  it('finds the nearest point in time', () => {
    const points = [0, 10, 20, 30].map((time) => ({ time, price: 1 }));
    expect(findNearestPointIndex(points, -5)).toBe(0);
    expect(findNearestPointIndex(points, 14)).toBe(1);
    expect(findNearestPointIndex(points, 16)).toBe(2);
    expect(findNearestPointIndex(points, 99)).toBe(3);
    expect(findNearestPointIndex([], 1)).toBe(-1);
  });

  it('snaps to whole steps from today within maturity', () => {
    const base = { now: NOW_MS, maturityTime: MATURITY_MS };
    expect(
      snapToStep({ ...base, time: NOW_MS + 2.4 * DAY_MS, stepMs: DAY_MS }),
    ).toBe(NOW_MS + 2 * DAY_MS);
    expect(
      snapToStep({ ...base, time: NOW_MS + 2.4 * HOUR_MS, stepMs: HOUR_MS }),
    ).toBe(NOW_MS + 2 * HOUR_MS);
    expect(
      snapToStep({ ...base, time: MATURITY_MS + DAY_MS, stepMs: DAY_MS }),
    ).toBe(MATURITY_MS);
  });

  it('formats rates and paths', () => {
    expect(formatPtRate(0.994_704_850_601)).toBe('0.9947');
    expect(formatPtRate(1)).toBe('1');
    expect(formatPtRate(Number.NaN)).toBe('--');
    expect(
      buildLinePath([
        [0, 1],
        [2.5, 3],
      ]),
    ).toBe('M0.00 1.00 L2.50 3.00');
  });
});
