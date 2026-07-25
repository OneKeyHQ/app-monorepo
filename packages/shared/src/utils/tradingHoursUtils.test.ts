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
    expect(res.cycleStartInstant).toBe(Date.parse('2026-01-15T09:00:00Z'));
    expect(res.cycleEndInstant).toBe(Date.parse('2026-01-16T09:00:00Z'));
    expect(res.segments.map((s) => s.startInstant)).toEqual([
      Date.parse('2026-01-15T09:00:00Z'),
      Date.parse('2026-01-15T14:30:00Z'),
      Date.parse('2026-01-15T21:00:00Z'),
      Date.parse('2026-01-16T01:00:00Z'),
    ]);
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Regular);
    expect(res.nowRatio).toBeCloseTo(0.25, 10);
    expect(res.segments.map((s) => s.ratio)).toEqual([
      5.5 / 24,
      6.5 / 24,
      4 / 24,
      8 / 24,
    ]);
  });

  it('attributes early-morning ET hours to the previous cycle day', () => {
    // 07:00 UTC = 02:00 EST (before the 04:00 anchor) → cycle of Jan 14
    const res = getUSMarketTradingHours(new Date('2026-01-15T07:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-01-14T09:00:00Z'));
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Overnight);
  });

  it('uses EDT offsets in summer', () => {
    // 2026-07-15 15:00 UTC = 11:00 EDT → regular session
    const res = getUSMarketTradingHours(new Date('2026-07-15T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-07-15T08:00:00Z'));
    expect(res.currentSessionKey).toBe(EUSMarketSessionKey.Regular);
  });

  it('produces a 23h cycle across the spring-forward transition', () => {
    // Cycle anchored 2026-03-07 04:00 EST; DST starts 2026-03-08 02:00 ET
    const res = getUSMarketTradingHours(new Date('2026-03-07T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-03-07T09:00:00Z'));
    expect(res.cycleEndInstant).toBe(Date.parse('2026-03-08T08:00:00Z'));
    const overnight = res.segments[3];
    expect(overnight.startInstant).toBe(Date.parse('2026-03-08T01:00:00Z'));
    expect(overnight.ratio).toBeCloseTo(7 / 23, 10);
    const ratioSum = res.segments.reduce((acc, s) => acc + s.ratio, 0);
    expect(ratioSum).toBeCloseTo(1, 10);
  });

  it('produces a 25h cycle across the fall-back transition', () => {
    // Cycle anchored 2026-10-31 04:00 EDT; DST ends 2026-11-01 02:00 ET
    const res = getUSMarketTradingHours(new Date('2026-10-31T15:00:00Z'));
    expect(res.cycleStartInstant).toBe(Date.parse('2026-10-31T08:00:00Z'));
    expect(res.cycleEndInstant).toBe(Date.parse('2026-11-01T09:00:00Z'));
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

  it('keeps every boundary aligned with session order', () => {
    const res = getUSMarketTradingHours(new Date('2026-01-15T15:00:00Z'));
    expect(res.segments.map((s) => s.key)).toEqual([
      EUSMarketSessionKey.PreMarket,
      EUSMarketSessionKey.Regular,
      EUSMarketSessionKey.PostMarket,
      EUSMarketSessionKey.Overnight,
    ]);
    for (let i = 1; i < res.segments.length; i += 1) {
      expect(res.segments[i].startInstant).toBe(res.segments[i - 1].endInstant);
    }
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
    // DST starts 2026-03-08 ≈07:00 UTC, ends 2026-11-01 ≈06:00 UTC
    expect(approximateNyOffsetMinutes(Date.parse('2026-03-08T06:00:00Z'))).toBe(
      -300,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-03-08T08:00:00Z'))).toBe(
      -240,
    );
    expect(approximateNyOffsetMinutes(Date.parse('2026-11-01T08:00:00Z'))).toBe(
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

  it('returns undefined for tokens without stock signals', () => {
    expect(resolveUSMarketStatusVariant({})).toBeUndefined();
    expect(
      resolveUSMarketStatusVariant({ status: status('REGULAR') }),
    ).toBeUndefined();
  });

  it('prioritizes halt over everything', () => {
    expect(
      resolveUSMarketStatusVariant({
        isOpen: true,
        isPaused: true,
        status: status('REGULAR'),
      }),
    ).toBe(EUSMarketStatusVariant.Halted);
    expect(resolveUSMarketStatusVariant({ isPaused: true })).toBe(
      EUSMarketStatusVariant.Halted,
    );
  });

  it('honors the per-stock closed signal', () => {
    expect(
      resolveUSMarketStatusVariant({
        isOpen: false,
        status: status('REGULAR'),
      }),
    ).toBe(EUSMarketStatusVariant.Closed);
  });

  it('refines an open instrument with the market-wide session', () => {
    expect(
      resolveUSMarketStatusVariant({
        isOpen: true,
        status: status('PRE_MARKET'),
      }),
    ).toBe(EUSMarketStatusVariant.PreMarket);
    expect(
      resolveUSMarketStatusVariant({ isOpen: true, status: status('REGULAR') }),
    ).toBe(EUSMarketStatusVariant.Open);
    expect(
      resolveUSMarketStatusVariant({
        isOpen: true,
        status: status('POST_MARKET'),
      }),
    ).toBe(EUSMarketStatusVariant.PostMarket);
    expect(
      resolveUSMarketStatusVariant({
        isOpen: true,
        status: status('OVERNIGHT'),
      }),
    ).toBe(EUSMarketStatusVariant.Overnight);
  });

  it('keeps a 7x24 instrument Open when the US session is closed or unknown', () => {
    expect(
      resolveUSMarketStatusVariant({ isOpen: true, status: status('CLOSED') }),
    ).toBe(EUSMarketStatusVariant.Open);
    expect(resolveUSMarketStatusVariant({ isOpen: true })).toBe(
      EUSMarketStatusVariant.Open,
    );
    expect(
      resolveUSMarketStatusVariant({
        isOpen: true,
        status: status('REGULAR', true),
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
  const clockSessionKey = EUSMarketSessionKey.Overnight;

  it('overlays halts above everything', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isPaused: true,
        status: status('REGULAR'),
        clockSessionKey,
      }),
    ).toBe('halts');
  });

  it('marks closed for the underlying even when the token is 7x24 tradable', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('CLOSED'),
        clockSessionKey,
      }),
    ).toBe('closed');
  });

  it('follows the backend session when open', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('PRE_MARKET'),
        clockSessionKey,
      }),
    ).toBe(EUSMarketSessionKey.PreMarket);
  });

  it('falls back to clock session or per-stock closed when status is unavailable', () => {
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: true,
        status: status('REGULAR', true),
        clockSessionKey,
      }),
    ).toBe(clockSessionKey);
    expect(
      resolveUSTradingHoursActiveRow({
        isOpen: false,
        clockSessionKey,
      }),
    ).toBe('closed');
  });
});
