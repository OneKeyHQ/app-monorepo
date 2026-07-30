import {
  EUSMarketSessionKey,
  EUSMarketStatusVariant,
  approximateNyOffsetMinutes,
  getDeviceUtcOffsetLabel,
  getUSMarketTradingHours,
  resolveUSMarketStatusVariant,
  resolveUSTradingHoursActiveRow,
  usMarketSessionKeyFromBackendSession,
} from './tradingHoursUtils';

import type { IFetchUSMarketStatusResult } from '../../types/swap/types';

const HOUR = 60 * 60 * 1000;

describe('getUSMarketTradingHours', () => {
  it('computes EST (winter) cycle boundaries as UTC instants', () => {
    // 2026-01-15 (Thu) 15:00 UTC = 10:00 EST → regular session
    const res = getUSMarketTradingHours(new Date('2026-01-15T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-01-15T09:01:00Z'));
    expect(res.cycleEndInstant).toBe(Date.parse('2026-01-16T08:56:00Z'));
    expect(res.segments.map((s) => s.startInstant)).toEqual([
      Date.parse('2026-01-15T09:01:00Z'), // 04:01 EST
      Date.parse('2026-01-15T14:31:00Z'), // 09:31 EST
      Date.parse('2026-01-15T21:01:00Z'), // 16:01 EST
      Date.parse('2026-01-16T01:05:00Z'), // 20:05 EST
    ]);
    expect(res.segments.map((s) => s.endInstant)).toEqual([
      Date.parse('2026-01-15T14:30:00Z'), // 09:30 EST → renders 09:29
      Date.parse('2026-01-15T21:00:00Z'), // 16:00 EST → renders 15:59
      Date.parse('2026-01-16T01:00:00Z'), // 20:00 EST → renders 19:59
      Date.parse('2026-01-16T08:56:00Z'), // 03:56 EST → renders 03:55
    ]);
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Regular);
    // Cycle 04:01 → 03:56 next day = 1435 min; now offset = 359 min
    expect(res.nowRatio).toBeCloseTo(359 / 1435, 10);
    expect(res.segments.map((s) => s.ratio)).toEqual([
      329 / 1435,
      389 / 1435,
      239 / 1435,
      471 / 1435,
    ]);
  });

  it('attributes early-morning ET hours to the previous cycle day', () => {
    // 07:00 UTC = 02:00 EST (before the 04:01 anchor) → cycle of Jan 14
    const res = getUSMarketTradingHours(new Date('2026-01-15T07:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-01-14T09:01:00Z'));
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Overnight);
  });

  it('uses EDT offsets in summer', () => {
    // 2026-07-15 15:00 UTC = 11:00 EDT → regular session
    const res = getUSMarketTradingHours(new Date('2026-07-15T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-07-15T08:01:00Z'));
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Regular);
  });

  it('produces a shortened cycle across the spring-forward transition', () => {
    // Cycle anchored 2026-03-07 04:01 EST; DST starts 2026-03-08 02:00 ET
    const res = getUSMarketTradingHours(new Date('2026-03-07T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-03-07T09:01:00Z'));
    // Overnight close 03:56 is EDT after the 1h jump → cycle is 22h55m long
    expect(res.cycleEndInstant).toBe(Date.parse('2026-03-08T07:56:00Z'));
    const overnight = res.segments[3];
    expect(overnight.startInstant).toBe(Date.parse('2026-03-08T01:05:00Z'));
    // 20:05 EST → 03:56 EDT spans 411 real minutes of a 1375-minute cycle
    expect(overnight.ratio).toBeCloseTo(411 / 1375, 10);
    const ratioSum = res.segments.reduce((acc, s) => acc + s.ratio, 0);
    // 7 minutes of inter-session gaps stay outside every segment
    expect(ratioSum).toBeCloseTo(1368 / 1375, 10);
  });

  it('produces a lengthened cycle across the fall-back transition', () => {
    // Cycle anchored 2026-10-31 04:01 EDT; DST ends 2026-11-01 02:00 ET
    const res = getUSMarketTradingHours(new Date('2026-10-31T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-10-31T08:01:00Z'));
    // Overnight close 03:56 is EST after the 1h repeat → cycle is 24h55m long
    expect(res.cycleEndInstant).toBe(Date.parse('2026-11-01T08:56:00Z'));
  });

  it('computes the upcoming weekend window on a weekday', () => {
    // Thu Jan 15 → weekend = Fri Jan 16 20:00 EST → Sun Jan 18 20:00 EST
    const res = getUSMarketTradingHours(new Date('2026-01-15T15:00:00Z'));
    expect(res.weekendStartInstant).toBe(Date.parse('2026-01-17T01:00:00Z'));
    expect(res.weekendEndInstant).toBe(Date.parse('2026-01-19T01:00:00Z'));
  });

  it('computes the ongoing weekend window on a Saturday spanning a DST switch', () => {
    // Sat Mar 7 → weekend = Fri Mar 6 20:00 EST → Sun Mar 8 20:00 EDT (47h)
    const res = getUSMarketTradingHours(new Date('2026-03-07T15:00:00Z'));
    expect(res.weekendStartInstant).toBe(Date.parse('2026-03-07T01:00:00Z'));
    expect(res.weekendEndInstant).toBe(Date.parse('2026-03-09T00:00:00Z'));
    expect(res.weekendEndInstant - res.weekendStartInstant).toBe(47 * HOUR);
  });

  it('keeps every boundary aligned with session order, with fixed gaps', () => {
    const res = getUSMarketTradingHours(new Date('2026-01-15T15:00:00Z'));
    expect(res.segments.map((s) => s.key)).toEqual([
      EUSMarketSessionKey.PreMarket,
      EUSMarketSessionKey.Regular,
      EUSMarketSessionKey.PostMarket,
      EUSMarketSessionKey.Overnight,
    ]);
    // 09:30 (opening cross), 16:00 and 20:00–20:04 ET belong to no session
    const gapMinutes = res.segments
      .slice(1)
      .map(
        (s, i) => (s.startInstant - res.segments[i].endInstant) / (60 * 1000),
      );
    expect(gapMinutes).toEqual([1, 1, 5]);
  });

  it('flags a now inside an inter-session gap', () => {
    // 14:30:30 UTC = 09:30:30 EST — between pre-market end and regular start
    const res = getUSMarketTradingHours(new Date('2026-01-15T14:30:30Z'));
    expect(res.isNowInSessionGap).toBe(true);
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Regular);
    // Mid-session times are not gaps
    expect(
      getUSMarketTradingHours(new Date('2026-01-15T15:00:00Z'))
        .isNowInSessionGap,
    ).toBe(false);
  });

  it('flags the overnight-to-pre-market gap at the cycle edge', () => {
    // 2026-01-16 08:58 UTC = 03:58 EST — after the 03:56 overnight close and
    // before the 04:01 pre-market open
    const res = getUSMarketTradingHours(new Date('2026-01-16T08:58:00Z'));
    expect(res.isNowInSessionGap).toBe(true);
    expect(res.cycleStartInstant).toBe(Date.parse('2026-01-15T09:01:00Z'));
  });
});

