/* cspell:ignore HWAVE */

import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';
import type { IWsSpotStateWithAvailability } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsAbstractionModeAtom,
  perpsActiveAccountAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsComputedAccountValueAtom,
  perpsSpotBalancesAtom,
  spotAssetCtxsMapAtom,
} from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import { generateSubscriptionKey } from './utils/SubscriptionConfig';

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

// HWAVE context from OK-63600: mark 0.001 vs mid 0.001239.
const spotCtx = {
  coin: '@241',
  prevDayPx: '0.001355',
  dayNtlVlm: '345.92922158',
  markPx: '0.001',
  midPx: '0.001595',
  circulatingSupply: '999062061.4525643587',
  totalSupply: '999062061.4525643587',
  dayBaseVlm: '246978.51',
};
const spotCtxKey = generateSubscriptionKey(
  ESubscriptionType.SPOT_ASSET_CTXS,
  {},
);

describe('ServiceHyperliquid spot price source', () => {
  let service: ServiceHyperliquid;
  let subscriptions: ServiceHyperliquidSubscription;

  const setContextWanted = (wanted: boolean) => {
    if (wanted) {
      subscriptions.pendingSubSpecsMap[spotCtxKey] = {
        type: ESubscriptionType.SPOT_ASSET_CTXS,
        key: spotCtxKey,
        params: {},
        priority: 2,
      };
    } else {
      delete subscriptions.pendingSubSpecsMap[spotCtxKey];
    }
  };
  const receive = async (type: ESubscriptionType, detail: unknown) => {
    await (
      subscriptions as unknown as {
        _handleSubscriptionData: (
          type: ESubscriptionType,
          event: CustomEvent,
        ) => Promise<void>;
      }
    )._handleSubscriptionData(type, { detail } as CustomEvent);
    jest.advanceTimersByTime(1000);
  };
  const receiveMid = (price: string) =>
    receive(ESubscriptionType.ALL_MIDS, { mids: { '@241': price } });
  const expectPrice = (markPx: string) =>
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx }),
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = new ServiceHyperliquid({
      backgroundApi: { simpleDb: { perp: { getPerpData: async () => ({}) } } },
    });
    subscriptions = new ServiceHyperliquidSubscription({
      backgroundApi: service.backgroundApi,
    });
    service.backgroundApi.serviceHyperliquid = service;
    jest.spyOn(service, 'recalculateSpotTotalUsd').mockResolvedValue(undefined);
    const internals = subscriptions as unknown as Record<string, () => void>;
    jest
      .spyOn(internals, '_updateNetworkLiveness')
      .mockImplementation(() => {});
    jest
      .spyOn(internals, '_emitHyperliquidDataUpdate')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('uses mids as the cold-start price until a context arrives', async () => {
    setContextWanted(true);
    await receiveMid('0.001239');
    expectPrice('0.001239');
    await receiveMid('0.00124');
    expectPrice('0.00124');
  });

  it('keeps context marks while the context subscription is wanted', async () => {
    setContextWanted(true);
    // REST hydration can land before the subscribe ACK.
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await receiveMid('0.001239');
    expectPrice('0.001');

    await receive(ESubscriptionType.SPOT_ASSET_CTXS, [
      { ...spotCtx, markPx: '0.0011' },
    ]);
    await receiveMid('0.001239');
    expectPrice('0.0011');
  });

  it('falls back to mids once the context subscription is no longer wanted', async () => {
    setContextWanted(true);
    await service.updateSpotAssetCtxsMap([spotCtx]);
    setContextWanted(false);
    await receiveMid('0.001239');
    expectPrice('0.001239');
    await receiveMid('0.00124');
    expectPrice('0.00124');

    // Resubscribing protects the next context mark again.
    setContextWanted(true);
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.0012' }]);
    await receiveMid('0.00125');
    expectPrice('0.0012');
  });
});

