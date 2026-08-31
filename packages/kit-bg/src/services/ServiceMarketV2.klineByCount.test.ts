import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import ServiceMarketV2 from './ServiceMarketV2';

jest.mock('./ServiceHyperLiquid/hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    infoClient: {
      candleSnapshot: jest.fn(),
    },
  },
}));

function createService() {
  return new ServiceMarketV2({ backgroundApi: {} });
}

function buildHttpError(httpStatusCode: number) {
  return Object.assign(new Error(`HTTP ${httpStatusCode}`), { httpStatusCode });
}

describe('ServiceMarketV2 kline by count', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('treats the exact history floor as terminal', async () => {
    const getClient = jest.fn();
    const service = createService();
    service.getClient = getClient;

    const result = await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '1m',
      timeTo: 1000,
      targetCount: 299,
      stopAfterCount: 299,
      historyStartTime: 1000,
    });

    expect(result).toEqual({
      points: [],
      total: 0,
      historyMeta: {
        noData: true,
        isPartial: false,
        stopReason: 'history_exhausted',
        requestedCount: 299,
        returnedCount: 0,
        coveredFrom: 1000,
        coveredTo: 1000,
      },
    });
    expect(getClient).not.toHaveBeenCalled();
  });

  it('preserves a terminal sparse-history response from the backend', async () => {
    const expectedResult: IMarketTokenKLineResponse = {
      points: [{ t: 999, o: 1, h: 1, l: 1, c: 1, v: 1 }],
      total: 1,
      historyMeta: {
        noData: true,
        isPartial: false,
        stopReason: 'page_budget_exhausted',
        requestedCount: 299,
        returnedCount: 1,
        coveredFrom: 800,
        coveredTo: 1000,
      },
    };
    const get = jest.fn().mockResolvedValue({
      data: { code: 0, message: 'ok', data: expectedResult },
    });
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    const result = await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '1m',
      timeTo: 1000,
      targetCount: 299,
      stopAfterCount: 299,
      historyStartTime: 100,
    });

    expect(result).toEqual(expectedResult);
    expect(get).toHaveBeenCalledWith('/utility/v3/market/token/kline', {
      params: {
        tokenAddress: '0xtoken',
        networkId: 'evm--1',
        interval: '1m',
        targetCount: 299,
        timeTo: 1000,
        historyStartTime: 100,
        currency: 'usd',
      },
      autoHandleError: false,
    });
  });

  it('falls back to the legacy range endpoint when v3 returns 404', async () => {
    const legacyResult: IMarketTokenKLineResponse = {
      points: [
        { t: 900, o: 1, h: 2, l: 1, c: 2, v: 3 },
        { t: 960, o: 2, h: 3, l: 2, c: 3, v: 4 },
      ],
      total: 2,
    };
    const get = jest
      .fn()
      .mockRejectedValueOnce(buildHttpError(404))
      .mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: legacyResult },
      });
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    const result = await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '1m',
      timeTo: 1000,
      targetCount: 2,
      stopAfterCount: 2,
      historyStartTime: 880,
    });

    expect(result.points).toEqual(legacyResult.points);
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/utility/v3/market/token/kline',
      expect.any(Object),
    );
    expect(get).toHaveBeenNthCalledWith(2, '/utility/v2/market/token/kline', {
      params: {
        tokenAddress: '0xtoken',
        networkId: 'evm--1',
        interval: '1m',
        timeFrom: 880,
        timeTo: 1000,
        currency: 'usd',
      },
    });
  });

  it('falls back to the legacy range endpoint when v3 has a network error', async () => {
    const legacyResult: IMarketTokenKLineResponse = {
      points: [{ t: 960, o: 1, h: 2, l: 1, c: 2, v: 3 }],
      total: 1,
    };
    const get = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: legacyResult },
      });
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    const result = await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '4H',
      timeTo: 1000,
      targetCount: 1,
      stopAfterCount: 1,
      historyStartTime: 940,
    });

    expect(result.points).toEqual(legacyResult.points);
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/utility/v3/market/token/kline',
      expect.any(Object),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/utility/v2/market/token/kline',
      expect.any(Object),
    );
  });

  it('preserves the monthly interval for v3 and v2 fallback requests', async () => {
    const legacyResult: IMarketTokenKLineResponse = {
      points: [
        { t: 900, o: 1, h: 2, l: 1, c: 2, v: 3 },
        { t: 960, o: 2, h: 3, l: 2, c: 3, v: 4 },
      ],
      total: 2,
    };
    const get = jest
      .fn()
      .mockRejectedValueOnce(buildHttpError(404))
      .mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: legacyResult },
      });
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '1M',
      timeTo: 1000,
      targetCount: 2,
      stopAfterCount: 2,
      historyStartTime: 880,
    });

    expect(get).toHaveBeenNthCalledWith(1, '/utility/v3/market/token/kline', {
      params: expect.objectContaining({ interval: '1M' }),
      autoHandleError: false,
    });
    expect(get).toHaveBeenNthCalledWith(2, '/utility/v2/market/token/kline', {
      params: expect.objectContaining({ interval: '1M' }),
    });
  });

  it('falls back for an incompatible v3 response', async () => {
    const legacyResult: IMarketTokenKLineResponse = {
      points: [{ t: 960, o: 1, h: 2, l: 1, c: 2, v: 3 }],
      total: 1,
    };
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: { candles: [] } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, message: 'ok', data: legacyResult },
      });
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    const result = await service.fetchMarketTokenKlineByCount({
      tokenAddress: '0xtoken',
      networkId: 'evm--1',
      interval: '1m',
      timeTo: 1000,
      targetCount: 1,
      stopAfterCount: 1,
      historyStartTime: 940,
    });

    expect(result.points).toEqual(legacyResult.points);
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/utility/v3/market/token/kline',
      expect.any(Object),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/utility/v2/market/token/kline',
      expect.any(Object),
    );
  });

  it('does not hide a v3 server failure behind the legacy endpoint', async () => {
    const get = jest.fn().mockRejectedValue(buildHttpError(500));
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    await expect(
      service.fetchMarketTokenKlineByCount({
        tokenAddress: '0xtoken',
        networkId: 'evm--1',
        interval: '1m',
        timeTo: 1000,
        targetCount: 299,
        stopAfterCount: 299,
      }),
    ).rejects.toMatchObject({ httpStatusCode: 500 });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
