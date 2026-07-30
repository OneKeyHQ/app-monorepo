import type { IFetchUSMarketStatusResult } from '../../types/swap/types';

/**
 * US tokenized-stock trading sessions, defined in America/New_York wall-clock
 * time (the single source of truth per OK-58043). All local rendering must be
 * derived from these constants — never hardcode a user-local time.
 *
 * Ranges follow the venue's published windows (OK-58509, aligned with OKX):
 *
 *   Pre-market  04:01 – 09:29 ET
 *   Regular     09:31 – 15:59 ET
 *   Post-market 16:01 – 19:59 ET
 *   Overnight   20:05 – 03:55 ET (next day)
 *
 * Sessions are NOT contiguous: the minutes between them (e.g. 09:30, the
 * opening cross) belong to no session — the underlying venues pause trading
 * while switching session state, so the UI surfaces those windows as trading
 * halts.
 *
 * A "cycle" is one full loop from the pre-market open to the overnight close
 * the next ET day. On DST transition days a cycle is ±1h long; ratios are
 * computed from real instants so segment widths stay proportional.
 */

const NY_TIME_ZONE = 'America/New_York';
const MINUTE_MS = 60 * 1000;

export enum EUSMarketSessionKey {
  PreMarket = 'preMarket',
  Regular = 'regular',
  PostMarket = 'postMarket',
  Overnight = 'overnight',
}

/**
 * Session boundaries as minutes since ET midnight, in cycle order. Ends are
 * exclusive (a `09:30` end renders as `09:29`); a value ≥ 24h means the
 * session closes on the next ET calendar day.
 */
const SESSIONS_ET_MINUTES: Array<{
  key: EUSMarketSessionKey;
  startMinutes: number;
  endMinutes: number;
}> = [
  {
    key: EUSMarketSessionKey.PreMarket,
    startMinutes: 4 * 60 + 1,
    endMinutes: 9 * 60 + 30,
  },
  {
    key: EUSMarketSessionKey.Regular,
    startMinutes: 9 * 60 + 31,
    endMinutes: 16 * 60,
  },
  {
    key: EUSMarketSessionKey.PostMarket,
    startMinutes: 16 * 60 + 1,
    endMinutes: 20 * 60,
  },
  {
    key: EUSMarketSessionKey.Overnight,
    startMinutes: 20 * 60 + 5,
    endMinutes: 24 * 60 + 3 * 60 + 56,
  },
];
const CYCLE_START_ET_MINUTES = SESSIONS_ET_MINUTES[0].startMinutes;

interface INyWallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

let cachedNyFormatter: Intl.DateTimeFormat | null | undefined;

function getNyFormatter(): Intl.DateTimeFormat | null {
  if (cachedNyFormatter !== undefined) {
    return cachedNyFormatter;
  }
  try {
    cachedNyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: NY_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    // Probe once — some engines only throw on first format call.
    cachedNyFormatter.formatToParts(new Date());
  } catch {
    cachedNyFormatter = null;
  }
  return cachedNyFormatter;
}

/**
 * Approximate ET offset used ONLY when Intl lacks IANA time-zone data
 * (defense-in-depth for stripped-down JS engines). US DST rule since 2007:
 * EDT (UTC-4) from 2:00 local on the second Sunday of March until 2:00 local
 * on the first Sunday of November, otherwise EST (UTC-5). Evaluated in UTC —
 * the ±hours error window around the exact switch moment is acceptable for a
 * fallback path.
 */
export function approximateNyOffsetMinutes(instantMs: number): number {
  const d = new Date(instantMs);
  const year = d.getUTCFullYear();
  // 2:00 local = 07:00 UTC (EST) at the spring switch, 06:00 UTC (EDT) in fall
  const nthSundayUtc = (month: number, nth: number, utcHour: number) => {
    const firstDayWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const firstSunday = 1 + ((7 - firstDayWeekday) % 7);
    return Date.UTC(year, month, firstSunday + (nth - 1) * 7, utcHour, 0);
  };
  const dstStart = nthSundayUtc(2, 2, 7); // second Sunday of March
  const dstEnd = nthSundayUtc(10, 1, 6); // first Sunday of November
  const isDst = instantMs >= dstStart && instantMs < dstEnd;
  return isDst ? -4 * 60 : -5 * 60;
}

