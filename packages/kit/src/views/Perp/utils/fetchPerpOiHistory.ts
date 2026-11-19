import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

const OI_HISTORY_REQUEST_TIMEOUT_MS = 15_000;

const OI_HISTORY_WINDOWS = {
  '24h': '24h',
  '7d': '7d',
  history: '90d',
} as const;

export type IPerpOiHistoryRange = keyof typeof OI_HISTORY_WINDOWS;

type IPerpOiHistory = {
  // Chart points are [Unix seconds, USD notional].
  data: IMarketTokenChart;
  resolution: '5m' | '1h';
  stale: boolean;
};

type IRogueIqOiHistory = {
  coin: string;
  resolution: IPerpOiHistory['resolution'];
  stale: boolean;
  history: Array<{ time_ms: number; open_interest_usd: number }>;
};

export async function fetchPerpOiHistory(
  coin: string,
  range: IPerpOiHistoryRange,
): Promise<IPerpOiHistory> {
  const url = new URL('https://rogueiq.com/econiq/v1/hl/oi-history');
  url.searchParams.set('coin', coin);
  url.searchParams.set('window', OI_HISTORY_WINDOWS[range]);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OI_HISTORY_REQUEST_TIMEOUT_MS,
  );
  let payload: IRogueIqOiHistory;
  try {
    const response = await fetch(url.toString(), {
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new OneKeyLocalError(
        `OI history request failed (${response.status})`,
      );
    }

    payload = (await response.json()) as IRogueIqOiHistory;
  } finally {
    clearTimeout(timeoutId);
  }
  if (
    payload.coin !== coin ||
    !Array.isArray(payload.history) ||
    (payload.resolution !== '5m' && payload.resolution !== '1h')
  ) {
    throw new OneKeyLocalError('Unexpected OI history response');
  }

  const pointsByTime = new Map<number, number>();
  for (const {
    time_ms: timeMs,
    open_interest_usd: openInterestUsd,
  } of payload.history) {
    if (
      Number.isFinite(timeMs) &&
      timeMs > 0 &&
      Number.isFinite(openInterestUsd) &&
      openInterestUsd >= 0
    ) {
      pointsByTime.set(Math.floor(timeMs / 1000), openInterestUsd);
    }
  }
  const data = [...pointsByTime].toSorted(([left], [right]) => left - right);
  if (payload.history.length && !data.length) {
    throw new OneKeyLocalError('OI history contains no valid points');
  }

  return {
    data,
    resolution: payload.resolution,
    stale: payload.stale === true,
  };
}
