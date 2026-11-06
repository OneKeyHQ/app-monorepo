import type { IHyperliquidPortfolioSnapshot } from '@onekeyhq/shared/types/hyperliquid/portfolio';

import ServiceHyperliquid from './ServiceHyperliquid';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('p-timeout', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@nktkas/hyperliquid', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  toastIfError: () => (_target: unknown, _key: string, descriptor: unknown) =>
    descriptor,
}));

describe('Portfolio refresh freshness', () => {
  const snapshot = (): IHyperliquidPortfolioSnapshot => ({
    address: '0xabc',
    isEmpty: true,
    accountValue: '0',
    withdrawable: '0',
    totalMarginUsed: '0',
    totalUnrealizedPnl: '0',
    perpPositions: [],
    spotBalances: [],
    spotTotalUsd: '0',
    netWorthUsd: '0',
    source: 'rest',
    isDegraded: false,
    summaryUpdatedAt: Date.now(),
    spotUpdatedAt: Date.now(),
    priceCachedAt: Date.now(),
    fetchedAt: Date.now(),
  });

  function setup() {
    const cached = snapshot();
    const fetch = jest
      .fn<Promise<IHyperliquidPortfolioSnapshot>, [string]>()
      .mockRejectedValue(new Error('offline'));
    const invalidate = jest.fn();
    const service = Object.assign(
      Object.create(ServiceHyperliquid.prototype) as ServiceHyperliquid,
      {
        backgroundApi: {
          simpleDb: {
            perp: {
              getHyperliquidPortfolioSnapshot: async () => cached,
              getUserAbstractionMode: async () => undefined,
              setHyperliquidPortfolioSnapshot: jest.fn(),
            },
          },
        } as unknown as IBackgroundApi,
        fetchHyperliquidPortfolioByAddress: fetch,
        _fetchHlPortfolioMemo: { delete: invalidate },
      },
    );
    return { service, cached, fetch, invalidate };
  }

  it('preserves the normal cache fallback for ordinary callers', async () => {
    const { service, cached } = setup();
    await expect(
      service.getHyperliquidPortfolioSnapshot({
        address: '0xabc',
        force: true,
      }),
    ).resolves.toBe(cached);
  });

  it('does not report cached data as a successful required refresh', async () => {
    const { service, fetch, invalidate } = setup();
    await expect(
      service.getHyperliquidPortfolioSnapshot({
        address: '0xabc',
        requireFresh: true,
      }),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('0xabc');
    expect(invalidate).toHaveBeenCalledWith('0xabc');
  });
});
