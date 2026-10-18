/* cspell:ignore Ufvks */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { isZcashRuntimeError, zcashErrorAmount } from '../runtimeError';

import {
  forgetOpenWallet,
  getRuntime,
  noteNetworkOutcome,
  getEndpointHealth as readEndpointHealth,
  recordEndpointHealth,
  walletDbName,
  walletDbNameForNetwork,
  withWallet,
} from './carrier';
import {
  ALLOW_ZERO_CONF_SHIELDING,
  BATCHES_PER_CALL,
  BLOCKS_PER_BATCH,
  RUNTIME_HISTORY_PAGE,
  SCAN_YIELD_MS,
  SUBTREE_ROOTS_TTL_MS,
  SYNC_TIME_BUDGET_MS,
  TRUSTED_CONFIRMATIONS,
  UNTRUSTED_CONFIRMATIONS,
} from './policy';

import type {
  IZcashBalance,
  IZcashHistoryItem,
  IZcashNetwork,
  IZcashSyncProgress,
  IZcashSyncResult,
  IZcashTxDetails,
  IZcashWalletAccount,
} from '../types/sdk';

// Scheduling lives here, not in the wasm runtime, so each pass is one host call instead of many postMessage round trips.

type IRuntimeSyncStep = {
  transactionsEnhanced?: number;
  enhancementError?: string | null;
  done: boolean;
  batchesDone: number;
  blocksScanned: number;
  remainingBlocks: number;
  remainingRanges: number;
  scannedFrom: number | null;
  scannedTo: number | null;
  scannedPriority: string | null;
  activeAccounts: number;
};

// A reorg is routine, not a failure; left unhandled it is permanent — every
// later sync throws the same error forever and the wallet silently stops updating.
function reorgRewindHeight(e: unknown): number | null {
  if (!isZcashRuntimeError(e, 'REORG_DETECTED')) {
    return null;
  }
  return zcashErrorAmount(e, 'suggestedRewindHeight');
}

type IRuntimeHistoryRow = {
  txid: string;
  minedHeight: number | null;
  blockTime: number | null;
  expiredUnmined: boolean;
  feeZat: number | null;
  balanceDeltaZat: number | null;
  isShielding: boolean;
  sentNoteCount: number;
  receivedNoteCount: number;
  totalSpentZat: number | null;
  totalReceivedZat: number | null;
  poolIds?: number[];
  perPoolBalanceDeltaZat?: Record<string, string>;
  // An explicit node rejection was recorded for this transaction.
  rejected?: boolean;
  recipient?: string | null;
  // Absent on a runtime build that predates this column.
  externalOutputCount?: number;
};

type IRuntimeBalancePool = {
  spendable: number;
  pendingChange: number;
  pendingSpendable: number;
  locked: number;
  total: number;
};

type IRuntimeBalance = {
  ready: boolean;
  chainTip: number;
  fullyScannedHeight: number;
  orchard: IRuntimeBalancePool;
  ironwood: IRuntimeBalancePool;
  transparentRegular: IRuntimeBalancePool;
  transparentCoinbase: IRuntimeBalancePool;
  total: number;
};

export function canonicalizeZcashWalletAccounts(
  accounts: IZcashWalletAccount[],
): IZcashWalletAccount[] {
  const canonical = new Map<string, IZcashWalletAccount>();
  for (const account of accounts) {
    const key = `${account.network}:${account.ufvk}`;
    const existing = canonical.get(key);
    if (!existing) {
      canonical.set(key, { ...account });
    } else if (
      account.birthdayHeight !== undefined &&
      (existing.birthdayHeight === undefined ||
        account.birthdayHeight < existing.birthdayHeight)
    ) {
      canonical.set(key, {
        ...existing,
        birthdayHeight: account.birthdayHeight,
      });
    }
  }
  return Array.from(canonical.values());
}

