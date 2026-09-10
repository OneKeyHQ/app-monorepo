import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrivacyChainPerfLogEnabled } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import { ZCASH_LIGHTWALLETD_MAINNET_FALLBACKS } from '../constants';
import { isZcashRuntimeError, readZcashRuntimeError } from '../runtimeError';

import { wrapKeysModuleWithStackCleanup } from './keysMemory';

import type {
  IZcashDatabaseDiagnostics,
  IZcashNetwork,
  IZcashWalletAccount,
} from '../types/sdk';

// The runtime is a low-level utility: one wallet database open at a time,
// bounded scan steps, no scheduling of its own. Everything above that — which
// account maps to which database, when to scan, how far — lives here.

type IRuntimeModule = typeof import('onekey-zcash-runtime');
type IKeysModule = typeof import('onekey-zcash-keys');

let runtimeWasmPromise: Promise<IRuntimeModule> | undefined;
let runtimePromise: Promise<IRuntimeModule> | undefined;
let keysPromise: Promise<IKeysModule> | undefined;

export function walletDbNameForNetwork(network: IZcashNetwork): string {
  return `zcash-${network}.db`;
}

export function walletDbName(account: IZcashWalletAccount): string {
  return walletDbNameForNetwork(account.network);
}

// Which database the runtime currently has open, so we only pay the reopen
// cost when the caller actually switches accounts.
let openDbName: string | undefined;

// One operation at a time, for the whole operation.
//
// The runtime holds a single wallet database and hands it out for the duration
// of a call. Opening a different wallet while another call is mid-flight would
// leave the two disagreeing about which database is current — the runtime now
// refuses that outright (WALLET_BUSY), but refusing is a last line of defense,
// not a design. Serializing here means callers never hit it.
//
// The lease has to cover the *whole* public operation, not just the open: a
// sync is syncPrepare followed by many syncStep calls, and another account
// switching in between them would corrupt the very thing being measured.
let lease: Promise<unknown> = Promise.resolve();
// Running + queued lease operations. Lets read-only surfaces (sync progress)
// answer from a snapshot instead of queueing behind a minutes-long scan.
let leasePendingCount = 0;

// Set from the host to trace why a read was slow. Off by default: during a
// boost these fire several times a second, which is exactly the volume that
// makes a console-attached page crawl.
let leaseTraceEnabled = false;

// Why the last read could not take the lock-free path. Three very different
// causes collapse into one `return null` below, and telling them apart is the
// difference between "still warming up" and "the scan owns the database".
export type IZcashReadFastPathMiss =
  | 'runtime-not-loaded'
  | 'wrong-db-open'
  | 'db-busy'
  | 'account-not-registered';

let lastReadFastPathMiss: IZcashReadFastPathMiss | undefined;

export function takeReadFastPathMiss(): IZcashReadFastPathMiss | undefined {
  const miss = lastReadFastPathMiss;
  lastReadFastPathMiss = undefined;
  return miss;
}

export function setLeaseTraceEnabled(enabled: boolean): void {
  leaseTraceEnabled = enabled;
}

// One switch for every zcash performance trace, so turning it on gives the
// whole picture and turning it off leaves nothing behind.
export function isLeaseTraceEnabled(): boolean {
  return leaseTraceEnabled;
}

export function withWalletLease<T>(operation: () => Promise<T>): Promise<T> {
  leasePendingCount += 1;
  const guardedOperation = () => {
    if (storageRequiresWorkerRestart()) {
      throw new OneKeyLocalError('zcash worker: storage failed');
    }
    return operation();
  };
  // The number that matters is how long this waited for the lane, not how long
  // the operation itself took: a read that "feels slow" is usually a fast read
  // queued behind a scan pass.
  const queuedAt = Date.now();
  const queueDepth = leasePendingCount;
  const traced = leaseTraceEnabled
    ? async () => {
        const waitedMs = Date.now() - queuedAt;
        const startedAt = Date.now();
        try {
          return await guardedOperation();
        } finally {
          console.log('[zcash:lease] ran', {
            waitedMs,
            ranMs: Date.now() - startedAt,
            queueDepthAtRequest: queueDepth,
          });
        }
      }
    : guardedOperation;
  const run = lease.then(traced, traced);
  // Keep the chain alive regardless of outcome: a rejected operation must not
  // wedge every later one.
  lease = run.then(
    () => undefined,
    () => undefined,
  );
  run.then(
    () => {
      leasePendingCount -= 1;
    },
    () => {
      leasePendingCount -= 1;
    },
  );
  return run;
}

