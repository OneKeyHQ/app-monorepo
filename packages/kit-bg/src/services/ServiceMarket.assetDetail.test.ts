import axios from 'axios';

import ServiceMarket from './ServiceMarket';

const mockSettings = {
  locale: 'en-US',
  currencyInfo: { id: 'usd' },
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    getClient = jest.fn();
    getClientEndpointInfo = jest.fn().mockResolvedValue({
      endpoint: 'https://utility.onekey.so',
      name: 'utility',
    });
  },
}));

jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: jest.fn(async () => mockSettings) },
}));

const createService = () => {
  const client = axios.create();
  const get = jest.spyOn(client, 'get');
  const service = new ServiceMarket({ backgroundApi: {} });
  jest.spyOn(service, 'getClient').mockResolvedValue(client);
  return { service, get };
};

it('shares a pending and settled initial Asset request, then refreshes normally', async () => {
  jest.useFakeTimers();
  try {
    const { service, get } = createService();
    let resolveDetail!: (value: {
      data: { code: number; data: unknown };
    }) => void;
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );
    const params = {
      assetId: 'bitcoin',
      currency: 'usd',
      autoHandleError: false,
      reuseInitialResult: true,
    };
    const first = service.fetchMarketAssetDetail(params);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    jest.advanceTimersByTime(6000);
    const pendingConsumer = service.fetchMarketAssetDetail(params);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(get.mock.calls).toHaveLength(1);

    const data = { asset: { assetId: 'bitcoin' } };
    resolveDetail({ data: { code: 0, data } });
    await expect(first).resolves.toBe(data);
    await expect(pendingConsumer).resolves.toBe(data);
    await expect(service.fetchMarketAssetDetail(params)).resolves.toBe(data);
    expect(get.mock.calls).toHaveLength(1);

    get.mockResolvedValueOnce({ data: { code: 0, data } });
    await service.fetchMarketAssetDetail({ assetId: 'bitcoin' });
    expect(get.mock.calls).toHaveLength(2);

    jest.advanceTimersByTime(5001);
    get.mockResolvedValueOnce({ data: { code: 0, data } });
    await service.fetchMarketAssetDetail(params);
    expect(get.mock.calls).toHaveLength(3);
  } finally {
    jest.useRealTimers();
  }
});

it('evicts a failed initial Asset request and scopes reuse by request settings', async () => {
  const { service, get } = createService();
  const params = {
    assetId: 'bitcoin',
    autoHandleError: false,
    reuseInitialResult: true,
  };
  get.mockRejectedValueOnce(new Error('offline'));
  await expect(service.fetchMarketAssetDetail(params)).rejects.toThrow(
    'offline',
  );
  get.mockResolvedValue({
    data: { code: 0, data: { asset: { assetId: 'bitcoin' } } },
  });
  await service.fetchMarketAssetDetail(params);
  expect(get.mock.calls).toHaveLength(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await service.fetchMarketAssetDetail(params);
  expect(get.mock.calls).toHaveLength(2);

  mockSettings.currencyInfo.id = 'sgd';
  try {
    await service.fetchMarketAssetDetail(params);
    expect(get.mock.calls).toHaveLength(3);
  } finally {
    mockSettings.currencyInfo.id = 'usd';
  }
});

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
