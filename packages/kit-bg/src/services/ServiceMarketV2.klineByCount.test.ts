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

  it('uses the backend by-count endpoint for a complete OneKey request', async () => {
    const expectedResult: IMarketTokenKLineResponse = {
      points: [{ t: 999, o: 1, h: 1, l: 1, c: 1, v: 1 }],
      total: 1,
      historyMeta: {
        noData: false,
        isPartial: true,
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

  it('does not fall back to the legacy range endpoint when v3 returns 404', async () => {
    const get = jest.fn().mockRejectedValue(buildHttpError(404));
    const service = createService();
    service.getClient = jest.fn().mockResolvedValue({ get });

    await expect(
      service.fetchMarketTokenKlineByCount({
        tokenAddress: '0xtoken',
        networkId: 'evm--1',
        interval: '1m',
        timeTo: 1000,
        targetCount: 2,
        stopAfterCount: 2,
        historyStartTime: 0,
      }),
    ).rejects.toMatchObject({ httpStatusCode: 404 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/utility/v3/market/token/kline',
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
