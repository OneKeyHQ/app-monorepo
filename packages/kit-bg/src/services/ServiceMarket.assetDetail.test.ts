import axios, { AxiosError } from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceMarket from './ServiceMarket';
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

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    getClient = jest.fn();

    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const createService = () => {
  const client = axios.create();
  const get = jest.spyOn(client, 'get');
  const service = new ServiceMarket({ backgroundApi: {} });
  jest.spyOn(service, 'getClient').mockResolvedValue(client);
  return { service, get };
};

it('opts only background prefetch into silent request handling', async () => {
  const { service, get } = createService();
  const data = { asset: { symbol: 'BTC' } };
  get.mockResolvedValue({ data: { code: 0, data } });
  await expect(
    service.fetchMarketAssetDetail({
      assetId: 'bitcoin',
      autoHandleError: false,
    }),
  ).resolves.toBe(data);
  expect(get).toHaveBeenLastCalledWith(
    '/utility/v1/market/asset/detail',
    expect.objectContaining({ autoHandleError: false }),
  );
  await service.fetchMarketAssetDetail({ assetId: 'bitcoin' });
  expect(get).toHaveBeenLastCalledWith('/utility/v1/market/asset/detail', {
    params: { assetId: 'bitcoin', variantId: undefined, currency: 'usd' },
  });
});

it.each([
  { code: 123, data: { asset: { symbol: 'BTC' } } },
  { code: 0, data: null },
])(
  'keeps invalid prefetch responses retryable without a toast',
  async (data) => {
    const { service, get } = createService();
    get.mockResolvedValue({ data });
    await expect(
      service.fetchMarketAssetDetail({
        assetId: 'bitcoin',
        autoHandleError: false,
      }),
    ).rejects.toMatchObject({ autoToast: false });
  },
);

it('silences prefetch request errors before they cross the background proxy', async () => {
  const { service, get } = createService();
  const error = Object.assign(new Error('offline'), { autoToast: true });
  get.mockRejectedValue(error);
  await expect(
    service.fetchMarketAssetDetail({
      assetId: 'bitcoin',
      autoHandleError: false,
    }),
  ).rejects.toMatchObject({ autoToast: false });
});

it('preserves normal callers error handling', async () => {
  const { service, get } = createService();
  const error = Object.assign(new Error('offline'), { autoToast: true });
  get.mockRejectedValue(error);
  await expect(
    service.fetchMarketAssetDetail({ assetId: 'bitcoin' }),
  ).rejects.toMatchObject({ autoToast: true });
});

describe('listing watchlist quote timeout recovery', () => {
  const identity = { assetId: 'btc' };
  const detail = { asset: { symbol: 'BTC' }, market: { price: '50000' } };
  const timeoutError = () => new AxiosError('Timed out', AxiosError.ETIMEDOUT);

  beforeEach(() => {
    jest.replaceProperty(platformEnv, 'isNativeIOS', true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shares a single retry between a prefetch and overlapping watchlist batches', async () => {
    jest.useFakeTimers();
    const { service, get } = createService();
    get
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(timeoutError()), 30_000);
          }),
      )
      .mockResolvedValueOnce({ data: { code: 0, data: detail } });
    const market = new ServiceMarketV2({
      backgroundApi: { serviceMarket: service },
    });

    const prefetch = market.fetchMarketListingWatchlistQuotes([identity]);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(get).toHaveBeenCalledTimes(1);

    const results = Promise.all([
      prefetch,
      market.fetchMarketListingWatchlistQuotes([identity]),
      market.fetchMarketListingWatchlistQuotes([identity]),
    ]);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(results).resolves.toEqual(
      Array.from({ length: 3 }, () => [{ symbol: 'BTC', price: '50000' }]),
    );
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0]?.[1]?.transitional?.clarifyTimeoutError).toBe(
      true,
    );
  });

  it('aborts the only retry at the deadline and keeps the missing slot', async () => {
    jest.useFakeTimers();
    const { service, get } = createService();
    get.mockRejectedValueOnce(timeoutError()).mockImplementationOnce(
      (_url, config) =>
        new Promise((_resolve, reject) => {
          config?.signal?.addEventListener?.('abort', () => {
            reject(new axios.CanceledError());
          });
        }),
    );
    const market = new ServiceMarketV2({
      backgroundApi: { serviceMarket: service },
    });

    const quotes = market.fetchMarketListingWatchlistQuotes([identity]);
    await jest.advanceTimersByTimeAsync(3000);

    await expect(quotes).resolves.toEqual([undefined]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1]?.[1]?.timeout).toBe(3000);
    expect(get.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  });

  it('does not retry an XHR abort', async () => {
    const { service, get } = createService();
    const error = new AxiosError('Request aborted', AxiosError.ECONNABORTED);
    get.mockRejectedValueOnce(error);

    await expect(
      service.fetchMarketAssetDetailForWatchlistQuote(identity.assetId),
    ).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

it('pins compact modal quotes to USD without changing other callers currency', async () => {
  const { service, get } = createService();
  get.mockResolvedValue({
    data: { data: { stats: { currentPrice: '50000' } } },
  });
  await service.fetchMarketTokenDetail('bitcoin', true, 'usd');
  expect(get).toHaveBeenLastCalledWith('/utility/v1/market/detail', {
    params: { id: 'bitcoin', explorer_platforms: true },
    headers: { 'x-onekey-request-currency': 'usd' },
  });
  await service.fetchMarketTokenDetail('bitcoin');
  expect(get).toHaveBeenLastCalledWith('/utility/v1/market/detail', {
    params: { id: 'bitcoin', explorer_platforms: true },
  });
});
