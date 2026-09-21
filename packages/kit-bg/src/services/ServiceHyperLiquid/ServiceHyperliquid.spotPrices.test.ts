/* cspell:ignore HWAVE */

import {
  perpsActiveAccountAtom,
  perpsSpotBalancesAtom,
  spotAssetCtxsMapAtom,
} from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquid from './ServiceHyperliquid';

jest.mock('p-timeout', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@nktkas/hyperliquid', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('../../states/jotai/atoms', () => {
  const actual = jest.requireActual<typeof import('../../states/jotai/atoms')>(
    '../../states/jotai/atoms',
  );
  return {
    ...actual,
    spotAssetCtxsMapAtom: { set: jest.fn(async () => undefined) },
  };
});

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

// HWAVE spotMetaAndAssetCtxs payload captured on 2026-09-21.
const spotCtx = {
  coin: '@241',
  prevDayPx: '0.001355',
  dayNtlVlm: '345.92922158',
  markPx: '0.0014',
  midPx: '0.001595',
  circulatingSupply: '999062061.4525643587',
  totalSupply: '999062061.4525643587',
  dayBaseVlm: '246978.51',
};
const liveSpotCtxCoins = new Set([spotCtx.coin]);

describe('ServiceHyperliquid spot price source', () => {
  let service: ServiceHyperliquid;
  let recalculateSpy: jest.SpiedFunction<
    ServiceHyperliquid['recalculateSpotTotalUsd']
  >;

  beforeAll(() => globalJotaiStorageReadyHandler.resolveReady(true));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = new ServiceHyperliquid({
      backgroundApi: {
        simpleDb: {
          perp: {
            getPerpData: async () => ({}),
            getSpotMeta: async () => ({ tokens: [], universes: [] }),
          },
        },
        serviceHyperliquidCache: {
          writePerpsAccountDisplaySnapshot: async () => undefined,
          writePerpsAccountDisplaySpotBalances: async () => undefined,
        },
      },
    });
    recalculateSpy = jest
      .spyOn(service, 'recalculateSpotTotalUsd')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps the mark price when allMids arrives after the spot context', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await service.extractSpotPricesFromAllMids(
      { '@241': spotCtx.midPx },
      liveSpotCtxCoins,
    );
    jest.advanceTimersByTime(1000);

    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: '0.0014',
        prevDayPx: '0.001355',
      }),
    });

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.001401' }]);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001401' }),
    });
  });

  it('uses mid prices as a cold fallback until the first spot context arrives', async () => {
    await service.extractSpotPricesFromAllMids({
      '@241': '0.001239',
      BTC: '60000',
    });
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': { markPx: '0.001239' },
    });

    await service.extractSpotPricesFromAllMids({ '@241': '0.00124' });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': { markPx: '0.00124' },
    });

    // Exact prices from OK-63600: the mid must not overwrite the mark again.
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.001' }]);
    await service.extractSpotPricesFromAllMids(
      { '@241': '0.001239' },
      liveSpotCtxCoins,
    );
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001' }),
    });
  });

  it('preserves the context price even when the previous day price is zero', async () => {
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, prevDayPx: '0' }]);
    await service.extractSpotPricesFromAllMids(
      { '@241': spotCtx.midPx },
      liveSpotCtxCoins,
    );
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: spotCtx.markPx,
        prevDayPx: '0',
      }),
    });
  });

  it('resumes mids and requests a valuation refresh after context ownership ends', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    recalculateSpy.mockClear();
    await service.extractSpotPricesFromAllMids({ '@241': '0.002' });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: '0.002',
        prevDayPx: spotCtx.prevDayPx,
      }),
    });
    expect(recalculateSpy).toHaveBeenCalledWith({
      force: true,
    });

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.0021' }]);
    await service.extractSpotPricesFromAllMids(
      { '@241': '0.0022' },
      liveSpotCtxCoins,
    );
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.0021' }),
    });
  });

  it('updates an existing spot valuation from fallback mids without a new balance event', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await perpsActiveAccountAtom.set({
      accountAddress: '0xabc',
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
    });
    await perpsSpotBalancesAtom.set({
      accountAddress: '0xabc',
      balances: [
        { coin: '@241', token: 241, total: '1000', hold: '0', entryNtl: '0' },
      ],
      spotTotalUsd: '1.4',
    });
    recalculateSpy.mockImplementation(
      ServiceHyperliquid.prototype.recalculateSpotTotalUsd.bind(service),
    );

    await service.extractSpotPricesFromAllMids({ '@241': '0.002' });
    await jest.advanceTimersByTimeAsync(1000);
    expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe('2');

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.003' }]);
    await service.extractSpotPricesFromAllMids(
      { '@241': '0.004' },
      liveSpotCtxCoins,
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe('3');
    await perpsSpotBalancesAtom.set(undefined);
  });
});
