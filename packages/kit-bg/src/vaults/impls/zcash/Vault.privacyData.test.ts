/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    fetchZcashChainTipDirect: jest.fn(async () => null),
    fetchZcashTransactionMissingDirect: jest.fn(async () => true),
  }),
);

import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import VaultBtc from '../btc/Vault';

import { getZcashLifecycleMutex } from './lifecycle';
import { ZcashPrivacyMode } from './privacyMode';
import Vault from './Vault';

import type {
  IZcashAccountMeta,
  IZcashDB,
  IZcashPendingRescan,
  IZcashPrivacyModeStateView,
} from '../../../dbs/simple/entity/SimpleDbEntityZcash';

// The endpoint resolver reads the app-wide custom-RPC store; these fixtures
// only care about the zcash entity, so the default node is enough.
const defaultCustomRpcStub = {
  // The chain's own node, seeded as an ordinary record; the resolver reads
  // only this, so a fixture that leaves it out gets no endpoint at all.
  ensureBuiltInRpc: async () => ({
    rpc: 'https://zcash.example',
    networkId: 'zec--0',
    enabled: true,
    updatedAt: undefined,
    isCustomNetwork: undefined,
  }),
};

describe('Zcash local privacy data deletion', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const aliasAccountId = "hd-2--m/44'/133'/0'";
  const ufvk = 'same-ufvk';

  function createMeta(): IZcashAccountMeta {
    return {
      ufvk,
      unifiedAddress: 'u1-address',
      transparentAddress: 't1-address',
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      seedFingerprintHex: '00',
      hdIndex: 0,
      birthdayHeight: 2_000_000,
      createdAt: 1,
    };
  }

  function createVault(aliasState: IZcashPrivacyModeStateView) {
    const meta = createMeta();
    const removeSignedTransactionsForAccount = jest
      .fn()
      .mockResolvedValue(undefined);
    const purgeWallet = jest.fn().mockResolvedValue(undefined);
    const removeAccountMeta = jest.fn().mockResolvedValue(undefined);
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
        serviceSignature: { removeSignedTransactionsForAccount },
        simpleDb: {
          zcash: {
            getAccountMeta: jest.fn(async ({ accountId: id }) =>
              id === accountId || id === aliasAccountId ? meta : undefined,
            ),
            getPrivacyModeState: jest.fn(
              async ({ accountId: id }) => states[id] ?? { intent: 'off' },
            ),
            isPrivacyModeEnabled: jest.fn(async ({ accountId: id }) => {
              const state = states[id];
              return state?.intent === 'on' && state.operation === undefined;
            }),
            listTransparentPendingTxs: jest.fn(async () => []),
            listShieldedReservations: jest.fn(async () => []),
            listAccountMetas: jest.fn(async () => [
              { accountId, meta },
              { accountId: aliasAccountId, meta },
            ]),
            removeAccountMeta,
          },
        },
      },
    });
    jest
      .spyOn(vault, 'zcashGetApi')
      .mockResolvedValue({ purgeWallet } as never);
    return {
      purgeWallet,
      removeAccountMeta,
      removeSignedTransactionsForAccount,
      vault,
    };
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
      const { purgeWallet, removeAccountMeta, vault } = createVault(state);

      await vault.deleteLocalPrivacyData({ accountId });

      expect(purgeWallet).not.toHaveBeenCalled();
      expect(removeAccountMeta).toHaveBeenCalledWith({ accountId });
    },
  );

  // Pausing promises the cache stays. Treating a paused alias as gone let one
  // account's delete throw away what another account meant to resume from.
  it('retains the shared cache while an alias is paused', async () => {
    const { purgeWallet, removeAccountMeta, vault } = createVault({
      intent: 'off',
      resumeFromHeight: 2_100_000,
    });

    await vault.deleteLocalPrivacyData({ accountId });

    expect(purgeWallet).not.toHaveBeenCalled();
    expect(removeAccountMeta).toHaveBeenCalledWith({ accountId });
  });

  // Deleting local privacy data must also remove what this device recorded
  // about what the account signed; the public chain history is untouched.
  it('clears the local signing archive for the deleted account', async () => {
    const { removeSignedTransactionsForAccount, vault } = createVault({
      intent: 'off',
    });

    await vault.deleteLocalPrivacyData({ accountId });

    expect(removeSignedTransactionsForAccount).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId,
    });
  });

  it('purges the shared cache when every other alias is stably off', async () => {
    const { purgeWallet, removeAccountMeta, vault } = createVault({
      intent: 'off',
    });

    await vault.deleteLocalPrivacyData({ accountId });

    expect(purgeWallet).toHaveBeenCalledTimes(1);
    expect(purgeWallet).toHaveBeenCalledWith(expect.objectContaining({ ufvk }));
    expect(removeAccountMeta).toHaveBeenCalledWith({ accountId });
  });
});

