/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    fetchZcashChainTipDirect: jest.fn(async () => null),
  }),
);

import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

import { getZcashLifecycleMutex } from './lifecycle';
import { ZcashPrivacyMode } from './privacyMode';
import Vault from './Vault';
import { zcashIdentityMismatchAccountIds } from './vaultUtils';

import type {
  IZcashAccountMeta,
  IZcashPendingRescan,
  IZcashPrivacyModeStateView,
} from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

// The endpoint resolver reads the app-wide custom-RPC store; these fixtures
// only care about the privacy chain state, so the default node is enough.
const defaultCustomRpcStub = {
  // The vault reads its node only through this resolver, so a fixture that
  // leaves it out gets no endpoint at all.
  resolveRpcUrlWithBuiltIn: async () => 'https://zcash.example',
};

// The runtime step of deleting an account's local data. The key, state,
// journals and caches are the lifecycle executor's, after this returns.
describe('Zcash local privacy data deletion', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const aliasAccountId = "hd-2--m/44'/133'/0'";
  const ufvk = 'same-ufvk';

  const vkFp = getViewingKeyFingerprint({
    networkId: 'zec--0',
    viewingKey: ufvk,
  });

  function createMeta(): IZcashAccountMeta {
    return {
      vkFp,
      unifiedAddress: 'u1-address',
      transparentAddress: 't1-address',
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      seedFingerprintHex: '00'.repeat(32),
      hdIndex: 0,
      birthdayHeight: 2_000_000,
      createdAt: 1,
    };
  }

  // Scan data: scanning, mid-operation, or paused with a resume position.
  function holdsScanData(state: IZcashPrivacyModeStateView) {
    return (
      state.intent === 'on' ||
      state.operation !== undefined ||
      state.resumeFromHeight !== undefined
    );
  }

  function createVault(aliasState: IZcashPrivacyModeStateView) {
    const meta = createMeta();
    const purgeWallet = jest.fn().mockResolvedValue(undefined);
    const rotateAccountEpochs = jest.fn().mockResolvedValue(undefined);
    const clearAccountScanData = jest.fn().mockResolvedValue(undefined);
    const states: Record<string, IZcashPrivacyModeStateView> = {
      [accountId]: { intent: 'off' },
      [aliasAccountId]: aliasState,
    };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        serviceAccount: {
          getDBAccountSafe: jest.fn(async ({ accountId: id }) =>
            id === aliasAccountId ? { id } : undefined,
          ),
        },
        serviceCustomRpc: defaultCustomRpcStub,
        simpleDb: {
          privacyChainState: {
            getZcashAccountMeta: jest.fn(async ({ accountId: id }) =>
              id === accountId || id === aliasAccountId ? meta : undefined,
            ),
            listZcashAccountMetas: jest.fn(async () => [
              { accountId, meta },
              { accountId: aliasAccountId, meta },
            ]),
            listZcashMetaAccountIds: jest.fn(async () => [
              accountId,
              aliasAccountId,
            ]),
            listScanDataAccountIds: jest.fn(async () =>
              Object.entries(states).flatMap(([id, state]) =>
                holdsScanData(state) ? [id] : [],
              ),
            ),
            clearAccountScanData,
            rotateAccountEpochs,
          },
          privacyChainKeys: {
            getKey: jest.fn(async () => ({
              networkId: 'zec--0',
              vkFp,
              sealed: { format: 'plain', value: ufvk },
            })),
          },
        },
      },
    });
    jest
      .spyOn(vault, 'zcashGetApi')
      .mockResolvedValue({ purgeWallet } as never);
    return { purgeWallet, clearAccountScanData, rotateAccountEpochs, vault };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['enabled', { intent: 'on' }],
    [
      'enabling',
      {
        intent: 'off',
        operation: { type: 'enable', requestedAt: 1 },
      },
    ],
    [
      'disabling',
      {
        intent: 'off',
        operation: { type: 'disable', requestedAt: 1 },
      },
    ],
  ] as const)(
    'retains the shared cache while an alias is %s',
    async (_, state) => {
      const { purgeWallet, vault } = createVault(state);

      await expect(
        vault.zcashDeleteRuntimeAccount({ accountId }),
      ).resolves.toEqual({ orphaned: false });

      expect(purgeWallet).not.toHaveBeenCalled();
    },
  );

  // Pausing promises the cache stays; one account's delete must not discard
  // what another alias resumes from.
  it('retains the shared cache while an alias is paused', async () => {
    const { purgeWallet, vault } = createVault({
      intent: 'off',
      resumeFromHeight: 2_100_000,
    });

    await vault.zcashDeleteRuntimeAccount({ accountId });

    expect(purgeWallet).not.toHaveBeenCalled();
  });

  it('purges the shared cache when every other alias is stably off', async () => {
    const { purgeWallet, clearAccountScanData, rotateAccountEpochs, vault } =
      createVault({
        intent: 'off',
      });

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId }),
    ).resolves.toEqual({ orphaned: false });

    expect(purgeWallet).toHaveBeenCalledTimes(1);
    expect(purgeWallet).toHaveBeenCalledWith(expect.objectContaining({ ufvk }));
    // Only the runtime: the executor rotates before and clears records after.
    expect(rotateAccountEpochs).not.toHaveBeenCalled();
    expect(clearAccountScanData).not.toHaveBeenCalled();
  });

  // Deleting is one way out of a broken setup, so a lost key must not block
  // it; the runtime rows it leaves are reported for the orphan marker.
  it('reports possible orphans for an account whose key can no longer be read', async () => {
    const { purgeWallet, vault } = createVault({
      intent: 'off',
    });
    (
      vault.backgroundApi.simpleDb.privacyChainKeys.getKey as jest.Mock
    ).mockResolvedValue(undefined);

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId }),
    ).resolves.toEqual({ orphaned: true });

    expect(purgeWallet).not.toHaveBeenCalled();
  });
});

