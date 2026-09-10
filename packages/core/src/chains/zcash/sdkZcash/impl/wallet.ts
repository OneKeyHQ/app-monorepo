/* cspell:ignore Ufvks */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { isZcashRuntimeError, zcashErrorAmount } from '../runtimeError';

import {
  forgetOpenWallet,
  getRuntime,
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

// The runtime deliberately never syncs to completion on its own: `syncStep`
// scans a bounded number of blocks and returns progress. The loop below is the
// scheduling the runtime refuses to do, and it belongs here — on this side of
// the carrier boundary, so the background process makes one call instead of
// hundreds of postMessage round trips.

type IRuntimeSyncStep = {
  done: boolean;
  batchesDone: number;
  blocksScanned: number;
  remainingBlocks: number;
  remainingRanges: number;
  // Which range this call actually scanned, so progress lands in the right lane.
  scannedFrom: number | null;
  scannedTo: number | null;
  scannedPriority: string | null;
  activeAccounts: number;
};

// A chain reorg is a routine event, not a failure: the last few blocks at the
// tip were replaced, so the scanned data above that point describes a chain
// that no longer exists. The runtime deliberately reports it as its own error
// code (instead of folding it into a generic database error) and carries the
// height to roll back to, precisely so the host can recover without a human.
//
// Left unhandled it is permanent: the continuity break never heals on its own,
// so every later sync throws the same error forever and the wallet silently
// stops updating.
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
  broadcastState?: 'observed' | 'pending' | 'accepted' | 'rejected' | null;
  recipient?: string | null;
  // Outputs this account sent to addresses it does not own. Absent on a
  // runtime build that predates the column.
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

// Versions baked into the runtime build (zcash_client_sqlite decides the
// on-disk schema). The host stores the last seen value to detect a runtime
// swap that requires rebuilding the database.
export async function getRuntimeVersions(): Promise<Record<string, string>> {
  const rt = await getRuntime();
  return JSON.parse(rt.dependencyVersions()) as Record<string, string>;
}

// The host is the account authority. A runtime account without a host record
// (meta lost, GC that failed offline) would otherwise be trial-decrypted on
// every pass forever, with its history on disk and no code path to remove it.
async function purgeAccountsUnknownToHost(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  known: IZcashWalletAccount[],
): Promise<void> {
  const knownUuids = new Set(
    known
      .map(
        (account) =>
          (
            JSON.parse(rt.accountByUfvk(account.ufvk)) as {
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
      // removeAccount refuses while a broadcast is unresolved; retried on
      // the next prepare.
      console.error('[zcash] purge of unknown runtime account failed', {
        uuid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export async function prepareWalletAccounts(
  accounts: IZcashWalletAccount[],
): Promise<void> {
  // Opening each account's database runs its schema migrations and imports the
  // viewing key, so later calls do not pay that cost inside a user-visible
  // action. One account at a time: the runtime holds one database open.
  const canonical = canonicalizeZcashWalletAccounts(accounts);
  for (const account of canonical) {
    await withWallet(account);
  }
  if (canonical.length > 0) {
    const { rt } = await withWallet(canonical[0]);
    await purgeAccountsUnknownToHost(rt, canonical);
  }
}

// When the previous pass returned, so a pass can report the gap it waited
// through. Without it a slow sync is unattributable: 100 blocks per 100
// seconds looks the same whether the work took 100s or took 5s and the
// scheduler slept for 95.
let lastPassEndedAt: number | null = null;

// Per-database expiry of the downloaded subtree roots, so backfill passes stop
// paying `syncPrepare`'s full-root re-download every round.
const subtreeRootsFreshUntil = new Map<string, number>();

export async function rebroadcastUnmined(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
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
      txids = JSON.parse(rt.broadcastRetryTxids(accountUuid)) as string[];
    } catch {
      // One damaged account view must not prevent another account's pending
      // transaction from being retried.
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
        // Runtime validates and persists the intent/outcome in its own DB.
        // eslint-disable-next-line no-await-in-loop
        await rt.broadcastTransaction(txid);
        accepted.push(txid);
        console.log('[zcash] rebroadcast pending tx', { txid });
      } catch (e) {
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
  const timing = { tipMs: 0, prepareMs: 0, scanMs: 0, utxoMs: 0, steps: 0 };

  const { rt, accountUuid } = await withWallet(account);

  const before = readScanMark(rt, account);

  // Idle fast path.
  //
  // A caught-up wallet is polled forever, and every pass used to cost a
  // `syncPrepare` (~1.4s of subtree-root download, more on mainnet) plus one
  // `syncStep` per lane plus a transparent refresh -- all of it synchronous
  // inside the wasm, so it holds the JS event loop and the UI stutters while
  // there is provably nothing to do.
  //
  // Two cheap questions answer whether there is: `syncPeek` is a local read
  // with no network at all, and `chainTip` is a single unary call (~270ms
  // measured) against `syncPrepare`'s much heavier work. Nothing queued and no
  // new block means nothing to do, and the pass ends here.
  const queued = JSON.parse(rt.syncPeek()) as { totalBlocks: number };
  let liveTip: number | null = options?.chainTip ?? null;
  if (liveTip === null) {
    const t = Date.now();
    try {
      liveTip = await rt.chainTip();
    } catch {
      // Offline: fall through and let the real sync path report the failure.
    }
    timing.tipMs = Date.now() - t;
  }
  if (
    queued.totalBlocks === 0 &&
    liveTip !== null &&
    before.chainTip !== null &&
    liveTip <= before.chainTip
  ) {
    lastPassEndedAt = Date.now();
    return {
      synced: true,
      stateChanged: false,
      chainTip: options?.chainTip ?? before.chainTip,
      fullyScanned: before.fullyScanned,
      backfillRemaining: false,
      transparentCurrent: true,
    };
  }

  // What used to be an unconditional `syncPrepare` (subtree roots + tip) every
  // pass -- 7.4s on mainnet, all of it re-downloading roots that change every
  // few days. Now three-way, mirroring upstream's reference loop (roots
  // outside the loop, tip inside):
  //
  //   roots stale        syncPrepare  once per TTL, pays the full download
  //   chain tip moved    syncTip      one unary call + a tip write
  //   neither            nothing      backfill runs straight from the queue
  //
  // The tip write is deliberately skipped while the tip is unchanged: every
  // write queues a ~10-block Verify range at the tip which outranks the
  // historic lane, so an unconditional write made each backfill pass re-verify
  // the same 10 blocks instead of advancing a full batch. Measured, not
  // theoretical.
  const dbName = walletDbName(account);
  const prepareStartedAt = Date.now();
  if (Date.now() > (subtreeRootsFreshUntil.get(dbName) ?? 0)) {
    await rt.syncPrepare();
    subtreeRootsFreshUntil.set(dbName, Date.now() + SUBTREE_ROOTS_TTL_MS);
  } else if (
    liveTip !== null &&
    (before.chainTip === null || liveTip > before.chainTip)
  ) {
    await rt.syncTip();
  }
  timing.prepareMs = Date.now() - prepareStartedAt;
  let scanned = 0;
  let backfillRemaining = false;

  // Upstream's scan priorities, highest first. The runtime only scans a range
  // we ask for, from the set it considers safe, so a priority nobody asks for
  // is a priority that never runs:
  //
  //   verify       re-checks an already-scanned range is still on the main
  //                chain. Highest priority upstream; never asking means a
  //                reorg can go unnoticed.
  //   chainTip     completes the newest commitment-tree shard -- "is the
  //                balance current", which is what the user is looking at.
  //   foundNote    completes tree shards adjacent to notes we found. Skipping
  //                it leaves witnesses incomplete, and an incomplete witness
  //                means a note that cannot be spent.
  //   openAdjacent ranges around heights where the user opened the wallet.
  //   historic     backfill toward the birthday -- "does this wallet know all
  //                of its own history", which decides whether the balance on
  //                screen can be trusted.
  //
  // Driving only chainTip and historic was not a scheduling preference: verify,
  // foundNote and openAdjacent ranges simply sat queued forever.
  //
  // Order matters more than the budget split: the tip is reached early, and
  // whatever is left flows down to backfill.
  const LANES = [
    'verify',
    'chainTip',
    'foundNote',
    'openAdjacent',
    'historic',
  ] as const;
  let budget = BATCHES_PER_CALL;

  // Set once a reorg has been rolled back, to stop this pass: the scan queue
  // was just rewritten underneath us, so continuing with the remaining lanes
  // would work from a plan that no longer matches the database. The next call
  // re-plans and rescans the rolled-back range.
  let reorgRewoundTo: number | null = null;

  // Wall clock, not just batch count: how long a batch takes depends on block
  // density, which we cannot know in advance. The budget is what actually keeps
  // a pass from monopolizing the thread on a dense chain.
  const scanStartedAt = Date.now();
  const deadline = scanStartedAt + SYNC_TIME_BUDGET_MS;

  for (const lane of LANES) {
    if (reorgRewoundTo !== null) break;
    while (budget > 0 && Date.now() < deadline) {
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
        // Destructive by design: everything scanned above this height came
        // from the abandoned chain. The runtime may roll back further than
        // asked (commitment-tree checkpoints), so trust its return value.
        reorgRewoundTo = rt.rewindTo(rewindHeight);
        break;
      }
      budget -= 1;
      timing.steps += 1;
      scanned += r.blocksScanned;
      // Nothing scanned means this lane has no queued ranges; move to the next
      // one rather than burning the budget on empty calls.
      if (r.blocksScanned === 0) break;
      if (lane === 'historic' && !r.done) backfillRemaining = true;
      // Hand the thread back between batches. The scan is synchronous inside
      // the wasm and on desktop/web it shares a thread with the UI, so without
      // this the batches run back to back and the app is frozen for the whole
      // run. A macrotask, not just an await: a microtask resumes before the
      // browser gets to paint.
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

  // What the runtime still wants to scan, and where this account thinks it is.
  // `fullyScanned` alone cannot answer "is my history complete": it is a
  // wallet-wide figure, so it says nothing about whether THIS account's
  // birthday range was ever queued -- an account registered at the tip reports
  // "caught up" while never having looked at its own history.
  //
  // syncPeek and accountSyncStatus are both local reads, no network.
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
  // The queue is the truth about remaining work. Keying this on the historic
  // lane alone was wrong: a rescan re-queues the whole span at ChainTip
  // priority, so 29k blocks sat pending while the historic lane said "done"
  // and the scheduler never engaged its fast pace. Seen in-app.
  if (queuedAfter !== null) {
    backfillRemaining = queuedAfter > 0;
  }

  // Transparent UTXOs are not produced by block scanning -- they are public and
  // have to be queried by address. Skipping this leaves the transparent balance
  // at zero forever while the scan looks perfectly healthy, and shielding then
  // reports "nothing to shield".
  //
  // Only when the tip moved: the server answers from its *current* UTXO set,
  // so scanning historic blocks cannot change the answer -- `scanned > 0` here
  // made every backfill pass pay the round trip for an identical reply. An
  // address first discovered by backfill (gap limit) waits one block, ~75s,
  // for its UTXOs; the next tip write covers it.
  let transparentCurrent = true;
  let rebroadcastRejectedTxids: string[] = [];
  let rebroadcastAcceptedTxids: string[] = [];
  if (before.chainTip !== after.chainTip) {
    const utxoStartedAt = Date.now();
    try {
      // Transparent product reads come from the backend, but shielding still
      // needs runtime UTXOs for privacy-enabled accounts. Refresh only the
      // exact host-authorized UFVK set; accounts that paused Privacy Mode must
      // not keep generating wallet-runtime network activity just because a
      // different account on the shared database remains enabled.
      for (const ufvk of activeUfvks) {
        const runtimeAccount = JSON.parse(rt.accountByUfvk(ufvk)) as {
          uuid: string;
        } | null;
        if (runtimeAccount?.uuid) {
          // eslint-disable-next-line no-await-in-loop
          await rt.syncTransparentUtxos(runtimeAccount.uuid);
        }
      }
    } catch {
      transparentCurrent = false;
    }
    timing.utxoMs = Date.now() - utxoStartedAt;
    // Same cadence as the UTXO refresh (a new block is both a fresh chance
    // that the network works and a new expiry check). Never fails the pass.
    const rebroadcast = await rebroadcastUnmined(rt);
    rebroadcastAcceptedTxids = rebroadcast.accepted;
    rebroadcastRejectedTxids = rebroadcast.rejected;
  }

  // Where a pass actually goes. `idleBeforeMs` is the discriminator: a sync
  // that moves 100 blocks per 100 seconds is a scheduling problem if the work
  // took 5s, and a throughput problem if it took 95.
  const totalMs = Date.now() - passStartedAt;
  lastPassEndedAt = Date.now();
  // One flat line on purpose: the collapsed console object hid exactly the
  // fields that attribute a slow pass. `other` is everything the phases do
  // not account for -- database reads, JSON, yields, renderer contention.
  console.log(
    `[zcash] sync timing acct=${account.hdIndex} blocks=${scanned}` +
      ` total=${totalMs}ms idle=${idleBeforeMs ?? '-'}` +
      ` tip=${timing.tipMs} prep=${timing.prepareMs} scan=${timing.scanMs}` +
      ` utxo=${timing.utxoMs} other=${
        totalMs -
        (timing.tipMs + timing.prepareMs + timing.scanMs + timing.utxoMs)
      } queued=${queuedAfter ?? '?'} steps=${timing.steps}`,
  );

  return {
    transparentCurrent,
    // Always true now. The old implementation reported false when the carrier
    // had no threads: WebZjs needed a thread pool and therefore
    // crossOriginIsolated, which a system WebView cannot provide. This runtime
    // is single-threaded, and a real device run confirmed it scans with
    // crossOriginIsolated false.
    synced: true,
    // Lets the caller skip serialization, list refreshes and other expensive
    // follow-up work when a bounded pass found nothing new.
    //
    // Compared field by field on purpose: `readScanMark` builds a fresh object
    // each call, so `before !== after` is always true and this flag was always
    // true -- the skip it exists to enable never once happened.
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

// Pure read over an already-resolved handle. Split out so the lock-free fast
// path (carrier.tryReadOnlyHandle) and the leased path share one body; every
// statement here is a synchronous wasm call, which is what makes skipping the
// lease safe.
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

  // The two lanes answer different questions. The birthday lane answers "does
  // this wallet know all of its own history yet" — that is the one that decides
  // whether a balance can be trusted. The tip lane answers "how fresh is it",
  // and can be caught up while older ranges are still queued.
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

// Pure read over an already-resolved handle -- see readSyncProgress above for
// why this split exists.
export function readBalance(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  accountUuid: string,
): IZcashBalance {
  let raw: IRuntimeBalance;
  try {
    raw = JSON.parse(
      rt.accountBalance(
        accountUuid,
        TRUSTED_CONFIRMATIONS,
        UNTRUSTED_CONFIRMATIONS,
        ALLOW_ZERO_CONF_SHIELDING,
      ),
    ) as IRuntimeBalance;
  } catch (e) {
    // Nothing scanned yet is a state, not a fault: report zeroes so the UI can
    // render an account that simply has no data behind it.
    if (isZcashRuntimeError(e, 'NOT_SYNCED')) return zeroBalance();
    throw e;
  }

  // The runtime reports each pool separately and never merges them, because
  // which pool the money sits in is a fact while any total is a policy. The
  // summing happens here, where the policy lives.
  const shielded = BigInt(raw.orchard.total) + BigInt(raw.ironwood.total);
  const transparent =
    BigInt(raw.transparentRegular.total) +
    BigInt(raw.transparentCoinbase.total);
  const pendingChange =
    BigInt(raw.orchard.pendingChange) + BigInt(raw.ironwood.pendingChange);
  const pendingSpendable =
    BigInt(raw.orchard.pendingSpendable) +
    BigInt(raw.ironwood.pendingSpendable);

  // The account-wide spendable figure stays shielded-only. Transparent inputs
  // can be enabled only after the host knows both the account preference and a
  // shielded destination, so including them here would overstate what ordinary
  // sends can spend. Exact PCZT quotes report the transaction-specific sources.
  //
  // Excluded regardless of policy:
  //   coinbase -- reachable only through propose_shielding_coinbase, which
  //               this runtime does not implement
  // Per-pool `spendable` already accounts for the confirmation thresholds.
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
    shielded: shielded.toString(),
    transparent: transparent.toString(),
    spendable: spendable.toString(),
    pendingChange: pendingChange.toString(),
    pendingSpendable: pendingSpendable.toString(),
    total: (shielded + transparent).toString(),
    orchardBalance: String(raw.orchard.total),
    ironwoodBalance: String(raw.ironwood.total),
    transparentBalance: transparent.toString(),
    shieldedSpendable: shieldedSpendable.toString(),
    poolsDetail: {
      orchard: poolDetail(raw.orchard),
      ironwood: poolDetail(raw.ironwood),
      transparentRegular: poolDetail(raw.transparentRegular),
      transparentCoinbase: poolDetail(raw.transparentCoinbase),
    },
    transparentRegularBalance: String(raw.transparentRegular.total),
    transparentCoinbaseBalance: String(raw.transparentCoinbase.total),
  };
}

export async function getBalance(
  account: IZcashWalletAccount,
): Promise<IZcashBalance> {
  const { rt, accountUuid } = await withWallet(account);
  return readBalance(rt, accountUuid);
}

// Pure read over an already-resolved handle -- see readSyncProgress above for
// why this split exists. The paging loop stays synchronous on purpose: an
// await inside it would yield mid-read and give up the atomicity that lets
// the fast path skip the lease.
export function readHistory(
  rt: Awaited<ReturnType<typeof withWallet>>['rt'],
  accountUuid: string,
  pagination?: { limit?: number; offset?: number },
): IZcashHistoryItem[] {
  // The runtime caps a single call at 500 rows so one call cannot blow up
  // memory. That cap must not leak out as a silently truncated result: the
  // caller asks for 20001 rows precisely to tell "complete" from "truncated" by
  // the length it gets back, so clamping to 500 would report every wallet as
  // complete and let it discard older cached history. Page instead.
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

  // The runtime returns neutral facts and no classification: "is this income or
  // spending" is a display decision, and it is made here.
  //
  // The displayed amount is NOT the balance delta. The delta of a shielding
  // or self-transfer is just minus the fee, so the old delta-based display
  // showed every Shield as a fee-sized transaction; and a send's delta folds
  // the fee into the amount, disagreeing with the quote the user confirmed.
  // Classify and display from the directional sums instead:
  //
  //   external (left the account, fee excluded) = spent - received - fee
  //   sent      -> -external      shielded/self -> received (what arrived)
  //   received  -> received
  return rows.map((r) => {
    const delta = BigInt(r.balanceDeltaZat ?? 0);
    const spent = BigInt(r.totalSpentZat ?? 0);
    const received = BigInt(r.totalReceivedZat ?? 0);
    const feeKnown = r.feeZat !== null;
    const external = spent - received - BigInt(r.feeZat ?? 0);

    // Internal move (shield, withdraw to own transparent address, pool to
    // pool): we spent notes and every output stayed inside the account. Decide
    // it from the output ownership the runtime reports, not from
    // `spent - received - fee`: with the fee unknown that difference equals
    // the fee and mislabels a self-transfer as an outgoing send.
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
      // What arrived in the destination pool(s); `received` would also count
      // the change note that stayed behind in the source pool.
      const arrived = Object.values(r.perPoolBalanceDeltaZat ?? {})
        .map((v) => BigInt(v))
        .filter((v) => v > 0n)
        .reduce((sum, v) => sum + v, 0n);
      valueZat = arrived > 0n ? arrived : received;
    } else if (spent > 0n) {
      txType = 'sent';
      // After a rescan the fee can be unknown (no enhancement step yet);
      // claiming a fee-excluded figure would then be wrong, so fall back to
      // the delta -- the pre-fix display -- for exactly those rows.
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
      pending:
        r.minedHeight === null &&
        !r.expiredUnmined &&
        r.broadcastState !== 'rejected',
      expired:
        r.expiredUnmined ||
        (r.minedHeight === null && r.broadcastState === 'rejected'),
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
      address: string | null;
    }[];
    external: {
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
      address: o.address,
    })),
    // Outputs with no recorded address are dropped rather than surfaced with a
    // placeholder: an empty recipient in a transaction detail reads as a bug to
    // the user, and we cannot recover the address after the fact.
    external: outputs.external
      .filter((o): o is typeof o & { address: string } => !!o.address)
      .map((o) => ({
        address: o.address,
        value: String(o.valueZat),
        pool: o.poolName,
      })),
    feeZat: typeof summary?.feeZat === 'number' ? String(summary.feeZat) : null,
  };
}

// Drops this account's scanned state so it can be rebuilt from its UFVK and
// birthday. Everything here is derived cache; nothing unrecoverable is lost.
//
// It removes the ACCOUNT, not the database. There is one database per network
// and every account of every mnemonic lives in it (D14), so deleting the file
// would throw away every other account's scan state too — a per-account repair
// button that silently makes the whole wallet rescan. The database is deleted
// only once it holds nothing.
export async function purgeWallet(account: IZcashWalletAccount): Promise<void> {
  const { rt, accountUuid } = await withWallet(account);
  await rt.removeAccount(accountUuid);

  const remaining = JSON.parse(rt.listAccounts()) as string[];
  if (remaining.length > 0) return;

  // Last one out deletes the file. The database has to be closed first, and the
  // carrier's cached "which database is open" state cleared with it, otherwise
  // the next call reuses a handle to bytes that no longer exist.
  // Throws WALLET_BUSY if another operation still holds the database. Under the
  // lease that cannot happen, but propagating it beats deleting a database the
  // runtime still has open.
  rt.closeWallet();
  forgetOpenWallet();
  // A re-created database starts without subtree roots, so the freshness mark
  // must go with the file or the next sync would skip the prepare it needs.
  subtreeRootsFreshUntil.delete(walletDbName(account));
  await rt.deleteWallet(walletDbName(account));
}

// App reset: delete the per-network database outright. The runtime closes it
// first if it is the open one; a database that never existed is not an error.
export async function dropWalletDatabase(
  network: IZcashNetwork,
): Promise<void> {
  const rt = await getRuntime();
  const dbName = walletDbNameForNetwork(network);
  forgetOpenWallet();
  subtreeRootsFreshUntil.delete(dbName);
  await rt.deleteWallet(dbName);
}

// ---------------------------------------------------------------- helpers

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

function zeroPoolDetail() {
  const z = '0';
  return {
    spendable: z,
    pendingChange: z,
    pendingSpendable: z,
    locked: z,
    total: z,
  };
}

function zeroBalance(): IZcashBalance {
  const z = '0';
  return {
    shielded: z,
    transparent: z,
    spendable: z,
    pendingChange: z,
    pendingSpendable: z,
    total: z,
    orchardBalance: z,
    ironwoodBalance: z,
    transparentBalance: z,
    shieldedSpendable: z,
    poolsDetail: {
      orchard: zeroPoolDetail(),
      ironwood: zeroPoolDetail(),
      transparentRegular: zeroPoolDetail(),
      transparentCoinbase: zeroPoolDetail(),
    },
    transparentRegularBalance: z,
    transparentCoinbaseBalance: z,
  };
}
