import { HttpRequestError } from '@nktkas/hyperliquid';

import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  PERP_FUNDING_HISTORY_PAGE_SIZE,
  fetchFundingPageWithRetry,
  fetchPerpFundingHistoryPages,
} from './fundingHistory';

jest.mock('@nktkas/hyperliquid', () => ({
  HttpRequestError: class extends Error {
    response?: Response;

    constructor({ response }: { response?: Response }) {
      super('HTTP request failed');
      this.response = response;
    }
  },
}));

function buildRecords(
  startTime: number,
  count: number,
): IFundingHistoryRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    coin: 'BTC',
    fundingRate: '0.00001',
    premium: '0',
    time: startTime + index,
  }));
}

describe('fetchPerpFundingHistoryPages', () => {
  it('continues after a full page without repeating the inclusive boundary', async () => {
    const firstPage = buildRecords(1, PERP_FUNDING_HISTORY_PAGE_SIZE);
    const secondPage = buildRecords(PERP_FUNDING_HISTORY_PAGE_SIZE + 1, 2);
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const result = await fetchPerpFundingHistoryPages({
      startTime: 1,
      endTime: 1000,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      startTime: 1,
      endTime: 1000,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      startTime: PERP_FUNDING_HISTORY_PAGE_SIZE + 1,
      endTime: 1000,
    });
    expect(result).toHaveLength(PERP_FUNDING_HISTORY_PAGE_SIZE + 2);
    expect(result.at(-1)?.time).toBe(PERP_FUNDING_HISTORY_PAGE_SIZE + 2);
  });

  it('sorts each page before advancing the cursor', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValue([
        ...buildRecords(2, PERP_FUNDING_HISTORY_PAGE_SIZE - 1),
        ...buildRecords(1, 1),
      ]);

    const result = await fetchPerpFundingHistoryPages({
      startTime: 1,
      endTime: 1000,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      startTime: PERP_FUNDING_HISTORY_PAGE_SIZE + 1,
      endTime: 1000,
    });
    expect(result[0].time).toBe(1);
    expect(result).toHaveLength(PERP_FUNDING_HISTORY_PAGE_SIZE);
  });

  it('stops when a page cannot advance the cursor', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValue(buildRecords(0, PERP_FUNDING_HISTORY_PAGE_SIZE));

    await expect(
      fetchPerpFundingHistoryPages({
        startTime: 1000,
        endTime: 2000,
        fetchPage,
      }),
    ).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('keeps records that share the timestamp at a page boundary', async () => {
    type IBoundaryRecord = { id: string; time: number };
    const firstPage: IBoundaryRecord[] = [
      ...Array.from(
        { length: PERP_FUNDING_HISTORY_PAGE_SIZE - 1 },
        (_, index) => ({
          id: `first-${index + 1}`,
          time: index + 1,
        }),
      ),
      { id: 'boundary-a', time: PERP_FUNDING_HISTORY_PAGE_SIZE },
    ];
    const secondPage: IBoundaryRecord[] = [
      { id: 'boundary-a', time: PERP_FUNDING_HISTORY_PAGE_SIZE },
      { id: 'boundary-b', time: PERP_FUNDING_HISTORY_PAGE_SIZE },
      ...Array.from(
        { length: PERP_FUNDING_HISTORY_PAGE_SIZE - 2 },
        (_, index) => ({
          id: `second-${index + 1}`,
          time: PERP_FUNDING_HISTORY_PAGE_SIZE + index + 1,
        }),
      ),
    ];
    const lastTime = PERP_FUNDING_HISTORY_PAGE_SIZE * 2 - 2;
    const fetchPage = jest
      .fn<
        Promise<IBoundaryRecord[]>,
        [{ startTime: number; endTime: number }]
      >()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)
      .mockResolvedValueOnce([
        { id: `second-${PERP_FUNDING_HISTORY_PAGE_SIZE - 2}`, time: lastTime },
        { id: 'last', time: lastTime + 1 },
      ]);

    const result = await fetchPerpFundingHistoryPages({
      startTime: 1,
      endTime: 2000,
      fetchPage,
      getRecordKey: (record) => record.id,
    });

    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      startTime: PERP_FUNDING_HISTORY_PAGE_SIZE,
      endTime: 2000,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(3, {
      startTime: lastTime,
      endTime: 2000,
    });
    expect(result.filter((record) => record.id === 'boundary-a')).toHaveLength(
      1,
    );
    expect(result).toContainEqual({
      id: 'boundary-b',
      time: PERP_FUNDING_HISTORY_PAGE_SIZE,
    });
    expect(result.at(-1)).toEqual({ id: 'last', time: lastTime + 1 });
  });

  it('rejects a full timestamp boundary that cannot advance', async () => {
    const page = Array.from(
      { length: PERP_FUNDING_HISTORY_PAGE_SIZE },
      (_, index) => ({ id: String(index), time: 1 }),
    );

    await expect(
      fetchPerpFundingHistoryPages({
        startTime: 1,
        endTime: 2,
        fetchPage: jest.fn().mockResolvedValue(page),
        getRecordKey: (record: { id: string; time: number }) => record.id,
      }),
    ).rejects.toThrow('cannot advance past a full timestamp boundary');
  });
});

describe('fetchFundingPageWithRetry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function rateLimit(retryAfter?: string) {
    return new HttpRequestError({
      response: new Response(null, {
        status: 429,
        headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
      }),
    });
  }

  it('retries the failed page without refetching earlier pages', async () => {
    const page = jest
      .fn<
        Promise<IFundingHistoryRecord[]>,
        [{ startTime: number; endTime: number }]
      >()
      .mockResolvedValueOnce(buildRecords(1, 500))
      .mockRejectedValueOnce(rateLimit('3'))
      .mockResolvedValueOnce(buildRecords(501, 1));
    const result = fetchPerpFundingHistoryPages({
      startTime: 1,
      endTime: 1000,
      fetchPage: (params) => fetchFundingPageWithRetry(() => page(params)),
    });
    await jest.advanceTimersByTimeAsync(2999);
    expect(page).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(await result).toHaveLength(501);
    expect(page.mock.calls.map(([params]) => params.startTime)).toEqual([
      1, 501, 501,
    ]);
  });

  it('honors an HTTP-date Retry-After header', async () => {
    const page = jest
      .fn()
      .mockRejectedValueOnce(
        rateLimit(new Date(Date.now() + 10_000).toUTCString()),
      )
      .mockResolvedValueOnce([]);
    const result = fetchFundingPageWithRetry(page);
    await jest.advanceTimersByTimeAsync(9000);
    expect(page).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual([]);
  });

  it('stops after three retries', async () => {
    const error = rateLimit();
    const page = jest.fn().mockRejectedValue(error);
    await Promise.all([
      expect(fetchFundingPageWithRetry(page)).rejects.toBe(error),
      jest.runAllTimersAsync(),
    ]);
    expect(page).toHaveBeenCalledTimes(4);
  });

  it('does not retry other failures', async () => {
    const page = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchFundingPageWithRetry(page)).rejects.toThrow('offline');
    expect(page).toHaveBeenCalledTimes(1);
  });
});
