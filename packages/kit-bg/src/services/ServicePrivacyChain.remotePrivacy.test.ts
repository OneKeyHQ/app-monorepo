import { Mutex } from 'async-mutex';

import { setLocalWalletRemoteConfigs } from '../vaults/localWallet/remoteConfig';

import type {
  ILocalWalletAccountState,
  ILocalWalletSendReadiness,
} from '../vaults/localWallet/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
jest.mock('../vaults/settings', () => ({
  getVaultSettings: async () => ({
    localWallet: { pools: [{ key: 'orchard', source: 'localScan' }] },
  }),
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IParams = { networkId: string; accountId: string };
type IService = {
  getLocalWalletAccountState: (
    params: IParams,
  ) => Promise<ILocalWalletAccountState>;
  enableLocalWalletAccount: (params: IParams) => Promise<void>;
  assertLocalWalletAccountAdmission: (params: IParams) => Promise<void>;
  retryLocalWalletAccountSetup: (params: IParams) => Promise<void>;
  enableLocalWalletAccountInSlot: (params: IParams) => Promise<void>;
  refreshLocalWalletAccount: (params: IParams) => Promise<void>;
  getLocalWalletSendReadiness: (
    params: IParams & { sourcePool: string },
  ) => Promise<ILocalWalletSendReadiness | undefined>;
};

function fixture(networkId: string, state: ILocalWalletAccountState) {
  const enableAccount = jest.fn(async () => undefined);
  const getAccountState = jest.fn(async () => state);
  mockGetChainOnlyVault.mockResolvedValue({
    getLocalWalletCapability: () => ({
      getAccountState,
      enableAccount,
      syncPolicy: {
        sendMaxBlocksLeft: networkId === 'xmr--0' ? 100 : undefined,
        sendSync: { followUpSyncs: 8, followUpIntervalMs: 90_000 },
      },
    }),
  });
  const ensureLoaded = jest.fn(async () => undefined);
  const mutex = new Mutex();
  const admission = jest.fn(async () => undefined);
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    {
      backgroundApi: {
        serviceCustomRpc: { ensureLocalWalletRemoteConfigLoaded: ensureLoaded },
        serviceAccount: { getWalletSafe: async () => ({ isTemp: false }) },
      },
      enableMutexByNetwork: new Map([[networkId, mutex]]),
      assertNetworkAccountCeiling: admission,
    },
  );
  return {
    service,
    enableAccount,
    getAccountState,
    ensureLoaded,
    mutex,
    admission,
  };
}

afterEach(() => setLocalWalletRemoteConfigs({}));

describe.each(['zec--0', 'xmr--0'])(
  'server privacy authority: %s',
  (networkId) => {
    const params = { networkId, accountId: 'hd-1--0' };

    it.each([false, true])(
      'returns unavailable while preserving saved intent (enabled: %s)',
      async (enabled) => {
        const saved = {
          enabled,
          paused: !enabled,
          pendingOperation: 'enable' as const,
        };
        const { service, enableAccount } = fixture(networkId, saved);
        setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });

        expect(await service.getLocalWalletAccountState(params)).toMatchObject({
          enabled: false,
          paused: false,
          privacyDisabled: true,
          pendingOperation: undefined,
        });
        expect(saved).toEqual({
          enabled,
          paused: !enabled,
          pendingOperation: 'enable',
        });
        expect(enableAccount).not.toHaveBeenCalled();

        setLocalWalletRemoteConfigs({});
        expect(await service.getLocalWalletAccountState(params)).toEqual(saved);
      },
    );

    it('loads a persisted disable before admitting an old page enable request', async () => {
      const { service, ensureLoaded, enableAccount, admission } = fixture(
        networkId,
        {
          enabled: false,
          paused: false,
        },
      );
      ensureLoaded.mockImplementation(async () => {
        setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
      });

      await expect(service.enableLocalWalletAccount(params)).rejects.toThrow();
      await expect(
        service.assertLocalWalletAccountAdmission(params),
      ).rejects.toThrow();
      await expect(
        service.retryLocalWalletAccountSetup(params),
      ).rejects.toThrow();
      expect(ensureLoaded).toHaveBeenCalled();
      expect(enableAccount).not.toHaveBeenCalled();
      expect(admission).not.toHaveBeenCalled();
    });

    it('blocks private sends after loading a persisted server disable', async () => {
      const { service, ensureLoaded } = fixture(networkId, {
        enabled: true,
        paused: false,
      });
      ensureLoaded.mockImplementation(async () => {
        setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
      });
      expect(
        await service.getLocalWalletSendReadiness({
          ...params,
          sourcePool: 'orchard',
        }),
      ).toMatchObject({
        canSend: false,
        paused: true,
      });
    });

    it('rejects an enable queued before the server disabled privacy', async () => {
      const { service, mutex, enableAccount, admission } = fixture(networkId, {
        enabled: false,
        paused: true,
      });
      const release = await mutex.acquire();
      const pending = service.enableLocalWalletAccountInSlot(params);
      setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
      release();

      await expect(pending).rejects.toThrow();
      expect(enableAccount).not.toHaveBeenCalled();
      expect(admission).not.toHaveBeenCalled();
    });

    it('does not refresh an enabled account while privacy is disabled', async () => {
      const { service, getAccountState } = fixture(networkId, {
        enabled: true,
        paused: false,
      });
      setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
      await service.refreshLocalWalletAccount(params);
      expect(getAccountState).not.toHaveBeenCalled();
    });
  },
);