describe('Zcash chain-only deletion expiry guard', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const txid = '11'.repeat(32);

  function createVault() {
    const initial: IZcashDB = {
      accounts: {},
      transparentPendingTxs: {
        [accountId]: {
          [txid]: {
            txid,
            rawTx: 'synthetic-transaction',
            ownerId: 'owner',
            spentOutpoints: [],
            expiryHeight: 100,
            createdAt: 1,
            broadcastState: 'unknown',
          },
        },
      },
    };
    let saved: unknown = { data: initial, updatedAt: 1 };
    const zcash = new SimpleDbEntityZcash();
    (zcash as { appStorage: unknown }).appStorage = {
      getItem: jest.fn(async () => saved),
      setItem: jest.fn(async (_key: string, value: unknown) => {
        saved = value;
      }),
    };
    const getDBAccount = jest.fn(async () => ({
      id: accountId,
      address: 'synthetic-address',
      xpub: 'synthetic-xpub',
      path: "m/44'/133'/0'",
    }));
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: '',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash,
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: async () => [],
            getAccountLocalHistoryPendingTxs: async () => [],
          },
        },
        serviceAccount: { getDBAccount },
        serviceCustomRpc: defaultCustomRpcStub,
      },
    });
    return { vault, zcash, getDBAccount };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Expiry cleanup requires a tip beyond expiry and explicit node absence.
  it.each([99, 101])(
    'uses the named account and consensus tip %s to decide expiry',
    async (height) => {
      const { vault, zcash, getDBAccount } = createVault();
      jest.mocked(fetchZcashChainTipDirect).mockResolvedValueOnce(height);
      const backend = jest
        .spyOn(VaultBtc.prototype, 'fetchAccountDetails')
        .mockResolvedValue({
          data: {
            data: {
              address: 'synthetic-transparent-address',
              allUtxoList: [
                {
                  txid: '22'.repeat(32),
                  vout: 0,
                  height: 1,
                  confirmations: height,
                  value: '100000',
                  address: 'synthetic-transparent-address',
                  path: '0/0',
                  globalIndex: 0,
                  txPubkey: '',
                  prevOutPubkey: `76a914${'33'.repeat(20)}88ac`,
                },
              ],
            },
          },
        });
      Object.assign(vault.backgroundApi, {
        serviceSend: {
          getRawTransactions: async () => ({
            ['22'.repeat(32)]: { rawTx: 'raw-transaction' },
          }),
        },
      });
      Object.assign(vault, {
        zcashGetApi: async () => ({
          parseTransparentTransactions: async () => [
            {
              txid: '22'.repeat(32),
              isCoinbase: false,
              outputs: [
                {
                  valueZat: '100000',
                  scriptPubKey: `76a914${'33'.repeat(20)}88ac`,
                },
              ],
            },
          ],
        }),
      });
      const check = vault.zcashAssertNoUnresolvedBroadcast(accountId);
      if (height > 100) {
        await expect(check).resolves.toBeUndefined();
        await expect(
          zcash.listTransparentPendingTxs({ accountId }),
        ).resolves.toEqual([]);
      } else {
        await expect(check).rejects.toMatchObject({
          code: 'UNRESOLVED_PRIVACY_CHAIN_BROADCAST',
        });
      }
      expect(getDBAccount).toHaveBeenCalledWith({ accountId });
      expect(backend).not.toHaveBeenCalled();
    },
  );

  it('expires pending state of an account left without any UTXO', async () => {
    const { vault, zcash } = createVault();
    jest.spyOn(VaultBtc.prototype, 'fetchAccountDetails').mockResolvedValue({
      data: {
        data: { address: 'synthetic-transparent-address', allUtxoList: [] },
      },
    } as unknown as Awaited<ReturnType<VaultBtc['fetchAccountDetails']>>);
    const fetchTip = jest
      .mocked(fetchZcashChainTipDirect)
      .mockResolvedValueOnce(101);

    await expect(
      vault.zcashAssertNoUnresolvedBroadcast(accountId),
    ).resolves.toBeUndefined();
    expect(fetchTip).toHaveBeenCalled();
    await expect(
      zcash.listTransparentPendingTxs({ accountId }),
    ).resolves.toEqual([]);
  });

  it('retains pending state when the indexer cannot establish expiry', async () => {
    const { vault, zcash } = createVault();
    jest
      .spyOn(VaultBtc.prototype, 'fetchAccountDetails')
      .mockRejectedValue(new Error('indexer unavailable'));

    await expect(
      vault.zcashAssertNoUnresolvedBroadcast(accountId),
    ).rejects.toMatchObject({ code: 'UNRESOLVED_PRIVACY_CHAIN_BROADCAST' });
    await expect(
      zcash.listTransparentPendingTxs({ accountId }),
    ).resolves.toHaveLength(1);
  });
});

