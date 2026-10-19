import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import type {
  IZcashHistoryItem,
  IZcashTxDetails,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  PRIVACY_CHAIN_PUBLIC_POOL_ID,
  appendMissingPrivacyChainHistoryTxs,
  isPrivacyChainHistoryComplete,
  mergePrivacyChainHistoryTxs,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import {
  privacyChainPerfLog,
  privacyChainPerfSpan,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { loadCachedLocalWalletHistory } from '../../localWallet/cachedHistory';

import {
  fetchCompleteZcashBackendHistory,
  normalizeZcashBackendHistoryTx,
} from './backendHistory';
import {
  buildZcashLocalHistoryTx,
  findZcashLocalHistoryItem,
} from './localHistory';
import {
  isTerminalTransparentHistoryStatus,
  zcashDescribeError,
  zcashLastPrivateHistory,
} from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBUtxoAccount } from '../../../dbs/local/types';

// Runtime owns shielded + locally-created history; backend owns transparent history. The open pool tab decides which answers.
export async function zcashFetchBackendHistoryDetail(
  vault: Vault,
  params: IServerFetchAccountHistoryDetailParams,
): Promise<IServerFetchAccountHistoryDetailResp> {
  // A stale page may request this txid after Privacy Mode is off; prove the public association without the wallet runtime.
  const publicHistory = await vault.zcashFetchTransparentHistory({
    accountId: params.accountId || vault.accountId,
    networkId: params.networkId,
    accountAddress: params.accountAddress ?? '',
    xpub: params.xpub,
  });
  if (
    !publicHistory.txs.some(
      ({ decodedTx }) =>
        decodedTx.txid.toLowerCase() === params.txid.toLowerCase(),
    )
  ) {
    throw new OneKeyLocalError('zcash: transaction not found');
  }
  const response = await vault.baseFetchAccountHistoryDetail(params);
  const detail = response.data.data.data;
  if (detail) {
    response.data.data.data = params.withUTXOs
      ? {
          ...detail,
          sends:
            detail.sends?.filter(
              (send) => send.type !== EOnChainHistoryTransferType.Shielded,
            ) ?? [],
          receives:
            detail.receives?.filter(
              (receive) =>
                receive.type !== EOnChainHistoryTransferType.Shielded,
            ) ?? [],
          inputOutputSource: 'public',
        }
      : normalizeZcashBackendHistoryTx(detail);
  }
  return response;
}

export async function fetchAccountHistoryDetail(
  vault: Vault,
  params: IServerFetchAccountHistoryDetailParams,
): Promise<IServerFetchAccountHistoryDetailResp> {
  const accountId = params.accountId || vault.accountId;
  if (!accountId) {
    throw new OneKeyLocalError('zcash: history detail needs an account');
  }
  const privacyModeState =
    await vault.backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId,
    });
  if (privacyModeState.intent !== 'on') {
    return vault.zcashFetchBackendHistoryDetail(params);
  }
  // Split by pool, never merged: public belongs to the backend, private to the runtime; the open tab decides who answers.
  if (params.privacyChainPoolId === PRIVACY_CHAIN_PUBLIC_POOL_ID) {
    return vault.zcashFetchBackendHistoryDetail(params);
  }
  // Resolve local history before disclosing a txid to the indexer; a failed local lookup isn't evidence it's public.
  let item: IZcashHistoryItem | null;
  let account: Awaited<ReturnType<typeof vault.zcashGetWalletAccount>>;
  let api: Awaited<ReturnType<typeof vault.zcashGetApi>>;
  try {
    account = await vault.zcashGetWalletAccount({ accountId });
    api = await vault.zcashGetApi();
    item = await findZcashLocalHistoryItem({
      txid: params.txid,
      fetchPage: (pagination) => api.getHistory(account, pagination),
    });
  } catch (e) {
    // Only the runtime lookups above land here; a backend "not found" below is
    // the normal pending-tx state, not a runtime failure, so it isn't logged here.
    console.error('[zcash] runtime history detail failed', {
      txid: params.txid,
      ...zcashDescribeError(e),
    });
    throw e;
  }
  if (!item) {
    return vault.zcashFetchBackendHistoryDetail(params);
  }
  // No pool tab in the request: a row the runtime knows only as transparent is the backend's to describe.
  if (
    params.privacyChainPoolId === undefined &&
    !(item.poolIds ?? []).some(
      (poolId) => poolId !== PRIVACY_CHAIN_PUBLIC_POOL_ID,
    )
  ) {
    return vault.zcashFetchBackendHistoryDetail(params);
  }
  let details: IZcashTxDetails;
  let chainTip: number | null | undefined;
  try {
    // Account-view I/O from local note tables; shielded entries have no on-chain address, so they're labeled by pool.
    details = await api.getTxDetails(account, { txid: params.txid });
    chainTip = (await api.getSyncProgress(account).catch(() => undefined))
      ?.chainTip;
  } catch (e) {
    console.error('[zcash] runtime history detail failed', {
      txid: params.txid,
      ...zcashDescribeError(e),
    });
    throw e;
  }
  privacyChainPerfLog('bg history detail', {
    source: 'runtime',
    spent: details.spent.length,
    received: details.received.length,
    external: details.external.length,
  });
  let status = EOnChainHistoryTxStatus.Pending;
  if (item.expired) {
    status = EOnChainHistoryTxStatus.Failed;
  } else if (!item.pending && item.minedHeight !== null) {
    status = EOnChainHistoryTxStatus.Success;
  }
  // A tx with a transparent leg takes the indexer's status (backend wins the row, Failed/Dropped included) when no tab is open.
  let publicDetail: IOnChainHistoryTx | undefined;
  if (
    (params.privacyChainPoolId === undefined || params.withUTXOs) &&
    (item.poolIds ?? []).includes(PRIVACY_CHAIN_PUBLIC_POOL_ID)
  ) {
    publicDetail = await vault
      .zcashFetchBackendHistoryDetail(params)
      .then((response) => response.data.data.data)
      .catch(() => undefined);
    if (params.privacyChainPoolId === undefined && publicDetail?.status) {
      status = publicDetail.status;
    }
  }

  const poolLabel = (pool: string) =>
    `${pool.charAt(0).toUpperCase()}${pool.slice(1)} pool`;
  const toZec = (value: string) => zatoshiToZec(value);
  const sends: IOnChainHistoryTx['sends'] = details.spent.map((s) => {
    const isShielded = s.pool !== 'transparent';
    const label = isShielded ? poolLabel(s.pool) : '';
    return {
      type: isShielded
        ? EOnChainHistoryTransferType.Shielded
        : EOnChainHistoryTransferType.Transfer,
      address: isShielded ? label : (s.address ?? ''),
      from: isShielded ? '' : (s.address ?? ''),
      to: '',
      token: '',
      key: '',
      amount: toZec(s.value),
      label,
      isNative: true,
      isOwn: true,
    };
  });
  const receives: IOnChainHistoryTx['receives'] = [
    ...details.external.map((e) => ({
      type:
        e.pool === 'transparent'
          ? EOnChainHistoryTransferType.Transfer
          : EOnChainHistoryTransferType.Shielded,
      address: e.address ?? '',
      from: '',
      to: e.address ?? '',
      token: '',
      key: '',
      amount: toZec(e.value),
      label: e.pool === 'transparent' ? '' : poolLabel(e.pool),
      isNative: true,
      isOwn: false,
    })),
    // Payment details omit change; the wallet I/O view includes it explicitly.
    ...details.received
      .filter((r) => params.withUTXOs || !r.internal)
      .map((r) => {
        const isShielded = r.pool !== 'transparent';
        const label = isShielded ? poolLabel(r.pool) : '';
        return {
          type: isShielded
            ? EOnChainHistoryTransferType.Shielded
            : EOnChainHistoryTransferType.Transfer,
          address: isShielded ? label : (r.address ?? ''),
          from: '',
          to: isShielded ? '' : (r.address ?? ''),
          token: '',
          key: '',
          amount: toZec(r.value),
          label,
          isNative: true,
          isOwn: true,
          isChange: r.internal,
        };
      }),
  ];

  // Recipient memos decrypted by the runtime, excluding change; raw field and hash cover both UTF-8 and binary data.
  const memoOutputs = [
    ...details.received.filter((r) => !r.internal),
    ...details.external,
  ];
  const memos = memoOutputs.map((r) => r.memo).filter((m): m is string => !!m);
  const binaryMemos = memoOutputs
    .map((r) => r.memoBinary)
    .filter((m): m is { hex: string; hash: string } => !!m);
  const publicStatusDetail =
    params.privacyChainPoolId === undefined ? publicDetail : undefined;

  return {
    data: {
      data: {
        // Status consumers read `tx`/`status`; the details page reads `sends`/`receives`/`memo`.
        data: {
          tx: item.txid,
          status,
          block: publicStatusDetail?.block ?? item.minedHeight ?? undefined,
          confirmations:
            publicStatusDetail?.confirmations ??
            (item.minedHeight !== null &&
            chainTip !== null &&
            chainTip !== undefined
              ? Math.max(0, chainTip - item.minedHeight + 1)
              : undefined),
          timestamp: item.timestamp ?? undefined,
          gasFee: item.fee === null ? undefined : zatoshiToZec(item.fee),
          // Indexer owns public I/O; keep local shielded facts while replacing the public portion once association is proven.
          sends: publicDetail?.sends
            ? [
                ...sends.filter(
                  (send) => send.type === EOnChainHistoryTransferType.Shielded,
                ),
                ...publicDetail.sends.filter(
                  (send) => send.type !== EOnChainHistoryTransferType.Shielded,
                ),
              ]
            : sends,
          receives: publicDetail?.receives
            ? [
                ...receives.filter(
                  (receive) =>
                    receive.type === EOnChainHistoryTransferType.Shielded,
                ),
                ...publicDetail.receives
                  .filter(
                    (receive) =>
                      receive.type !== EOnChainHistoryTransferType.Shielded,
                  )
                  .map((receive) => ({
                    ...receive,
                    // Public indexer doesn't identify wallet change; preserve a matching change output known locally.
                    ...(receives.filter(
                      (local) =>
                        local.address === receive.address &&
                        local.amount === receive.amount,
                    ).length === 1 &&
                    receives.some(
                      (local) =>
                        local.isChange &&
                        local.address === receive.address &&
                        local.amount === receive.amount,
                    ) &&
                    publicDetail.receives?.filter(
                      (other) =>
                        other.address === receive.address &&
                        other.amount === receive.amount,
                    ).length === 1
                      ? { isChange: true }
                      : {}),
                  })),
              ]
            : receives,
          inputOutputSource: 'account',
          memo: memos.length ? memos.join('\n') : undefined,
          binaryMemos: binaryMemos.length ? binaryMemos : undefined,
        } as IOnChainHistoryTx,
        tokens: {},
        nfts: {},
      },
    },
  };
}

