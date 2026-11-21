import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { perpsActiveAssetAtom } from '../../states/jotai/atoms';

import ServiceHyperliquid from './ServiceHyperliquid';

import type { IPerpsActiveAssetAtom } from '../../states/jotai/atoms';

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
  jest
    .spyOn(perpsActiveAssetAtom, 'get')
    .mockImplementation(async () => current);
  jest.spyOn(perpsActiveAssetAtom, 'set').mockImplementation(async (next) => {
    current = next as IPerpsActiveAssetAtom;
  });
  return { service, getActiveAsset: () => current };
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

it('puts the last loaded asset back over a coin named without its metadata', async () => {
  const { service, getActiveAsset } = createService(ethNamed);

  await expect(service.restoreLoadedActiveAsset()).resolves.toEqual(btc);
  expect(getActiveAsset()).toEqual(btc);
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

  await expect(service.restoreLoadedActiveAsset()).resolves.toEqual(sol);
  expect(perpsActiveAssetAtom.set).not.toHaveBeenCalled();
});
