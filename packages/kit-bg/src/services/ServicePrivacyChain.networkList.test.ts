import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServicePrivacyChain from './ServicePrivacyChain';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
jest.mock('../vaults/settings', () => ({
  getVaultSettings: async () => ({ localWallet: true }),
}));

describe('privacy chain network list', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['resolve', 'reject'])(
    'replaces a pending enumeration after the network list changes (%s)',
    async (oldResult) => {
      type INetworks = { networks: { id: string }[] };
      const oldEnumeration = Promise.withResolvers<INetworks>();
      const newEnumeration = Promise.withResolvers<INetworks>();
      const getAllNetworks = jest
        .fn<Promise<INetworks>, []>()
        .mockReturnValueOnce(oldEnumeration.promise)
        .mockReturnValueOnce(newEnumeration.promise);
      const subscriptions = jest
        .spyOn(appEventBus, 'on')
        .mockReturnValue(appEventBus);
      const service = new ServicePrivacyChain({
        backgroundApi: {
          serviceNetwork: { getAllNetworks },
        } as unknown as IBackgroundApi,
      });
      jest
        .spyOn(service, 'publishBoostingNetworks')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'scheduleBackgroundSync')
        .mockImplementation(() => {});
      const listener = subscriptions.mock.calls.find(
        ([event]) => event === EAppEventBusNames.AddedCustomNetwork,
      )?.[1];
      expect(listener).toBeDefined();

      const beforeChange = service.getListedLocalWalletNetworkIds();
      await Promise.resolve();
      listener?.(undefined);
      const afterChange = service.getListedLocalWalletNetworkIds();
      await Promise.resolve();
      expect(getAllNetworks).toHaveBeenCalledTimes(2);

      if (oldResult === 'resolve') {
        oldEnumeration.resolve({ networks: [{ id: 'evm--1' }] });
      } else {
        oldEnumeration.reject(new OneKeyLocalError('stale enumeration failed'));
      }
      await Promise.resolve();
      const concurrent = service.getListedLocalWalletNetworkIds();
      newEnumeration.resolve({ networks: [{ id: 'xmr--0' }] });

      await expect(
        Promise.all([beforeChange, afterChange, concurrent]),
      ).resolves.toEqual([['xmr--0'], ['xmr--0'], ['xmr--0']]);
      await expect(service.getListedLocalWalletNetworkIds()).resolves.toEqual([
        'xmr--0',
      ]);
      expect(getAllNetworks).toHaveBeenCalledTimes(2);
    },
  );
});
