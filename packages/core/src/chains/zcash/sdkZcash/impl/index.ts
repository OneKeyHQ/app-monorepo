import { runStorageBenchmark } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/storageBenchmarkEntry';
import {
  privacyChainPerfLog,
  summarizeResultSize,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import {
  diagnoseWalletDatabase,
  getKeys,
  getRuntime,
  isLeaseTraceEnabled,
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
  deriveAccount,
  deriveAddressFromUfvk,
  deriveTransparentXpubFromUfvk,
  getChainTip,
  quoteTransparentTx,
  signPczt,
} from './keys';
import { runRuntimeSelfTest } from './runtimeSelfTest';
import {
  broadcastPczt,
  combinePczt,
  createPczt,
  finalizePczt,
  getPendingBroadcasts,
  provePczt,
  quotePczt,
  quoteShieldFunds,
  releasePczt,
  shieldFunds,
} from './send';
import {
  dropWalletDatabase,
  getBalance,
  getHistory,
  getRuntimeVersions,
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
  IZcashSmokeParams,
  IZcashSmokeResult,
  IZcashWalletAccount,
} from '../types/sdk';

// Reports what this carrier can actually do. Every carrier runs the same
// implementation, so a difference here is a carrier problem (assets not
// served, network blocked), never a logic difference.
async function smokeTest(
  params: IZcashSmokeParams,
): Promise<IZcashSmokeResult> {
  const result: IZcashSmokeResult = {
    crossOriginIsolated: !!globalThis.crossOriginIsolated,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    // Kept for contract compatibility. This runtime is single-threaded, so
    // there is no pool to start and no crossOriginIsolated requirement — a
    // real Android device scans fine with it false.
    threadPool: 'not required (single-threaded runtime)',
    walletWasmLoaded: false,
    keysWasmLoaded: false,
    chainTip: null,
    unifiedAddress: null,
    transparentAddress: null,
    syncMs: null,
    fullyScanned: null,
    balances: null,
    historyLength: null,
    pcztSignAvailable: false,
    uskDerived: false,
  };

  try {
    const keys = await getKeys();
    result.keysWasmLoaded = true;
    result.pcztSignAvailable = typeof keys.pcztSignWithSeed === 'function';

    const rt = await getRuntime();
    result.walletWasmLoaded = true;

    result.chainTip = await rt.chainTipAt(params.lightwalletdUrl);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    result.errorStack = e instanceof Error ? (e.stack ?? null) : null;
  }

  return result;
}

// Merging the two halves is a host decision: a payment can only go out if the
// runtime can prove the bundle AND the keys package can sign it. Neither crate
// can answer that alone, so neither of them pretends to.
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

  // Ironwood is required, not optional: after NU6.3 an ordinary payment to a
  // unified address lands in the Ironwood bundle, so "orchard works" is not
  // enough to call spending supported.
  const spend =
    r.prove.ironwood && k.sign.ironwood && r.prove.orchard && k.sign.orchard;
  // Shielding moves transparent UTXOs, which have to be signed as transparent
  // inputs regardless of which shielded pool receives them.
  const shieldTransparent = spend && k.sign.transparent;

  return {
    scan: r.scan,
    balance: r.balance,
    history: r.history,
    spend,
    shieldTransparent,
    // Withdrawing to a transparent address is an ordinary spend with a
    // transparent recipient — it needs the same proving and signing.
    withdrawToTransparent: spend,
    unsupportedReasons: r.notes,
  };
}