describe('approximateNyOffsetMinutes', () => {
  it('returns EST in winter and EDT in summer', () => {
    expect(approximateNyOffsetMinutes(Date.parse('2026-01-15T12:00:00Z'))).toBe(
      -300,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-07-15T12:00:00Z'))).toBe(
      -240,
    );
  });

  it('switches around the 2026 DST boundaries', () => {
    // DST starts 2026-03-08 07:00 UTC, ends 2026-11-01 06:00 UTC
    expect(approximateNyOffsetMinutes(Date.parse('2026-03-08T06:00:00Z'))).toBe(
      -300,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-03-08T08:00:00Z'))).toBe(
      -240,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-11-01T05:30:00Z'))).toBe(
      -240,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-11-01T06:30:00Z'))).toBe(
      -300,
    );
  });
});

describe('getDeviceUtcOffsetLabel', () => {
  const label = (offsetMinutes: number) => {
    const d = new Date('2026-01-15T15:00:00Z');
    jest
      .spyOn(Date.prototype, 'getTimezoneOffset')
      .mockReturnValue(offsetMinutes);
    const result = getDeviceUtcOffsetLabel(d);
    jest.restoreAllMocks();
    return result;
  };

  it('formats whole-hour and fractional offsets', () => {
    expect(label(-480)).toBe('UTC+8');
    expect(label(300)).toBe('UTC-5');
    expect(label(-330)).toBe('UTC+5:30');
    expect(label(-345)).toBe('UTC+5:45');
    expect(label(0)).toBe('UTC+0');
  });
});

describe('usMarketSessionKeyFromBackendSession', () => {
  it('maps backend sessions to engine keys', () => {
    expect(usMarketSessionKeyFromBackendSession('PRE_MARKET')).toBe(
      EUSMarketSessionKey.PreMarket,
    );
    expect(usMarketSessionKeyFromBackendSession('REGULAR')).toBe(
      EUSMarketSessionKey.Regular,
    );
    expect(usMarketSessionKeyFromBackendSession('POST_MARKET')).toBe(
      EUSMarketSessionKey.PostMarket,
    );
    expect(usMarketSessionKeyFromBackendSession('OVERNIGHT')).toBe(
      EUSMarketSessionKey.Overnight,
    );
    expect(usMarketSessionKeyFromBackendSession('CLOSED')).toBeUndefined();
    expect(usMarketSessionKeyFromBackendSession(undefined)).toBeUndefined();
  });
});

