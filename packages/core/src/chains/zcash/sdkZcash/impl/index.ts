import {
  privacyChainPerfLog,
  summarizeResultSize,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import {
  diagnoseWalletDatabase,
  getKeys,
  getRuntime,
  isLeaseTraceEnabled,
  isWalletLeaseBusy,
  noteNetworkOutcome,
  resetCarrierState,
  setLeaseTraceEnabled,
  takeReadFastPathMiss,
  tryReadOnlyHandle,
  withWalletLease,
} from './carrier';
import {
  buildTransparentTxWithAccountXprv,
  buildTransparentTxWithSeed,
  createTransparentHardwarePczt,
  deriveAccount,
  deriveAddressFromUfvk,
  deriveTransparentXpubFromUfvk,
  finalizeTransparentHardwarePczt,
  getChainTip,
  parseTransparentTransactions,
  quoteTransparentTx,
  redactPcztForHardwareSigner,
  signPczt,
  validateAddress,
  verifyPcztReview,
} from './keys';
import { runRuntimeSelfTest } from './runtimeSelfTest';
import {
  combinePczt,
  createPczt,
  getPendingBroadcasts,
  prewarmPczt,
  provePczt,
  quotePczt,
  releasePczt,
  submitPczt,
} from './send';
import {
  dropWalletDatabase,
  getBalance,
  getEndpointHealth,
  getHistory,
  getSyncProgress,
  getTxDetails,
  prepareWalletAccounts,
  purgeWallet,
  queueRescanFrom,
  readBalance,
  readHistory,
  readSyncProgress,
  syncWallet,
} from './wallet';

import type {
  IZcashCapabilities,
  IZcashSdkApi,
  IZcashWalletAccount,
} from '../types/sdk';

// A payment can only go out if the runtime can prove the bundle AND the keys package can sign it; neither crate can answer that alone.
async function capabilities(): Promise<IZcashCapabilities> {
  const rt = await getRuntime();
  const keys = await getKeys();
  const r = JSON.parse(rt.capabilities()) as {
    prove: { orchard: boolean; sapling: boolean; ironwood: boolean };
    scan: boolean;
    balance: boolean;
    history: boolean;
    notes: Record<string, string>;
  };
  const k = JSON.parse(keys.keysCapabilities()) as {
    sign: {
      orchard: boolean;
      sapling: boolean;
      transparent: boolean;
      ironwood: boolean;
    };
  };

  // Ironwood is required, not optional: after NU6.3 an ordinary payment to a unified address lands
  // in the Ironwood bundle, so "orchard works" alone is not enough to call spending supported.
  const spend =
    r.prove.ironwood && k.sign.ironwood && r.prove.orchard && k.sign.orchard;
  // Shielding moves transparent UTXOs, which must be signed as transparent inputs regardless of the destination shielded pool.
  const shieldTransparent = spend && k.sign.transparent;

  return {
    scan: r.scan,
    balance: r.balance,
    history: r.history,
    spend,
    shieldTransparent,
    // Withdrawing to a transparent address is an ordinary spend with a transparent recipient — needs the same proving and signing.
    withdrawToTransparent: spend,
    unsupportedReasons: r.notes,
  };
}

// Serializes everything touching the wallet database: the runtime holds one open at a time, so
// overlapping ops would disagree on which wallet is current. Wrapped once here, not per function, so a new method can't quietly miss it.
function leased<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  // Escaping failures are counted once here; only operations with real network work report success — local reads must not reset endpoint failures.
  return (...args: A) => {
    const queuedAt = Date.now();
    return withWalletLease(async () => {
      const waitedMs = Date.now() - queuedAt;
      const startedAt = Date.now();
      try {
        const result = await fn(...args);
        privacyChainPerfLog(`carrier leased ${fn.name}`, {
          waitedMs,
          ranMs: Date.now() - startedAt,
          ...summarizeResultSize(result),
        });
        return result;
      } catch (e) {
        noteNetworkOutcome(e);
        privacyChainPerfLog(`carrier leased ${fn.name} failed`, {
          waitedMs,
          ranMs: Date.now() - startedAt,
        });
        throw e;
      }
    });
  };
}

// Last result of each fast-path read, per account and op; Worker memory only, so a restart pays one queued read per op.
const lastReadResults = new Map<string, unknown>();

async function resetCarrier(): Promise<void> {
  lastReadResults.clear();
  resetCarrierState();
}

async function setPerfTrace({ enabled }: { enabled: boolean }): Promise<void> {
  setLeaseTraceEnabled(enabled);
}

// Reads never wait for a scan: these are synchronous local SQLite calls that can run atomically in
// a gap between the scan's own await points, because JS is single-threaded and the scan's writes are likewise synchronous.
function lastReadKey(
  opName: string,
  account: IZcashWalletAccount,
  variant: string,
): string {
  // No viewing key in the key: fingerprint + index identify the account.
  return [
    opName,
    account.network,
    account.seedFingerprintHex,
    account.hdIndex,
    variant,
  ].join('|');
}

