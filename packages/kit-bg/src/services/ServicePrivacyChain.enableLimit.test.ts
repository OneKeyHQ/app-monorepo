import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { localWalletText } from '../vaults/localWallet/messages';
import { getViewingKeyFingerprint } from '../vaults/localWallet/viewingKeyFingerprint';

import type {
  ILocalWalletAccount,
  ILocalWalletCapability,
} from '../vaults/localWallet/types';
import type { Mutex } from 'async-mutex';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));
jest.mock('../vaults/settings', () => ({
  getVaultSettings: async () => ({ localWallet: {} }),
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

const ZEC = 'zec--0';
const XMR = 'xmr--0';

type ISlotTimes = { enabledAt?: number; refreshedAt?: number };

type ITestService = {
  enableLocalWalletAccount: (params: {
    networkId: string;
    accountId: string;
  }) => Promise<void>;
  refreshLocalWalletAccount: (params: {
    networkId: string;
    accountId: string;
  }) => Promise<void>;
  resumePendingLocalWalletOperations: () => Promise<void>;
  disableLocalWalletAccount: (params: {
    networkId: string;
    accountId: string;
  }) => Promise<void>;
  getLocalWalletTwinBirthday: (params: {
    networkId: string;
    accountId: string;
  }) => Promise<
    { birthdayHeight: number; birthdayTimestamp?: number } | undefined
  >;
};

const account = (
  accountId: string,
  identity: string,
  syncEnabled = true,
): ILocalWalletAccount => ({
  accountId,
  runtimeKey: 'main',
  accountRuntimeKey: identity,
  syncEnabled,
});

// Accounts per network, enabled or not; a disable or enable flips `syncEnabled`.
function createService({
  accountsByNetwork,
  times = {},
  enableError,
  pendingDeletions = [],
  pausedAccountIds = [],
  keylessAccountIds = [],
  addresses = {},
  birthdays = {},
  viewingKeys = {},
}: {
  accountsByNetwork: Record<string, ILocalWalletAccount[]>;
  times?: Record<string, ISlotTimes>;
  enableError?: Error;
  pendingDeletions?: {
    networkId: string;
    accountId: string;
    reenabled?: boolean;
  }[];
  // Hold local data without syncing.
  pausedAccountIds?: string[];
  // Never enabled, so no identity is known before the key is derived.
  keylessAccountIds?: string[];
  addresses?: Record<string, string>;
  birthdays?: Record<
    string,
    { birthdayHeight: number; birthdayTimestamp?: number }
  >;
  // Stored viewing keys by account.
  viewingKeys?: Record<string, string>;
}) {
  const find = (networkId: string, accountId: string) =>
    accountsByNetwork[networkId]?.find((item) => item.accountId === accountId);
  const listNetworkDataHolders = async ({ networkId }: { networkId: string }) =>
    (accountsByNetwork[networkId] ?? [])
      .filter(
        (item) =>
          (item.slotEnabled ?? item.syncEnabled) ||
          pausedAccountIds.includes(item.accountId),
      )
      .map((item) => ({
        accountId: item.accountId,
        identity: item.accountRuntimeKey,
      }));
  const enableAccount = jest.fn(
    async ({ accountId }: { accountId: string }): Promise<void> => {
      if (enableError) throw enableError;
      for (const [networkId, accounts] of Object.entries(accountsByNetwork)) {
        if (accounts.some((item) => item.accountId === accountId)) {
          const target = find(networkId, accountId);
          if (target) {
            target.syncEnabled = true;
            target.slotEnabled = undefined;
          }
        }
      }
    },
  );
  mockGetChainOnlyVault.mockImplementation(
    async ({ networkId }: { networkId: string }) => ({
      getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
        enableAccount,
        listAccounts: async () => ({
          accounts: accountsByNetwork[networkId] ?? [],
          cleanupAccountIds: [],
        }),
        getAccountState: async ({ accountId }) => {
          const enabled = !!find(networkId, accountId)?.syncEnabled;
          return {
            enabled,
            paused: !enabled && pausedAccountIds.includes(accountId),
            ...birthdays[accountId],
          };
        },
      }),
    }),
  );
  const disabled: string[] = [];
  const runLocalWalletLifecycle = jest.fn(
    async ({
      event,
      targets,
    }: {
      event: string;
      targets: { networkId: string; accountIds: string[] }[];
    }) => {
      if (event !== 'disable') return;
      for (const target of targets) {
        for (const accountId of target.accountIds) {
          const item = find(target.networkId, accountId);
          if (item) {
            item.syncEnabled = false;
            item.slotEnabled = false;
          }
          disabled.push(accountId);
        }
      }
    },
  );
  const touchAccountSyncSlot = jest.fn(
    async ({
      accountId,
      enabled,
    }: {
      networkId: string;
      accountId: string;
      enabled?: boolean;
    }) => {
      const now = 1_000_000;
      times[accountId] = {
        refreshedAt: now,
        enabledAt: enabled ? now : times[accountId]?.enabledAt,
      };
    },
  );
  const promptPasswordVerifyByAccount = jest.fn();
  const getWalletDeviceParams = jest.fn();
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as ITestService,
    {
      backgroundApi: {
        serviceCustomRpc: {
          ensureLocalWalletRemoteConfigLoaded: async () => undefined,
        },
        servicePassword: { promptPasswordVerifyByAccount },
        simpleDb: {
          privacyChainKeys: {
            getKey: async ({ accountId }: { accountId: string }) => {
              const value = viewingKeys[accountId];
              if (value === undefined) return undefined;
              const networkId = Object.keys(accountsByNetwork).find(
                (id) => !!find(id, accountId),
              );
              if (!networkId) return undefined;
              return {
                networkId,
                vkFp: getViewingKeyFingerprint({
                  networkId,
                  viewingKey: value,
                }),
                sealed: { format: 'plain', value },
              };
            },
          },
          privacyChainState: {
            listPendingAccountDeletions: async () => pendingDeletions,
            getAccountVkFp: async ({
              networkId,
              accountId,
            }: {
              networkId: string;
              accountId: string;
            }) =>
              keylessAccountIds.includes(accountId)
                ? undefined
                : find(networkId, accountId)?.accountRuntimeKey,
            listNetworkDataHolders,
            touchAccountSyncSlot,
            getAccountSyncSlotTimes: async ({
              accountId,
            }: {
              accountId: string;
            }) => times[accountId] ?? {},
          },
        },
        serviceAccount: {
          getWalletDeviceParams,
          getWalletSafe: async () => ({ isTemp: false }),
          getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
            address: addresses[accountId] ?? `address-${accountId}`,
          }),
        },
      },
      enableMutexByNetwork: new Map<string, Mutex>(),
      storageUnsupportedNetworkIds: new Set<string>(),
      boostPausedByNetwork: {},
      getLocalWalletNetworkIds: async () => Object.keys(accountsByNetwork),
      runLocalWalletLifecycle,
      resumePendingAccountDeletions: async () => undefined,
      forEachLocalWalletCapability: async () => undefined,
    },
  );
  const syncing = () =>
    Object.values(accountsByNetwork)
      .flat()
      .filter((item) => item.slotEnabled ?? item.syncEnabled)
      .map((item) => item.accountId);
  return {
    service,
    enableAccount,
    disabled,
    syncing,
    touchAccountSyncSlot,
    promptPasswordVerifyByAccount,
    getWalletDeviceParams,
  };
}