// The resolved module, kept SYNCHRONOUSLY reachable. `runtimePromise` can only
// be consumed with an await, and an await is exactly what the read fast path
// below cannot afford: awaiting yields to the event loop, which is where the
// scan is waiting to take the lease back.
let loadedRuntime: IRuntimeModule | undefined;

export function storageRequiresWorkerRestart(): boolean {
  return loadedRuntime?.storageRequiresWorkerRestart() ?? false;
}

export async function getRuntimeWasm(): Promise<IRuntimeModule> {
  if (!runtimeWasmPromise) {
    runtimeWasmPromise = (async () => {
      const mod = await import(
        /* webpackMode: "eager" */ 'onekey-zcash-runtime'
      );
      await mod.default();
      return mod;
    })().catch((error) => {
      runtimeWasmPromise = undefined;
      throw error;
    });
  }
  return runtimeWasmPromise;
}

export async function getRuntime(): Promise<IRuntimeModule> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const mod = await getRuntimeWasm();
      // Installs the shared OPFS VFS. Idempotent, but it must complete
      // before any openWallet call or SQLite falls back to memory and the
      // wallet silently stops persisting.
      await mod.init();
      // Temporary: mirror the host-side [PRIV-PERF] trace inside wasm.
      if (isPrivacyChainPerfLogEnabled()) {
        (mod as { setPerfTrace?: (enabled: boolean) => void }).setPerfTrace?.(
          true,
        );
      }
      loadedRuntime = mod;
      return mod;
    })().catch((e) => {
      // Never cache a failed load: a transient failure (carrier still warming
      // up, asset not served yet) would otherwise poison every later call.
      runtimePromise = undefined;
      throw e;
    });
  }
  return runtimePromise;
}

// Lock-free handle for READ-ONLY wallet queries.
//
// The lease serializes whole ASYNC operations, because those interleave: a
// sync is syncPrepare plus many syncStep calls, and a database switch between
// them would corrupt what is being measured. A read has none of that shape.
// `accountBalance` / `transactionHistory` / `syncProgress` are SYNCHRONOUS
// wasm exports, and JavaScript is single-threaded, so such a call cannot be
// interleaved with anything: it slots into a gap between the scan's own await
// points and completes atomically. The scan's writes are equally synchronous
// (`scan_blocks_inline` is a plain fn), so at every one of those gaps the
// database is in a committed, consistent state.
//
// Making reads wait for the lease therefore bought nothing and cost
// everything: a backfill pass holds it for minutes (~150s inside the 2022
// spam wall) and the scheduler retakes it 500ms later, so a balance poll
// queued behind it simply never resolved and the UI spun forever.
//
// Returns null when any step would need an await -- module not loaded yet,
// a different network's database is open, or this account is not registered.
// Those callers fall back to the leased path, which is where the awaits and
// the mutation belong.
export function tryReadOnlyHandle(account: IZcashWalletAccount): {
  rt: IRuntimeModule;
  accountUuid: string;
} | null {
  if (storageRequiresWorkerRestart()) {
    throw new OneKeyLocalError('zcash worker: storage failed');
  }
  const rt = loadedRuntime;
  if (!rt) {
    lastReadFastPathMiss = 'runtime-not-loaded';
    return null;
  }
  if (openDbName !== walletDbName(account)) {
    lastReadFastPathMiss = 'wrong-db-open';
    return null;
  }
  // Deliberately does NOT call setLightwalletdUrl: a read never touches the
  // network, and rewriting that shared setting mid-scan would change where
  // the scan downloads from.
  try {
    const existing = JSON.parse(rt.accountByUfvk(account.ufvk)) as {
      uuid: string;
    } | null;
    if (!existing) {
      lastReadFastPathMiss = 'account-not-registered';
      return null;
    }
    return { rt, accountUuid: existing.uuid };
  } catch {
    lastReadFastPathMiss = 'db-busy';
    // An async runtime operation temporarily owns the DB across its await.
    // Let the caller join the lease instead of turning normal scan activity
    // into a WALLET_NOT_OPEN error in the UI.
    return null;
  }
}

