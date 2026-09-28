/* cspell:ignore HWAVE */

import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { spotAssetCtxsMapAtom } from '../../states/jotai/atoms';

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
