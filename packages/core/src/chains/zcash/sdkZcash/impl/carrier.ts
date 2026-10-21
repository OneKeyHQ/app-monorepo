import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrivacyChainPerfLogEnabled } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import { ZCASH_LIGHTWALLETD_MAINNET } from '../constants';

import { wrapKeysModuleWithStackCleanup } from './keysMemory';

import type {
  IZcashDatabaseDiagnostics,
  IZcashNetwork,
  IZcashWalletAccount,
} from '../types/sdk';

// Low-level utility only: one database open at a time, bounded scan steps, no scheduling of its own.

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

// Which database the runtime currently has open, to avoid reopening on every call.
let openDbName: string | undefined;

// Serializes every wallet operation: opening a different database mid-call would corrupt
// shared state. Must cover the whole public operation (sync = prepare + many steps), not just the open.
let lease: Promise<unknown> = Promise.resolve();
// Running + queued lease count, so read-only surfaces can snapshot instead of queueing behind a scan.
let leasePendingCount = 0;

// Off by default: during a boost this fires several times/sec, enough to crawl a console-attached page.
let leaseTraceEnabled = false;

// Distinguishes why a read missed the lock-free path below (still warming up vs. the scan owns the db).
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

export function isLeaseTraceEnabled(): boolean {
  return leaseTraceEnabled;
}

// Whether a scan pass is currently running (anything holds/waits for the lease).
export function isWalletLeaseBusy(): boolean {
  return leasePendingCount > 0;
}

export function withWalletLease<T>(operation: () => Promise<T>): Promise<T> {
  leasePendingCount += 1;
  const guardedOperation = () => {
    if (storageRequiresWorkerRestart()) {
      throw new OneKeyLocalError('zcash worker: storage failed');
    }
    return operation();
  };
  // Wait time matters more than run time: a "slow" read is usually just queued behind a scan.
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
  // Keep the chain alive regardless of outcome: a rejected op must not wedge later ones.
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

// Kept synchronously reachable: an await here would yield to the event loop, where the scan could retake the lease.
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
      // Installs the shared OPFS VFS; must complete before openWallet or SQLite silently falls back to memory.
      await mod.init();
      // Mirrors the host-side [PRIV-PERF] trace inside wasm.
      if (isPrivacyChainPerfLogEnabled()) {
        (mod as { setPerfTrace?: (enabled: boolean) => void }).setPerfTrace?.(
          true,
        );
      }
      loadedRuntime = mod;
      return mod;
    })().catch((e) => {
      // Never cache a failed load: a transient failure would otherwise poison every later call.
      runtimePromise = undefined;
      throw e;
    });
  }
  return runtimePromise;
}

// Lock-free: these are synchronous wasm calls, so they can't interleave with the scan and always see a consistent db.
// Returns null (caller falls back to the leased path) when not loaded, wrong db open, or account not registered.
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
  // Deliberately skips setLightwalletdUrl: rewriting that shared setting mid-scan would change where the scan downloads from.
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
    // DB is busy mid-await from an async op; let the caller join the lease instead of a false WALLET_NOT_OPEN.
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

// One database per network; every account across every wallet shares it (scanning trial-decrypts for all keys in one pass).
// Safe to mix seeds: note selection is account-scoped and the db holds viewing keys only, never spending keys.
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

// The endpoint the last wallet operation used; health samples are attributed to it.
let selectedEndpointUrl: string | undefined;

export async function withWallet(
  account: IZcashWalletAccount,
  options?: {
    // Only prepareWalletAccounts should set this; elsewhere a missing account means it was purged.
    registerIfMissing?: boolean;
  },
): Promise<{
  rt: IRuntimeModule;
  accountUuid: string;
}> {
  const rt = await getRuntime();
  const dbName = walletDbName(account);

  if (openDbName !== dbName) {
    const switchStartedAt = Date.now();
    await rt.openWallet(account.network, dbName);
    // OPFS reads pages on demand, so switching does not preload the whole file.
    console.log('[zcash] wallet db switched', {
      from: openDbName ?? null,
      to: dbName,
      ms: Date.now() - switchStartedAt,
    });
    openDbName = dbName;
  }
  // Pinned to the configured endpoint (default or custom RPC); no automatic failover.
  selectedEndpointUrl = account.lightwalletdUrl;
  rt.setLightwalletdUrl(account.lightwalletdUrl);

  // Match by UFVK, not uuid: the runtime's uuid is not stable across a purge, so it can't be cached.
  const existing = JSON.parse(rt.accountByUfvk(account.ufvk)) as {
    uuid: string;
  } | null;
  if (existing) {
    return { rt, accountUuid: existing.uuid };
  }
  if (options?.registerIfMissing !== true) {
    const err = new OneKeyLocalError(
      'zcash: account not registered in runtime',
    );
    Object.assign(err, {
      code: 'ACCOUNT_NOT_FOUND',
      params: { hdIndex: account.hdIndex },
    });
    throw err;
  }

  // Registering a new account rewinds and re-scans every account above this birthday (host warns the user).
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

// Callers that delete a database must call this first, or the runtime keeps a SQLite handle to deleted bytes.
export function forgetOpenWallet(): void {
  openDbName = undefined;
}

// Last-resort recovery for a wedged carrier: swaps in a fresh lease so new calls stop queueing behind it.
// The abandoned call keeps running; if it wedged holding the busy flag, opens throw WALLET_BUSY until reload.
export function resetCarrierState(): void {
  lease = Promise.resolve();
  openDbName = undefined;
  runtimePromise = undefined;
  // Must be cleared with runtimePromise: the read fast path reaches this synchronously.
  loadedRuntime = undefined;
  console.log('[zcash] carrier state reset');
}

// Health signal comes from the scan's own requests, not a dedicated probe.
export type IZcashEndpointHealth = {
  url: string;
  ok: boolean;
  // Round trip of the tip call, when this sample came from one.
  latencyMs: number | null;
  atMs: number;
};

let endpointHealth: IZcashEndpointHealth | undefined;

export function recordEndpointHealth(sample: {
  ok: boolean;
  latencyMs?: number | null;
}): void {
  const url = selectedEndpointUrl ?? ZCASH_LIGHTWALLETD_MAINNET;
  endpointHealth = {
    url,
    ok: sample.ok,
    latencyMs:
      sample.latencyMs ??
      (endpointHealth?.url === url ? endpointHealth.latencyMs : null),
    atMs: Date.now(),
  };
}

export function getEndpointHealth(): IZcashEndpointHealth | undefined {
  return endpointHealth;
}

export function noteNetworkOutcome(e: unknown | null): void {
  recordEndpointHealth({ ok: e === null });
}

/** Install only on this WASM instance, before any node operation runs. */
export async function installZcashHostFetch(
  fetcher: typeof fetch,
): Promise<void> {
  const mod = await getRuntimeWasm();
  if (typeof mod.setRequestHandler !== 'function') {
    throw new OneKeyLocalError(
      'zcash runtime lacks the host network transport; rebuild the runtime',
    );
  }
  mod.setRequestHandler(fetcher);
}