export async function getKeys(): Promise<IKeysModule> {
  if (!keysPromise) {
    keysPromise = (async () => {
      const mod = await import(/* webpackMode: "eager" */ 'onekey-zcash-keys');
      const instance = await mod.default();
      return wrapKeysModuleWithStackCleanup(mod, instance);
    })().catch((e) => {
      keysPromise = undefined;
      throw e;
    });
  }
  return keysPromise;
}

// One database per network (D14). Every account the user has — across every
// wallet and every mnemonic — registers into the same database, because
// scanning is a single pass that trial-decrypts for all registered keys at
// once. Partitioning it would make each block be downloaded and decrypted once
// per partition, every day.
//
// Networks cannot be merged: the database carries consensus parameters.
//
// Mixing seeds is safe because note selection is account-scoped in SQL and the
// database holds viewing keys only — spending keys never enter the runtime.
// See D14 for the full evidence.
function getDatabaseLocation(): IZcashDatabaseDiagnostics['location'] {
  const origin = globalThis.location?.origin || null;
  if (platformEnv.isDesktop) {
    return {
      carrier: 'desktop-sdk-runtime',
      origin,
      description:
        'Dedicated Worker / Electron profile OPFS (.onekey-zcash-opfs)',
      exactPhysicalPathAvailable: false,
    };
  }
  if (platformEnv.isExtension) {
    return {
      carrier: platformEnv.isExtensionOffscreen
        ? 'extension-offscreen'
        : 'extension-background',
      origin,
      description: platformEnv.isExtensionOffscreen
        ? 'Dedicated Worker / extension offscreen-origin OPFS (.onekey-zcash-opfs)'
        : 'Dedicated Worker / extension background-origin OPFS (.onekey-zcash-opfs)',
      exactPhysicalPathAvailable: false,
    };
  }
  if (platformEnv.isWebEmbed) {
    return {
      carrier: 'mobile-webembed',
      origin,
      description:
        'Dedicated Worker / WebView profile OPFS (.onekey-zcash-opfs)',
      exactPhysicalPathAvailable: false,
    };
  }
  if (platformEnv.isWeb) {
    return {
      carrier: 'web-page',
      origin,
      description: 'Dedicated Worker / page-origin OPFS (.onekey-zcash-opfs)',
      exactPhysicalPathAvailable: false,
    };
  }
  return {
    carrier: 'unknown-web-runtime',
    origin,
    description: 'Dedicated Worker / origin-scoped OPFS (.onekey-zcash-opfs)',
    exactPhysicalPathAvailable: false,
  };
}

async function getBrowserStorageDiagnostics(): Promise<
  IZcashDatabaseDiagnostics['browserStorage']
> {
  const storage = globalThis.navigator?.storage;
  let persisted: boolean | null = null;
  let originUsageBytes: number | null = null;
  let originQuotaBytes: number | null = null;
  let estimateError: string | null = null;
  try {
    if (typeof storage?.persisted === 'function') {
      persisted = await storage.persisted();
    }
    if (typeof storage?.estimate === 'function') {
      const estimate = await storage.estimate();
      originUsageBytes = estimate.usage ?? null;
      originQuotaBytes = estimate.quota ?? null;
    }
  } catch (e) {
    estimateError = e instanceof Error ? e.message : String(e);
  }
  return {
    persisted,
    originUsageBytes,
    originQuotaBytes,
    estimateError,
  };
}