describe('Zcash web timeout recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits for carrier reset before confirming that the writer stopped', async () => {
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isDesktop', false);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    let completeReset: (() => void) | undefined;
    const reset = new Promise<void>((resolve) => {
      completeReset = resolve;
    });
    const vault = Object.create(Vault.prototype) as Vault;
    const resetCarrier = jest
      .spyOn(vault, 'resetLocalWalletCarrier')
      .mockReturnValue(reset);
    let recovered = false;
    const recovery = vault.recoverLocalWalletFromTimeout().then((result) => {
      recovered = result;
      return result;
    });
    await Promise.resolve();
    expect(resetCarrier).toHaveBeenCalledTimes(1);
    expect(recovered).toBe(false);
    completeReset?.();
    await expect(recovery).resolves.toBe(true);
  });

  it('does not confirm recovery when web carrier reset fails', async () => {
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isDesktop', false);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    const vault = Object.create(Vault.prototype) as Vault;
    jest
      .spyOn(vault, 'resetLocalWalletCarrier')
      .mockRejectedValue(new Error('reset failed'));

    await expect(vault.recoverLocalWalletFromTimeout()).rejects.toThrow(
      'reset failed',
    );
  });
});

// The WebEmbed is shared with XMR and the secret module; a Zcash timeout
// restarts only the Zcash Worker unless the WebEmbed itself stopped answering.
describe('Zcash native timeout recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restarts only the Zcash Worker when the WebEmbed answers', async () => {
    jest.replaceProperty(platformEnv, 'isNative', true);
    const vault = Object.create(Vault.prototype) as Vault;
    jest.spyOn(vault, 'resetLocalWalletCarrier').mockResolvedValue();
    const emit = jest.spyOn(appEventBus, 'emit');

    await expect(vault.recoverLocalWalletFromTimeout()).resolves.toBe(true);
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebView,
      undefined,
    );
  });

  it('remounts the WebEmbed only when the Worker reset fails', async () => {
    jest.replaceProperty(platformEnv, 'isNative', true);
    const vault = Object.create(Vault.prototype) as Vault;
    jest
      .spyOn(vault, 'resetLocalWalletCarrier')
      .mockRejectedValue(new Error('bridge dead'));
    let onReady: (() => void) | undefined;
    jest.spyOn(appEventBus, 'on').mockImplementation(((
      name: unknown,
      listener: () => void,
    ) => {
      if (name === EAppEventBusNames.LoadWebEmbedWebViewComplete) {
        onReady = listener;
      }
      return appEventBus;
    }) as never);
    jest
      .spyOn(appEventBus, 'off')
      .mockImplementation((() => appEventBus) as never);
    const emit = jest.spyOn(appEventBus, 'emit').mockImplementation(((
      name: unknown,
    ) => {
      if (name === EAppEventBusNames.LoadWebEmbedWebView) onReady?.();
      return true;
    }) as never);

    await expect(vault.recoverLocalWalletFromTimeout()).resolves.toBe(true);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebView,
      undefined,
    );
  });
});

