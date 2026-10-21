import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import { SimpleDbEntityPrivacyChainKeys } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { getViewingKeyFingerprint } from '../vaults/localWallet/viewingKeyFingerprint';

import type { ILocalWalletRetainedIdentity } from '../vaults/localWallet/types';

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
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: jest.fn() },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = InstanceType<typeof ServicePrivacyChain>;

const networkId = 'xmr--0';
const liveAccountId = 'hd-1--0';
// Locked passphrase wallets are hidden from getWallets() but stay on disk.
const hiddenAccountId = 'hd-2--0';
const deletedAccountId = 'hd-3--0';

function vkFpOf(accountId: string) {
  return getViewingKeyFingerprint({
    networkId,
    viewingKey: `key-${accountId}`,
  });
}

function createKeysDb(accountIds: string[]) {
  let saved: unknown = {
    data: {
      keys: Object.fromEntries(
        accountIds.map((id) => [
          id,
          {
            networkId,
            vkFp: vkFpOf(id),
            sealed: { format: 'plain', value: `key-${id}` },
          },
        ]),
      ),
    },
    updatedAt: 1,
  };
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function accountRow(id: string) {
  return { id, indexedAccountId: `${id}--indexed` };
}

// The runtime side: identities named by vkFp, purged as the XMR capability
// does (everything not retained goes).
function createHarness({
  keyAccountIds = [liveAccountId, hiddenAccountId, deletedAccountId],
}: { keyAccountIds?: string[] } = {}) {
  let identities = [liveAccountId, hiddenAccountId, deletedAccountId].map(
    vkFpOf,
  );
  const purgeRuntimeOrphans = jest.fn(
    async ({ retained }: { retained: ILocalWalletRetainedIdentity[] }) => {
      const keep = new Set(retained.map(({ vkFp }) => vkFp));
      identities = identities.filter((uuid) => keep.has(uuid));
      return true;
    },
  );
  const listScanDataAccountIds = jest.fn(
    async (): Promise<string[] | undefined> => [
      liveAccountId,
      hiddenAccountId,
      deletedAccountId,
    ],
  );
  const capability = {
    listScanDataAccountIds,
    purgeRuntimeOrphans,
    syncPolicy: { maxSyncDurationMs: 60_000 },
  };
  const getAllAccounts = jest.fn(async () => ({
    accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
  }));
  const clearRuntimeOrphans = jest.fn(async () => undefined);
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    {
      enableMutexByNetwork: new Map<string, Mutex>(),
      quarantinedSyncs: new Map<string, Promise<unknown>>(),
      orphanCleanupGeneration: new Map<string, number>(),
      orphanCleanupDoneGeneration: new Map<string, number>(),
      backgroundApi: {
        serviceAccount: {
          getAllAccounts,
          getAllIndexedAccounts: jest.fn(async () => ({
            indexedAccounts: [liveAccountId, hiddenAccountId].map((id) => ({
              id: accountRow(id).indexedAccountId,
            })),
          })),
        },
        simpleDb: {
          privacyChainKeys: createKeysDb(keyAccountIds),
          privacyChainState: { clearRuntimeOrphans },
        },
      },
    },
  );
  const pass = () =>
    service.purgeLocalWalletRuntimeOrphans({
      networkId,
      capability: capability as never,
    });
  const runIfDue = () =>
    (
      service as unknown as {
        runLocalWalletOrphanCleanupIfDue: (p: unknown) => Promise<void>;
      }
    ).runLocalWalletOrphanCleanupIfDue({ networkId, capability });
  return {
    service,
    capability,
    purgeRuntimeOrphans,
    listScanDataAccountIds,
    getAllAccounts,
    clearRuntimeOrphans,
    identities: () => identities,
    pass,
    runIfDue,
  };
}

// The real environment is unmasked; masking it also masks every entity read.
function maskPersistence() {
  return jest
    .spyOn(travelModeManager, 'getRuntimeEnvironment')
    .mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
}