function getNyWallClock(instantMs: number): INyWallClock {
  const formatter = getNyFormatter();
  if (formatter) {
    const parts = formatter.formatToParts(new Date(instantMs));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const weekday = WEEKDAY_INDEX[get('weekday')];
    const hourText = get('hour');
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      // Some ICU builds render midnight as "24" with h23 — normalize it.
      hour: Number(hourText) % 24,
      minute: Number(get('minute')),
      weekday: weekday ?? new Date(instantMs).getUTCDay(),
    };
  }
  const shifted = new Date(
    instantMs + approximateNyOffsetMinutes(instantMs) * MINUTE_MS,
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Convert an ET wall-clock time to a UTC instant. Starts from a UTC guess and
 * converges by comparing the guess's actual ET wall clock — two rounds are
 * enough for any fixed-offset error, including across DST transitions.
 */
function nyWallClockToInstant({
  year,
  month,
  day,
  minutesOfDay,
}: {
  year: number;
  month: number;
  day: number;
  minutesOfDay: number;
}): number {
  const targetAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
  );
  let guess = targetAsUtc - approximateNyOffsetMinutes(targetAsUtc) * MINUTE_MS;
  for (let i = 0; i < 2; i += 1) {
    const wc = getNyWallClock(guess);
    const guessAsUtc = Date.UTC(
      wc.year,
      wc.month - 1,
      wc.day,
      wc.hour,
      wc.minute,
    );
    const diff = targetAsUtc - guessAsUtc;
    if (diff === 0) {
      break;
    }
    guess += diff;
  }
  return guess;
}