// Serializes everything that touches the wallet database.
//
// The runtime keeps one database open and hands it out for the duration of a
// call; two overlapping operations would disagree about which wallet is
// current. Doing this once at assembly is deliberate — wrapping each function
// individually means the next method added quietly misses it.
function leased<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  // The one choke point every wallet operation passes through, so it also
  // feeds the endpoint pool: consecutive NETWORK_ERRORs rotate to the next
  // lightwalletd (carrier.noteNetworkOutcome), any success resets the count.
  return (...args: A) => {
    const queuedAt = Date.now();
    return withWalletLease(async () => {
      const waitedMs = Date.now() - queuedAt;
      const startedAt = Date.now();
      try {
        const result = await fn(...args);
        noteNetworkOutcome(null);
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

async function resetCarrier(): Promise<void> {
  resetCarrierState();
}

async function setPerfTrace({ enabled }: { enabled: boolean }): Promise<void> {
  setLeaseTraceEnabled(enabled);
}

// Reads never wait for a scan.
//
// A scan pass holds the lease for seconds normally and for MINUTES inside the
// 2022 spam wall, and the scheduler retakes it 500ms later -- so a balance or
// history poll queued behind it simply never resolved, and the UI spun for as
// long as the backfill lasted. But these three are pure local SQLite reads
// exposed as SYNCHRONOUS wasm calls, so when the database they need is
// already open they can run in a gap between the scan's own await points and
// complete atomically (JS is single-threaded, and the scan's writes are
// likewise synchronous, so every gap sees committed state).
//
// tryReadOnlyHandle returns null whenever an await would be required (module
// still loading, another network's database open, account not registered
// yet); those cases fall back to the leased path, which is brief and correct.
function readOnlyOrLeased<T>(
  opName: string,
  account: IZcashWalletAccount,
  read: (handle: NonNullable<ReturnType<typeof tryReadOnlyHandle>>) => T,
  leasedFallback: (account: IZcashWalletAccount) => Promise<T>,
): Promise<T> {
  const handle = tryReadOnlyHandle(account);
  if (!handle && isLeaseTraceEnabled()) {
    // The one line that explains a slow-feeling read: which of the four
    // reasons sent it to the queue. 'db-busy' means the scan owns the
    // database, which is the only reason that repeats on every reopen.
    console.log('[zcash:read] fast path missed', {
      op: opName,
      reason: takeReadFastPathMiss(),
    });
  }
  if (handle) {
    try {
      const startedAt = Date.now();
      const result = read(handle);
      privacyChainPerfLog(`carrier read ${opName}`, {
        ms: Date.now() - startedAt,
        ...summarizeResultSize(result),
      });
      return Promise.resolve(result);
    } catch (e) {
      // A read that throws against a healthy handle is a real failure, but it
      // must not poison the endpoint/deterministic-failure counters the way a
      // leased operation would -- those track the scan's network health.
      return Promise.reject(e);
    }
  }
  return leasedFallback(account);
}

const leasedGetSyncProgress = leased(getSyncProgress);
const leasedGetBalance = leased(getBalance);
const leasedGetHistory = leased(getHistory);

const api: IZcashSdkApi = {
  // Not leased: these answer from the keys package, the network, or a constant,
  // and never open a wallet. Putting them behind the lease would make a chain
  // tip lookup wait out an entire sync for no reason.
  // `resetCarrier` MUST stay outside the lease: it must recover a stuck lease.
  resetCarrier,
  setPerfTrace,
  capabilities,
  smokeTest,
  runRuntimeSelfTest,
  getChainTip,
  getRuntimeVersions,
  deriveAccount,
  deriveAddressFromUfvk,
  signPczt,
  deriveTransparentXpubFromUfvk,
  // Stateless PCZT merge: only the wasm module, no wallet database.
  combinePczt,
  quoteTransparentTx,
  buildTransparentTxWithSeed,
  buildTransparentTxWithAccountXprv,

  // Leased: every one of these opens or uses the wallet database.
  prepareWalletAccounts: leased(prepareWalletAccounts),
  syncWallet: leased(syncWallet),
  queueRescanFrom: leased(queueRescanFrom),
  // Lock-free when the wallet database is already open -- see
  // readOnlyOrLeased above. These are the three surfaces a user stares at.
  getSyncProgress: (account) =>
    readOnlyOrLeased(
      'getSyncProgress',
      account,
      ({ rt, accountUuid }) => readSyncProgress(rt, accountUuid, account),
      leasedGetSyncProgress,
    ),
  diagnoseWalletDatabase: leased(diagnoseWalletDatabase),
  // Isolated synthetic databases in dedicated short-lived Workers. This must
  // not wait behind a wallet scan because it never touches the wallet VFS.
  runStorageBenchmark,
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
    ),
  getTxDetails: leased(getTxDetails),
  getPendingBroadcasts: leased(getPendingBroadcasts),
  createPczt: leased(createPczt),
  finalizePczt: leased(finalizePczt),
  broadcastPczt: leased(broadcastPczt),
  shieldFunds: leased(shieldFunds),
  quotePczt: leased(quotePczt),
  quoteShieldFunds: leased(quoteShieldFunds),
  provePczt: leased(provePczt),
  releasePczt: leased(releasePczt),
  purgeWallet: leased(purgeWallet),
  dropWalletDatabase: leased(dropWalletDatabase),
};

export default {
  getZcashApi: async (): Promise<IZcashSdkApi> => api,
};

export { storageRequiresWorkerRestart } from './carrier';
