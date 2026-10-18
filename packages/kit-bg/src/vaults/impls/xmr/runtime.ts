import { Mutex } from 'async-mutex';

import {
  getXmrRuntimeApi,
  hasXmrRuntimeApiLoader,
  readXmrRuntimeError,
} from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { XMR_RUNTIME_METHODS } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/methods';
import { installXmrCarrier } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/install';
import type { IXmrNetwork } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getLastLocalWalletChainTip } from '../../localWallet/privacyChainCacheStore';

import type Vault from './Vault';

/**
 * Single place that opens the Monero runtime's database and node URL exactly once.
 * Opening the database twice fails as something that looks like corruption, not loudly.
 */

// Installed as a side effect of importing this module, so the chain cannot end up half-wired.
installXmrCarrier();

/** One database per network. Every identity on that network shares it. */
export function xmrDbNameForNetwork(network: IXmrNetwork): string {
  return `xmr-${network}`;
}

type ISession = {
  /** The carrier's API, wrapped so a lost runtime heals itself (below). */
  api: IXmrRuntimeApi;
  /** As loaded; only session setup calls it directly. */
  raw: IXmrRuntimeApi;
  network: IXmrNetwork;
  dbName: string;
  /** The node the runtime is connected to; `''` while it is not. */
  nodeUrl: string;
  /** Last failed connect, so an unreachable node is not retried every call. */
  nodeAttempt?: { url: string; at: number };
};

// How long an unreachable node is left alone before the next attempt.
const NODE_RETRY_MS = 30_000;

// Codes meaning the Worker's database/node client was torn down while this module's cached session survived.
const LOST_STATE_CODES = new Set([
  'WALLET_NOT_OPEN',
  'NODE_NOT_CONFIGURED',
  'NOT_INITIALIZED',
]);

const NODE_METHODS = new Set<(typeof XMR_RUNTIME_METHODS)[number]>([
  'chainTip',
  'syncStep',
  'prepareTransaction',
  'broadcastTransaction',
]);

function readLostStateCode(error: unknown): string | undefined {
  const runtime = readXmrRuntimeError(error);
  if (runtime && LOST_STATE_CODES.has(runtime.code)) {
    return runtime.code;
  }
  return undefined;
}

let session: ISession | undefined;

// The last chain tip any caller fetched; at most a turn old.
let lastKnownChainTip: number | undefined;

// Health shown in settings comes from the tip fetches scanning already makes,
// not a separate probe. Keyed by url so a switch never shows the old node's.
export type IXmrNodeHealth = {
  url: string;
  ok: boolean;
  latencyMs: number | null;
  atMs: number;
};
let nodeHealth: IXmrNodeHealth | undefined;
let opening: Promise<ISession> | undefined;

// One runtime call at a time: a read landing mid-step would otherwise fail as "not open",
// indistinguishable from the real error. Queueing bounds the wait to at most one step.
const runtimeCallLock = new Mutex();

// Tests and carrier teardown only; calling this during a live scan reopens a database the previous call still holds.
export function resetXmrRuntimeSession() {
  session = undefined;
  opening = undefined;
  lastKnownChainTip = undefined;
  nodeHealth = undefined;
}

async function openSession(params: {
  network: IXmrNetwork;
  nodeUrl: string;
}): Promise<ISession> {
  const { network, nodeUrl } = params;
  const api = await getXmrRuntimeApi();
  const dbName = xmrDbNameForNetwork(network);
  await api.openWallet(dbName, network);
  // The database alone serves every local operation; an unreachable or disabled node must not take those down with it.
  let connectedUrl = '';
  let nodeAttempt: ISession['nodeAttempt'];
  if (nodeUrl) {
    try {
      await api.setNodeUrl(nodeUrl);
      connectedUrl = nodeUrl;
    } catch (error) {
      console.warn('[xmr] node unreachable; local operations only', { error });
      nodeAttempt = { url: nodeUrl, at: Date.now() };
    }
  }
  const opened: ISession = {
    api,
    raw: api,
    network,
    dbName,
    nodeUrl: connectedUrl,
    nodeAttempt,
  };
  // Mutual recursion by design: healing reopens, reopening wraps for healing.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  opened.api = withSelfHealing(opened);
  return opened;
}

