import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import {
  perpsActiveAssetAtom,
  spotActiveAssetAtom,
  tradingModeAtom,
} from '../../states/jotai/atoms';

import ServiceHyperliquid from './ServiceHyperliquid';

import type {
  IPerpsActiveAssetAtom,
  ISpotActiveAssetAtom,
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
    lastCommittedActiveAsset: btc,
  });
  let current = activeAsset;
  let mode: ITradingMode = 'perp';
  let spotAsset: ISpotActiveAssetAtom | undefined;
  jest
    .spyOn(perpsActiveAssetAtom, 'get')
    .mockImplementation(async () => current);
  jest.spyOn(perpsActiveAssetAtom, 'set').mockImplementation(async (next) => {
    current = next as IPerpsActiveAssetAtom;
  });
  jest.spyOn(tradingModeAtom, 'set').mockImplementation(async (next) => {
    mode = next as ITradingMode;
  });
  jest.spyOn(spotActiveAssetAtom, 'set').mockImplementation(async (next) => {
    spotAsset = next as ISpotActiveAssetAtom;
  });
  return {
    service,
    getActiveAsset: () => current,
    getMode: () => mode,
    getSpotAsset: () => spotAsset,
  };
}

afterEach(() => jest.restoreAllMocks());

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
  const requestId = await service.cancelPendingActiveAssetChange();

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
  const requestId = await service.cancelPendingActiveAssetChange();

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
  const requestId = await service.cancelPendingActiveAssetChange();

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