// Lifecycle operations run through this gate; none may depend on the scanner
// answering. A known unresolved broadcast still blocks.
describe('Zcash unresolved-broadcast gate without the scanner', () => {
  function createVault(pending: string[] | Error) {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            listTransparentPendingTxs: async () => [],
            listShieldedReservations: async () => [],
            getAccountMeta: async () => ({ ufvk: 'uview1' }),
            isPrivacyModeEnabled: async () => true,
          },
        },
      },
      zcashGetWalletAccount: async () => ({}),
      zcashGetApi: async () => ({
        getPendingBroadcasts: async () => {
          if (pending instanceof Error) throw pending;
          return pending;
        },
      }),
    });
  }

  it('passes when the scanner cannot be reached', async () => {
    const vault = createVault(new Error('runtime unavailable'));
    await expect(
      vault.zcashAssertNoUnresolvedBroadcast('acc'),
    ).resolves.toBeUndefined();
  });

  // A corrupt database fails every read; the rebuild that fixes it must not
  // be gated on reading it.
  it('lets a corrupt database be rebuilt', async () => {
    const vault = createVault(new Error('database disk image is malformed'));
    const dropWalletDatabase = jest.fn(async () => undefined);
    Object.assign(vault, {
      listLocalWalletAccounts: async () => ({
        accounts: [{ accountId: 'acc' }],
      }),
      zcashGetApi: async () => ({
        getPendingBroadcasts: async () => {
          throw new OneKeyLocalError('database disk image is malformed');
        },
        dropWalletDatabase,
      }),
    });
    await (
      vault as unknown as { zcashRebuildRuntimeDatabase: () => Promise<void> }
    ).zcashRebuildRuntimeDatabase();
    expect(dropWalletDatabase).toHaveBeenCalled();
  });

  // The broken database cannot release a reservation; one never signed must
  // not keep the rebuild from running.
  it('discards an unsigned reservation instead of blocking the rebuild', async () => {
    const vault = createVault(new Error('database disk image is malformed'));
    const dropWalletDatabase = jest.fn(async () => undefined);
    const journal = new Map([['r1', { state: 'unsigned' as const }]]);
    Object.assign(vault, {
      backgroundApi: {
        simpleDb: {
          zcash: {
            listTransparentPendingTxs: async () => [],
            listShieldedReservations: async () =>
              [...journal].map(([reservationId, r]) => ({
                reservationId,
                ...r,
              })),
            removeShieldedReservation: async ({
              reservationId,
            }: {
              reservationId: string;
            }) => {
              journal.delete(reservationId);
            },
            getAccountMeta: async () => ({ ufvk: 'uview1' }),
            isPrivacyModeEnabled: async () => true,
          },
        },
      },
      listLocalWalletAccounts: async () => ({
        accounts: [{ accountId: 'acc' }],
      }),
      zcashGetApi: async () => ({
        getPendingBroadcasts: async () => {
          throw new OneKeyLocalError('database disk image is malformed');
        },
        releasePczt: async () => {
          throw new OneKeyLocalError('database disk image is malformed');
        },
        dropWalletDatabase,
      }),
    });
    await (
      vault as unknown as { zcashRebuildRuntimeDatabase: () => Promise<void> }
    ).zcashRebuildRuntimeDatabase();
    expect(journal.size).toBe(0);
    expect(dropWalletDatabase).toHaveBeenCalled();
  });

  it('blocks while the scanner reports a pending broadcast', async () => {
    const vault = createVault(['aa'.repeat(32)]);
    await expect(
      vault.zcashAssertNoUnresolvedBroadcast('acc'),
    ).rejects.toMatchObject({ code: 'UNRESOLVED_PRIVACY_CHAIN_BROADCAST' });
  });
});

