import BigNumber from 'bignumber.js';

import { ZCASH_DECIMALS } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type { IZcashHistoryItem } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionAssetTransfer,
  IDecodedTxShieldedEndpoint,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

export async function findZcashLocalHistoryItem({
  txid,
  fetchPage,
  pageSize = 500,
  maxItems = 20_000,
}: {
  txid: string;
  fetchPage: (params: {
    limit: number;
    offset: number;
  }) => Promise<IZcashHistoryItem[]>;
  pageSize?: number;
  maxItems?: number;
}): Promise<IZcashHistoryItem | null> {
  for (let offset = 0; offset < maxItems; offset += pageSize) {
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage({
      limit: Math.min(pageSize, maxItems - offset),
      offset,
    });
    const item = page.find((row) => row.txid === txid);
    if (item) {
      return item;
    }
    if (page.length < pageSize) {
      return null;
    }
  }
  return null;
}

export function resolvePrivacyChainHistorySide({
  poolIds,
}: Pick<
  IZcashHistoryItem,
  'poolIds'
>): IAccountHistoryTx['privacyChainHistorySide'] {
  const involvesTransparent = poolIds.includes(0);
  const involvesShielded = poolIds.some((poolId) => poolId !== 0);
  if (involvesTransparent && involvesShielded) {
    return 'mixed';
  }
  if (involvesTransparent) {
    return 'public';
  }
  if (involvesShielded) {
    return 'private';
  }
  return undefined;
}

// A shielded endpoint keeps an address only when it is exactly known; it
// names its pool when known and whether it is this account's side.
export type IZcashHistoryEndpoint = {
  address: string;
  shielded?: IDecodedTxShieldedEndpoint;
};

// The other party inside a shielded pool: the protocol hides its address.
function shieldedCounterparty(poolId?: string): IZcashHistoryEndpoint {
  return {
    address: '',
    shielded: poolId === undefined ? {} : { poolId: Number(poolId) },
  };
}

// This account's side in one of its shielded pools.
function zcashPoolEndpoint(poolId: string): IZcashHistoryEndpoint {
  return { address: '', shielded: { poolId: Number(poolId), isOwn: true } };
}

function withZcashEndpoints<
  T extends Pick<IDecodedTxTransferInfo, 'from' | 'to'> &
    Pick<IDecodedTxActionAssetTransfer, 'shieldedFrom' | 'shieldedTo'>,
>(target: T, from: IZcashHistoryEndpoint, to: IZcashHistoryEndpoint): T {
  return {
    ...target,
    from: from.address,
    to: to.address,
    ...(from.shielded ? { shieldedFrom: from.shielded } : {}),
    ...(to.shielded ? { shieldedTo: to.shielded } : {}),
  };
}

// The shielded pool this account spent from (sent) or received into.
function resolveOwnShieldedPool({
  item,
  isSent,
}: {
  item: Pick<IZcashHistoryItem, 'perPoolBalanceDeltaZat' | 'poolIds'>;
  isSent: boolean;
}): string | undefined {
  const deltas = Object.entries(item.perPoolBalanceDeltaZat ?? {})
    .map(([poolId, delta]) => [poolId, BigInt(delta)] as const)
    .filter(([poolId]) => poolId !== '0');
  const match = deltas.find(([, d]) => (isSent ? d < 0n : d > 0n));
  return (
    match?.[0] ?? item.poolIds.map(String).find((poolId) => poolId !== '0')
  );
}

// Where an internal move came from and went to, by pool. The transparent
// side keeps the real address; shielded sides name their pool.
export function resolveInternalMoveEndpoints({
  item,
  ownAddress,
}: {
  item: Pick<IZcashHistoryItem, 'perPoolBalanceDeltaZat'>;
  ownAddress: string;
}): { from: IZcashHistoryEndpoint; to: IZcashHistoryEndpoint } {
  const deltas = Object.entries(item.perPoolBalanceDeltaZat ?? {}).map(
    ([poolId, delta]) => [poolId, BigInt(delta)] as const,
  );
  const spentPools = deltas.filter(([, d]) => d < 0n).map(([id]) => id);
  const receivedPools = deltas.filter(([, d]) => d > 0n).map(([id]) => id);
  const transparentDelta = deltas.find(([id]) => id === '0')?.[1] ?? 0n;
  const shieldedSpent = spentPools.find((id) => id !== '0');
  const shieldedReceived = receivedPools.find((id) => id !== '0');
  const own: IZcashHistoryEndpoint = { address: ownAddress };
  if (transparentDelta > 0n) {
    // withdraw: shielded pool -> own transparent address
    return { from: zcashPoolEndpoint(shieldedSpent ?? '0'), to: own };
  }
  if (transparentDelta < 0n) {
    // shield: own transparent address -> shielded pool
    return { from: own, to: zcashPoolEndpoint(shieldedReceived ?? '0') };
  }
  const source = shieldedSpent ?? spentPools[0] ?? '0';
  return {
    from: zcashPoolEndpoint(source),
    to: zcashPoolEndpoint(shieldedReceived ?? receivedPools[0] ?? source),
  };
}

