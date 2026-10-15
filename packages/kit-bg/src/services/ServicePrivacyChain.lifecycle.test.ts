import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});
const mockEmit = jest.fn();
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBusNames')
  >('@onekeyhq/shared/src/eventBus/appEventBusNames').EAppEventBusNames,
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
    },
  },
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));
const mockSetProgress = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: (value: unknown) => mockSetProgress(value) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('privacy lifecycle invalidation', () => {
  beforeEach(() => {
    mockEmit.mockReset();
    mockSetProgress.mockReset().mockResolvedValue(undefined);
  });

  it.each(['progress', 'scheduler'])(
    'invalidates retained pages even when %s notification work fails',
    async (failedStep) => {
      const error = new Error(`${failedStep} unavailable`);
      const init = jest.fn().mockResolvedValue(undefined);
      if (failedStep === 'progress') {
        mockSetProgress.mockRejectedValueOnce(error);
      } else {
        init.mockRejectedValueOnce(error);
      }
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        { backfillActiveByAccount: {}, syncFailureBackoff: new Map(), init },
      );
      const params = {
        networkId: 'zec--0',
        accountIds: ['account-a'],
        backfillActive: false,
      };

      await expect(service.onLocalWalletAccountsChanged(params)).rejects.toBe(
        error,
      );
      expect(mockEmit).toHaveBeenCalledWith(
        EAppEventBusNames.LocalWalletAccountsChanged,
        { networkId: params.networkId, accountIds: params.accountIds },
      );
      expect(mockEmit).toHaveBeenCalledTimes(1);
    },
  );
});

describe('removed-account gc', () => {
  it('runs again when a removal arrives while a pass is running', async () => {
    let releaseFirstPass: () => void = () => {};
    const getLocalWalletNetworkIds = jest
      .fn<Promise<string[]>, []>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstPass = () => resolve([]);
          }),
      )
      .mockResolvedValue([]);
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        gcRunning: false,
        gcRequested: false,
        getLocalWalletNetworkIds,
        forEachLocalWalletCapability: jest.fn(async () => undefined),
        backgroundApi: {
          serviceAccount: { getAllWallets: async () => ({ wallets: [] }) },
        },
      },
    );

    const first = service.gcRemovedAccounts();
    // The second wallet is removed after the first pass listed accounts.
    await service.gcRemovedAccounts();
    releaseFirstPass();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getLocalWalletNetworkIds).toHaveBeenCalledTimes(2);
  });
});
