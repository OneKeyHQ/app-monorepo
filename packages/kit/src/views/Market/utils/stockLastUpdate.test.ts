import { formatStockLastUpdateTime } from './stockLastUpdate';

describe('formatStockLastUpdateTime', () => {
  // The label reads the viewer's clock, so the zone is pinned per test rather
  // than left to whichever machine runs the suite.
  function mockTimeZone(offsetMinutesAheadOfUtc: number) {
    const shift = (date: Date) =>
      new Date(date.getTime() + offsetMinutesAheadOfUtc * 60_000);
    jest
      .spyOn(Date.prototype, 'getTimezoneOffset')
      .mockReturnValue(-offsetMinutesAheadOfUtc);
    jest
      .spyOn(Date.prototype, 'getHours')
      .mockImplementation(function getHours(this: Date) {
        return shift(this).getUTCHours();
      });
    jest
      .spyOn(Date.prototype, 'getMinutes')
      .mockImplementation(function getMinutes(this: Date) {
        return shift(this).getUTCMinutes();
      });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports the local time and offset of the quote', () => {
    mockTimeZone(8 * 60);

    expect(formatStockLastUpdateTime('2026-09-15T23:58:00.007Z')).toBe(
      '07:58 UTC+8',
    );
  });

  it('pads the hour and keeps half-hour zones exact', () => {
    mockTimeZone(5 * 60 + 30);

    expect(formatStockLastUpdateTime('2026-09-15T23:58:00.007Z')).toBe(
      '05:28 UTC+5:30',
    );
  });

  it('drops the sign at UTC', () => {
    mockTimeZone(0);

    expect(formatStockLastUpdateTime('2026-09-15T23:58:00.007Z')).toBe(
      '23:58 UTC',
    );
  });

  it('keeps the sign behind UTC', () => {
    mockTimeZone(-4 * 60);

    expect(formatStockLastUpdateTime('2026-09-15T23:58:00.007Z')).toBe(
      '19:58 UTC-4',
    );
  });

  it.each([undefined, '', 'not-a-date'])(
    'returns nothing for %s so the chip renders no segment',
    (value) => {
      mockTimeZone(8 * 60);

      expect(formatStockLastUpdateTime(value)).toBeUndefined();
    },
  );
});