// Maps one runtime history row to the app's history-tx shape; pure except
// for the injected action builder (a VaultBase method).
export async function buildZcashLocalHistoryTx({
  item,
  chainTip,
  ownAddress,
  nativeToken,
  networkId,
  accountId,
  accountAddress,
  xpub,
  buildTransferAction,
}: {
  item: IZcashHistoryItem;
  chainTip?: number | null;
  ownAddress: string;
  nativeToken:
    | Pick<IToken, 'address' | 'logoURI' | 'name' | 'symbol'>
    | undefined
    | null;
  networkId: string;
  accountId: string;
  accountAddress: string;
  xpub?: string;
  buildTransferAction: (params: {
    from: string;
    to: string;
    transfers: IDecodedTxTransferInfo[];
  }) => Promise<IDecodedTxAction>;
}): Promise<IAccountHistoryTx> {
  const isSent = item.txType === 'sent';
  // 'shielded' = internal move between own pools; both sides are us
  const isInternal = item.txType === 'shielded';
  // A rescan may know only the same-pool fee delta, without payment outputs.
  // That is missing payment information, not proof of a zero-value payment.
  const nativeAmountIsUnknown =
    (isSent && item.fee === null) ||
    (isInternal && new BigNumber(item.valueZat).isZero());
  const amount = nativeAmountIsUnknown
    ? '0'
    : new BigNumber(item.valueZat).abs().shiftedBy(-ZCASH_DECIMALS).toFixed();
  // Own address stands in for "this account" so buildTxActionDirection can
  // read direction from it. A shielded sender is unknowable; a shielded
  // recipient survives a rescan only if we recorded it.
  const ownPoolId = resolveOwnShieldedPool({ item, isSent }) ?? '0';
  // An incoming note's sender is hidden; it paid into the receiving pool.
  let from: IZcashHistoryEndpoint =
    isSent || isInternal
      ? { address: ownAddress }
      : shieldedCounterparty(ownPoolId);
  let to: IZcashHistoryEndpoint = { address: ownAddress };
  if (!isInternal && isSent) {
    to = item.recipient ? { address: item.recipient } : shieldedCounterparty();
  }
  if (isInternal) {
    // Name the pools instead of reusing the own address on both ends (that
    // reads as "unknown"); per-pool tabs project direction from this.
    const endpoints = resolveInternalMoveEndpoints({ item, ownAddress });
    from = endpoints.from;
    to = endpoints.to;
  }
  // Classify internal movements as our own send before replacing account
  // identifiers with pool endpoints, which carry no account address.
  const actionFrom = isInternal ? ownAddress : from.address;
  const actionTo = isInternal ? ownAddress : to.address;
  const action = await buildTransferAction({
    from: actionFrom,
    to: actionTo,
    transfers: [
      {
        from: actionFrom,
        to: actionTo,
        amount,
        tokenIdOnNetwork: nativeToken?.address ?? '',
        icon: nativeToken?.logoURI ?? '',
        name: nativeToken?.name ?? '',
        symbol: nativeToken?.symbol ?? '',
        isNFT: false,
        isNative: true,
      },
    ],
  });
  if (action.assetTransfer && isInternal) {
    action.assetTransfer = withZcashEndpoints(action.assetTransfer, from, to);
    action.assetTransfer.sends = action.assetTransfer.sends.map((send) => ({
      ...withZcashEndpoints(send, from, to),
      isOwn: true,
    }));
  }
  // Own transparent address only fixed direction above; a shielded leg has
  // no address, so it names its pool + isOwn (never shown as the t-address).
  if (action.assetTransfer && !isInternal) {
    const ownPool = zcashPoolEndpoint(ownPoolId);
    // Only a sent row has sends and only a received row has receives.
    action.assetTransfer.sends = action.assetTransfer.sends.map((s) => ({
      ...withZcashEndpoints(s, ownPool, to),
      isOwn: true,
    }));
    action.assetTransfer.receives = action.assetTransfer.receives.map((r) => ({
      ...withZcashEndpoints(r, from, ownPool),
      isOwn: true,
    }));
    action.assetTransfer = isSent
      ? withZcashEndpoints(action.assetTransfer, ownPool, to)
      : withZcashEndpoints(action.assetTransfer, from, ownPool);
  }
  // unmined txs have no block time; without a stand-in they sort to the
  // BOTTOM of the history list (sort key falls back to 0)
  const timestampMs = item.timestamp
    ? item.timestamp * 1000
    : (item.pending && Date.now()) || undefined;
  const decodedTx: IDecodedTx = {
    txid: item.txid,
    owner: ownAddress,
    signer: isSent || isInternal ? ownAddress : '',
    nonce: 0,
    actions: [action],
    status: (() => {
      if (item.expired) return EDecodedTxStatus.Failed;
      if (item.pending) return EDecodedTxStatus.Pending;
      return EDecodedTxStatus.Confirmed;
    })(),
    networkId,
    accountId,
    extraInfo: null,
    totalFeeInNative: item.fee
      ? new BigNumber(item.fee).shiftedBy(-ZCASH_DECIMALS).toFixed()
      : undefined,
    block: item.minedHeight ?? undefined,
    confirmations:
      item.minedHeight !== null && chainTip !== null && chainTip !== undefined
        ? Math.max(0, chainTip - item.minedHeight + 1)
        : undefined,
    nativeAmount: amount,
    ...(nativeAmountIsUnknown ? { nativeAmountIsUnknown: true } : {}),
    createdAt: timestampMs,
    updatedAt: timestampMs,
  };
  const privacyChainHistorySide = resolvePrivacyChainHistorySide(item);
  return {
    id: accountUtils.buildLocalHistoryId({
      networkId,
      accountAddress,
      txid: item.txid,
      xpub,
    }),
    decodedTx,
    privacyChainHistoryPoolIds: item.poolIds,
    privacyChainHistoryPoolDeltas: Object.fromEntries(
      Object.entries(item.perPoolBalanceDeltaZat).map(([poolId, deltaZat]) => [
        poolId,
        new BigNumber(deltaZat).shiftedBy(-ZCASH_DECIMALS).toFixed(),
      ]),
    ),
    ...(privacyChainHistorySide ? { privacyChainHistorySide } : {}),
  };
}
