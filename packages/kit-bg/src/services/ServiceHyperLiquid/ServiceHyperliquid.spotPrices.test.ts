/* cspell:ignore HWAVE */

import { spotAssetCtxsMapAtom } from '../../states/jotai/atoms';

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

describe('ServiceHyperliquid spot price source', () => {
  let service: ServiceHyperliquid;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = new ServiceHyperliquid({
      backgroundApi: {
        simpleDb: { perp: { getPerpData: async () => ({}) } },
      },
    });
    jest.spyOn(service, 'recalculateSpotTotalUsd').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps the mark price when allMids arrives after the spot context', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await service.extractSpotPricesFromAllMids({ '@241': spotCtx.midPx });
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
    await service.extractSpotPricesFromAllMids({ '@241': '0.001239' });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001' }),
    });
  });

  it('preserves the context price even when the previous day price is zero', async () => {
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, prevDayPx: '0' }]);
    await service.extractSpotPricesFromAllMids({ '@241': spotCtx.midPx });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: spotCtx.markPx,
        prevDayPx: '0',
      }),
    });
  });
});