// ADR 0002: once signed, a failure later in the flow must not free the inputs.
describe('Zcash PCZT failure cleanup', () => {
  function createVault(state: 'unsigned' | 'signed') {
    const zcashReleasePczt = jest.fn(async () => undefined);
    const removeShieldedReservation = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      zcashReleasePczt,
      backgroundApi: {
        simpleDb: {
          zcash: {
            listShieldedReservations: async () => [
              { reservationId: 'r', state },
            ],
            removeShieldedReservation,
          },
        },
      },
    });
    return { vault, zcashReleasePczt, removeShieldedReservation };
  }

  it('releases an unsigned reservation', async () => {
    const { vault, zcashReleasePczt } = createVault('unsigned');
    await vault.zcashAbandonPczt({ accountId: 'a', reservationId: 'r' });
    expect(zcashReleasePczt).toHaveBeenCalled();
  });

  it('keeps a signed reservation', async () => {
    const { vault, zcashReleasePczt, removeShieldedReservation } =
      createVault('signed');
    await vault.zcashAbandonPczt({ accountId: 'a', reservationId: 'r' });
    expect(zcashReleasePczt).not.toHaveBeenCalled();
    expect(removeShieldedReservation).not.toHaveBeenCalled();
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
      ufvk: 'synthetic-rescan-ufvk',
      unifiedAddress: 'synthetic-ua',
      transparentAddress: 'synthetic-transparent',
      seedFingerprintHex: '00',
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
        accounts: { [accountId]: meta },
        pendingRescans: { [accountId]: repair },
      },
      updatedAt: 1,
    };
    const zcash = new SimpleDbEntityZcash();
    (zcash as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      backgroundApi: {
        simpleDb: {
          zcash,
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
      const snapshot = await zcash.getAccountMeta({ accountId });
      observed?.();
      return snapshot;
    });
    const save = jest.spyOn(zcash, 'saveAccountMeta');
    const runtime = jest.spyOn(vault, 'zcashGetApi');
    const release = await getZcashLifecycleMutex(meta.ufvk).acquire();
    const pending = (
      vault as unknown as {
        applyPendingRescan: (params: {
          accountId: string;
          repair: IZcashPendingRescan;
        }) => Promise<void>;
      }
    ).applyPendingRescan({ accountId, repair });
    await readBeforeQueue;
    await zcash.removeAccountMeta({ accountId });
    release();
    await pending;

    expect(save).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
    await expect(zcash.getAccountMeta({ accountId })).resolves.toBeUndefined();
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

it('drops chain data without clearing device-wide privacy preferences', async () => {
  const dropWalletDatabase = jest.fn().mockResolvedValue(undefined);
  const clearZcash = jest.fn().mockResolvedValue(undefined);
  const clearPrivacyChain = jest.fn().mockResolvedValue(undefined);
  const removeScanStartPrompted = jest.fn().mockResolvedValue(undefined);
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    zcashGetApi: async () => ({ dropWalletDatabase }),
    backgroundApi: {
      simpleDb: {
        zcash: {
          listCleanupAccountIds: async () => ['zcash-account'],
          clearRawData: clearZcash,
        },
        privacyChain: {
          clearRawData: clearPrivacyChain,
          removeScanStartPrompted,
        },
      },
    },
  });
  await vault.getLocalWalletCapability().dropLocalData?.();
  expect(dropWalletDatabase).toHaveBeenCalledTimes(1);
  expect(clearZcash).toHaveBeenCalledTimes(1);
  expect(removeScanStartPrompted).toHaveBeenCalledWith({
    accountId: 'zcash-account',
  });
  expect(clearPrivacyChain).not.toHaveBeenCalled();
});