describe('ServiceHyperliquid outcome balance completeness', () => {
  let service: ServiceHyperliquid;
  const writeSpotCache = jest.fn(async () => undefined);
  const usdc = {
    coin: 'USDC',
    token: 0,
    total: '100',
    hold: '25',
    entryNtl: '0',
  };
  const outcome = {
    coin: '+1' as const,
    total: '10',
    hold: '0',
    entryNtl: '5',
  };
  const receive = (
    balances: IWsSpotStateWithAvailability['spotState']['balances'],
  ) => service.updateSpotBalances({ user: '0xabc', spotState: { balances } });

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    writeSpotCache.mockClear();
    globalJotaiStorageReadyHandler.resolveReady(true);
    (
      globalThis as typeof globalThis & { $onekeyIsInBackground?: boolean }
    ).$onekeyIsInBackground = true;
    service = new ServiceHyperliquid({
      backgroundApi: {
        simpleDb: { perp: { getPerpData: async () => ({}) } },
        serviceHyperliquidCache: {
          writePerpsAccountDisplaySpotBalances: writeSpotCache,
          writePerpsAccountDisplaySnapshot: jest.fn(async () => undefined),
        },
      },
    });
    jest
      .spyOn(service, 'getSpotMeta')
      .mockResolvedValue({ tokens: [], universes: [] });
    await perpsActiveAccountAtom.set({
      accountAddress: '0xabc',
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
    });
    await perpsActiveAccountStatusInfoAtom.set(undefined);
    await perpsSpotBalancesAtom.set(undefined);
    await perpsAbstractionModeAtom.set({
      accountAddress: '0xabc',
      mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      source: 'live',
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete (
      globalThis as typeof globalThis & { $onekeyIsInBackground?: boolean }
    ).$onekeyIsInBackground;
  });

  it('marks live and cached totals partial without blocking USDC withdrawals, then recovers', async () => {
    await receive([usdc, outcome]);
    await expect(perpsComputedAccountValueAtom.get()).resolves.toMatchObject({
      accountValue: '100',
      withdrawable: '75',
      isLoading: false,
      isAccountValuePartial: true,
    });
    expect(writeSpotCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        spotTotalUsd: '100',
        hasUnsupportedBalances: true,
      }),
    );
    await receive([usdc, { ...outcome, total: '0' }]);
    await expect(perpsComputedAccountValueAtom.get()).resolves.toMatchObject({
      accountValue: '100',
      withdrawable: '75',
      isLoading: false,
      isAccountValuePartial: false,
    });
    expect(writeSpotCache).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasUnsupportedBalances: false }),
    );
  });

  it('does not label an outcome-only account as a complete zero balance', async () => {
    await receive([outcome]);
    await expect(perpsComputedAccountValueAtom.get()).resolves.toMatchObject({
      accountValue: '0',
      withdrawable: '0',
      isLoading: false,
      isAccountValuePartial: true,
    });
  });

  it.each(['price', 'fallback'] as const)(
    'preserves the partial flag when %s resolves a missing spot price',
    async (recovery) => {
      const getPrice = jest
        .spyOn(
          service as unknown as {
            getSpotBalanceMarkPrice: (coin: string) => string | undefined;
          },
          'getSpotBalanceMarkPrice',
        )
        .mockReturnValue(undefined);
      await receive([
        usdc,
        outcome,
        { coin: 'HYPE', token: 1, total: '2', hold: '0', entryNtl: '1' },
      ]);
      await expect(perpsSpotBalancesAtom.get()).resolves.toMatchObject({
        spotTotalUsd: undefined,
        hasUnsupportedBalances: true,
      });
      if (recovery === 'price') {
        getPrice.mockReturnValue('5');
        await service.recalculateSpotTotalUsd();
      } else {
        await jest.advanceTimersByTimeAsync(3000);
      }
      const spotTotalUsd = recovery === 'price' ? '110' : '100';
      await expect(perpsComputedAccountValueAtom.get()).resolves.toMatchObject({
        accountValue: spotTotalUsd,
        withdrawable: '75',
        isLoading: false,
        isAccountValuePartial: true,
      });
      expect(writeSpotCache).toHaveBeenLastCalledWith(
        expect.objectContaining({ spotTotalUsd, hasUnsupportedBalances: true }),
      );
    },
  );
});