// Host owns the account set; an orphaned runtime account (lost host record)
// would otherwise be trial-decrypted forever with no way to remove it.
async function purgeAccountsUnknownToHost(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  knownUfvks: string[],
): Promise<void> {
  const knownUuids = new Set(
    knownUfvks
      .map(
        (ufvk) =>
          (
            JSON.parse(rt.accountByUfvk(ufvk)) as {
              uuid: string;
            } | null
          )?.uuid,
      )
      .filter((uuid): uuid is string => !!uuid),
  );
  const all = JSON.parse(rt.listAccounts()) as string[];
  const unknown = all.filter((candidate) => !knownUuids.has(candidate));
  for (const uuid of unknown) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await rt.removeAccount(uuid);
      console.log('[zcash] purged runtime account unknown to host', { uuid });
    } catch (e) {
      // Failed storage cleanup is retried on the next prepare.
      console.error('[zcash] purge of unknown runtime account failed', {
        uuid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export async function prepareWalletAccounts(
  accounts: IZcashWalletAccount[],
  options?: { retainedUfvks: string[] },
): Promise<void> {
  // Opens and migrates each account's DB up front, one at a time — the runtime holds only one database open.
  const canonical = canonicalizeZcashWalletAccounts(accounts);
  for (const account of canonical) {
    await withWallet(account, { registerIfMissing: true });
  }
  if (canonical.length > 0 && options) {
    const { rt } = await withWallet(canonical[0], { registerIfMissing: true });
    // Paused accounts keep their cache outside the active scan set; retention must be explicit or purge can't tell what's still owned.
    await purgeAccountsUnknownToHost(rt, [
      ...options.retainedUfvks,
      ...canonical.map(({ ufvk }) => ufvk),
    ]);
  }
}

// Timestamp of the previous pass's end, so idle time can be reported separately from work time.
let lastPassEndedAt: number | null = null;

// Per-database TTL for downloaded subtree roots, so backfill doesn't re-pay syncPrepare's full download every round.
const subtreeRootsFreshUntil = new Map<string, number>();

export async function rebroadcastUnmined(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  recordOutcome?: (error: unknown | null) => void,
): Promise<{ accepted: string[]; rejected: string[] }> {
  let accountUuids: string[];
  try {
    accountUuids = JSON.parse(rt.listAccounts()) as string[];
  } catch {
    return { accepted: [], rejected: [] };
  }
  const accepted: string[] = [];
  const rejected: string[] = [];
  const visited = new Set<string>();
  for (const accountUuid of accountUuids) {
    let txids: string[];
    try {
      txids = JSON.parse(rt.pendingBroadcastTxids(accountUuid)) as string[];
    } catch {
      // One damaged account view must not block another account's pending-tx retry.
      // eslint-disable-next-line no-continue
      continue;
    }
    for (const txid of txids) {
      if (visited.has(txid)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      visited.add(txid);
      try {
        // eslint-disable-next-line no-await-in-loop
        await rt.broadcastTransaction(txid);
        recordOutcome?.(null);
        accepted.push(txid);
        console.log('[zcash] rebroadcast pending tx', { txid });
      } catch (e) {
        recordOutcome?.(
          isZcashRuntimeError(e, 'BROADCAST_REJECTED') ? null : e,
        );
        if (isZcashRuntimeError(e, 'BROADCAST_REJECTED')) {
          rejected.push(txid);
          console.log('[zcash] rebroadcast rejected, giving up', { txid });
        } else {
          console.log('[zcash] rebroadcast failed, will retry next block', {
            txid,
          });
        }
      }
    }
  }
  return { accepted, rejected };
}

export async function syncWallet(
  account: IZcashWalletAccount,
  options: { activeUfvks: string[]; chainTip?: number | null },
): Promise<IZcashSyncResult> {
  let networkSucceeded = false;
  let networkFailure: unknown;
  const recordOutcome = (error: unknown | null) => {
    if (error === null) {
      networkSucceeded = true;
    } else if (
      networkFailure === undefined ||
      isZcashRuntimeError(error, 'NETWORK_ERROR')
    ) {
      networkFailure = error;
    }
  };
  const activeUfvks = Array.from(new Set(options.activeUfvks));
  if (activeUfvks.length === 0) {
    const error = new OneKeyLocalError(
      'zcash: no privacy-enabled accounts were supplied for scanning',
    );
    Object.assign(error, { code: 'NO_ACTIVE_ACCOUNTS' });
    throw error;
  }
  const passStartedAt = Date.now();
  const idleBeforeMs =
    lastPassEndedAt === null ? null : passStartedAt - lastPassEndedAt;
  const timing = { tipMs: 0, prepareMs: 0, scanMs: 0, steps: 0 };

  const { rt, accountUuid } = await withWallet(account);

  const before = readScanMark(rt, account);

  // Idle fast path: cheap local syncPeek + one chainTip call decide there's nothing to do,
  // avoiding the heavier synchronous syncPrepare/syncStep work that would otherwise block the UI thread.
  const queued = JSON.parse(rt.syncPeek()) as { totalBlocks: number };
  let liveTip: number | null = options?.chainTip ?? null;
  if (liveTip === null) {
    const t = Date.now();
    try {
      liveTip = await rt.chainTip();
    } catch (e) {
      recordOutcome(e);
      // Offline: fall through and let the real sync path report the failure.
    }
    timing.tipMs = Date.now() - t;
    // Reuses the chainTip call already being made as the latency sample.
    recordEndpointHealth({ ok: liveTip !== null, latencyMs: timing.tipMs });
  }
  if (
    queued.totalBlocks === 0 &&
    liveTip !== null &&
    before.chainTip !== null &&
    liveTip <= before.chainTip
  ) {
    lastPassEndedAt = Date.now();
    return {
      stateChanged: false,
      chainTip: options?.chainTip ?? before.chainTip,
      fullyScanned: before.fullyScanned,
      backfillRemaining: false,
    };
  }

  // syncPrepare runs only when roots are stale (TTL); syncTip only when the tip moved. Skipping
  // the tip write when unchanged matters: it would requeue a verify range that starves backfill.
  const dbName = walletDbName(account);
  const prepareStartedAt = Date.now();
  if (Date.now() > (subtreeRootsFreshUntil.get(dbName) ?? 0)) {
    await rt.syncPrepare();
    recordOutcome(null);
    subtreeRootsFreshUntil.set(dbName, Date.now() + SUBTREE_ROOTS_TTL_MS);
  } else if (
    liveTip !== null &&
    (before.chainTip === null || liveTip > before.chainTip)
  ) {
    await rt.syncTip();
    recordOutcome(null);
  }
  timing.prepareMs = Date.now() - prepareStartedAt;
  let scanned = 0;
  let backfillRemaining = false;

  // Scan priorities, highest first; only queued ranges run.
  // foundNote must not be skipped: an incomplete tree-shard witness leaves a note unspendable.
  const LANES = [
    'verify',
    'chainTip',
    'foundNote',
    'openAdjacent',
    'historic',
  ] as const;
  let budget = BATCHES_PER_CALL;

  // Set once a reorg rewinds the DB, to stop this pass — remaining lanes would run against a plan that no longer matches the database.
  let reorgRewoundTo: number | null = null;

  // Wall clock, not batch count: block density varies, and the budget is what stops a dense chain from monopolizing the thread.
  const scanStartedAt = Date.now();
  const deadline = scanStartedAt + SYNC_TIME_BUDGET_MS;

  for (const lane of LANES) {
    if (reorgRewoundTo !== null) break;
    // Every lane gets at least one step per pass; the deadline only caps ADDITIONAL steps.
    // Without this, historic (last in order) can starve indefinitely while earlier lanes eat the budget.
    let laneSteps = 0;
    while (budget > 0 && (laneSteps === 0 || Date.now() < deadline)) {
      let r: IRuntimeSyncStep;
      try {
        r = JSON.parse(
          await rt.syncStep(
            BLOCKS_PER_BATCH,
            1,
            lane,
            JSON.stringify(activeUfvks),
          ),
        ) as IRuntimeSyncStep;
      } catch (e) {
        const rewindHeight = reorgRewindHeight(e);
        if (rewindHeight === null) {
          throw e;
        }
        // Destructive by design: everything above this height came from the abandoned chain.
        // The runtime may roll back further than requested; trust its return value, not the request.
        reorgRewoundTo = rt.rewindTo(rewindHeight);
        break;
      }
      budget -= 1;
      laneSteps += 1;
      timing.steps += 1;
      scanned += r.blocksScanned;
      if (r.enhancementError) {
        console.warn('[zcash] history enhancement incomplete; will retry', {
          error: r.enhancementError,
        });
      }
      if (r.blocksScanned === 0) break;
      recordOutcome(null);
      if (lane === 'historic' && !r.done) backfillRemaining = true;
      // Yields between batches (setTimeout, not just await) so the synchronous wasm scan doesn't freeze a UI sharing its thread.
      await new Promise((resolve) => {
        setTimeout(resolve, SCAN_YIELD_MS);
      });
    }
  }

  timing.scanMs = Date.now() - scanStartedAt;

  if (reorgRewoundTo !== null) {
    // Rewound ranges are queued again, so this pass ends with work still due.
    backfillRemaining = true;
    console.log('[zcash] chain reorg handled, wallet rewound', {
      rewoundTo: reorgRewoundTo,
    });
  }

  const after = readScanMark(rt, account);

  // fullyScanned alone can't tell if THIS account's birthday range was ever queued — an account
  // registered at the tip can report "caught up" while it never scanned its own history.
  let queuedAfter: number | null = null;
  try {
    const peek = JSON.parse(rt.syncPeek()) as {
      ranges: { start: number; end: number; priority: string }[];
      totalBlocks: number;
    };
    queuedAfter = peek.totalBlocks;
    const status = JSON.parse(rt.accountSyncStatus(accountUuid)) as unknown;
    console.log('[zcash] scan queue', {
      accountId: account.hdIndex,
      scannedThisPass: scanned,
      remainingBlocks: peek.totalBlocks,
      ranges: peek.ranges.slice(0, 6),
      accountStatus: status,
    });
  } catch (e) {
    console.log('[zcash] scan queue unavailable', e);
  }
  // Queue length is the truth about remaining work; the historic lane alone can report done while a rescan still has queued blocks.
  if (queuedAfter !== null) {
    backfillRemaining = queuedAfter > 0;
  }

  // Transparent balance/history/UTXOs are backend-owned (blockbook) on purpose — asking lightwalletd would leak every transparent address to it.
  let rebroadcastRejectedTxids: string[] = [];
  let rebroadcastAcceptedTxids: string[] = [];
  if (before.chainTip !== after.chainTip) {
    // A new block is both a fresh network-health signal and a new expiry check; never fails the pass.
    const rebroadcast = await rebroadcastUnmined(rt, recordOutcome);
    rebroadcastAcceptedTxids = rebroadcast.accepted;
    rebroadcastRejectedTxids = rebroadcast.rejected;
  }

  // idleBeforeMs distinguishes a scheduling gap from a throughput problem: 100 blocks/100s differs if the work took 5s vs 95s idle.
  const totalMs = Date.now() - passStartedAt;
  lastPassEndedAt = Date.now();
  // Flat log line: `other` covers everything the named phases don't (DB reads, JSON, yields, renderer contention).
  console.log(
    `[zcash] sync timing acct=${account.hdIndex} blocks=${scanned}` +
      ` total=${totalMs}ms idle=${idleBeforeMs ?? '-'}` +
      ` tip=${timing.tipMs} prep=${timing.prepareMs} scan=${timing.scanMs}` +
      ` other=${
        totalMs - (timing.tipMs + timing.prepareMs + timing.scanMs)
      } queued=${queuedAfter ?? '?'} steps=${timing.steps}`,
  );

  // Failure wins over earlier successes; a tip-only or empty pass doesn't prove the endpoint is healthy.
  if (networkFailure !== undefined) {
    noteNetworkOutcome(networkFailure);
  } else if (networkSucceeded) {
    noteNetworkOutcome(null);
  }
  return {
    // Lets the caller skip expensive follow-up work (serialization, list refresh) when nothing changed;
    // compared field by field since readScanMark returns a fresh object each call, so `!==` alone is always true.
    stateChanged:
      scanned > 0 ||
      before.chainTip !== after.chainTip ||
      before.fullyScanned !== after.fullyScanned,
    chainTip: options?.chainTip ?? after.chainTip,
    fullyScanned: after.fullyScanned,
    backfillRemaining,
    rebroadcastAcceptedTxids,
    rebroadcastRejectedTxids,
  };
}

export async function queueRescanFrom(
  account: IZcashWalletAccount,
  params: { fromHeight: number },
): Promise<{ queued: boolean; fromHeight: number; toHeight: number }> {
  const { rt } = await withWallet(account);
  return JSON.parse(rt.queueRescanFrom(params.fromHeight)) as {
    queued: boolean;
    fromHeight: number;
    toHeight: number;
  };
}

// Pure synchronous read, split out so the lock-free fast path and the leased path share one body.
export function readSyncProgress(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  accountUuid: string,
  account: IZcashWalletAccount,
): IZcashSyncProgress {
  const mark = readScanMark(rt, account);
  const status = JSON.parse(rt.accountSyncStatus(accountUuid)) as {
    birthdayHeight: number;
    chainTip: number | null;
    scannedToHeight: number | null;
    remainingBlocks: number;
    isComplete: boolean;
  };

  const birthdayHeight = status.birthdayHeight;
  const chainTip = status.chainTip ?? mark.chainTip;
  const tipScannedHeight = mark.fullyScanned;

  // Birthday lane answers whether this wallet knows its full history — the one that decides if the
  // balance can be trusted. Tip lane only answers freshness, and can be caught up while history isn't.
  const backfillTargetHeight = chainTip;
  const backfillScannedHeight = status.scannedToHeight;
  const isBackfillComplete = status.isComplete;

  const tipLag =
    chainTip !== null && tipScannedHeight !== null
      ? Math.max(0, chainTip - tipScannedHeight)
      : null;

  return {
    birthdayHeight,
    backfillScannedHeight,
    backfillTargetHeight,
    backfillProgress: ratio(
      birthdayHeight,
      backfillScannedHeight,
      backfillTargetHeight,
    ),
    isBackfillComplete,
    backfillRemainingBlocks: status.remainingBlocks,
    tipScannedHeight,
    chainTip,
    tipLag,
    isTipCaughtUp: tipLag !== null && tipLag === 0,
    isSyncing: status.remainingBlocks > 0,
  };
}

export async function getSyncProgress(
  account: IZcashWalletAccount,
): Promise<IZcashSyncProgress> {
  const { rt, accountUuid } = await withWallet(account);
  return readSyncProgress(rt, accountUuid, account);
}

// Pure synchronous read (see readSyncProgress above).
export function readBalance(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  accountUuid: string,
): IZcashBalance {
  // NOT_SYNCED must remain unavailable; it is not evidence of an empty wallet.
  const raw = JSON.parse(
    rt.accountBalance(
      accountUuid,
      TRUSTED_CONFIRMATIONS,
      UNTRUSTED_CONFIRMATIONS,
      ALLOW_ZERO_CONF_SHIELDING,
    ),
  ) as IRuntimeBalance;
  let isComplete = false;
  try {
    const status = JSON.parse(rt.accountSyncStatus(accountUuid)) as {
      isComplete: boolean;
    };
    isComplete = status.isComplete === true;
  } catch {
    // The amounts already read are useful, but cannot be presented as totals.
  }

  // Runtime reports each pool separately (a fact); summing into a total is a policy decision made here.
  const shielded = BigInt(raw.orchard.total) + BigInt(raw.ironwood.total);
  const pendingChange =
    BigInt(raw.orchard.pendingChange) + BigInt(raw.ironwood.pendingChange);
  const pendingSpendable =
    BigInt(raw.orchard.pendingSpendable) +
    BigInt(raw.ironwood.pendingSpendable);

  // spendable is shielded-only (transparent funds are the backend's to report); coinbase is excluded
  // because this runtime doesn't implement propose_shielding_coinbase. Per-pool figures already apply confirmation thresholds.
  const poolDetail = (pool: IRuntimeBalancePool) => ({
    spendable: String(pool.spendable),
    pendingChange: String(pool.pendingChange),
    pendingSpendable: String(pool.pendingSpendable),
    locked: String(pool.locked),
    total: String(pool.total),
  });

  const shieldedSpendable =
    BigInt(raw.orchard.spendable) + BigInt(raw.ironwood.spendable);
  const spendable = shieldedSpendable;

  return {
    isComplete,
    shielded: shielded.toString(),
    spendable: spendable.toString(),
    pendingChange: pendingChange.toString(),
    pendingSpendable: pendingSpendable.toString(),
    orchardBalance: String(raw.orchard.total),
    ironwoodBalance: String(raw.ironwood.total),
    shieldedSpendable: shieldedSpendable.toString(),
    poolsDetail: {
      orchard: poolDetail(raw.orchard),
      ironwood: poolDetail(raw.ironwood),
    },
  };
}

export async function getBalance(
  account: IZcashWalletAccount,
): Promise<IZcashBalance> {
  const { rt, accountUuid } = await withWallet(account);
  return readBalance(rt, accountUuid);
}

// Pure synchronous read (see readSyncProgress); the paging loop must stay synchronous too, or an
// await mid-read would break the atomicity the fast path relies on.
export function readHistory(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  accountUuid: string,
  pagination?: { limit?: number; offset?: number },
): IZcashHistoryItem[] {
  // Runtime caps one call at 500 rows; must page rather than clamp, or a 20001-row request
  // would look complete and silently drop older history.
  const want = pagination?.limit ?? 50;
  const baseOffset = pagination?.offset ?? 0;
  const rows: IRuntimeHistoryRow[] = [];

  for (let fetched = 0; fetched < want;) {
    const pageSize = Math.min(RUNTIME_HISTORY_PAGE, want - fetched);
    const page = JSON.parse(
      rt.transactionHistory(accountUuid, pageSize, baseOffset + fetched),
    ) as IRuntimeHistoryRow[];
    rows.push(...page);
    fetched += page.length;
    // A short page means there is nothing more to read.
    if (page.length < pageSize) break;
  }

  // Displayed amount is not the balance delta: a shield/self-transfer's delta is just minus the fee, and a
  // send's delta folds the fee in, disagreeing with the quote the user confirmed — classified from directional sums instead.
  return rows.map((r) => {
    const delta = BigInt(r.balanceDeltaZat ?? 0);
    const spent = BigInt(r.totalSpentZat ?? 0);
    const received = BigInt(r.totalReceivedZat ?? 0);
    const feeKnown = r.feeZat !== null;
    const external = spent - received - BigInt(r.feeZat ?? 0);

    // Internal move (shield / pool-to-pool / own transparent): decided from output ownership, not
    // spent-received-fee — with the fee unknown that difference equals the fee and mislabels it as a send.
    const isInternalMove =
      r.isShielding ||
      (spent > 0n &&
        (typeof r.externalOutputCount === 'number'
          ? r.externalOutputCount === 0
          : external <= 0n));
    let txType: 'received' | 'sent' | 'shielded';
    let valueZat: bigint;
    if (isInternalMove) {
      txType = 'shielded';
      // What arrived in the destination pool; `received` would also count the change note left behind in the source pool.
      const arrived = Object.values(r.perPoolBalanceDeltaZat ?? {})
        .map((v) => BigInt(v))
        .filter((v) => v > 0n)
        .reduce((sum, v) => sum + v, 0n);
      valueZat = arrived > 0n ? arrived : received;
    } else if (spent > 0n) {
      txType = 'sent';
      // After a rescan the fee can be unknown; fall back to the raw delta rather than claim a fee-excluded figure that would be wrong.
      valueZat = feeKnown ? -external : delta;
    } else {
      txType = 'received';
      valueZat = received > 0n ? received : delta;
    }

    return {
      txid: r.txid,
      minedHeight: r.minedHeight,
      timestamp: r.blockTime,
      valueZat: valueZat.toString(),
      fee: r.feeZat === null ? null : String(r.feeZat),
      pending: r.minedHeight === null && !r.expiredUnmined && !r.rejected,
      expired: r.expiredUnmined || (r.minedHeight === null && !!r.rejected),
      txType,
      recipient: r.recipient ?? null,
      poolIds: Array.isArray(r.poolIds)
        ? r.poolIds.filter(Number.isSafeInteger)
        : [],
      perPoolBalanceDeltaZat: r.perPoolBalanceDeltaZat ?? {},
    };
  });
}

export async function getHistory(
  account: IZcashWalletAccount,
  pagination?: { limit?: number; offset?: number },
): Promise<IZcashHistoryItem[]> {
  const { rt, accountUuid } = await withWallet(account);
  return readHistory(rt, accountUuid, pagination);
}

export async function getTxDetails(
  account: IZcashWalletAccount,
  params: { txid: string },
): Promise<IZcashTxDetails> {
  const { rt, accountUuid } = await withWallet(account);
  const outputs = JSON.parse(
    rt.transactionOutputs(accountUuid, params.txid),
  ) as {
    spent: { valueZat: number; poolName: string; address: string | null }[];
    received: {
      valueZat: number;
      poolName: string;
      isChange: boolean;
      memo: string | null;
      memoBinary: { hex: string; hash: string } | null;
      address: string | null;
    }[];
    external: {
      memo?: string | null;
      memoBinary?: { hex: string; hash: string } | null;
      valueZat: number;
      poolName: string;
      address: string | null;
    }[];
  };

  const summary = JSON.parse(
    rt.transactionDetails(accountUuid, params.txid),
  ) as { feeZat: number | null } | null;

  return {
    spent: outputs.spent.map((o) => ({
      value: String(o.valueZat),
      pool: o.poolName,
      address: o.address,
    })),
    received: outputs.received.map((o) => ({
      value: String(o.valueZat),
      pool: o.poolName,
      internal: o.isChange,
      memo: o.memo,
      memoBinary: o.memoBinary,
      address: o.address,
    })),
    // Outputs with no recorded address are dropped, not shown with a placeholder — an empty recipient
    // reads as a bug and the address can't be recovered after the fact.
    external: outputs.external
      .filter((o): o is typeof o & { address: string } => !!o.address)
      .map((o) => ({
        address: o.address,
        memo: o.memo,
        memoBinary: o.memoBinary,
        value: String(o.valueZat),
        pool: o.poolName,
      })),
    feeZat: typeof summary?.feeZat === 'number' ? String(summary.feeZat) : null,
  };
}

// What the scanner last observed about its node while doing its normal work.
export async function getEndpointHealth(): Promise<
  | { url: string; ok: boolean; latencyMs: number | null; atMs: number }
  | undefined
> {
  return readEndpointHealth();
}

// Removes the ACCOUNT, not the database — every account of every mnemonic shares one database
// per network, so deleting the file would wipe every other account's scan state too.
// Everything dropped here is derived cache (rebuildable from UFVK + birthday); nothing unrecoverable is lost.
export async function purgeWallet(account: IZcashWalletAccount): Promise<void> {
  // Registering it just to remove it would rewind the shared database and requeue every other
  // account's range; an unregistered account has nothing to drop.
  let registered: Awaited<ReturnType<typeof withWallet>> | undefined;
  try {
    registered = await withWallet(account);
  } catch (e) {
    if (!isZcashRuntimeError(e, 'ACCOUNT_NOT_FOUND')) throw e;
  }
  // Open either way: withWallet opens the database before resolving the account, so the emptiness check below is accurate.
  const rt = registered?.rt ?? (await getRuntime());
  if (registered) {
    await rt.removeAccount(registered.accountUuid);
  }

  const remaining = JSON.parse(rt.listAccounts()) as string[];
  if (remaining.length > 0) return;

  // Last one out deletes the file: must close first and clear the carrier's cached handle, or the
  // next call reuses a handle to bytes that no longer exist. Throws WALLET_BUSY if another operation
  // still holds the database — shouldn't happen under the lease, but propagating it beats deleting an open database.
  rt.closeWallet();
  forgetOpenWallet();
  // A re-created database starts without subtree roots; the freshness mark must be cleared with the file.
  subtreeRootsFreshUntil.delete(walletDbName(account));
  await rt.deleteWallet(walletDbName(account));
}

// App reset: deletes the per-network database outright; the runtime closes it first if open, and a missing database is not an error.
export async function dropWalletDatabase(
  network: IZcashNetwork,
): Promise<void> {
  const rt = await getRuntime();
  const dbName = walletDbNameForNetwork(network);
  forgetOpenWallet();
  subtreeRootsFreshUntil.delete(dbName);
  await rt.deleteWallet(dbName);
}

function readScanMark(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  account: IZcashWalletAccount,
): { chainTip: number | null; fullyScanned: number | null } {
  try {
    const accounts = JSON.parse(rt.listAccounts()) as string[];
    if (!accounts.length) return { chainTip: null, fullyScanned: null };
    const b = JSON.parse(
      rt.accountBalance(
        accounts[0],
        TRUSTED_CONFIRMATIONS,
        UNTRUSTED_CONFIRMATIONS,
        ALLOW_ZERO_CONF_SHIELDING,
      ),
    ) as IRuntimeBalance;
    return { chainTip: b.chainTip, fullyScanned: b.fullyScannedHeight };
  } catch {
    // Before the first scan there is no summary at all; that is not an error.
    void account;
    return { chainTip: null, fullyScanned: null };
  }
}

function ratio(
  from: number | null,
  current: number | null,
  target: number | null,
): number | null {
  if (from === null || current === null || target === null) return null;
  const span = target - from;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (current - from) / span));
}