describe('Privacy Mode enable failures', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks the network when its storage is unsupported on this device', async () => {
    const { privacyChainAtom } = jest.requireMock<{
      privacyChainAtom: { set: jest.Mock };
    }>('../states/jotai/atoms');
    const unsupported = Object.assign(new Error('storage unsupported'), {
      code: 'STORAGE_UNSUPPORTED',
    });
    const { service } = createService({
      accountsByNetwork: { [ZEC]: [account('new', 'key-new', false)] },
      enableError: unsupported,
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
    ).rejects.toMatchObject({
      message: localWalletText(
        ETranslations.privacy_error_webview_outdated__msg,
      ),
      autoToast: true,
    });
    const update = privacyChainAtom.set.mock.calls[0][0] as (value: {
      storageUnsupportedNetworkIds: string[];
    }) => { storageUnsupportedNetworkIds: string[] };
    expect(
      update({ storageUnsupportedNetworkIds: [] }).storageUnsupportedNetworkIds,
    ).toEqual([ZEC]);
  });

  it('rejects a dead runtime with a worded, toasting error', async () => {
    const { service } = createService({
      accountsByNetwork: { [ZEC]: [account('new', 'key-new', false)] },
      enableError: new OneKeyLocalError({
        message: 'zcash worker: handshake timed out',
        data: { privacyChainRuntimeFailure: 'handshake' },
      }),
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
    ).rejects.toMatchObject({
      message: ETranslations.privacy_error_runtime_unavailable__msg,
      autoToast: true,
    });
  });

  it('toasts any other enable failure with its own message', async () => {
    const { service } = createService({
      accountsByNetwork: { [ZEC]: [account('new', 'key-new', false)] },
      enableError: new Error('treestate fetch failed'),
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
    ).rejects.toMatchObject({
      message: 'treestate fetch failed',
      autoToast: true,
    });
  });
});

