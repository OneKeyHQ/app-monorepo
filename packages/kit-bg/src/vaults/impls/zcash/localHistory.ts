import BigNumber from 'bignumber.js';

import {
  ZCASH_DECIMALS,
  ZCASH_POOL_NAME_BY_ID,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type { IZcashHistoryItem } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
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

const SHIELDED_COUNTERPARTY = 'Shielded';

function zcashPoolLabel(poolId: string): string {
  const name = ZCASH_POOL_NAME_BY_ID[poolId] ?? `pool ${poolId}`;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} pool`;
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
// side keeps the real address; shielded sides are labeled by pool.
export function resolveInternalMoveEndpoints({
  item,
  ownAddress,
}: {
  item: Pick<IZcashHistoryItem, 'perPoolBalanceDeltaZat'>;
  ownAddress: string;
}): { from: string; to: string } {
  const deltas = Object.entries(item.perPoolBalanceDeltaZat ?? {}).map(
    ([poolId, delta]) => [poolId, BigInt(delta)] as const,
  );
  const spentPools = deltas.filter(([, d]) => d < 0n).map(([id]) => id);
  const receivedPools = deltas.filter(([, d]) => d > 0n).map(([id]) => id);
  const transparentDelta = deltas.find(([id]) => id === '0')?.[1] ?? 0n;
  const shieldedSpent = spentPools.find((id) => id !== '0');
  const shieldedReceived = receivedPools.find((id) => id !== '0');
  if (transparentDelta > 0n) {
    // withdraw: shielded pool -> own transparent address
    return { from: zcashPoolLabel(shieldedSpent ?? '0'), to: ownAddress };
  }
  if (transparentDelta < 0n) {
    // shield: own transparent address -> shielded pool
    return { from: ownAddress, to: zcashPoolLabel(shieldedReceived ?? '0') };
  }
  const source = shieldedSpent ?? spentPools[0] ?? '0';
  return {
    from: zcashPoolLabel(source),
    to: zcashPoolLabel(shieldedReceived ?? receivedPools[0] ?? source),
  };
}

// Maps one runtime history row to the app's history-tx shape. Pure except for
// the injected action builder (a VaultBase method); Vault.ts keeps only the
// snapshot/merge orchestration around this.
export async function buildZcashLocalHistoryTx({
  item,
  ownAddress,
  nativeToken,
  networkId,
  accountId,
  accountAddress,
  xpub,
  buildTransferAction,
}: {
  item: IZcashHistoryItem;
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
  const nativeAmountIsUnknown = isSent && item.fee === null;
  const amount = nativeAmountIsUnknown
    ? '0'
    : new BigNumber(item.valueZat).abs().shiftedBy(-ZCASH_DECIMALS).toFixed();
  // own address goes on the known side; the other side comes from the
  // recorded entered recipient when this device sent it, else stays empty
  // The own transparent address stands in for "this account" on the side
  // that decides direction (buildTxActionDirection compares against it). The
  // other side is what the list shows: a shielded sender is unknowable, and
  // a shielded recipient survives a rescan only when we recorded it.
  let from = isSent || isInternal ? ownAddress : SHIELDED_COUNTERPARTY;
  let to = ownAddress;
  if (!isInternal && isSent) {
    to = item.recipient || SHIELDED_COUNTERPARTY;
  }
  if (isInternal) {
    // Name the pools instead of putting the own address on both ends: that
    // reads as "unknown" in the list, and the direction (a withdraw is money
    // arriving at the transparent address, a shield is money leaving it)
    // is what the per-pool tabs project from.
    const endpoints = resolveInternalMoveEndpoints({ item, ownAddress });
    from = endpoints.from;
    to = endpoints.to;
  }
  const action = await buildTransferAction({
    from,
    to,
    transfers: [
      {
        from,
        to,
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
  // The own transparent address only served to fix the direction above. A
  // shielded leg has no address to show, so the own side is labeled by the
  // pool it lives in and flagged isOwn, which keeps the detail page from
  // presenting the t-address as the sender or recipient of shielded value.
  if (action.assetTransfer && !isInternal) {
    const ownPoolLabel = zcashPoolLabel(
      resolveOwnShieldedPool({ item, isSent }) ?? '0',
    );
    action.assetTransfer.sends = action.assetTransfer.sends.map((s) => ({
      ...s,
      from: ownPoolLabel,
      isOwn: true,
    }));
    action.assetTransfer.receives = action.assetTransfer.receives.map((r) => ({
      ...r,
      to: ownPoolLabel,
      isOwn: true,
    }));
    action.assetTransfer.from = isSent ? ownPoolLabel : from;
    action.assetTransfer.to = isSent ? to : ownPoolLabel;
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