function shiftNyDate(
  base: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export interface IUSMarketSessionSegment {
  key: EUSMarketSessionKey;
  /** UTC ms, inclusive */
  startInstant: number;
  /** UTC ms, exclusive */
  endInstant: number;
  /** Fraction of the whole cycle this segment spans (0..1) */
  ratio: number;
}

export interface IUSMarketTradingHours {
  /** Segments in cycle order: pre → regular → post → overnight (with gaps) */
  segments: IUSMarketSessionSegment[];
  cycleStartInstant: number;
  cycleEndInstant: number;
  /** Position of `now` within the cycle, 0..1 */
  nowRatio: number;
  /**
   * Session containing `now` by pure clock math (ignores holidays/halts).
   * A `now` inside an inter-session gap resolves to the upcoming session —
   * check `isNowInSessionGap` to tell the two cases apart.
   */
  currentSessionKey: EUSMarketSessionKey;
  /**
   * True when `now` falls between two sessions (e.g. 03:56 – 04:00 ET):
   * the underlying venues pause trading while switching session state, so
   * these minutes surface as a market-wide trading halt.
   */
  isNowInSessionGap: boolean;
  /** Current-or-upcoming weekend closure: Friday 20:00 ET */
  weekendStartInstant: number;
  /** Weekend closure end: Sunday 20:00 ET */
  weekendEndInstant: number;
}

/**
 * Compute the trading-hours cycle containing `now`, with every boundary as a
 * UTC instant. Callers render instants in the device time zone (plain Date
 * getters) — no further zone math needed anywhere else.
 */
export function getUSMarketTradingHours(
  now: Date = new Date(),
): IUSMarketTradingHours {
  const nowMs = now.getTime();
  const nowNy = getNyWallClock(nowMs);

  // The cycle day is the ET calendar date whose pre-market anchor (04:01)
  // precedes `now`.
  let cycleDate = {
    year: nowNy.year,
    month: nowNy.month,
    day: nowNy.day,
  };
  if (nowNy.hour * 60 + nowNy.minute < CYCLE_START_ET_MINUTES) {
    cycleDate = shiftNyDate(cycleDate, -1);
  }
  const nextDate = shiftNyDate(cycleDate, 1);

  const minutesToInstant = (minutes: number) =>
    minutes >= 24 * 60
      ? nyWallClockToInstant({ ...nextDate, minutesOfDay: minutes - 24 * 60 })
      : nyWallClockToInstant({ ...cycleDate, minutesOfDay: minutes });

  const instants = SESSIONS_ET_MINUTES.map(
    ({ key, startMinutes, endMinutes }) => ({
      key,
      startInstant: minutesToInstant(startMinutes),
      endInstant: minutesToInstant(endMinutes),
    }),
  );
  const cycleStartInstant = instants[0].startInstant;
  const cycleEndInstant = instants[instants.length - 1].endInstant;
  const cycleDuration = cycleEndInstant - cycleStartInstant;

  const segments: IUSMarketSessionSegment[] = instants.map(
    ({ key, startInstant, endInstant }) => ({
      key,
      startInstant,
      endInstant,
      ratio: (endInstant - startInstant) / cycleDuration,
    }),
  );

  const clampedNow = Math.min(
    Math.max(nowMs, cycleStartInstant),
    cycleEndInstant - 1,
  );
  // Sessions are not contiguous — a `now` inside an inter-session gap
  // resolves to the upcoming session.
  const currentSegment =
    segments.find((s) => clampedNow < s.endInstant) ??
    segments[segments.length - 1];
  const isNowInSessionGap = !segments.some(
    (s) => nowMs >= s.startInstant && nowMs < s.endInstant,
  );

  // Weekend closure runs Friday 20:00 ET → Sunday 20:00 ET. Pick the ongoing
  // weekend when the cycle day sits inside one, otherwise the upcoming one.
  const { weekday } = getNyWallClock(cycleStartInstant);
  let fridayShift: number;
  if (weekday === 6) {
    fridayShift = -1;
  } else if (weekday === 0) {
    fridayShift = -2;
  } else {
    fridayShift = 5 - weekday;
  }
  const fridayDate = shiftNyDate(cycleDate, fridayShift);
  const sundayDate = shiftNyDate(fridayDate, 2);
  const weekendStartInstant = nyWallClockToInstant({
    ...fridayDate,
    minutesOfDay: 20 * 60,
  });
  const weekendEndInstant = nyWallClockToInstant({
    ...sundayDate,
    minutesOfDay: 20 * 60,
  });

  return {
    segments,
    cycleStartInstant,
    cycleEndInstant,
    nowRatio: (clampedNow - cycleStartInstant) / cycleDuration,
    currentSessionKey: currentSegment.key,
    isNowInSessionGap,
    weekendStartInstant,
    weekendEndInstant,
  };
}

/**
 * Device time-zone label like "UTC+8" / "UTC-5:30" / "UTC+0", derived from the
 * runtime's own offset so it always matches how instants render locally.
 */
export function getDeviceUtcOffsetLabel(now: Date = new Date()): string {
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${
    minutes ? `:${String(minutes).padStart(2, '0')}` : ''
  }`;
}

/** Device-local "HH:mm" (24h, matching the design) for a UTC instant. */
export function formatInstantAsLocalHHmm(instantMs: number): string {
  const d = new Date(instantMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * Inclusive display end for a segment ("09:30 boundary" renders as "09:29"),
 * matching the design's `04:00 – 09:29` style.
 */
export function formatSegmentLocalRange(segment: {
  startInstant: number;
  endInstant: number;
}): string {
  return `${formatInstantAsLocalHHmm(
    segment.startInstant,
  )} – ${formatInstantAsLocalHHmm(segment.endInstant - MINUTE_MS)}`;
}

export function usMarketSessionKeyFromBackendSession(
  session: IFetchUSMarketStatusResult['session'] | undefined,
): EUSMarketSessionKey | undefined {
  switch (session) {
    case 'PRE_MARKET':
      return EUSMarketSessionKey.PreMarket;
    case 'REGULAR':
      return EUSMarketSessionKey.Regular;
    case 'POST_MARKET':
      return EUSMarketSessionKey.PostMarket;
    case 'OVERNIGHT':
      return EUSMarketSessionKey.Overnight;
    default:
      return undefined;
  }
}

/**
 * Display status of a tokenized stock: the four US sessions, closed/halted,
 * and "closed but tradable" for 7×24 Ondo instruments during market closure.
 */
export enum EUSMarketStatusVariant {
  PreMarket = 'preMarket',
  Open = 'open',
  PostMarket = 'postMarket',
  Overnight = 'overnight',
  Closed = 'closed',
  ClosedTradable = 'closedTradable',
  Halted = 'halted',
}

/**
 * Sources treated as Ondo-issued. Some Ondo stocks report a legacy
 * 'coingecko' source — keep this the single source of truth (kit's
 * `isOndoStockSource` delegates here).
 */
const ONDO_US_MARKET_STOCK_SOURCES = new Set(['ondo', 'coingecko']);

/**
 * Only Ondo-issued stock tokens follow the US-session trading model this
 * feature describes (OK-58043). xStocks and other providers run 7×24 with no
 * open/closed distinction, so they keep the legacy open/closed badge and get
 * no trading-hours entry.
 */
export function isOndoUSMarketStock(
  source: string | undefined | null,
): boolean {
  const normalized = source?.trim().toLowerCase();
  return !!normalized && ONDO_US_MARKET_STOCK_SOURCES.has(normalized);
}

/**
 * Single source of truth for a stock token's displayed market status.
 * Returns undefined for non-Ondo issuers (callers fall back to the legacy
 * two-state badge) and for tokens without stock signals.
 *
 * Signal priority:
 *   1. per-stock halt (`isPaused`) — overlays everything;
 *   2. per-stock `isOpen === false` — the instrument's own window is closed;
 *   3. market-wide closure (backend CLOSED / weekend) → ClosedTradable for a
 *      tradable instrument (`isOpen === true`) — the special 7×24-Ondo case;
 *   4. inter-session gap (clock math) → Halted: the underlying venues pause
 *      trading while switching session state;
 *   5. market-wide session refines HOW it is open.
 *
 * When the market-status API is unavailable, falls back to pure clock math:
 * weekends are detectable locally, holidays are not.
 */
export function resolveUSMarketStatusVariant({
  source,
  isOpen,
  isPaused,
  status,
  now = new Date(),
}: {
  source?: string;
  isOpen?: boolean;
  isPaused?: boolean;
  status?: IFetchUSMarketStatusResult;
  now?: Date;
}): EUSMarketStatusVariant | undefined {
  if (!isOndoUSMarketStock(source)) {
    return undefined;
  }
  if (isPaused === true) {
    return EUSMarketStatusVariant.Halted;
  }
  if (isOpen === undefined) {
    return undefined;
  }
  if (isOpen === false) {
    return EUSMarketStatusVariant.Closed;
  }
  const sessionKeyToVariant = (key: EUSMarketSessionKey) => {
    switch (key) {
      case EUSMarketSessionKey.PreMarket:
        return EUSMarketStatusVariant.PreMarket;
      case EUSMarketSessionKey.PostMarket:
        return EUSMarketStatusVariant.PostMarket;
      case EUSMarketSessionKey.Overnight:
        return EUSMarketStatusVariant.Overnight;
      case EUSMarketSessionKey.Regular:
      default:
        return EUSMarketStatusVariant.Open;
    }
  };
  const tradingHours = getUSMarketTradingHours(now);
  if (status && !status.unavailable) {
    if (!status.open || status.session === 'CLOSED') {
      return EUSMarketStatusVariant.ClosedTradable;
    }
    // Inter-session gap: the underlying venues pause trading while switching
    // session state (OK-58509), overriding the backend session refinement.
    if (tradingHours.isNowInSessionGap) {
      return EUSMarketStatusVariant.Halted;
    }
    const sessionKey = usMarketSessionKeyFromBackendSession(status.session);
    // Unknown session value (future contract addition): fall back to the
    // clock session, matching resolveUSTradingHoursActiveRow.
    return sessionKeyToVariant(sessionKey ?? tradingHours.currentSessionKey);
  }
  const nowMs = now.getTime();
  if (
    nowMs >= tradingHours.weekendStartInstant &&
    nowMs < tradingHours.weekendEndInstant
  ) {
    return EUSMarketStatusVariant.ClosedTradable;
  }
  if (tradingHours.isNowInSessionGap) {
    return EUSMarketStatusVariant.Halted;
  }
  return sessionKeyToVariant(tradingHours.currentSessionKey);
}

/** Rows of the trading-hours panel: the four sessions plus closed/halts. */
export type IUSTradingHoursRow = EUSMarketSessionKey | 'closed' | 'halts';

/**
 * Which panel row is highlighted. Unlike `resolveUSMarketStatusVariant`
 * (which describes the INSTRUMENT — a 7×24 token stays "Open" on weekends),
 * the panel describes the UNDERLYING US market, so a closed session wins even
 * when the token itself is still tradable.
 *
 * The clock fallback (status missing — including the first render before the
 * fetch resolves) must be weekend-aware, otherwise a 7×24 token briefly
 * highlights a session row and flashes to "closed" when the status arrives.
 */
export function resolveUSTradingHoursActiveRow({
  isOpen,
  isPaused,
  status,
  tradingHours,
  now = new Date(),
}: {
  isOpen?: boolean;
  isPaused?: boolean;
  status?: IFetchUSMarketStatusResult;
  /** From `getUSMarketTradingHours(now)` — clock/weekend fallback source */
  tradingHours: IUSMarketTradingHours;
  now?: Date;
}): IUSTradingHoursRow {
  if (isPaused === true) {
    return 'halts';
  }
  if (status && !status.unavailable) {
    if (!status.open || status.session === 'CLOSED') {
      return 'closed';
    }
    // Inter-session gap: the underlying venues pause trading while switching
    // session state (OK-58509), overriding the backend session refinement.
    if (tradingHours.isNowInSessionGap) {
      return 'halts';
    }
    return (
      usMarketSessionKeyFromBackendSession(status.session) ??
      tradingHours.currentSessionKey
    );
  }
  if (isOpen === false) {
    return 'closed';
  }
  const nowMs = now.getTime();
  if (
    nowMs >= tradingHours.weekendStartInstant &&
    nowMs < tradingHours.weekendEndInstant
  ) {
    return 'closed';
  }
  if (tradingHours.isNowInSessionGap) {
    return 'halts';
  }
  return tradingHours.currentSessionKey;
}
