import { HttpRequestError } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const PERP_FUNDING_HISTORY_PAGE_SIZE = 500;

type ITimedFundingHistoryRecord = {
  time: number;
};

function getNewFundingHistoryRecords<T extends ITimedFundingHistoryRecord>({
  page,
  startTime,
  endTime,
}: {
  page: T[];
  startTime: number;
  endTime: number;
}) {
  return page
    .filter((record) => record.time >= startTime && record.time <= endTime)
    .toSorted((a, b) => a.time - b.time);
}

export async function fetchPerpFundingHistoryPages<
  T extends ITimedFundingHistoryRecord,
>({
  startTime,
  endTime,
  fetchPage,
  getRecordKey,
}: {
  startTime: number;
  endTime: number;
  fetchPage: (params: { startTime: number; endTime: number }) => Promise<T[]>;
  getRecordKey?: (record: T) => string;
}): Promise<T[]> {
  const records: T[] = [];
  const recordKeys = getRecordKey ? new Set<string>() : undefined;
  let nextStartTime = startTime;

  while (nextStartTime <= endTime) {
    const page = await fetchPage({ startTime: nextStartTime, endTime });
    if (page.length === 0) {
      break;
    }

    const newRecords = getNewFundingHistoryRecords({
      page,
      startTime: nextStartTime,
      endTime,
    });
    if (newRecords.length === 0) {
      break;
    }

    newRecords.forEach((record) => {
      const recordKey = getRecordKey?.(record);
      if (recordKey !== undefined) {
        if (recordKeys?.has(recordKey)) return;
        recordKeys?.add(recordKey);
      }
      records.push(record);
    });

    const lastTime = newRecords.at(-1)?.time;
    if (
      page.length < PERP_FUNDING_HISTORY_PAGE_SIZE ||
      lastTime === undefined
    ) {
      break;
    }

    if (getRecordKey) {
      if (lastTime === nextStartTime) {
        throw new OneKeyLocalError(
          'Funding history pagination cannot advance past a full timestamp boundary.',
        );
      }
      // Keep the last timestamp inclusive. A user can have multiple market
      // settlements in the same millisecond, and the next page must retain
      // any records that did not fit before de-duplicating the overlap.
      nextStartTime = lastTime;
    } else {
      nextStartTime = lastTime + 1;
    }
  }

  return records;
}

export async function fetchFundingPageWithRetry<T>(
  fetchPage: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchPage();
    } catch (error) {
      if (
        !(error instanceof HttpRequestError) ||
        error.response?.status !== 429 ||
        attempt >= 3
      ) {
        throw error;
      }
      const retryAfter = error.response.headers.get('Retry-After');
      const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter ?? '') - Date.now();
      // Keep the current page cursor while backing off; never publish partial history.
      await timerUtils.wait(
        Math.max(2000 * 2 ** attempt, Number.isFinite(delay) ? delay : 0),
      );
    }
  }
}
