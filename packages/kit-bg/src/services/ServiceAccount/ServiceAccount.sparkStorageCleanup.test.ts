/*
yarn jest packages/kit-bg/src/services/ServiceAccount/ServiceAccount.sparkStorageCleanup.test.ts

Every wallet removal path ends in the WalletRemove event. The Lightning
Self-Custody service loads lazily, so ServiceAccount relays a removed software
wallet to it, which deletes that wallet's Breez storage.
*/
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceAccount from './ServiceAccount';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  // Every event name maps to itself.
  EAppEventBusNames: new Proxy({}, { get: (_target, name) => name }),
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

const mockedEventBus = (
  jest.requireMock('@onekeyhq/shared/src/eventBus/appEventBus') as {
    appEventBus: { on: jest.Mock };
  }
).appEventBus;

function setup() {
  const removeWalletStorage = jest.fn(
    async (_params: { walletId: string }) => undefined,
  );
  // eslint-disable-next-line no-new -- the constructor registers the listener
  new ServiceAccount({
    backgroundApi: { serviceLightningSpark: { removeWalletStorage } },
  });
  const onWalletRemove = mockedEventBus.on.mock.calls.findLast(
    ([name]) => name === 'WalletRemove',
  )?.[1] as (payload: { walletId: string }) => void;
  return { removeWalletStorage, onWalletRemove };
}

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('ServiceAccount relays wallet removal to Lightning Self-Custody', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each(['hd-1', 'hd-keyless-0a1b2c'])(
    'deletes the storage of a removed software wallet (%s)',
    async (walletId) => {
      const { removeWalletStorage, onWalletRemove } = setup();

      onWalletRemove({ walletId });
      await flush();

      expect(removeWalletStorage).toHaveBeenCalledWith({ walletId });
    },
  );

  it('ignores hardware wallets, which have no Spark storage', async () => {
    const { removeWalletStorage, onWalletRemove } = setup();

    onWalletRemove({ walletId: 'hw-1' });
    await flush();

    expect(removeWalletStorage).not.toHaveBeenCalled();
  });

  it('logs a failed deletion without failing the removal', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { removeWalletStorage, onWalletRemove } = setup();
    removeWalletStorage.mockRejectedValue(
      new OneKeyLocalError('storage is busy'),
    );

    expect(() => onWalletRemove({ walletId: 'hd-1' })).not.toThrow();
    await flush();

    expect(logged).toHaveBeenCalledWith(
      'Failed to remove Lightning Self-Custody storage after wallet removal:',
      expect.any(Error),
    );
  });
});
