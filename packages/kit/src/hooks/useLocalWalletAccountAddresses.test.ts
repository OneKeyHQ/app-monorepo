import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

import { loadLocalWalletAccountAddresses } from './useLocalWalletAccountAddresses';

const mockGetAddresses = jest.fn();
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletAccountAddresses: (params: unknown) =>
        mockGetAddresses(params) as Promise<unknown>,
    },
  },
}));

const target = { networkId: 'zec--0', accountId: 'account' };
const addresses = { publicAddress: 't1own', privateAddress: 'u1own' };

beforeEach(() => {
  mockGetAddresses.mockReset();
  appEventBus.emit(EAppEventBusNames.LocalWalletAccountsChanged, {
    networkId: target.networkId,
    accountIds: [target.accountId],
  });
});

it('shares one read between rows and reuses it', async () => {
  mockGetAddresses.mockResolvedValue(addresses);
  const reads = await Promise.all([
    loadLocalWalletAccountAddresses(target),
    loadLocalWalletAccountAddresses(target),
  ]);
  await loadLocalWalletAccountAddresses(target);
  expect(reads).toEqual([addresses, addresses]);
  expect(mockGetAddresses).toHaveBeenCalledTimes(1);
});

it('retries a failed read instead of keeping it', async () => {
  mockGetAddresses
    .mockRejectedValueOnce(new OneKeyLocalError('runtime busy'))
    .mockResolvedValue(addresses);
  await expect(loadLocalWalletAccountAddresses(target)).resolves.toBe(
    undefined,
  );
  await expect(loadLocalWalletAccountAddresses(target)).resolves.toBe(
    addresses,
  );
  expect(mockGetAddresses).toHaveBeenCalledTimes(2);
});

it('reads again after the account is enabled or paused', async () => {
  mockGetAddresses.mockResolvedValueOnce(addresses);
  await loadLocalWalletAccountAddresses(target);
  appEventBus.emit(EAppEventBusNames.LocalWalletAccountsChanged, {
    networkId: target.networkId,
    accountIds: [target.accountId],
  });
  const paused = { publicAddress: 't1own' };
  mockGetAddresses.mockResolvedValueOnce(paused);
  await expect(loadLocalWalletAccountAddresses(target)).resolves.toBe(paused);
  expect(mockGetAddresses).toHaveBeenCalledTimes(2);
});
