import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import { ZCASH_POOL_IDS } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { readZcashRuntimeError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashHistoryItem,
  IZcashTxDetails,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { ILocalWalletHistoryAddressGate } from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import {
  PRIVACY_CHAIN_PUBLIC_POOL_ID,
  mergePrivacyChainHistoryTxs,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
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
  isLocalWalletCacheEpochCurrent,
  readLocalWalletCacheEpoch,
} from '../../localWallet/privacyChainCacheStore';

import {
  ZCASH_BACKEND_HISTORY_PAGE_SIZE,
  fetchCompleteZcashBackendHistory,
  normalizeZcashBackendHistoryTx,
  restoreZcashLocalTransparentPayment,
} from './backendHistory';
import {
  buildZcashLocalHistoryTx,
  findZcashLocalHistoryItem,
} from './localHistory';
import {
  isZcashTransparentSendExpired,
  noteZcashChainHeight,
  zcashSettleTransparentPendingSends,
  zcashTransparentExpiryTip,
} from './vaultTransparent';
import {
  canReadZcashPrivateData,
  isTerminalTransparentHistoryStatus,
  isZcashSetupIncompleteError,
  zcashDescribeError,
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
  const publicTx = publicHistory.txs.find(
    ({ decodedTx }) =>
      decodedTx.txid.toLowerCase() === params.txid.toLowerCase(),
  );
  if (!publicTx) {
    throw new OneKeyLocalError('zcash: transaction not found');
  }
  const response = await vault.baseFetchAccountHistoryDetail(params);
  const detail = response.data.data.data;
  if (detail) {
    const publicDetail: IOnChainHistoryTx = params.withUTXOs
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
    const restored = restoreZcashLocalTransparentPayment({
      tx: publicDetail,
      localTx: publicTx,
      withUTXOs: params.withUTXOs,
    });
    response.data.data.data = restored;
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
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId,
      },
    );
  if (!canReadZcashPrivateData(privacyModeState)) {
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
    // A backend 'not found' is the normal pending state, not a runtime failure, so it is not logged.
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
    noteZcashChainHeight(vault.networkId, chainTip);
  } catch (e) {
    console.error('[zcash] runtime history detail failed', {
      txid: params.txid,
      ...zcashDescribeError(e),
    });
    throw e;
  }
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

  // Shielded entries carry no address of their own; they name their pool.
  const poolIdOf = (pool: string): number | undefined =>
    ZCASH_POOL_IDS[pool as keyof typeof ZCASH_POOL_IDS];
  const toZec = (value: string) => zatoshiToZec(value);
  const sends: IOnChainHistoryTx['sends'] = details.spent.map((s) => {
    const isShielded = s.pool !== 'transparent';
    return {
      type: isShielded
        ? EOnChainHistoryTransferType.Shielded
        : EOnChainHistoryTransferType.Transfer,
      address: isShielded ? '' : (s.address ?? ''),
      from: isShielded ? '' : (s.address ?? ''),
      to: '',
      token: '',
      key: '',
      amount: toZec(s.value),
      label: '',
      ...(isShielded ? { poolId: poolIdOf(s.pool) } : {}),
      isNative: true,
      isOwn: true,
    };
  });
  const receives: IOnChainHistoryTx['receives'] = [
    ...details.external.map((e) => {
      const isShielded = e.pool !== 'transparent';
      return {
        type: isShielded
          ? EOnChainHistoryTransferType.Shielded
          : EOnChainHistoryTransferType.Transfer,
        address: e.address ?? '',
        from: '',
        to: e.address ?? '',
        token: '',
        key: '',
        amount: toZec(e.value),
        label: '',
        ...(isShielded ? { poolId: poolIdOf(e.pool) } : {}),
        isNative: true,
        isOwn: false,
      };
    }),
    // Payment details omit change; the wallet I/O view includes it explicitly.
    ...details.received
      .filter((r) => params.withUTXOs || !r.internal)
      .map((r) => {
        const isShielded = r.pool !== 'transparent';
        return {
          type: isShielded
            ? EOnChainHistoryTransferType.Shielded
            : EOnChainHistoryTransferType.Transfer,
          address: isShielded && r.internal ? '' : (r.address ?? ''),
          from: '',
          to: isShielded && r.internal ? '' : (r.address ?? ''),
          token: '',
          key: '',
          amount: toZec(r.value),
          label: '',
          ...(isShielded ? { poolId: poolIdOf(r.pool) } : {}),
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
                        local.type !== EOnChainHistoryTransferType.Shielded &&
                        local.address === receive.address &&
                        local.amount === receive.amount,
                    ).length === 1 &&
                    receives.some(
                      (local) =>
                        local.type !== EOnChainHistoryTransferType.Shielded &&
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

// Local pending transparent sends past their expiry, for the shared history flow to drop.
export async function zcashDroppedPendingTxs(
  vault: Vault,
  pendingTxs: IAccountHistoryTx[],
): Promise<IAccountHistoryTx[]> {
  const expiryOf = (tx: IAccountHistoryTx) => {
    const encoded = tx.decodedTx.encodedTx as IEncodedTxZcash | undefined;
    return encoded?.zcashMode === 'transparent'
      ? (encoded.zcashTransparentBuild?.expiryHeight ?? encoded.expiry)
      : undefined;
  };
  if (!pendingTxs.some((tx) => expiryOf(tx) !== undefined)) return [];
  const tip = await zcashTransparentExpiryTip(vault);
  if (tip === undefined) return [];
  return pendingTxs.filter((tx) => {
    const expiry = expiryOf(tx);
    return expiry !== undefined && isZcashTransparentSendExpired(expiry, tip);
  });
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
    isManualRefresh?: boolean;
    // Rows written to the shared history cache pass this gate first.
    addressGate: ILocalWalletHistoryAddressGate;
  },
): Promise<IAccountHistoryTx[] | undefined> {
  // honor the explicit param; this.accountId is '' on a chain-only vault
  const accountId = params.accountId || vault.accountId;
  let items: IZcashHistoryItem[];
  let chainTip: number | null | undefined;
  const loadCachedHistory = () =>
    loadCachedLocalWalletHistory({
      backgroundApi: vault.backgroundApi,
      networkId: params.networkId,
      accountAddress: params.accountAddress,
      xpub: params.xpub,
    });
  const privacyModeState =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      {
        accountId,
      },
    );
  // A paused account keeps its runtime rows; deletion clears its resume position.
  if (canReadZcashPrivateData(privacyModeState)) {
    try {
      const account = await vault.zcashGetWalletAccount({ accountId });
      const api = await vault.zcashGetApi();
      const maxItems = 20_000;
      items = await api.getHistory(account, { limit: maxItems, offset: 0 });
      chainTip = (await api.getSyncProgress(account).catch(() => undefined))
        ?.chainTip;
      noteZcashChainHeight(vault.networkId, chainTip);
    } catch (error) {
      // Not registered or set up yet: there is no private history to show.
      if (
        readZcashRuntimeError(error)?.code !== 'ACCOUNT_NOT_FOUND' &&
        !isZcashSetupIncompleteError(error)
      ) {
        // As a failed backend fetch does, so the page keeps the rows it has.
        throw error;
      }
      items = [];
    }
  } else {
    // Transparent Mode must not initialize the wallet runtime; the backend stays the only source until privacy is enabled.
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

  const privateTxs = await buildRows(items);

  let publicTxs: IAccountHistoryTx[] = [];
  try {
    const publicResult = await vault.zcashFetchTransparentHistory(params);
    publicTxs = publicResult.txs;
    let settledTxids: Set<string> | undefined;
    // Only a complete snapshot may settle rows or raise the tip.
    if (publicResult.snapshotComplete) {
      noteZcashChainHeight(vault.networkId, publicResult.tipHeight);
      settledTxids = new Set(
        publicTxs
          .filter(
            ({ decodedTx }) =>
              (decodedTx.block ?? 0) > 0 ||
              isTerminalTransparentHistoryStatus(decodedTx.status),
          )
          .map(({ decodedTx }) => decodedTx.txid.toLowerCase()),
      );
    }
    await zcashSettleTransparentPendingSends(vault, {
      accountId,
      settledTxids,
    });
  } catch (e) {
    console.error('[zcash] transparent history fetch failed', {
      name: e instanceof Error ? e.name : typeof e,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  // Until a send is mined, this device's pending or dropped row stands for it:
  // the backend can keep listing an expired send as pending.
  const isLocallyHeld = (tx: IAccountHistoryTx) =>
    tx.decodedTx.status === EDecodedTxStatus.Dropped ||
    (tx.decodedTx.status === EDecodedTxStatus.Pending &&
      (tx.isLocalCreated === true || !!tx.decodedTx.encodedTx));
  const locallyHeld = new Set(
    (await loadCachedHistory())
      .filter(isLocallyHeld)
      .map((tx) => tx.decodedTx.txid.toLowerCase()),
  );
  publicTxs = publicTxs.filter(
    (tx) =>
      tx.decodedTx.status !== EDecodedTxStatus.Pending ||
      (tx.decodedTx.block ?? 0) > 0 ||
      !locallyHeld.has(tx.decodedTx.txid.toLowerCase()),
  );
  return mergePrivacyChainHistoryTxs({ privateTxs, publicTxs });
}

const ZCASH_TRANSPARENT_FULL_REFRESH_MS = 10 * 60 * 1000;

// Last complete backend snapshot per account, under the account epoch it was
// fetched in; routine polls merge the first page into it.
export const zcashTransparentHistorySnapshots = new LRUCache<
  string,
  {
    epoch: string | undefined;
    addressKey: string;
    txs: IAccountHistoryTx[];
    fullAt: number;
  }
>({ max: 64 });

// Every account's when none is named.
export function forgetZcashTransparentHistorySnapshots({
  networkId,
  accountIds,
}: {
  networkId: string;
  accountIds?: string[];
}) {
  if (!accountIds) {
    zcashTransparentHistorySnapshots.clear();
    return;
  }
  for (const accountId of accountIds) {
    zcashTransparentHistorySnapshots.delete(`${networkId}:${accountId}`);
  }
}

// Throws on indexer failure (vs. empty) so the caller can tell 'nothing to add' from 'could not ask'.
export async function zcashFetchTransparentHistory(
  vault: Vault,
  params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
    isManualRefresh?: boolean;
  },
): Promise<{
  txs: IAccountHistoryTx[];
  snapshotComplete: boolean;
  tipHeight?: number;
}> {
  const accountId = params.accountId || vault.accountId;
  const meta =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
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
    // Watch-only accounts are excluded from KYT, as in the standard history request.
    ...(accountUtils.isWatchingAccount({ accountId })
      ? {}
      : await vault.backgroundApi.serviceHistory.getOneKeyIdAuthHeaders()),
  };
  const dbAccountCache = {};
  // Backend tip: the highest indexed block in this same snapshot. Confirmations
  // aren't used until the backend documents what height they count from.
  let tipHeight: number | undefined;
  const cached = new Map(
    (
      await loadCachedLocalWalletHistory({
        backgroundApi: vault.backgroundApi,
        networkId: params.networkId,
        accountAddress: params.accountAddress || transparentAddress,
        xpub: params.xpub ?? xpub,
      })
    ).map((tx) => [tx.decodedTx.txid.toLowerCase(), tx]),
  );
  const backendPages: Parameters<typeof fetchCompleteZcashBackendHistory>[0] = {
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
        page.data.map(async (onChainHistoryTx, index) => {
          const { block = 0 } = onChainHistoryTx;
          if (Number.isSafeInteger(block) && block > 0) {
            tipHeight = Math.max(tipHeight ?? 0, block);
          }
          const localTx = cached.get(onChainHistoryTx.tx.toLowerCase());
          const normalized = normalizeZcashBackendHistoryTx(onChainHistoryTx);
          const restored = restoreZcashLocalTransparentPayment({
            tx: normalized,
            localTx,
          });
          const built = await vault.buildOnChainHistoryTx({
            dbAccountCache,
            accountId,
            networkId: params.networkId,
            accountAddress: params.accountAddress,
            xpub: params.xpub,
            onChainHistoryTx: restored,
            tokens: page.tokens,
            nfts: page.nfts,
            index: indexOffset + index,
          });
          if (!built || restored === normalized) return built;
          return {
            ...built,
            isLocalCreated: localTx?.isLocalCreated,
            decodedTx: {
              ...built.decodedTx,
              encodedTx: {
                ...(localTx?.decodedTx.encodedTx as IEncodedTxZcash),
                zcashMemoHex: undefined,
                zcashTransparentBuild: undefined,
              },
            },
          };
        }),
      ),
  };
  const snapshotKey = `${params.networkId}:${accountId}`;
  const addressKey = `${transparentAddress}:${xpub ?? ''}`;
  const epoch = await readLocalWalletCacheEpoch({
    backgroundApi: vault.backgroundApi,
    accountId,
  });
  const stored = zcashTransparentHistorySnapshots.get(snapshotKey);
  const snapshot =
    stored && stored.epoch === epoch && stored.addressKey === addressKey
      ? stored
      : undefined;
  const saveSnapshot = async (value: {
    txs: IAccountHistoryTx[];
    fullAt: number;
  }) => {
    if (
      await isLocalWalletCacheEpochCurrent({
        backgroundApi: vault.backgroundApi,
        accountId,
        epoch,
      })
    ) {
      zcashTransparentHistorySnapshots.set(snapshotKey, {
        epoch,
        addressKey,
        ...value,
      });
    }
  };
  // Callers may edit returned rows in place; the snapshot keeps its own copies.
  const copyRows = (txs: IAccountHistoryTx[]) =>
    txs.map((tx) => ({ ...tx, decodedTx: { ...tx.decodedTx } }));
  // The newest page, kept so a fallback to a full fetch doesn't request it again.
  let newestPage: IFetchAccountHistoryResp | undefined;
  if (
    snapshot &&
    !params.isManualRefresh &&
    Date.now() - snapshot.fullAt < ZCASH_TRANSPARENT_FULL_REFRESH_MS
  ) {
    const firstPage = await fetchCompleteZcashBackendHistory({
      ...backendPages,
      fetchPage: async (args) => {
        const page = await backendPages.fetchPage(args);
        if (args.maxTimestampMs === undefined) newestPage = page;
        return page;
      },
      maxItems: ZCASH_BACKEND_HISTORY_PAGE_SIZE,
    });
    if (firstPage.snapshotComplete) {
      await saveSnapshot({
        txs: copyRows(firstPage.txs),
        fullAt: Date.now(),
      });
      return { ...firstPage, tipHeight };
    }
    const pageTxids = new Set(
      firstPage.txs.map((tx) => tx.decodedTx.txid.toLowerCase()),
    );
    // A mined row seen in both means every newer row is on this page.
    if (
      snapshot.txs.some(
        (tx) =>
          tx.decodedTx.status !== EDecodedTxStatus.Pending &&
          pageTxids.has(tx.decodedTx.txid.toLowerCase()),
      )
    ) {
      const txs = [
        ...firstPage.txs,
        ...snapshot.txs.filter(
          (tx) => !pageTxids.has(tx.decodedTx.txid.toLowerCase()),
        ),
      ];
      await saveSnapshot({ txs, fullAt: snapshot.fullAt });
      // Not a full snapshot: callers may add or update rows but must not remove or drop any.
      return {
        txs: copyRows(txs),
        snapshotComplete: false,
      };
    }
  }
  tipHeight = undefined;
  const result = await fetchCompleteZcashBackendHistory({
    ...backendPages,
    fetchPage: async (args) => {
      const page = args.maxTimestampMs === undefined ? newestPage : undefined;
      newestPage = undefined;
      return page ?? backendPages.fetchPage(args);
    },
  });
  if (result.snapshotComplete) {
    await saveSnapshot({
      txs: copyRows(result.txs),
      fullAt: Date.now(),
    });
  }
  return { ...result, tipHeight };
}
