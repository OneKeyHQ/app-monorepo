import {
  shiftChartToLocalTime,
  toUtcTimestampFromLocalTime,
} from './localTimeScale';

// `Date#getTimezoneOffset` minutes: positive west of UTC, negative east of it.
function mockTimezoneOffset(resolveOffset: (timeMs: number) => number) {
  return jest
    .spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(function getOffset(this: Date) {
      return resolveOffset(this.getTime());
    });
}

describe('localTimeScale', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('puts local midnight on the chart day boundary', () => {
    // UTC+8, e.g. Asia/Taipei.
    mockTimezoneOffset(() => -480);
    // 2026-10-09 00:00 at UTC+8 is 2026-10-08 16:00 UTC.
    const localMidnight = Date.UTC(2026, 9, 8, 16) / 1000;
    const [[shifted]] = shiftChartToLocalTime([[localMidnight, 1]]);

    expect(new Date(shifted * 1000).toISOString()).toBe(
      '2026-10-09T00:00:00.000Z',
    );
    expect(toUtcTimestampFromLocalTime(shifted)).toBe(localMidnight);
  });

  it('keeps the per-point offset across a DST change', () => {
    // America/New_York: EST (UTC-5) until 2026-03-08 07:00 UTC, EDT after.
    const dstStartMs = Date.UTC(2026, 2, 8, 7);
    mockTimezoneOffset((timeMs) => (timeMs < dstStartMs ? 300 : 240));
    // 01:00 EST and 04:00 EDT.
    const beforeChange = Date.UTC(2026, 2, 8, 6) / 1000;
    const afterChange = Date.UTC(2026, 2, 8, 8) / 1000;
    const shifted = shiftChartToLocalTime([
      [beforeChange, 1],
      [afterChange, 2],
    ]);

    expect(
      shifted.map(([time]) => new Date(time * 1000).getUTCHours()),
    ).toEqual([1, 4]);
    expect(shifted.map(([time]) => toUtcTimestampFromLocalTime(time))).toEqual([
      beforeChange,
      afterChange,
    ]);
  });

  it('leaves UTC data untouched', () => {
    mockTimezoneOffset(() => 0);
    const time = Date.UTC(2026, 9, 9, 8) / 1000;

    expect(shiftChartToLocalTime([[time, 3]])).toEqual([[time, 3]]);
    expect(toUtcTimestampFromLocalTime(time)).toBe(time);
  });
});