export async function diagnoseWalletDatabase({
  network,
  account,
}: {
  network: IZcashNetwork;
  account?: IZcashWalletAccount;
}): Promise<IZcashDatabaseDiagnostics> {
  if (account && account.network !== network) {
    throw new OneKeyLocalError('Zcash diagnostic account network mismatch');
  }
  const rt = await getRuntime();
  const databaseName = walletDbNameForNetwork(network);
  const [databaseExists, browserStorage] = await Promise.all([
    rt.diagDatabaseExists(databaseName),
    getBrowserStorageDiagnostics(),
  ]);
  const base = {
    backend: 'sqlite-wasm-opfs-sahpool' as const,
    databaseName,
    databaseExists,
    location: getDatabaseLocation(),
    browserStorage,
  };

  if (!databaseExists) {
    return {
      ...base,
      openedAndMigrated: false,
      accountPresent: account ? false : null,
      accountScanState: null,
      health: null,
      storageStats: null,
    };
  }

  if (openDbName !== databaseName) {
    const switchStartedAt = Date.now();
    await rt.openWallet(network, databaseName);
    console.log('[zcash] diagnostic opened existing wallet db', {
      from: openDbName ?? null,
      to: databaseName,
      ms: Date.now() - switchStartedAt,
    });
    openDbName = databaseName;
  }

  const existing = account
    ? (JSON.parse(rt.accountByUfvk(account.ufvk)) as { uuid: string } | null)
    : null;
  return {
    ...base,
    openedAndMigrated: true,
    accountPresent: account ? existing !== null : null,
    accountScanState:
      account && existing
        ? (JSON.parse(
            rt.accountSyncStatus(existing.uuid),
          ) as IZcashDatabaseDiagnostics['accountScanState'])
        : null,
    health: JSON.parse(
      rt.diagDatabaseHealth(),
    ) as IZcashDatabaseDiagnostics['health'],
    storageStats: JSON.parse(
      rt.storageStats(),
    ) as IZcashDatabaseDiagnostics['storageStats'],
  };
}

const ENDPOINT_ROTATE_AFTER_FAILURES = 2;
let endpointOffset = 0;
let consecutiveNetworkFailures = 0;

export function pickLightwalletdUrl(preferred: string): string {
  const pool = [
    preferred,
    ...ZCASH_LIGHTWALLETD_MAINNET_FALLBACKS.filter((u) => u !== preferred),
  ];
  return pool[endpointOffset % pool.length];
}

// Opens the account's database (switching away from another one if needed) and
// returns the runtime plus the account's uuid inside that database.
export async function withWallet(
  account: IZcashWalletAccount,
  options?: {
    // Send-path callers pass false: an unregistered account there means the
    // host skipped prepareWalletAccounts, and importing it here would rewind
    // and rescan every account in the database as a side effect of a send.
    registerIfMissing?: boolean;
  },
): Promise<{
  rt: IRuntimeModule;
  accountUuid: string;
}> {
  const rt = await getRuntime();
  const dbName = walletDbName(account);

  if (openDbName !== dbName) {
    // Wait for the async WASM entry before using the new network database.
    const switchStartedAt = Date.now();
    await rt.openWallet(account.network, dbName);
    // OPFS reads pages on demand; switching no longer preloads the whole file.
    console.log('[zcash] wallet db switched', {
      from: openDbName ?? null,
      to: dbName,
      ms: Date.now() - switchStartedAt,
    });
    openDbName = dbName;
  }
  rt.setLightwalletdUrl(pickLightwalletdUrl(account.lightwalletdUrl));

  // Resolve *this* account inside a database that holds many. Matching by UFVK
  // is the only correct key: the shared database has one entry per account
  // across every wallet, and the runtime's uuid is not stable across a purge,
  // so it can be neither assumed-first nor cached.
  const existing = JSON.parse(rt.accountByUfvk(account.ufvk)) as {
    uuid: string;
  } | null;
  if (existing) {
    return { rt, accountUuid: existing.uuid };
  }
  if (options?.registerIfMissing === false) {
    const err = new OneKeyLocalError(
      'zcash: account not registered in runtime',
    );
    Object.assign(err, {
      code: 'ACCOUNT_NOT_FOUND',
      params: { hdIndex: account.hdIndex },
    });
    throw err;
  }

  // Not registered yet. Adding a viewing key rewinds the wallet and requeues
  // the already-scanned ranges above this account's birthday, so every account
  // in this database re-scans that span together — cheap for a freshly created
  // account (birthday at the tip), expensive when recovering an old one. The
  // host warns the user before the latter.
  const birthday = account.birthdayHeight ?? (await rt.chainTip());
  const accountUuid = await rt.importAccountUfvk(
    `hd-${account.hdIndex}`,
    account.ufvk,
    birthday,
    account.seedFingerprintHex,
    account.hdIndex,
  );
  return { rt, accountUuid };
}