function readOnlyOrLeased<T>(
  opName: string,
  account: IZcashWalletAccount,
  read: (handle: NonNullable<ReturnType<typeof tryReadOnlyHandle>>) => T,
  leasedFallback: (account: IZcashWalletAccount) => Promise<T>,
  variant = '',
): Promise<T> {
  const cacheKey = lastReadKey(opName, account, variant);
  const handle = tryReadOnlyHandle(account);
  if (!handle && isLeaseTraceEnabled()) {
    // Explains why this read felt slow: 'db-busy' (scan owns the database) is the only reason that repeats on every reopen.
    console.log('[zcash:read] fast path missed', {
      op: opName,
      reason: takeReadFastPathMiss(),
    });
  }
  if (handle) {
    try {
      const startedAt = Date.now();
      const result = read(handle);
      lastReadResults.set(cacheKey, result);
      privacyChainPerfLog(`carrier read ${opName}`, {
        ms: Date.now() - startedAt,
        ...summarizeResultSize(result),
      });
      return Promise.resolve(result);
    } catch (e) {
      // A throw against a healthy handle is a real failure, but must not poison the endpoint-health counters the way a leased operation would.
      return Promise.reject(e);
    }
  }
  // No fast path (usually a scan owns the DB across an await); answer from the last result rather
  // than wait out the whole pass. The next read after the pass returns the fresh one.
  if (isWalletLeaseBusy() && lastReadResults.has(cacheKey)) {
    privacyChainPerfLog(`carrier stale ${opName}`, {});
    return Promise.resolve(lastReadResults.get(cacheKey) as T);
  }
  return leasedFallback(account).then((result) => {
    lastReadResults.set(cacheKey, result);
    return result;
  });
}

// A remembered read describes data as it was; after a purge/drop it would show a wiped wallet as
// fully synced, so it's forgotten together with the data (null = every account).
function forgetLastReads(
  account: IZcashWalletAccount | null,
  opNames?: string[],
): void {
  for (const key of lastReadResults.keys()) {
    const [opName, network, seedFingerprintHex, hdIndex] = key.split('|');
    const otherOp = opNames !== undefined && !opNames.includes(opName);
    const otherAccount =
      account !== null &&
      (network !== account.network ||
        seedFingerprintHex !== account.seedFingerprintHex ||
        hdIndex !== String(account.hdIndex));
    if (!otherOp && !otherAccount) {
      lastReadResults.delete(key);
    }
  }
}

const leasedPurgeWallet = leased(purgeWallet);
const leasedDropWalletDatabase = leased(dropWalletDatabase);
const leasedQueueRescanFrom = leased(queueRescanFrom);

const leasedGetSyncProgress = leased(getSyncProgress);
const leasedGetBalance = leased(getBalance);
const leasedGetHistory = leased(getHistory);

const api: IZcashSdkApi = {
  // Not leased: these never open a wallet, so putting them behind the lease would block a cheap read behind an entire sync.
  // `resetCarrier` MUST stay outside the lease — it exists to recover a stuck one.
  resetCarrier,
  setPerfTrace,
  capabilities,
  runRuntimeSelfTest,
  getChainTip,
  deriveAccount,
  deriveAddressFromUfvk,
  signPczt,
  verifyPcztReview,
  validateAddress,
  deriveTransparentXpubFromUfvk,
  // Stateless PCZT merge: only the wasm module, no wallet database.
  combinePczt,
  // Public circuit parameters only; no wallet or spending-key access.
  prewarmPczt,
  parseTransparentTransactions,
  quoteTransparentTx,
  buildTransparentTxWithSeed,
  buildTransparentTxWithAccountXprv,

  createTransparentHardwarePczt,
  finalizeTransparentHardwarePczt,
  redactPcztForHardwareSigner,

  // Leased: every one of these opens or uses the wallet database.
  prepareWalletAccounts: leased(prepareWalletAccounts),
  syncWallet: leased(syncWallet),
  queueRescanFrom: async (account, params) => {
    const queued = await leasedQueueRescanFrom(account, params);
    forgetLastReads(account, ['getSyncProgress']);
    return queued;
  },
  getEndpointHealth,
  // Lock-free when the wallet database is already open (see readOnlyOrLeased above); these are the three surfaces a user stares at.
  getSyncProgress: (account) =>
    readOnlyOrLeased(
      'getSyncProgress',
      account,
      ({ rt, accountUuid }) => readSyncProgress(rt, accountUuid, account),
      leasedGetSyncProgress,
    ),
  diagnoseWalletDatabase: leased(diagnoseWalletDatabase),
  getBalance: (account) =>
    readOnlyOrLeased(
      'getBalance',
      account,
      ({ rt, accountUuid }) => readBalance(rt, accountUuid),
      leasedGetBalance,
    ),
  getHistory: (account, pagination) =>
    readOnlyOrLeased(
      'getHistory',
      account,
      ({ rt, accountUuid }) => readHistory(rt, accountUuid, pagination),
      (a) => leasedGetHistory(a, pagination),
      JSON.stringify(pagination ?? {}),
    ),
  getTxDetails: leased(getTxDetails),
  getPendingBroadcasts: leased(getPendingBroadcasts),
  createPczt: leased(createPczt),
  submitPczt: leased(submitPczt),
  quotePczt: leased(quotePczt),
  provePczt: leased(provePczt),
  releasePczt: leased(releasePczt),
  purgeWallet: async (account, options) => {
    await leasedPurgeWallet(account, options);
    forgetLastReads(account);
  },
  dropWalletDatabase: async (network) => {
    await leasedDropWalletDatabase(network);
    forgetLastReads(null);
  },
};

export default {
  getZcashApi: async (): Promise<IZcashSdkApi> => api,
};

export { installZcashHostFetch, storageRequiresWorkerRestart } from './carrier';
