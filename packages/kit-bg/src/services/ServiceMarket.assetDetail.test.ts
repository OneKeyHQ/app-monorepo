import axios from 'axios';

import ServiceMarket from './ServiceMarket';

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