describe('Privacy Mode sync slot rotation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Five identities across both chains, z1 refreshed longest ago.
  const fullAcrossChains = () => ({
    accountsByNetwork: {
      [ZEC]: [
        account('z1', 'key-z1'),
        account('z2', 'key-z2'),
        account('z3', 'key-z3'),
        account('new', 'key-new', false),
      ],
      [XMR]: [account('x1', 'key-x1'), account('x2', 'key-x2')],
    },
    times: {
      z1: { refreshedAt: 10, enabledAt: 10 },
      z2: { refreshedAt: 50, enabledAt: 20 },
      z3: { refreshedAt: 40, enabledAt: 30 },
      x1: { refreshedAt: 30, enabledAt: 5 },
      x2: { refreshedAt: 20, enabledAt: 15 },
    } as Record<string, ISlotTimes>,
  });

  it('enables a sixth identity and pauses the one refreshed longest ago, across chains', async () => {
    const setup = fullAcrossChains();
    const { service, enableAccount, disabled, syncing, touchAccountSyncSlot } =
      createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    expect(enableAccount).toHaveBeenCalledTimes(1);
    expect(touchAccountSyncSlot).toHaveBeenCalledWith({
      networkId: ZEC,
      accountId: 'new',
      enabled: true,
    });
    expect(disabled).toEqual(['z1']);
    expect(syncing()).toHaveLength(5);
  });

  it('pauses an XMR account when it is the least recently refreshed', async () => {
    const setup = fullAcrossChains();
    setup.times.z1 = { refreshedAt: 60, enabledAt: 10 };
    const { service, disabled } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    expect(disabled).toEqual(['x2']);
  });

  it('breaks a refresh tie by the older enable', async () => {
    const setup = fullAcrossChains();
    setup.times.z1 = { refreshedAt: 20, enabledAt: 18 };
    const { service, disabled } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    // x2 and z1 were both last refreshed at 20; x2 was enabled earlier.
    expect(disabled).toEqual(['x2']);
  });

  it('pauses every alias of the identity it releases', async () => {
    const setup = fullAcrossChains();
    setup.accountsByNetwork[ZEC].push(account('z1-alias', 'key-z1'));
    setup.times['z1-alias'] = { refreshedAt: 12, enabledAt: 12 };
    const { service, disabled } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    expect(disabled.toSorted()).toEqual(['z1', 'z1-alias']);
  });

  it('releases nothing for an alias of an identity already syncing', async () => {
    const setup = fullAcrossChains();
    setup.accountsByNetwork[ZEC].push(account('z2-alias', 'key-z2', false));
    const { service, enableAccount, disabled } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'z2-alias',
    });

    expect(enableAccount).toHaveBeenCalledTimes(1);
    expect(disabled).toEqual([]);
  });

  it('leaves every slot alone when the enable fails', async () => {
    const { service, disabled, syncing } = createService({
      ...fullAcrossChains(),
      enableError: new Error('cancelled on device'),
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
    ).rejects.toThrow('cancelled on device');
    expect(disabled).toEqual([]);
    expect(syncing()).toEqual(['z1', 'z2', 'z3', 'x1', 'x2']);
  });

  it('counts a hidden wallet still holding its slot', async () => {
    const setup = fullAcrossChains();
    setup.accountsByNetwork[XMR][0] = {
      ...account('x1', 'key-x1', false),
      slotEnabled: true,
    };
    setup.times.x1 = { refreshedAt: 1, enabledAt: 1 };
    const { service, disabled } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    expect(disabled).toEqual(['x1']);
  });

  it('never releases a slot held by a re-enable still finishing', async () => {
    const setup = fullAcrossChains();
    const { service, disabled } = createService({
      ...setup,
      pendingDeletions: [{ networkId: ZEC, accountId: 'z1', reenabled: true }],
    });

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'new',
    });

    expect(disabled).toEqual(['x2']);
  });

  it('serializes concurrent enables so the ceiling holds', async () => {
    const setup = fullAcrossChains();
    setup.accountsByNetwork[XMR].push(account('x-new', 'key-x-new', false));
    const { service, disabled, syncing } = createService(setup);

    await Promise.all([
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
      service.enableLocalWalletAccount({ networkId: XMR, accountId: 'x-new' }),
    ]);

    expect(disabled).toEqual(['z1', 'x2']);
    expect(syncing().toSorted()).toEqual(['new', 'x-new', 'x1', 'z2', 'z3']);
  });

  it('brings accounts enabled under the old per-chain ceilings back to five on startup', async () => {
    const setup = fullAcrossChains();
    setup.accountsByNetwork[ZEC].push(
      account('z4', 'key-z4'),
      account('z5', 'key-z5'),
    );
    setup.times.z4 = { refreshedAt: 70, enabledAt: 70 };
    const { service, disabled, syncing } = createService(setup);

    await service.resumePendingLocalWalletOperations();

    // z5 has no recorded times, so it counts as the oldest.
    expect(disabled.toSorted()).toEqual(['z1', 'z5']);
    expect(syncing()).toHaveLength(5);
  });

  it('records an explicit refresh of a syncing account', async () => {
    const setup = fullAcrossChains();
    const { service, touchAccountSyncSlot } = createService(setup);
    Object.assign(service, { boostPausedByNetwork: { [ZEC]: true } });

    await service.refreshLocalWalletAccount({
      networkId: ZEC,
      accountId: 'z1',
    });

    expect(touchAccountSyncSlot).toHaveBeenCalledWith({
      networkId: ZEC,
      accountId: 'z1',
    });
  });
});

