import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import {
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetCtxDisplayAtom,
  perpsActiveAssetDataAtom,
  perpsActiveOrderBookOptionsAtom,
  spotActiveAssetAtom,
  spotActiveAssetCtxAtom,
  tradingModeAtom,
} from '../../states/jotai/atoms';

import ServiceHyperliquid from './ServiceHyperliquid';

import type {
  IPerpsActiveAssetAtom,
  IPerpsActiveOrderBookOptionsAtom,
  ISpotActiveAssetAtom,
  ISpotActiveAssetCtxAtom,
  ITradingMode,
} from '../../states/jotai/atoms';

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));
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

const btc: IPerpsActiveAssetAtom = {
  coin: 'BTC',
  assetId: 0,
  universe: {
    assetId: 0,
    name: 'BTC',
    szDecimals: 5,
    maxLeverage: 40,
  } as IPerpsUniverse,
  margin: undefined,
};
// A coin named for a switch before its trading metadata has loaded.
const ethNamed: IPerpsActiveAssetAtom = {
  coin: 'ETH',
  assetId: undefined,
  universe: undefined,
  margin: undefined,
};

function createService(activeAsset: IPerpsActiveAssetAtom) {
  // Exercises the active asset without starting account or subscription work.
  const service = Object.create(
    ServiceHyperliquid.prototype,
  ) as ServiceHyperliquid;
  // What the constructor would set up, with BTC loaded before.
  Object.assign(service, {
    activeAssetChangeRequestId: 0,
    activeAssetChangeWrites: new Set<number>(),
    lastCommittedActiveAsset: btc,
  });
  let current = activeAsset;
  let mode: ITradingMode = 'perp';
  let spotAsset: ISpotActiveAssetAtom | undefined;
  let orderBookOptions: IPerpsActiveOrderBookOptionsAtom;
  jest
    .spyOn(perpsActiveAssetAtom, 'get')
    .mockImplementation(async () => current);
  jest.spyOn(perpsActiveAssetAtom, 'set').mockImplementation(async (next) => {
    current = next as IPerpsActiveAssetAtom;
  });
  jest.spyOn(tradingModeAtom, 'get').mockImplementation(async () => mode);
  jest.spyOn(tradingModeAtom, 'set').mockImplementation(async (next) => {
    mode = next as ITradingMode;
  });
  jest
    .spyOn(spotActiveAssetAtom, 'get')
    .mockImplementation(async () => spotAsset as ISpotActiveAssetAtom);
  jest.spyOn(spotActiveAssetAtom, 'set').mockImplementation(async (next) => {
    spotAsset = next as ISpotActiveAssetAtom;
  });
  // What the order book subscription is for.
  jest
    .spyOn(perpsActiveOrderBookOptionsAtom, 'get')
    .mockImplementation(async () => orderBookOptions);
  jest
    .spyOn(perpsActiveOrderBookOptionsAtom, 'set')
    .mockImplementation(async (next) => {
      orderBookOptions = next as IPerpsActiveOrderBookOptionsAtom;
    });
  // The active asset's contexts.
  for (const atom of [
    perpsActiveAssetCtxAtom,
    perpsActiveAssetCtxDisplayAtom,
    perpsActiveAssetDataAtom,
    spotActiveAssetCtxAtom,
  ]) {
    jest.spyOn(atom, 'set').mockResolvedValue(undefined);
  }
  // Shown for the asset until its contexts are cleared.
  jest.spyOn(perpsActiveAssetCtxDisplayAtom, 'get').mockResolvedValue({
    coin: activeAsset.coin,
    assetId: activeAsset.assetId,
  } as unknown as Awaited<
    ReturnType<typeof perpsActiveAssetCtxDisplayAtom.get>
  >);
  return {
    service,
    getActiveAsset: () => current,
    getMode: () => mode,
    getSpotAsset: () => spotAsset,
    getOrderBookCoin: () => orderBookOptions?.coin,
  };
}

const orderBookOptionsFor = (
  coin: string,
): NonNullable<IPerpsActiveOrderBookOptionsAtom> => ({
  coin,
  assetId: undefined,
  nSigFigs: null,
  mantissa: null,
});

afterEach(() => jest.restoreAllMocks());

