import axios from 'axios';

import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';

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

describe('ServiceMarketV2 account portfolio', () => {
  const params = {
    accountAddress: 'account',
    networkId: 'bch--0',
    tokenAddress: '',
    xpub: 'xpub',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rethrows a failure without allowing the background proxy to show a toast', async () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    const client = axios.create();
    const error = new OneKeyServerApiError({
      autoToast: true,
      code: 40_000,
      message: 'Something went wrong',
      requestId: 'request-1',
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    jest.spyOn(client, 'get').mockRejectedValueOnce(error);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      service.fetchMarketAccountPortfolio({ ...params, throwOnError: true }),
    ).rejects.toBe(error);
    expect(toPlainErrorObject(error)).toMatchObject({
      autoToast: false,
      code: 40_000,
      message: 'Something went wrong',
      requestId: 'request-1',
    });
  });

  it('returns an empty list on failure when throwing is not requested', async () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    const client = axios.create();
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    jest.spyOn(client, 'get').mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.fetchMarketAccountPortfolio(params)).resolves.toEqual({
      list: [],
    });
  });

  it('returns the portfolio and forwards its request parameters', async () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    const client = axios.create();
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const get = jest.spyOn(client, 'get').mockResolvedValueOnce({
      data: { code: 0, data: { list: [] } },
    });

    await expect(service.fetchMarketAccountPortfolio(params)).resolves.toEqual({
      list: [],
    });
    expect(get).toHaveBeenCalledWith('/utility/v2/market/account/portfolio', {
      params: { ...params, currency: 'usd' },
    });
  });
});