describe('Zcash queued rescan deletion boundary', () => {
  it('does not restore metadata removed while waiting for the lifecycle lock', async () => {
    const accountId = 'synthetic-rescan-account';
    const meta: IZcashAccountMeta = {
      vkFp: 'e'.repeat(32),
      unifiedAddress: 'synthetic-ua',
      transparentAddress: 'synthetic-transparent',
      seedFingerprintHex: '00'.repeat(32),
      hdIndex: 0,
      birthdayHeight: 3_000_000,
      createdAt: 1,
    };
    const repair: IZcashPendingRescan = {
      birthdayHeight: 3_100_000,
      birthdaySource: 'manual-height',
      requestedAt: 2,
    };
    let saved: unknown = {
      data: {
        wallets: {
          [accountId]: {
            chain: { zcash: { seedFingerprintHex: meta.seedFingerprintHex } },
          },
        },
        accounts: {
          [accountId]: {
            networkId: 'zec--0',
            walletId: accountId,
            vkFp: meta.vkFp,
            epoch: '0123456789abcdef',
            scan: {
              intent: 'on',
              birthday: { height: meta.birthdayHeight },
              rescan: {
                birthday: {
                  height: repair.birthdayHeight,
                  source: repair.birthdaySource,
                },
                requestedAt: repair.requestedAt,
              },
            },
            chain: {
              zcash: {
                unifiedAddress: meta.unifiedAddress,
                transparentAddress: meta.transparentAddress,
                hdIndex: meta.hdIndex,
              },
            },
            createdAt: meta.createdAt,
            updatedAt: 1,
          },
        },
      },
      updatedAt: 1,
    };
    const zcash = new SimpleDbEntityPrivacyChainState();
    (zcash as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: zcash,
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: async () => [],
            getAccountLocalHistoryPendingTxs: async () => [],
          },
        },
        serviceAccount: { getDBAccountSafe: async () => ({ id: accountId }) },
        serviceCustomRpc: defaultCustomRpcStub,
      },
    });
    let observed: (() => void) | undefined;
    const readBeforeQueue = new Promise<void>((resolve) => {
      observed = resolve;
    });
    jest.spyOn(vault, 'zcashGetAccountMeta').mockImplementation(async () => {
      const snapshot = await zcash.getZcashAccountMeta({ accountId });
      observed?.();
      return snapshot;
    });
    const save = jest.spyOn(zcash, 'saveZcashAccountMeta');
    const runtime = jest.spyOn(vault, 'zcashGetApi');
    const release = await getZcashLifecycleMutex(meta.vkFp).acquire();
    const pending = (
      vault as unknown as {
        applyPendingRescan: (params: {
          accountId: string;
          repair: IZcashPendingRescan;
        }) => Promise<void>;
      }
    ).applyPendingRescan({ accountId, repair });
    await readBeforeQueue;
    await zcash.clearAccountScanData({ accountId });
    release();
    await pending;

    expect(save).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
    await expect(
      zcash.getZcashAccountMeta({ accountId }),
    ).resolves.toBeUndefined();
    jest.restoreAllMocks();
  });
});

describe('Zcash privacy mode account state', () => {
  const accountId = "hd-1--m/44'/133'/0'";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function readState(state: IZcashPrivacyModeStateView) {
    jest
      .spyOn(ZcashPrivacyMode.prototype, 'getPrivacyModeState')
      .mockResolvedValue(state);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {},
    });
    return vault.getLocalWalletCapability().getAccountState({ accountId });
  }

  it('does not call a never-enabled account paused', async () => {
    await expect(readState({ intent: 'off' })).resolves.toMatchObject({
      enabled: false,
      paused: false,
    });
  });

  it('calls an account paused once it has a resume position', async () => {
    await expect(
      readState({ intent: 'off', resumeFromHeight: 2_100_000 }),
    ).resolves.toMatchObject({ enabled: false, paused: true });
  });

  it('reports an in-flight disable as pending rather than paused', async () => {
    await expect(
      readState({
        intent: 'off',
        resumeFromHeight: 2_100_000,
        operation: { type: 'disable', requestedAt: 1 },
      }),
    ).resolves.toMatchObject({
      enabled: false,
      paused: false,
      pendingOperation: 'disable',
    });
  });

  it('reports an enabled account as neither paused nor pending', async () => {
    await expect(readState({ intent: 'on' })).resolves.toMatchObject({
      enabled: true,
      paused: false,
    });
  });
});

