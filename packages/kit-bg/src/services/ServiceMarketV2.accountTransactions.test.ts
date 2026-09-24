import axios from 'axios';

import ServiceMarketV2 from './ServiceMarketV2';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MemoryPressureWarning: 'MemoryPressureWarning' },
  appEventBus: { on: jest.fn() },
}));

describe('ServiceMarketV2 account transactions', () => {
  const params = {
    accountAddress: 'account',
    networkId: 'sol--101',
    tokenAddress: 'token',
    timeFrom: 1000,
    timeTo: 2000,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates request failures instead of returning a successful empty list', async () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    const client = axios.create();
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    jest.spyOn(client, 'get').mockRejectedValueOnce(new Error('offline'));

    await expect(
      service.fetchMarketAccountTokenTransactions(params),
    ).rejects.toThrow('offline');
  });

  it('returns a successful empty list and forwards the account and time bounds', async () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    const client = axios.create();
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const get = jest.spyOn(client, 'get').mockResolvedValueOnce({
      data: { code: 0, data: { list: [] } },
    });

    await expect(
      service.fetchMarketAccountTokenTransactions(params),
    ).resolves.toEqual({ list: [] });
    expect(get).toHaveBeenCalledWith(
      '/utility/v2/market/account/token/transactions',
      { params: { ...params, currency: 'usd' } },
    );
  });
});