// MUST always return an array, never undefined: undefined falls through
// to the transparent-only server view and the reconciler deletes every shielded row.
export async function fetchAccountHistoryFromLocal(
  vault: Vault,
  params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  },
): Promise<IAccountHistoryTx[] | undefined> {
  // honor the explicit param; this.accountId is '' on a chain-only vault
  const accountId = params.accountId || vault.accountId;
  let items: IZcashHistoryItem[];
  let historySnapshotIsComplete = true;
  let chainTip: number | null | undefined;
  const loadCachedHistory = () =>
    loadCachedLocalWalletHistory({
      backgroundApi: vault.backgroundApi,
      networkId: params.networkId,
      accountAddress: params.accountAddress,
      xpub: params.xpub,
    });
  const privacyModeState =
    await vault.backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId,
    });
  if (privacyModeState.intent === 'on') {
    try {
      const account = await vault.zcashGetWalletAccount({ accountId });
      const api = await vault.zcashGetApi();
      const maxItems = 20_000;
      // One read-lock gives a coherent snapshot; the +1 row distinguishes an exact-maxItems result from truncation.
      items = await privacyChainPerfSpan(
        'bg history runtime read',
        () =>
          api.getHistory(account, {
            limit: maxItems + 1,
            offset: 0,
          }),
        (rows) => ({ rows: rows.length }),
      );
      historySnapshotIsComplete = items.length <= maxItems;
      if (!historySnapshotIsComplete) {
        items = items.slice(0, maxItems);
      }
      zcashLastPrivateHistory.set(accountId, items);
      const progress = await api.getSyncProgress(account);
      chainTip = progress.chainTip;
      historySnapshotIsComplete =
        historySnapshotIsComplete && progress.isBackfillComplete;
    } catch {
      // Scanner failure isn't evidence of empty history; keep the last private rows, marked incomplete.
      items = zcashLastPrivateHistory.get(accountId) ?? [];
      historySnapshotIsComplete = false;
    }
  } else {
    // Transparent Mode must not initialize the wallet runtime; the backend stays the only source until privacy is enabled.
    zcashLastPrivateHistory.delete(accountId);
    items = [];
  }
  const account = await vault.getAccount();
  const nativeToken = await vault.backgroundApi.serviceToken.getToken({
    accountId: vault.accountId,
    networkId: vault.networkId,
    tokenIdOnNetwork: '',
  });
  const buildRows = (rows: IZcashHistoryItem[]) =>
    Promise.all(
      rows.map((item) =>
        buildZcashLocalHistoryTx({
          item,
          chainTip,
          ownAddress: account.address,
          nativeToken,
          networkId: vault.networkId,
          accountId: vault.accountId,
          accountAddress: params.accountAddress,
          xpub: params.xpub,
          buildTransferAction: (p) => vault.buildTxTransferAssetAction(p),
        }),
      ),
    );

  const privateTxs = await privacyChainPerfSpan(
    'bg history map private rows',
    () => buildRows(items),
    (rows) => ({ rows: rows.length }),
  );

  let publicSideFailed = false;
  let publicSnapshotIsComplete = false;
  let publicTxs: IAccountHistoryTx[] = [];
  try {
    const publicResult = await privacyChainPerfSpan(
      'bg history transparent fetch',
      () => vault.zcashFetchTransparentHistory(params),
      (res) => ({ rows: res.txs.length }),
    );
    publicTxs = publicResult.txs;
    publicSnapshotIsComplete = publicResult.snapshotComplete;
  } catch (e) {
    publicSideFailed = true;
    console.error('[zcash] transparent history fetch failed', {
      name: e instanceof Error ? e.name : typeof e,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  const transparentPending =
    await vault.backgroundApi.simpleDb.zcash.listTransparentPendingTxs({
      accountId,
    });
  const cachedPendingMetadata = new Map(
    (await loadCachedHistory()).map((tx) => [
      tx.decodedTx.txid.toLowerCase(),
      tx.decodedTx,
    ]),
  );
  const observedTxs = new Map(
    publicTxs.map((tx) => [
      tx.decodedTx.txid.toLowerCase(),
      tx.decodedTx.status,
    ]),
  );
  const restorePendingJournal = (tx: IAccountHistoryTx): IAccountHistoryTx => {
    if (
      tx.decodedTx.status !== EDecodedTxStatus.Pending ||
      (tx.decodedTx.block ?? 0) > 0
    )
      return tx;
    const journal = transparentPending.find(
      (entry) => entry.txid.toLowerCase() === tx.decodedTx.txid.toLowerCase(),
    );
    const cached = cachedPendingMetadata.get(tx.decodedTx.txid.toLowerCase());
    const cachedEncoded = cached?.encodedTx as IEncodedTxZcash | undefined;
    const encodedTx = tx.decodedTx.encodedTx as IEncodedTxZcash | undefined;
    const historyEncoded = encodedTx?.zcashMode
      ? encodedTx
      : (cachedEncoded ?? encodedTx);
    // Missing local journal data says nothing about someone else's broadcast.
    if (!journal && historyEncoded?.zcashMode !== 'transparent') return tx;
    const expiry =
      journal?.expiryHeight ??
      cachedEncoded?.zcashTransparentBuild?.expiryHeight ??
      cachedEncoded?.expiry ??
      encodedTx?.expiry;
    const submittedAt =
      journal?.createdAt ?? cached?.createdAt ?? tx.decodedTx.createdAt;
    return {
      ...tx,
      decodedTx: {
        ...tx.decodedTx,
        broadcastOutcomeUnknown:
          !journal || journal.broadcastState === 'unknown',
        createdAt: submittedAt,
        updatedAt: submittedAt,
        ...(expiry === undefined || !historyEncoded
          ? {}
          : { encodedTx: { ...historyEncoded, expiry } }),
      },
    };
  };
  publicTxs = publicTxs.map(restorePendingJournal);
  if (!publicSideFailed) {
    await Promise.all(
      transparentPending.flatMap((tx) => {
        const status = observedTxs.get(tx.txid.toLowerCase());
        if (status === undefined) {
          // Not seen by the backend yet: an unknown-outcome tx is resubmitted since the same signed bytes are idempotent.
          return tx.broadcastState === 'unknown'
            ? [vault.zcashReplayUnknownTransparentBroadcast({ accountId, tx })]
            : [];
        }
        if (isTerminalTransparentHistoryStatus(status)) {
          return [
            vault.backgroundApi.simpleDb.zcash.settleTransparentPendingTx({
              accountId,
              txid: tx.txid,
            }),
          ];
        }
        // A Pending indexer row may be a server-side submission; it's not proof a node accepted the signed transaction.
        return [];
      }),
    );
    // An unknown-outcome send isn't in the backend's list yet; keep showing it pending until reported or expired.
    const unobserved = new Set(
      transparentPending
        .map((tx) => tx.txid.toLowerCase())
        .filter((txid) => !observedTxs.has(txid)),
    );
    if (unobserved.size > 0) {
      const cached = await loadCachedHistory();
      publicTxs = [
        ...publicTxs,
        ...cached
          .filter(
            (tx) =>
              unobserved.has(tx.decodedTx.txid.toLowerCase()) &&
              tx.decodedTx.status === EDecodedTxStatus.Pending,
          )
          .map(restorePendingJournal),
      ];
    }
    // Cache the transparent projection before merge promotes a cross-pool tx to `mixed`, which the generic cache rejects.
    try {
      await vault.backgroundApi.simpleDb.localHistory.saveLocalHistoryTxs({
        networkId: params.networkId,
        accountAddress: params.accountAddress,
        xpub: params.xpub,
        pendingTxs: publicTxs.filter(
          (tx) => tx.decodedTx.status === EDecodedTxStatus.Pending,
        ),
        confirmedTxs: publicTxs.filter(
          (tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending,
        ),
      });
    } catch (e) {
      console.error('[zcash] transparent history cache failed', {
        name: e instanceof Error ? e.name : typeof e,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  try {
    await vault.zcashPruneTransparentSendHistory(
      accountId,
      await loadCachedHistory(),
    );
  } catch (error) {
    console.error(
      '[zcash] expired transparent history update failed',
      zcashDescribeError(error),
    );
  }
  const settledCache = (await loadCachedHistory()).map(restorePendingJournal);
  const locallyDropped = new Set(
    settledCache
      .filter((tx) => tx.decodedTx.status === EDecodedTxStatus.Dropped)
      .map((tx) => tx.decodedTx.txid.toLowerCase()),
  );
  publicTxs = publicTxs.filter(
    (tx) =>
      tx.decodedTx.status !== EDecodedTxStatus.Pending ||
      !locallyDropped.has(tx.decodedTx.txid.toLowerCase()),
  );
  publicTxs.push(
    ...settledCache.filter(
      (tx) =>
        (tx.decodedTx.status === EDecodedTxStatus.Dropped ||
          tx.decodedTx.status === EDecodedTxStatus.Pending) &&
        !publicTxs.some((row) => row.decodedTx.txid === tx.decodedTx.txid),
    ),
  );
  const txs = mergePrivacyChainHistoryTxs({ privateTxs, publicTxs });
  if (
    isPrivacyChainHistoryComplete({
      privateSideComplete: historySnapshotIsComplete,
      publicSideFailed: publicSideFailed || !publicSnapshotIsComplete,
    })
  ) {
    return txs;
  }

  // During backfill, absence isn't evidence of deletion; merge the old cache until backfill completes.
  const cached = (await loadCachedHistory()).map(restorePendingJournal);
  return appendMissingPrivacyChainHistoryTxs({
    currentTxs: txs,
    cachedTxs: cached,
  });
}

// Throws on indexer failure (vs. empty) so the caller can tell 'nothing to add' from 'could not ask'.
export async function zcashFetchTransparentHistory(
  vault: Vault,
  params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  },
): Promise<{
  txs: IAccountHistoryTx[];
  snapshotComplete: boolean;
}> {
  const accountId = params.accountId || vault.accountId;
  const meta = await vault.backgroundApi.simpleDb.zcash.getAccountMeta({
    accountId,
  });
  let transparentAddress = meta?.transparentAddress || params.accountAddress;
  let xpub = params.xpub;
  if (!transparentAddress || xpub === undefined) {
    // Transparent Mode writes no metadata and a raw I/O request carries no address; the account's t-address answers both.
    const dbAccount = await vault.backgroundApi.serviceAccount.getDBAccountSafe(
      { accountId },
    );
    transparentAddress ||= dbAccount?.address ?? '';
    xpub ??=
      (dbAccount as IDBUtxoAccount | undefined)?.xpubSegwit ||
      (dbAccount as IDBUtxoAccount | undefined)?.xpub;
  }
  if (!transparentAddress) {
    return { txs: [], snapshotComplete: true };
  }
  const client = await vault.backgroundApi.serviceHistory.getClient(
    EServiceEndpointEnum.Wallet,
  );
  const headers = {
    ...(await vault.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
      accountId,
    })),
    ...(await vault.backgroundApi.serviceHistory.getOneKeyIdAuthHeaders()),
  };
  const dbAccountCache = {};
  return fetchCompleteZcashBackendHistory({
    fetchPage: async ({ limit, maxTimestampMs }) => {
      const response = await client.post<{
        data: IFetchAccountHistoryResp;
      }>(
        '/wallet/v1/account/history/list',
        {
          networkId: params.networkId,
          accountAddress: transparentAddress,
          xpub,
          tokenAddress: '',
          limit,
          ...(maxTimestampMs === undefined ? {} : { maxTimestampMs }),
        },
        { headers },
      );
      return response.data.data;
    },
    buildPage: async ({ page, indexOffset }) =>
      Promise.all(
        page.data.map((onChainHistoryTx, index) =>
          vault.buildOnChainHistoryTx({
            dbAccountCache,
            accountId,
            networkId: params.networkId,
            accountAddress: params.accountAddress,
            xpub: params.xpub,
            onChainHistoryTx: normalizeZcashBackendHistoryTx(onChainHistoryTx),
            tokens: page.tokens,
            nfts: page.nfts,
            index: indexOffset + index,
          }),
        ),
      ),
  });
}