beforeEach(() => {
  jest.spyOn(resetUtils, 'getIsResetting').mockReturnValue(false);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('privacy chain runtime orphan cleanup', () => {
  it("keeps live accounts' identities, hidden ones included, and purges a deleted account's", async () => {
    const { pass, purgeRuntimeOrphans, identities } = createHarness();

    await expect(pass()).resolves.toBe(true);

    expect(purgeRuntimeOrphans).toHaveBeenCalledWith({
      retained: [liveAccountId, hiddenAccountId].map((accountId) => ({
        accountId,
        vkFp: vkFpOf(accountId),
        viewingKey: `key-${accountId}`,
      })),
    });
    expect(identities()).toEqual([
      vkFpOf(liveAccountId),
      vkFpOf(hiddenAccountId),
    ]);
  });

  it('skips the pass when the state read returned nothing (null)', async () => {
    const { pass, purgeRuntimeOrphans, listScanDataAccountIds } =
      createHarness();
    listScanDataAccountIds.mockResolvedValueOnce(undefined);
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass when the state read failed', async () => {
    const { pass, purgeRuntimeOrphans, listScanDataAccountIds } =
      createHarness();
    listScanDataAccountIds.mockRejectedValueOnce(
      new OneKeyLocalError('simpledb: invalid persisted data (xmr)'),
    );
    await expect(pass()).rejects.toThrow('invalid persisted data');
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass while Travel Mode masks persistence', async () => {
    const { pass, purgeRuntimeOrphans, listScanDataAccountIds } =
      createHarness();
    maskPersistence();
    await expect(pass()).resolves.toBe(false);
    expect(listScanDataAccountIds).not.toHaveBeenCalled();
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass when the account enumeration fails', async () => {
    const { pass, purgeRuntimeOrphans, getAllAccounts } = createHarness();
    getAllAccounts.mockRejectedValueOnce(
      new OneKeyLocalError('database is locked'),
    );
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it("skips the pass when a kept account's key is not resolved", async () => {
    const { pass, purgeRuntimeOrphans, identities } = createHarness({
      keyAccountIds: [liveAccountId, deletedAccountId],
    });
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
    expect(identities()).toHaveLength(3);
  });

  it('needs no key for an account that is already gone', async () => {
    const { pass, purgeRuntimeOrphans } = createHarness({
      keyAccountIds: [liveAccountId, hiddenAccountId],
    });
    await expect(pass()).resolves.toBe(true);
    expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(1);
  });

  it('skips the pass while an enable holds the network', async () => {
    const { service, pass, purgeRuntimeOrphans } = createHarness();
    const mutex = new Mutex();
    service.enableMutexByNetwork.set(networkId, mutex);
    const release = await mutex.acquire();
    try {
      await expect(pass()).resolves.toBe(false);
    } finally {
      release();
    }
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('holds the enable lock for the whole pass', async () => {
    const { service, pass, purgeRuntimeOrphans } = createHarness();
    let lockedDuringPurge = false;
    purgeRuntimeOrphans.mockImplementationOnce(async () => {
      lockedDuringPurge = !!service.enableMutexByNetwork
        .get(networkId)
        ?.isLocked();
      return true;
    });
    await pass();
    expect(lockedDuringPurge).toBe(true);
  });

  it('skips the pass during App Reset', async () => {
    const { pass, purgeRuntimeOrphans } = createHarness();
    jest.spyOn(resetUtils, 'getIsResetting').mockReturnValue(true);
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass while a failed reset wipe is being retried', async () => {
    const { service, pass, purgeRuntimeOrphans } = createHarness();
    service.pendingLocalDataDropRetry = new Promise(() => undefined);
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass while a timed-out turn may still write', async () => {
    const { service, pass, purgeRuntimeOrphans } = createHarness();
    service.quarantinedSyncs.set(
      `${networkId}|xmr-mainnet`,
      new Promise(() => undefined),
    );
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });

  it('skips the pass when Reset starts while keys are read', async () => {
    const { pass, purgeRuntimeOrphans, listScanDataAccountIds } =
      createHarness();
    const resetting = jest.spyOn(resetUtils, 'getIsResetting');
    listScanDataAccountIds.mockImplementationOnce(async () => {
      resetting.mockReturnValue(true);
      return [liveAccountId];
    });
    await expect(pass()).resolves.toBe(false);
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();
  });
});

describe('privacy chain runtime orphan cleanup schedule', () => {
  it('runs once after startup, then only after the account set changes', async () => {
    const { service, runIfDue, purgeRuntimeOrphans } = createHarness();

    await runIfDue();
    await runIfDue();
    expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(1);

    service.markLocalWalletOrphanCleanupDue(networkId);
    await runIfDue();
    await runIfDue();
    expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(2);
  });

  it('stays due after a skipped pass', async () => {
    const { runIfDue, purgeRuntimeOrphans } = createHarness();
    const masked = maskPersistence();
    await runIfDue();
    expect(purgeRuntimeOrphans).not.toHaveBeenCalled();

    masked.mockRestore();
    await runIfDue();
    expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(1);
  });

  it('stays due when the account set changes during a pass', async () => {
    const { service, runIfDue, purgeRuntimeOrphans } = createHarness();
    purgeRuntimeOrphans.mockImplementationOnce(async () => {
      service.markLocalWalletOrphanCleanupDue(networkId);
      return true;
    });
    await runIfDue();
    await runIfDue();
    expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(2);
  });

  // A network marked as holding unnamed runtime accounts reads as holding
  // data for App Reset until a full purge has run.
  it('clears the orphan marker only after a full purge', async () => {
    const { pass, purgeRuntimeOrphans, clearRuntimeOrphans } = createHarness();
    purgeRuntimeOrphans.mockResolvedValueOnce(false);
    await expect(pass()).resolves.toBe(false);
    expect(clearRuntimeOrphans).not.toHaveBeenCalled();

    await expect(pass()).resolves.toBe(true);
    expect(clearRuntimeOrphans).toHaveBeenCalledWith({ networkId });
  });

  it('leaves the marker when a pass is skipped', async () => {
    const { pass, listScanDataAccountIds, clearRuntimeOrphans } =
      createHarness();
    listScanDataAccountIds.mockResolvedValueOnce(undefined);
    await expect(pass()).resolves.toBe(false);
    expect(clearRuntimeOrphans).not.toHaveBeenCalled();
  });

  // Bounded well inside the turn, whatever the chain's own watchdog is.
  it('gives up after 30 s and stays due', async () => {
    jest.useFakeTimers();
    try {
      const { runIfDue, purgeRuntimeOrphans, capability } = createHarness();
      capability.syncPolicy.maxSyncDurationMs = 5 * 60_000;
      let finishStuck: (ran: boolean) => void = () => undefined;
      purgeRuntimeOrphans.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            finishStuck = resolve;
          }),
      );
      const first = runIfDue();
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(first).resolves.toBeUndefined();

      // The abandoned pass still holds the enable lock until it settles.
      finishStuck(true);
      await jest.advanceTimersByTimeAsync(0);
      await runIfDue();
      expect(purgeRuntimeOrphans).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never fails the scan turn', async () => {
    const { runIfDue, listScanDataAccountIds } = createHarness();
    listScanDataAccountIds.mockRejectedValueOnce(new Error('unreadable'));
    await expect(runIfDue()).resolves.toBeUndefined();
  });
});