describe('resolveUSMarketStatusVariant', () => {
  const status = (
    session: IFetchUSMarketStatusResult['session'],
    unavailable?: boolean,
  ): IFetchUSMarketStatusResult => ({
    open: session !== 'CLOSED',
    session,
    reason: null,
    unavailable,
  });
  const ondo = 'ondo';

  it('returns undefined for non-Ondo issuers regardless of signals', () => {
    expect(
      resolveUSMarketStatusVariant({
        source: 'xstock',
        isOpen: true,
        status: status('REGULAR'),
      }),
    ).toBeUndefined();
    expect(
      resolveUSMarketStatusVariant({ isOpen: false, status: status('CLOSED') }),
    ).toBeUndefined();
  });

  it('returns undefined for Ondo tokens without stock signals', () => {
    expect(resolveUSMarketStatusVariant({ source: ondo })).toBeUndefined();
    expect(
      resolveUSMarketStatusVariant({ source: ondo, status: status('REGULAR') }),
    ).toBeUndefined();
  });

  it('prioritizes halt over everything', () => {
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        isPaused: true,
        status: status('REGULAR'),
      }),
    ).toBe(EUSMarketStatusVariant.Halted);
  });

  it('honors the per-stock closed signal', () => {
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: false,
        status: status('REGULAR'),
      }),
    ).toBe(EUSMarketStatusVariant.Closed);
  });

  it('refines an open instrument with the market-wide session', () => {
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('PRE_MARKET'),
      }),
    ).toBe(EUSMarketStatusVariant.PreMarket);
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('REGULAR'),
      }),
    ).toBe(EUSMarketStatusVariant.Open);
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('POST_MARKET'),
      }),
    ).toBe(EUSMarketStatusVariant.PostMarket);
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('OVERNIGHT'),
      }),
    ).toBe(EUSMarketStatusVariant.Overnight);
  });

  it('marks a tradable Ondo instrument during market closure as ClosedTradable', () => {
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('CLOSED'),
      }),
    ).toBe(EUSMarketStatusVariant.ClosedTradable);
  });

  it('marks inter-session gaps as halted', () => {
    // 14:30:30 UTC = 09:30:30 EST — the opening-cross switch window
    const gapNow = new Date('2026-01-15T14:30:30Z');
    // Clock gap overrides the backend session refinement…
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('REGULAR'),
        now: gapNow,
      }),
    ).toBe(EUSMarketStatusVariant.Halted);
    // …and applies on the pure clock fallback as well.
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        now: gapNow,
      }),
    ).toBe(EUSMarketStatusVariant.Halted);
  });

  it('falls back to clock math when the status API is unavailable', () => {
    // Sat 2026-01-17 15:00 UTC is inside the weekend window → ClosedTradable
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        status: status('REGULAR', true),
        now: new Date('2026-01-17T15:00:00Z'),
      }),
    ).toBe(EUSMarketStatusVariant.ClosedTradable);
    // Thu 2026-01-15 15:00 UTC = 10:00 EST → regular session chip
    expect(
      resolveUSMarketStatusVariant({
        source: ondo,
        isOpen: true,
        now: new Date('2026-01-15T15:00:00Z'),
      }),
    ).toBe(EUSMarketStatusVariant.Open);
  });
});

describe('resolveUSTradingHoursActiveRow', () => {
  const status = (
    session: IFetchUSMarketStatusResult['session'],
    unavailable?: boolean,
  ): IFetchUSMarketStatusResult => ({
    open: session !== 'CLOSED',
    session,
    reason: null,
    unavailable,
  });
  // Thu 2026-01-15 15:00 UTC = 10:00 EST (regular session, weekday)
  const weekdayNow = new Date('2026-01-15T15:00:00Z');
  const weekdayHours = getUSMarketTradingHours(weekdayNow);
  // Sat 2026-01-17 15:00 UTC — inside the weekend closure window
  const weekendNow = new Date('2026-01-17T15:00:00Z');
  const weekendHours = getUSMarketTradingHours(weekendNow);

  it('overlays halts above everything', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isPaused: true,
        status: status('REGULAR'),
        tradingHours: weekdayHours,
        now: weekdayNow,
      }),
    ).toBe('halts');
  });

  it('marks closed for the underlying even when the token is 7x24 tradable', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('CLOSED'),
        tradingHours: weekendHours,
        now: weekendNow,
      }),
    ).toBe('closed');
  });

  it('follows the backend session when open', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('PRE_MARKET'),
        tradingHours: weekdayHours,
        now: weekdayNow,
      }),
    ).toBe(EUSMarketSessionKey.PreMarket);
  });

  it('falls back to clock session or per-stock closed when status is unavailable', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('REGULAR', true),
        tradingHours: weekdayHours,
        now: weekdayNow,
      }),
    ).toBe(EUSMarketSessionKey.Regular);
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: false,
        tradingHours: weekdayHours,
        now: weekdayNow,
      }),
    ).toBe('closed');
  });

  it('falls back to closed on weekends before the status fetch resolves', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        tradingHours: weekendHours,
        now: weekendNow,
      }),
    ).toBe('closed');
  });

  it('highlights the halts row during inter-session gaps', () => {
    // 14:30:30 UTC = 09:30:30 EST — the opening-cross switch window
    const gapNow = new Date('2026-01-15T14:30:30Z');
    const gapHours = getUSMarketTradingHours(gapNow);
    // Clock gap overrides the backend session refinement…
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('REGULAR'),
        tradingHours: gapHours,
        now: gapNow,
      }),
    ).toBe('halts');
    // …and applies on the pure clock fallback as well.
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        tradingHours: gapHours,
        now: gapNow,
      }),
    ).toBe('halts');
  });
});