function openSessionSingleFlight(params: {
  network: IXmrNetwork;
  nodeUrl: string;
}): Promise<ISession> {
  if (!opening) {
    opening = openSession(params)
      .then((next) => {
        session = next;
        return next;
      })
      .finally(() => {
        opening = undefined;
      });
  }
  return opening;
}

// Retries once on a fresh session after a lost-state error; a second one surfaces instead of looping.
function healingMethod(
  current: ISession,
  method: (typeof XMR_RUNTIME_METHODS)[number],
): (...args: unknown[]) => Promise<unknown> {
  const call = (target: IXmrRuntimeApi, args: unknown[]) =>
    (target[method] as (...a: unknown[]) => Promise<unknown>)(...args);
  return (...args: unknown[]) =>
    runtimeCallLock.runExclusive(async () => {
      try {
        return await call(current.raw, args);
      } catch (error) {
        const code = readLostStateCode(error);
        if (!code) throw error;
        console.warn('[xmr] runtime lost its state; reopening', {
          method,
          code,
        });
        if (session === current) {
          session = undefined;
        }
        const next = await openSessionSingleFlight({
          network: current.network,
          nodeUrl: NODE_METHODS.has(method) ? current.nodeUrl : '',
        });
        return call(next.raw, args);
      }
    });
}

function withSelfHealing(current: ISession): IXmrRuntimeApi {
  const api: Record<string, unknown> = {};
  for (const method of XMR_RUNTIME_METHODS) {
    api[method] = healingMethod(current, method);
  }
  return api as unknown as IXmrRuntimeApi;
}

// Whether a scan step holds the lock; a UI read must not join that queue and should answer from its last snapshot.
export function isXmrRuntimeBusy(): boolean {
  return runtimeCallLock.isLocked();
}

const staleFirstCache = new Map<string, unknown>();

/** Drop remembered read results. Tests only. */
export function resetXmrStaleFirstCache() {
  staleFirstCache.clear();
}

// Read without waiting on a scan step: busy returns the last-seen value (or fallback) instead of queueing.
// The busy check is a snapshot, not a reservation -- a step can still start between it and the read.
export async function readXmrStaleFirst<T>({
  key,
  read,
  fallback,
}: {
  key: string;
  read: () => Promise<T>;
  fallback: T;
}): Promise<T> {
  if (isXmrRuntimeBusy()) {
    return staleFirstCache.has(key)
      ? (staleFirstCache.get(key) as T)
      : fallback;
  }
  const value = await read();
  staleFirstCache.set(key, value);
  return value;
}

// After the account's scanned data is removed or rewound, its last answers are wrong, not just old.
export function forgetXmrStaleFirstAccount(accountId: string) {
  for (const kind of ['history', 'progress']) {
    staleFirstCache.delete(`${kind}:${accountId}`);
  }
}

// Deletes the database without opening it: a database that cannot be opened must still be removable.
export async function deleteXmrDatabase(network: IXmrNetwork): Promise<void> {
  await runtimeCallLock.runExclusive(async () => {
    const api = await getXmrRuntimeApi();
    await api.deleteWallet(xmrDbNameForNetwork(network));
    session = undefined;
    staleFirstCache.clear();
  });
}

// Goes through the session's API, so it queues behind a running step instead of reopening the database under it.
async function connectNode(target: ISession, url: string) {
  const { nodeAttempt } = target;
  if (nodeAttempt?.url === url && Date.now() - nodeAttempt.at < NODE_RETRY_MS) {
    return;
  }
  // The runtime drops the previous node first, so a switch never falls back to the one the user moved away from.
  target.nodeUrl = '';
  try {
    await target.api.setNodeUrl(url);
    target.nodeUrl = url;
    target.nodeAttempt = undefined;
  } catch (error) {
    console.warn('[xmr] node unreachable; local operations only', { error });
    target.nodeAttempt = { url, at: Date.now() };
  }
}