// A UI switch that got as far as clearing the contexts, the first of its
// writes that leaves the mode and the assets alone.
async function beginSwitch(service: ServiceHyperliquid) {
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.clearActiveAssetCtxForActiveAssetChange({ requestId });
  return requestId;
}

it('goes back to the last loaded asset when asking again for a coin a superseded switch named fails', async () => {
  const { service, getActiveAsset } = createService(ethNamed);
  jest
    .spyOn(service, 'getTradingUniverse')
    .mockRejectedValue(new OneKeyLocalError('Network error'));

  await expect(service.changeActiveAsset({ coin: 'ETH' })).rejects.toThrow(
    'Network error',
  );

  expect(getActiveAsset()).toEqual(btc);
});

it('puts the last loaded asset and perp mode back over a coin named without its metadata', async () => {
  const { service, getActiveAsset, getMode } = createService(ethNamed);
  const requestId = await beginSwitch(service);

  await expect(
    service.restoreActiveAssetAfterFailedChange({ requestId }),
  ).resolves.toEqual({ restored: true, perpAsset: btc });
  expect(getActiveAsset()).toEqual(btc);
  expect(getMode()).toBe('perp');
});

it('leaves a loaded active asset as it is', async () => {
  const sol: IPerpsActiveAssetAtom = {
    coin: 'SOL',
    assetId: 5,
    universe: {
      assetId: 5,
      name: 'SOL',
      szDecimals: 2,
      maxLeverage: 20,
    } as IPerpsUniverse,
    margin: undefined,
  };
  const { service } = createService(sol);
  const requestId = await beginSwitch(service);

  await expect(
    service.restoreActiveAssetAfterFailedChange({ requestId }),
  ).resolves.toEqual({ restored: true, perpAsset: sol });
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
});

it('puts the spot token given and spot mode back', async () => {
  const { service, getMode, getSpotAsset } = createService(ethNamed);
  const spot: ISpotActiveAssetAtom = {
    coin: '@107',
    assetId: 10_107,
    universe: undefined,
  };
  const requestId = await beginSwitch(service);

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: spot,
    }),
  ).resolves.toMatchObject({ restored: true });
  expect(getSpotAsset()).toEqual(spot);
  expect(getMode()).toBe('spot');
});

it('leaves the market to a switch begun since on another page', async () => {
  const { service, getActiveAsset } = createService(ethNamed);
  const requestId = await service.cancelPendingActiveAssetChange();
  // Another extension tab begins a switch.
  await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
    }),
  ).resolves.toEqual({ restored: false, perpAsset: undefined });
  expect(getActiveAsset()).toEqual(ethNamed);
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
  expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
  expect(tradingModeAtom.set).not.toHaveBeenCalled();
});

it('writes nothing for a switch another page superseded before it reached the service', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.cancelPendingActiveAssetChange();

  await expect(
    service.changeActiveAsset({ coin: 'ETH', requestId }),
  ).resolves.toEqual(ethNamed);
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
});

it('leaves the loaded asset to a switch begun on another page while the markets load', async () => {
  const { service, getActiveAsset } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  jest.spyOn(service, 'getTradingUniverse').mockImplementation(async () => {
    await service.cancelPendingActiveAssetChange();
    return {
      universesByDex: [[btc.universe as IPerpsUniverse]],
      marginTablesMapByDex: [],
    } as unknown as Awaited<ReturnType<typeof service.getTradingUniverse>>;
  });

  await expect(
    service.changeActiveAsset({ coin: 'BTC', requestId }),
  ).resolves.toEqual({ ...ethNamed, coin: 'BTC' });
  expect(getActiveAsset()).toEqual(btc);
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
});

it('sets the spot token and spot mode for the switch holding the market', async () => {
  const { service, getMode, getSpotAsset } = createService(btc);
  const spot: ISpotActiveAssetAtom = {
    coin: '@107',
    assetId: 10_107,
    universe: undefined,
  };
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.setTradingModeForActiveAssetChange({ requestId, spotAsset: spot }),
  ).resolves.toBe(true);
  expect(getSpotAsset()).toEqual(spot);
  expect(getMode()).toBe('spot');
});