// App Reset's runtime step; the executor deletes the host records.
it('drops only the runtime database', async () => {
  const dropWalletDatabase = jest.fn().mockResolvedValue(undefined);
  const removeNetworkAccounts = jest.fn().mockResolvedValue(undefined);
  const removeNetworkKeys = jest.fn().mockResolvedValue(undefined);
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    zcashGetApi: async () => ({ dropWalletDatabase }),
    backgroundApi: {
      simpleDb: {
        privacyChainState: { removeNetworkAccounts },
        privacyChainKeys: { removeNetworkKeys },
      },
    },
  });
  await vault.getLocalWalletCapability().dropLocalData?.();
  expect(dropWalletDatabase).toHaveBeenCalledWith('main');
  expect(removeNetworkAccounts).not.toHaveBeenCalled();
  expect(removeNetworkKeys).not.toHaveBeenCalled();
});

describe('zcash may hold local data', () => {
  function createVault({
    stateAccountIds,
    orphans,
  }: {
    stateAccountIds: string[];
    orphans: boolean;
  }) {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            listAccountIds: async () => stateAccountIds,
            hasRuntimeOrphans: async () => orphans,
          },
          privacyChainJournal: {
            listZcashTransparentAccountIds: async () => [],
          },
        },
      },
    });
  }

  it('does with an account record', async () => {
    const vault = createVault({ stateAccountIds: ['a'], orphans: false });
    await expect(
      vault.getLocalWalletCapability().hasLocalData?.(),
    ).resolves.toBe(true);
  });

  // An account removed while its key was unreadable left rows behind.
  it('does while the runtime may hold orphans', async () => {
    const vault = createVault({ stateAccountIds: [], orphans: true });
    await expect(
      vault.getLocalWalletCapability().hasLocalData?.(),
    ).resolves.toBe(true);
  });

  it('does not with neither', async () => {
    const vault = createVault({ stateAccountIds: [], orphans: false });
    await expect(
      vault.getLocalWalletCapability().hasLocalData?.(),
    ).resolves.toBe(false);
  });
});

describe('zcash clear pending sends', () => {
  function createVault(tip: number | undefined) {
    const clearTransparentPendingSends = jest.fn().mockResolvedValue(undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainCache: { getChainTip: async () => tip },
          privacyChainJournal: { clearTransparentPendingSends },
        },
      },
    });
    return { vault, clearTransparentPendingSends };
  }

  it.each(['pending', 'expired'] as const)(
    'clears only the given account in %s scope, counting expiry past the drop margin',
    async (scope) => {
      const { vault, clearTransparentPendingSends } = createVault(1000);
      await vault.getLocalWalletCapability().clearPendingSends?.({
        networkId: 'zec--0',
        accountId: 'account',
        scope,
      });
      expect(clearTransparentPendingSends).toHaveBeenCalledWith({
        accountId: 'account',
        expiredBeforeHeight: 990,
        scope,
      });
    },
  );

  it('expires nothing without a saved tip', async () => {
    const { vault, clearTransparentPendingSends } = createVault(undefined);
    await vault.getLocalWalletCapability().clearPendingSends?.({
      networkId: 'zec--0',
      accountId: 'account',
      scope: 'pending',
    });
    expect(clearTransparentPendingSends).toHaveBeenCalledWith({
      accountId: 'account',
      expiredBeforeHeight: undefined,
      scope: 'pending',
    });
  });

  it('refuses another network', async () => {
    const { vault, clearTransparentPendingSends } = createVault(1000);
    await expect(
      vault.getLocalWalletCapability().clearPendingSends?.({
        networkId: 'xmr--0',
        accountId: 'account',
        scope: 'pending',
      }),
    ).rejects.toThrow('another network');
    expect(clearTransparentPendingSends).not.toHaveBeenCalled();
  });
});

