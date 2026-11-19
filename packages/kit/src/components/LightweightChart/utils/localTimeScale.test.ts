import { createLocalTimeScale } from './localTimeScale';

// `Date#getTimezoneOffset` minutes: positive west of UTC, negative east of it.
function mockTimezoneOffset(resolveOffset: (timeMs: number) => number) {
  return jest
    .spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(function getOffset(this: Date) {
      return resolveOffset(this.getTime());
    });
}

function toUtcClock(timeSeconds: number) {
  return new Date(timeSeconds * 1000).toISOString().slice(11, 16);
}

function expectStrictlyIncreasing(times: number[]) {
  times.slice(1).forEach((time, index) => {
    expect(time).toBeGreaterThan(times[index]);
  });
}

describe('createLocalTimeScale', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('puts local midnight on the chart day boundary', () => {
    // UTC+8, e.g. Asia/Taipei.
    mockTimezoneOffset(() => -480);
    // 2026-10-09 00:00 at UTC+8 is 2026-10-08 16:00 UTC.
    const localMidnight = Date.UTC(2026, 9, 8, 16) / 1000;
    const scale = createLocalTimeScale([[localMidnight, 1]]);
    const [[shifted]] = scale.data;

    expect(new Date(shifted * 1000).toISOString()).toBe(
      '2026-10-09T00:00:00.000Z',
    );
    expect(scale.toUtcTimestamp(shifted)).toBe(localMidnight);
  });

  it('keeps the per-point offset across a spring-forward change', () => {
    // America/New_York: EST (UTC-5) until 2026-03-08 07:00 UTC, EDT after.
    const dstStartMs = Date.UTC(2026, 2, 8, 7);
    mockTimezoneOffset((timeMs) => (timeMs < dstStartMs ? 300 : 240));
    // 01:00 EST and 04:00 EDT.
    const beforeChange = Date.UTC(2026, 2, 8, 6) / 1000;
    const afterChange = Date.UTC(2026, 2, 8, 8) / 1000;
    const scale = createLocalTimeScale([
      [beforeChange, 1],
      [afterChange, 2],
    ]);

    expect(scale.data.map(([time]) => toUtcClock(time))).toEqual([
      '01:00',
      '04:00',
    ]);
    expect(scale.data.map(([time]) => scale.toUtcTimestamp(time))).toEqual([
      beforeChange,
      afterChange,
    ]);
  });

  it('keeps times increasing through a fall-back change', () => {
    // America/New_York: EDT (UTC-4) until 2026-11-01 06:00 UTC, EST after, so
    // 01:00-02:00 local happens twice.
    const dstEndMs = Date.UTC(2026, 10, 1, 6);
    mockTimezoneOffset((timeMs) => (timeMs < dstEndMs ? 240 : 300));
    const fiveMinuteBuckets = Array.from(
      { length: 18 },
      (_item, index) => Date.UTC(2026, 10, 1, 5, 30 + index * 5) / 1000,
    );
    const hourlyBuckets = [4, 5, 6, 7].map(
      (hour) => Date.UTC(2026, 10, 1, hour) / 1000,
    );

    [fiveMinuteBuckets, hourlyBuckets].forEach((buckets) => {
      const scale = createLocalTimeScale(
        buckets.map((time, index) => [time, index]),
      );
      const localTimes = scale.data.map(([time]) => time);

      expectStrictlyIncreasing(localTimes);
      expect(localTimes.map((time) => scale.toUtcTimestamp(time))).toEqual(
        buckets,
      );
      expect(scale.data.map(([, value]) => value)).toEqual(
        buckets.map((_time, index) => index),
      );
    });
    // Points past the repeated hour are back on their own local time.
    const scale = createLocalTimeScale(hourlyBuckets.map((time) => [time, 0]));
    expect(toUtcClock(scale.data[3][0])).toBe('02:00');
  });

  it('leaves UTC data untouched', () => {
    mockTimezoneOffset(() => 0);
    const time = Date.UTC(2026, 9, 9, 8) / 1000;
    const scale = createLocalTimeScale([[time, 3]]);

    expect(scale.data).toEqual([[time, 3]]);
    expect(scale.toUtcTimestamp(time)).toBe(time);
  });
});