it('leaves the mode to a switch begun since on another page', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  // Another extension tab begins a switch.
  await service.cancelPendingActiveAssetChange();

  await expect(
    service.setTradingModeForActiveAssetChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
    }),
  ).resolves.toBe(false);
  expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
  expect(tradingModeAtom.set).not.toHaveBeenCalled();
});

it('stops at the spot token once another page begins a switch', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  jest.mocked(spotActiveAssetAtom.set).mockImplementationOnce(async () => {
    await service.cancelPendingActiveAssetChange();
  });

  await expect(
    service.setTradingModeForActiveAssetChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
    }),
  ).resolves.toBe(false);
  expect(tradingModeAtom.set).not.toHaveBeenCalled();
});

it('clears the contexts for the switch holding the market, down to the spot context it gives', async () => {
  const { service } = createService(btc);
  const spotAssetCtx = {
    coin: '@107',
    assetId: 10_107,
    ctx: { markPrice: '62' },
  } as ISpotActiveAssetCtxAtom;
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.clearActiveAssetCtxForActiveAssetChange({
      requestId,
      spotAssetCtx,
    }),
  ).resolves.toBe(true);
  expect(perpsActiveAssetCtxAtom.set).toHaveBeenCalledWith(undefined);
  expect(perpsActiveAssetCtxDisplayAtom.set).toHaveBeenCalledWith(undefined);
  expect(perpsActiveAssetDataAtom.set).toHaveBeenCalledWith(undefined);
  expect(spotActiveAssetCtxAtom.set).toHaveBeenCalledWith(spotAssetCtx);
});

it('leaves the contexts to a switch begun since on another page', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  // Another extension tab begins a switch.
  await service.cancelPendingActiveAssetChange();

  await expect(
    service.clearActiveAssetCtxForActiveAssetChange({ requestId }),
  ).resolves.toBe(false);
  expect(perpsActiveAssetCtxAtom.set).not.toHaveBeenCalled();
  expect(perpsActiveAssetCtxDisplayAtom.set).not.toHaveBeenCalled();
  expect(perpsActiveAssetDataAtom.set).not.toHaveBeenCalled();
  expect(spotActiveAssetCtxAtom.set).not.toHaveBeenCalled();
});

it('stops clearing the contexts once another page begins a switch', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  jest.mocked(perpsActiveAssetCtxAtom.set).mockImplementationOnce(async () => {
    await service.cancelPendingActiveAssetChange();
  });

  await expect(
    service.clearActiveAssetCtxForActiveAssetChange({ requestId }),
  ).resolves.toBe(false);
  expect(perpsActiveAssetDataAtom.set).not.toHaveBeenCalled();
  expect(spotActiveAssetCtxAtom.set).not.toHaveBeenCalled();
});

it('takes the order book target of a token still loading from the switch holding the market', async () => {
  const { service, getOrderBookCoin } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.setActiveOrderBookOptions({
      requestId,
      options: orderBookOptionsFor('ETH'),
    }),
  ).resolves.toBe(true);
  expect(getOrderBookCoin()).toBe('ETH');
});

it.each([
  ['a switch another page superseded', true],
  ['a page that has not switched', false],
])(
  'turns down the order book target of another token from %s',
  async (_label, hasSwitched) => {
    const { service, getOrderBookCoin } = createService(btc);
    const requestId = hasSwitched
      ? await service.cancelPendingActiveAssetChange()
      : undefined;
    // Another extension tab begins a switch.
    await service.cancelPendingActiveAssetChange();

    await expect(
      service.setActiveOrderBookOptions({
        requestId,
        options: orderBookOptionsFor('ETH'),
      }),
    ).resolves.toBe(false);
    expect(getOrderBookCoin()).toBeUndefined();
    expect(perpsActiveOrderBookOptionsAtom.set).not.toHaveBeenCalled();
  },
);

it.each(['perp', 'spot'] as const)(
  'takes the order book target for the %s token the market is on from any page',
  async (mode) => {
    const { service, getOrderBookCoin } = createService(btc);
    // As after a restart of this runtime, when no page holds a current id,
    // or for the tick size of the token two tabs show.
    if (mode === 'spot') {
      const requestId = await service.cancelPendingActiveAssetChange();
      await service.setTradingModeForActiveAssetChange({
        requestId,
        spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
      });
    }
    await service.cancelPendingActiveAssetChange();
    const coin = mode === 'spot' ? '@107' : 'BTC';

    await expect(
      service.setActiveOrderBookOptions({
        options: { ...orderBookOptionsFor(coin), nSigFigs: 4 },
      }),
    ).resolves.toBe(true);
    expect(getOrderBookCoin()).toBe(coin);
  },
);