export async function getXmrRuntime(vault: Vault): Promise<IXmrRuntimeApi> {
  if (!hasXmrRuntimeApiLoader()) {
    throw new OneKeyLocalError(
      'xmr: this carrier has no runtime; scanning and sending are unavailable here',
    );
  }
  const network = await vault.getXmrNetwork();
  // No node (disabled, not set) still leaves the database usable.
  const nodeUrl = await vault.resolveXmrNodeUrl().catch(() => '');
  const dbName = xmrDbNameForNetwork(network);

  const current =
    session?.dbName === dbName
      ? session
      : await openSessionSingleFlight({ network, nodeUrl });
  // An empty url disconnects: a disabled node must stop receiving requests.
  if (current.nodeUrl !== nodeUrl) {
    await connectNode(current, nodeUrl);
  }
  return current.api;
}

// Local reads and data management need only the database; waiting
// for a node to connect put up to three network round trips before them.
// Scanning and sending go through getXmrRuntime, which connects.
export async function getXmrLocalRuntime(
  vault: Vault,
): Promise<IXmrRuntimeApi> {
  if (!hasXmrRuntimeApiLoader()) {
    throw new OneKeyLocalError(
      'xmr: this carrier has no runtime; scanning and sending are unavailable here',
    );
  }
  const network = await vault.getXmrNetwork();
  const current =
    session?.dbName === xmrDbNameForNetwork(network)
      ? session
      : await openSessionSingleFlight({ network, nodeUrl: '' });
  return current.api;
}

// Translates an app account id (string) into the runtime's own row id (integer) via the stored uuid.
export async function getXmrIdentityId(params: {
  api: IXmrRuntimeApi;
  accountId: string;
}): Promise<string> {
  const { api, accountId } = params;
  const listed = JSON.parse(await api.listAccounts()) as {
    items: { accountId: number; uuid: string }[];
  };
  const row = listed.items.find((item) => item.uuid === accountId);
  if (!row) {
    throw new OneKeyLocalError(
      `xmr: account ${accountId} is not registered in the runtime; turn scanning on for it first`,
    );
  }
  return String(row.accountId);
}

function recordXmrNodeHealth(sample: {
  url: string | undefined;
  ok: boolean;
  latencyMs: number | null;
}) {
  const { url, ok } = sample;
  if (!url) return;
  nodeHealth = {
    url,
    ok,
    latencyMs:
      sample.latencyMs ??
      (nodeHealth?.url === url ? nodeHealth.latencyMs : null),
    atMs: Date.now(),
  };
}

export function getXmrNodeHealth(): IXmrNodeHealth | undefined {
  return nodeHealth;
}

export async function getXmrChainTip(api: IXmrRuntimeApi): Promise<number> {
  // A failed connect leaves nodeUrl empty; the failure still belongs to the node tried.
  const url = session?.nodeUrl || session?.nodeAttempt?.url;
  // Queued behind a scan step, the round trip would include that step.
  const timed = !isXmrRuntimeBusy();
  const startedAt = Date.now();
  let tip: { height: number };
  try {
    tip = JSON.parse(await api.chainTip()) as { height: number };
  } catch (error) {
    recordXmrNodeHealth({ url, ok: false, latencyMs: null });
    throw error;
  }
  recordXmrNodeHealth({
    url,
    ok: true,
    latencyMs: timed ? Date.now() - startedAt : null,
  });
  lastKnownChainTip = tip.height;
  return tip.height;
}

// Last observed tip for display and local scan-data management. Sending and
// normal sync fetch a fresh tip through getXmrChainTip instead.
export async function getXmrLastKnownChainTip(
  vault: Vault,
): Promise<number | undefined> {
  return (
    lastKnownChainTip ??
    getLastLocalWalletChainTip({
      backgroundApi: vault.backgroundApi,
      networkId: vault.networkId,
    })
  );
}