describe('Privacy Mode accounts per network', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Five Zcash identities hold data: three syncing, two paused.
  const fullNetwork = () => ({
    accountsByNetwork: {
      [ZEC]: [
        account('z1', 'key-z1'),
        account('z2', 'key-z2'),
        account('z3', 'key-z3'),
        account('p1', 'key-p1', false),
        account('p2', 'key-p2', false),
        account('new', 'key-new', false),
      ],
      [XMR]: [account('x-new', 'key-x-new', false)],
    },
    pausedAccountIds: ['p1', 'p2'],
  });

  it('refuses a sixth identity on a network before asking for any key', async () => {
    const { service, enableAccount, disabled } = createService(fullNetwork());
    const { isLocalWalletSlotsFullError } = jest.requireActual<
      typeof import('../vaults/localWallet/userFacingError')
    >('../vaults/localWallet/userFacingError');

    const error = await service
      .enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' })
      .catch((e: unknown) => e);

    expect(isLocalWalletSlotsFullError(error)).toBe(true);
    expect(error).toMatchObject({ autoToast: false });
    expect(enableAccount).not.toHaveBeenCalled();
    expect(disabled).toEqual([]);
  });

  it('resumes a paused account at the ceiling, since its data is already counted', async () => {
    const { service, enableAccount } = createService(fullNetwork());

    await service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'p1' });

    expect(enableAccount).toHaveBeenCalledTimes(1);
  });

  it('admits an alias of an identity already holding data', async () => {
    const setup = fullNetwork();
    setup.accountsByNetwork[ZEC].push(account('z1-twin', 'key-z1', false));
    const { service, enableAccount } = createService(setup);

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'z1-twin',
    });

    expect(enableAccount).toHaveBeenCalledTimes(1);
  });

  it('admits a first-time hardware twin by its shared address', async () => {
    const setup = fullNetwork();
    setup.accountsByNetwork[ZEC].push(account('hw-z2', 'key-z2', false));
    const { service, enableAccount } = createService({
      ...setup,
      keylessAccountIds: ['hw-z2'],
      addresses: { 'z2': 't1-shared', 'hw-z2': 't1-shared' },
    });

    await service.enableLocalWalletAccount({
      networkId: ZEC,
      accountId: 'hw-z2',
    });

    expect(enableAccount).toHaveBeenCalledTimes(1);
  });

  it('refuses a first-time account whose address no holder shares', async () => {
    const { service, enableAccount } = createService({
      ...fullNetwork(),
      keylessAccountIds: ['new'],
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: ZEC, accountId: 'new' }),
    ).rejects.toMatchObject({ autoToast: false });
    expect(enableAccount).not.toHaveBeenCalled();
  });

  it('counts each network on its own', async () => {
    const { service, enableAccount } = createService(fullNetwork());

    await service.enableLocalWalletAccount({
      networkId: XMR,
      accountId: 'x-new',
    });

    expect(enableAccount).toHaveBeenCalledTimes(1);
  });
});