it('leaves an order book target that is already in place', async () => {
  const { service } = createService(btc);
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('BTC'),
  });

  await expect(
    service.setActiveOrderBookOptions({
      requestId,
      options: orderBookOptionsFor('BTC'),
    }),
  ).resolves.toBe(true);
  expect(perpsActiveOrderBookOptionsAtom.set).toHaveBeenCalledTimes(1);
});

// Another extension tab holds a spot market, with its order book target.
async function holdSpotMarket(service: ServiceHyperliquid) {
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({
    requestId,
    spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
  });
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('@107'),
  });
}

it('leaves a market its switch never wrote to, takes back the order book target and ends the request', async () => {
  const { service, getMode, getSpotAsset, getOrderBookCoin } =
    createService(btc);
  await holdSpotMarket(service);
  // A page on a perp token begins a switch, and publishes the order book
  // target for the token it shows.
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('ETH'),
  });
  await service.setActiveOrderBookOptions({
    requestId,
    options: { ...orderBookOptionsFor('ETH'), nSigFigs: 4 },
  });
  jest.mocked(tradingModeAtom.set).mockClear();
  jest.mocked(spotActiveAssetAtom.set).mockClear();

  // Its first write to the market failed.
  await expect(
    service.restoreActiveAssetAfterFailedChange({ requestId }),
  ).resolves.toEqual({ restored: false, perpAsset: undefined });

  // The other tab's market stays, with its order book target.
  expect(getMode()).toBe('spot');
  expect(getSpotAsset()).toMatchObject({ coin: '@107' });
  expect(tradingModeAtom.set).not.toHaveBeenCalled();
  expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
  expect(getOrderBookCoin()).toBe('@107');
  // Nothing more is written for the request, e.g. a call still on its way.
  await expect(
    service.setTradingModeForActiveAssetChange({ requestId }),
  ).resolves.toBe(false);
  await expect(
    service.setActiveOrderBookOptions({
      requestId,
      options: orderBookOptionsFor('BTC'),
    }),
  ).resolves.toBe(false);
  expect(getMode()).toBe('spot');
  expect(getOrderBookCoin()).toBe('@107');
});

it('keeps an order book target published for the market since, when a switch that never wrote to it ends', async () => {
  const { service, getOrderBookCoin } = createService(btc);
  await holdSpotMarket(service);
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('ETH'),
  });
  // The tab on the market publishes its target again, e.g. for a tick size.
  const latest: NonNullable<IPerpsActiveOrderBookOptionsAtom> = {
    ...orderBookOptionsFor('@107'),
    nSigFigs: 4,
  };
  await service.setActiveOrderBookOptions({ options: latest });

  await service.restoreActiveAssetAfterFailedChange({ requestId });

  expect(getOrderBookCoin()).toBe('@107');
  expect(perpsActiveOrderBookOptionsAtom.set).toHaveBeenLastCalledWith(latest);
});

it('leaves everything to a switch begun since when one that never wrote to the market ends', async () => {
  const { service, getOrderBookCoin } = createService(btc);
  await holdSpotMarket(service);
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('ETH'),
  });
  // Another extension tab begins a switch and publishes its own target.
  const newer = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId: newer,
    options: orderBookOptionsFor('SOL'),
  });

  await expect(
    service.restoreActiveAssetAfterFailedChange({ requestId }),
  ).resolves.toEqual({ restored: false, perpAsset: undefined });

  expect(getOrderBookCoin()).toBe('SOL');
  // The newer switch still holds the market.
  await expect(
    service.setTradingModeForActiveAssetChange({ requestId: newer }),
  ).resolves.toBe(true);
});