describe('zcash chain tip for month-based birthday estimates', () => {
  function createVault(
    tip: number | null,
    { failSave = false }: { failSave?: boolean } = {},
  ) {
    let current = tip;
    const setChainTip = jest.fn(async () => {
      if (failSave) throw new OneKeyLocalError('storage full');
    });
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      getLocalWalletChainTip: async () => current,
      backgroundApi: {
        simpleDb: {
          privacyChainCache: {
            getChainTip: async () => undefined,
            setChainTip,
          },
        },
      },
    });
    return {
      vault,
      setChainTip,
      setTip: (next: number) => {
        current = next;
      },
    };
  }

  beforeEach(async () => {
    // The save throttle is per process; start each case without one.
    await createVault(null)
      .vault.getLocalWalletCapability()
      .forgetMemoryCaches?.({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves the tip the scheduler fetches', async () => {
    const { vault, setChainTip } = createVault(3_100_000);
    await expect(vault.getLocalWalletCapability().getChainTip()).resolves.toBe(
      3_100_000,
    );
    expect(setChainTip).toHaveBeenCalledWith({
      networkId: 'zec--0',
      height: 3_100_000,
    });
  });

  it('saves nothing when no tip was learned', async () => {
    const { vault, setChainTip } = createVault(null);
    await expect(
      vault.getLocalWalletCapability().getChainTip(),
    ).resolves.toBeNull();
    expect(setChainTip).not.toHaveBeenCalled();
  });

  // Every block would otherwise rewrite the shared app storage.
  it('saves again only after 100 blocks or 10 minutes', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { vault, setChainTip, setTip } = createVault(3_100_000);
    const capability = vault.getLocalWalletCapability();
    await capability.getChainTip();
    expect(setChainTip).toHaveBeenCalledTimes(1);

    setTip(3_100_099);
    await expect(capability.getChainTip()).resolves.toBe(3_100_099);
    expect(setChainTip).toHaveBeenCalledTimes(1);

    setTip(3_100_100);
    await capability.getChainTip();
    expect(setChainTip).toHaveBeenCalledTimes(2);
    expect(setChainTip).toHaveBeenLastCalledWith({
      networkId: 'zec--0',
      height: 3_100_100,
    });

    setTip(3_100_101);
    now.mockReturnValue(1_000_000 + 9 * 60 * 1000);
    await capability.getChainTip();
    expect(setChainTip).toHaveBeenCalledTimes(2);

    now.mockReturnValue(1_000_000 + 10 * 60 * 1000);
    await capability.getChainTip();
    expect(setChainTip).toHaveBeenCalledTimes(3);
  });

  it('still answers the tip when saving it fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { vault, setChainTip } = createVault(3_100_000, { failSave: true });
    await expect(vault.getLocalWalletCapability().getChainTip()).resolves.toBe(
      3_100_000,
    );
    expect(setChainTip).toHaveBeenCalledTimes(1);
  });
});

// A re-derived key that names another identity would be derived again from
// the seed on every balance poll; the latch stops that until local data is
// deleted.
describe('zcash background repair after an identity mismatch', () => {
  function createVault() {
    const zcashRetryLocalWalletSetup = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'mismatched-account',
      networkId: 'zec--0',
      keyring: {},
      backgroundApi: {
        servicePassword: {
          hasCachedPassword: async () => true,
          isAlwaysReenterPassword: async () => false,
          getCachedPassword: async () => 'password',
        },
      },
      zcashRetryLocalWalletSetup,
    });
    return { vault, zcashRetryLocalWalletSetup };
  }

  afterEach(() => {
    zcashIdentityMismatchAccountIds.clear();
  });

  it('derives again while no mismatch is latched', async () => {
    const { vault, zcashRetryLocalWalletSetup } = createVault();
    await expect(
      vault.zcashTryAutoRepairLocalWalletSetupIfUnlocked(),
    ).resolves.toBe(true);
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
  });

  it('does not derive once a mismatch is latched', async () => {
    const { vault, zcashRetryLocalWalletSetup } = createVault();
    zcashIdentityMismatchAccountIds.add('mismatched-account');
    await expect(
      vault.zcashTryAutoRepairLocalWalletSetupIfUnlocked(),
    ).resolves.toBe(false);
    expect(zcashRetryLocalWalletSetup).not.toHaveBeenCalled();
  });

  it('derives again after the account memory is forgotten', async () => {
    const { vault, zcashRetryLocalWalletSetup } = createVault();
    zcashIdentityMismatchAccountIds.add('mismatched-account');
    await vault
      .getLocalWalletCapability()
      .forgetMemoryCaches?.({ accountIds: ['mismatched-account'] });
    await expect(
      vault.zcashTryAutoRepairLocalWalletSetupIfUnlocked(),
    ).resolves.toBe(true);
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
  });
});