describe('Privacy Mode twin of a scanning account', () => {
  const twinSetup = (keylessAccountIds: string[] = []) =>
    createService({
      accountsByNetwork: {
        [XMR]: [
          account('hd-x1', 'key-x1'),
          account('hw-x1', 'key-x1', false),
          account('hd-x2', 'key-x2', false),
        ],
      },
      keylessAccountIds,
      addresses: { 'hd-x1': '4shared', 'hw-x1': '4shared' },
      birthdays: {
        'hd-x1': { birthdayHeight: 3_400_000, birthdayTimestamp: 1_700_000 },
      },
    });

  it('starts a first-time hardware twin where its software twin starts', async () => {
    const { service } = twinSetup(['hw-x1']);

    await expect(
      service.getLocalWalletTwinBirthday({
        networkId: XMR,
        accountId: 'hw-x1',
      }),
    ).resolves.toEqual({
      birthdayHeight: 3_400_000,
      birthdayTimestamp: 1_700_000,
    });
  });

  it('finds a twin by its viewing key once the account has one', async () => {
    const { service } = twinSetup();

    await expect(
      service.getLocalWalletTwinBirthday({
        networkId: XMR,
        accountId: 'hw-x1',
      }),
    ).resolves.toEqual({
      birthdayHeight: 3_400_000,
      birthdayTimestamp: 1_700_000,
    });
  });

  it('asks for a start when no account shares its key', async () => {
    const { service } = twinSetup(['hd-x2']);

    await expect(
      service.getLocalWalletTwinBirthday({
        networkId: XMR,
        accountId: 'hd-x2',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('Privacy Mode turning twins off', () => {
  it('turns every twin of the account off with it, and no other account', async () => {
    const { service, disabled, syncing } = createService({
      accountsByNetwork: {
        [XMR]: [
          account('hd-x1', 'key-x1'),
          account('hw-x1', 'key-x1'),
          account('hd-x2', 'key-x2'),
        ],
      },
    });

    await service.disableLocalWalletAccount({
      networkId: XMR,
      accountId: 'hd-x1',
    });

    expect(disabled).toEqual(['hd-x1', 'hw-x1']);
    expect(syncing()).toEqual(['hd-x2']);
  });

  it('leaves a twin that is already paused as it is', async () => {
    const { service, disabled } = createService({
      accountsByNetwork: {
        [XMR]: [account('hd-x1', 'key-x1'), account('hw-x1', 'key-x1', false)],
      },
      pausedAccountIds: ['hw-x1'],
    });

    await service.disableLocalWalletAccount({
      networkId: XMR,
      accountId: 'hd-x1',
    });

    expect(disabled).toEqual(['hd-x1']);
  });
});

describe('Privacy Mode resuming twins', () => {
  const sharedKey = 'aa:bb';
  const sharedIdentity = getViewingKeyFingerprint({
    networkId: XMR,
    viewingKey: sharedKey,
  });
  const pausedTwins = (viewingKeys: Record<string, string>) =>
    createService({
      accountsByNetwork: {
        [XMR]: [
          account('hd-x1', sharedIdentity, false),
          account('hw-x1', sharedIdentity, false),
          account('hd-x2', 'key-x2', false),
        ],
      },
      pausedAccountIds: ['hd-x1', 'hw-x1', 'hd-x2'],
      viewingKeys,
    });

  it('resumes a paused twin with the account, asking for nothing', async () => {
    const {
      service,
      enableAccount,
      syncing,
      promptPasswordVerifyByAccount,
      getWalletDeviceParams,
    } = pausedTwins({ 'hd-x1': sharedKey, 'hw-x1': sharedKey });

    await service.enableLocalWalletAccount({
      networkId: XMR,
      accountId: 'hd-x1',
    });

    expect(enableAccount.mock.calls).toEqual([
      [{ accountId: 'hd-x1' }],
      [{ accountId: 'hw-x1' }],
    ]);
    expect(syncing()).toEqual(['hd-x1', 'hw-x1']);
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(getWalletDeviceParams).not.toHaveBeenCalled();
  });

  it('leaves a twin without a stored viewing key paused', async () => {
    const {
      service,
      enableAccount,
      syncing,
      promptPasswordVerifyByAccount,
      getWalletDeviceParams,
    } = pausedTwins({ 'hd-x1': sharedKey });

    await service.enableLocalWalletAccount({
      networkId: XMR,
      accountId: 'hd-x1',
    });

    expect(enableAccount.mock.calls).toEqual([[{ accountId: 'hd-x1' }]]);
    expect(syncing()).toEqual(['hd-x1']);
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(getWalletDeviceParams).not.toHaveBeenCalled();
  });

  it('keeps the account on when resuming a twin fails', async () => {
    const { service, enableAccount, syncing } = pausedTwins({
      'hd-x1': sharedKey,
      'hw-x1': sharedKey,
    });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const turnOn = enableAccount.getMockImplementation();
    enableAccount.mockImplementation(async (params) => {
      if (params.accountId === 'hw-x1') {
        throw new OneKeyLocalError('device busy');
      }
      await turnOn?.(params);
    });

    await expect(
      service.enableLocalWalletAccount({ networkId: XMR, accountId: 'hd-x1' }),
    ).resolves.toBeUndefined();

    expect(enableAccount).toHaveBeenCalledTimes(2);
    expect(syncing()).toEqual(['hd-x1']);
    logged.mockRestore();
  });
});