it('puts the market back for a switch whose mode took effect though its call failed', async () => {
  const { service, getMode } = createService(btc);
  await holdSpotMarket(service);
  const requestId = await service.cancelPendingActiveAssetChange();
  // The mode is in before its write to storage fails.
  const setMode = jest.mocked(tradingModeAtom.set).getMockImplementation();
  jest.mocked(tradingModeAtom.set).mockImplementationOnce(async (next) => {
    await setMode?.(next);
    throw new OneKeyLocalError('Storage error');
  });
  await expect(
    service.setTradingModeForActiveAssetChange({ requestId }),
  ).rejects.toThrow('Storage error');
  expect(getMode()).toBe('perp');

  // The page saw the call fail and has nothing of its own to tell.
  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
    }),
  ).resolves.toMatchObject({ restored: true });
  expect(getMode()).toBe('spot');
});

it('puts the market back for a switch that wrote nothing after one of its page that did', async () => {
  const { service, getMode } = createService(btc);
  // The page was on a spot token; its first switch set the perp mode and the
  // next one of the page took over before it was done.
  const first = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: first });
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
      unsettledRequestIds: [first, requestId],
    }),
  ).resolves.toMatchObject({ restored: true });
  expect(getMode()).toBe('spot');
});

it('gives the order book target back to the market over the target of a switch before it that never landed', async () => {
  const { service, getOrderBookCoin } = createService(btc);
  await holdSpotMarket(service);
  const marketTarget: NonNullable<IPerpsActiveOrderBookOptionsAtom> = {
    ...orderBookOptionsFor('@107'),
    nSigFigs: 4,
  };
  await service.setActiveOrderBookOptions({ options: marketTarget });
  // A page publishes ETH's target for a switch that never gets on, then
  // SOL's for the next one, which fails before it writes anything else.
  const abandoned = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId: abandoned,
    options: orderBookOptionsFor('ETH'),
  });
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('SOL'),
  });

  await service.restoreActiveAssetAfterFailedChange({
    requestId,
    unsettledRequestIds: [abandoned, requestId],
  });

  // Not ETH's, which the market was never on.
  expect(getOrderBookCoin()).toBe('@107');
  expect(perpsActiveOrderBookOptionsAtom.set).toHaveBeenLastCalledWith(
    marketTarget,
  );
});

it('gives the market its token as the order book target when none it replaced was for it', async () => {
  const { service } = createService(btc);
  await holdSpotMarket(service);
  // Left behind by a page that never got on, before this runtime kept any.
  await perpsActiveOrderBookOptionsAtom.set(orderBookOptionsFor('ETH'));
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setActiveOrderBookOptions({
    requestId,
    options: orderBookOptionsFor('SOL'),
  });

  await service.restoreActiveAssetAfterFailedChange({ requestId });

  expect(perpsActiveOrderBookOptionsAtom.set).toHaveBeenLastCalledWith({
    coin: '@107',
    assetId: 10_107,
    nSigFigs: null,
    mantissa: null,
  });
});

it('leaves the market to a page that completed a switch since a write of the failed switch page', async () => {
  const { service, getMode, getSpotAsset } = createService(btc);
  const spot = { coin: '@107', assetId: 10_107, universe: undefined };
  // A page on a spot token set the perp mode for a switch.
  const first = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: first });
  // Another extension tab then completed a switch, to a spot token of its
  // own.
  const other = await service.cancelPendingActiveAssetChange();
  const otherSpot: ISpotActiveAssetAtom = {
    coin: '@150',
    assetId: 10_150,
    universe: { name: '@150', assetId: 10_150 } as ISpotUniverse,
  };
  await service.setTradingModeForActiveAssetChange({
    requestId: other,
    spotAsset: otherSpot,
  });
  // The first page begins another switch, which fails before it writes.
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: spot,
      unsettledRequestIds: [first, requestId],
    }),
  ).resolves.toEqual({ restored: false, perpAsset: undefined });

  // Its earlier write is not the market any more: the other tab's stays.
  expect(getMode()).toBe('spot');
  expect(getSpotAsset()).toEqual(otherSpot);
});

it('puts the market back for a page whose write another page only began to switch over', async () => {
  const { service, getMode, getSpotAsset } = createService(btc);
  const spot = { coin: '@107', assetId: 10_107, universe: undefined };
  // A page on a spot token set the perp mode for a switch.
  const first = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: first });
  // Another extension tab began a perp switch: it set the mode again, and
  // its token has not loaded.
  const other = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: other });
  // The first page begins another switch, which fails before it writes.
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: spot,
      unsettledRequestIds: [first, requestId],
    }),
  ).resolves.toMatchObject({ restored: true });

  // No switch completed since its write, so the market is still its to put
  // back.
  expect(getMode()).toBe('spot');
  expect(getSpotAsset()).toEqual(spot);
});

