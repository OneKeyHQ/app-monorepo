import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';

export const PERP_FUNDING_HISTORY_PAGE_SIZE = 500;

function getNewFundingHistoryRecords({
  page,
  startTime,
  endTime,
}: {
  page: IFundingHistoryRecord[];
  startTime: number;
  endTime: number;
}) {
  return page
    .filter((record) => record.time >= startTime && record.time <= endTime)
    .toSorted((a, b) => a.time - b.time);
}

export async function fetchPerpFundingHistoryPages({
  startTime,
  endTime,
  fetchPage,
}: {
  startTime: number;
  endTime: number;
  fetchPage: (params: {
    startTime: number;
    endTime: number;
  }) => Promise<IFundingHistoryRecord[]>;
}): Promise<IFundingHistoryRecord[]> {
  const records: IFundingHistoryRecord[] = [];
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

    records.push(...newRecords);

    const lastTime = newRecords.at(-1)?.time;
    if (
      page.length < PERP_FUNDING_HISTORY_PAGE_SIZE ||
      lastTime === undefined
    ) {
      break;
    }

    nextStartTime = lastTime + 1;
  }

  return records;
}