// Drops the runtime's handle on the current database. Callers that delete a
// database must go through this, otherwise the runtime keeps an open SQLite
// connection to bytes that are no longer there.
export function forgetOpenWallet(): void {
  openDbName = undefined;
}

// Last-resort recovery for a wedged carrier (a wasm call that never settles).
// Swaps in a fresh lease so new operations stop queueing behind the stuck
// one, and drops the cached handles so the next call re-opens from scratch.
//
// Honest limits: the abandoned operation keeps running (a promise cannot be
// cancelled), and if it wedged INSIDE the runtime while holding the busy
// flag, later opens throw WALLET_BUSY until the module is reloaded -- on
// desktop the Worker teardown (index.desktop.ts) provides that reload; other
// carriers get "reachable again" but not "guaranteed healthy".
export function resetCarrierState(): void {
  lease = Promise.resolve();
  openDbName = undefined;
  runtimePromise = undefined;
  // Must be dropped with the promise: the read fast path reaches this handle
  // synchronously, so leaving it set would let reads keep calling into the
  // module the reset just abandoned.
  loadedRuntime = undefined;
  console.log('[zcash] carrier state reset');
}

// ── endpoint pool ───────────────────────────────────────────────────────
//
// Sticky failover across lightwalletd endpoints. The preferred URL (from the
// account) leads; the fallbacks follow. Rotation is deliberately dumb and
// sticky: two CONSECUTIVE network failures advance to the next endpoint and
// stay there until it too fails twice -- one flaky request must not flap the
// endpoint, and a genuinely offline device just cycles harmlessly.
//
// Success resets the failure count but never rotates back: the pool has no
// opinion about which healthy endpoint is "best", only about leaving dead
// ones.

// Deterministic-failure breaker. A non-network error that repeats with the
// SAME shape on every retry is the infinite-wedge class: the input never
// changes, so neither does the outcome (the reorg mistranslation looped all
// night on one height this way). Rotation is a cheap lever when the poison
// is bad server data (corrupt block bytes, missing tree metadata); the loud
// escalating log is the surfacing when it is not (local database damage,
// where only Repair helps).
let lastFailureSignature: string | undefined;
let sameFailureCount = 0;

// Called by the leased wrapper (impl/index.ts) with the outcome of every
// wallet operation -- one choke point instead of instrumenting each call.
export function noteNetworkOutcome(e: unknown | null): void {
  if (e === null) {
    consecutiveNetworkFailures = 0;
    lastFailureSignature = undefined;
    sameFailureCount = 0;
    return;
  }
  if (isZcashRuntimeError(e, 'NETWORK_ERROR')) {
    consecutiveNetworkFailures += 1;
    if (consecutiveNetworkFailures >= ENDPOINT_ROTATE_AFTER_FAILURES) {
      consecutiveNetworkFailures = 0;
      endpointOffset += 1;
      console.log('[zcash] lightwalletd endpoint rotated', {
        offset: endpointOffset,
      });
    }
    return;
  }
  const runtime = readZcashRuntimeError(e);
  if (!runtime) {
    return;
  }
  const signature = `${runtime.code}:${String(runtime.params.operation ?? '')}`;
  if (signature === lastFailureSignature) {
    sameFailureCount += 1;
  } else {
    lastFailureSignature = signature;
    sameFailureCount = 1;
  }
  if (sameFailureCount === 3) {
    endpointOffset += 1;
    console.error(
      '[zcash] same failure three times in a row — rotating endpoint in case the server data is poisoned',
      { signature },
    );
  } else if (sameFailureCount === 6) {
    console.error(
      '[zcash] scan appears stuck on a deterministic failure; local data may need Repair',
      { signature },
    );
  }
}