it('leaves the market to a page whose perp switch loaded its token since a write of the failed switch page', async () => {
  const { service, getMode, getActiveAsset } = createService(btc);
  const sol = { name: 'SOL', szDecimals: 2, maxLeverage: 20 } as IPerpsUniverse;
  jest.spyOn(service, 'getTradingUniverse').mockResolvedValue({
    universesByDex: [[btc.universe, sol]],
    marginTablesMapByDex: [],
  } as unknown as Awaited<ReturnType<typeof service.getTradingUniverse>>);
  // A page on a spot token set the perp mode for a switch.
  const first = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: first });
  // Another extension tab then switched to SOL, which loaded.
  const other = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: other });
  await service.changeActiveAsset({ coin: 'SOL', requestId: other });
  expect(getActiveAsset()).toMatchObject({ coin: 'SOL' });
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: { coin: '@107', assetId: 10_107, universe: undefined },
      unsettledRequestIds: [first, requestId],
    }),
  ).resolves.toEqual({ restored: false, perpAsset: undefined });

  expect(getMode()).toBe('perp');
  expect(getActiveAsset()).toMatchObject({ coin: 'SOL' });
});

it('keeps what another page wrote while a loaded perp asset was being saved', async () => {
  const { service, getMode } = createService(btc);
  const sol = { name: 'SOL', szDecimals: 2, maxLeverage: 20 } as IPerpsUniverse;
  jest.spyOn(service, 'getTradingUniverse').mockResolvedValue({
    universesByDex: [[btc.universe, sol]],
    marginTablesMapByDex: [],
  } as unknown as Awaited<ReturnType<typeof service.getTradingUniverse>>);
  // The loaded asset is in at once, and its save to storage takes a while.
  const setAsset = jest
    .mocked(perpsActiveAssetAtom.set)
    .getMockImplementation();
  let finishSave: () => void = () => {};
  jest.mocked(perpsActiveAssetAtom.set).mockImplementation(async (next) => {
    await setAsset?.(next);
    if ((next as IPerpsActiveAssetAtom)?.universe) {
      await new Promise<void>((resolve) => {
        finishSave = resolve;
      });
    }
  });
  const older = await service.cancelPendingActiveAssetChange();
  const landing = service.changeActiveAsset({ coin: 'SOL', requestId: older });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  // Meanwhile a page on a spot token begins a switch and sets the perp mode.
  const requestId = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId });
  finishSave();
  await landing;

  // That page's switch then fails: its mode write came after SOL was in, so
  // it is still put back.
  const spot = { coin: '@107', assetId: 10_107, universe: undefined };
  await expect(
    service.restoreActiveAssetAfterFailedChange({ requestId, spotAsset: spot }),
  ).resolves.toMatchObject({ restored: true });
  expect(getMode()).toBe('spot');
});

it('keeps the writes before a spot token that was named without its metadata', async () => {
  const { service, getMode, getSpotAsset } = createService(btc);
  const spot: ISpotActiveAssetAtom = {
    coin: '@107',
    assetId: 10_107,
    universe: { name: '@107', assetId: 10_107 } as ISpotUniverse,
  };
  // A page on a spot token set the perp mode for a switch.
  const first = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({ requestId: first });
  // Another extension tab picks a spot token before the spot markets have
  // loaded: no market, and no switch its page takes as done.
  const other = await service.cancelPendingActiveAssetChange();
  await service.setTradingModeForActiveAssetChange({
    requestId: other,
    spotAsset: { coin: '@999', assetId: undefined, universe: undefined },
  });
  const requestId = await service.cancelPendingActiveAssetChange();

  await expect(
    service.restoreActiveAssetAfterFailedChange({
      requestId,
      spotAsset: spot,
      unsettledRequestIds: [first, requestId],
    }),
  ).resolves.toMatchObject({ restored: true });
  expect(getMode()).toBe('spot');
  expect(getSpotAsset()).toEqual(spot);
});
