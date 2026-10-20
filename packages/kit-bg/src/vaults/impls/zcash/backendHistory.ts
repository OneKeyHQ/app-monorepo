import BigNumber from 'bignumber.js';

import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';

// Public I/O of mined self-transfers, keyed by `${networkId}:${txid}`; every
// history snapshot rebuilds these rows, and mined I/O never changes.
export const zcashSelfTransferDetailCache = new LRUCache<
  string,
  IOnChainHistoryTx
>({ max: 512 });

function isTransparentSelfTransfer(tx: IOnChainHistoryTx) {
  return (
    tx.type === EOnChainHistoryTxType.Send &&
    /^t[13]/.test(tx.from) &&
    tx.from === tx.to
  );
}

export async function restoreZcashBackendSelfTransfer(
  vault: Vault,
  tx: IOnChainHistoryTx,
): Promise<IOnChainHistoryTx> {
  if (!isTransparentSelfTransfer(tx) || tx.receives?.length) return tx;
  // Only the fee leaves a true self-payment; a larger debit went elsewhere
  // (e.g. shielded), so a lone receive is unflagged change, not the payment.
  // Checked only when the list reports the fee; today it often omits it.
  if (tx.gasFee && !new BigNumber(tx.value).isEqualTo(tx.gasFee)) return tx;
  const cacheKey = `${vault.networkId}:${tx.tx}`;
  try {
    let detail = zcashSelfTransferDetailCache.get(cacheKey);
    if (!detail) {
      // Account-scoped history omits owned outputs and reports the net debit.
      // The existing public I/O endpoint retains the actual self-payment.
      const response = await vault.baseFetchAccountHistoryDetail({
        accountId: vault.accountId,
        networkId: vault.networkId,
        txid: tx.tx,
      });
      detail = response.data.data.data;
      if (
        detail?.tx === tx.tx &&
        tx.status !== EOnChainHistoryTxStatus.Pending
      ) {
        zcashSelfTransferDetailCache.set(cacheKey, detail);
      }
    }
    const payment = detail?.receives?.[0];
    if (
      detail?.tx !== tx.tx ||
      detail.receives?.length !== 1 ||
      !detail.sends?.length ||
      detail.sends.some(
        (input) =>
          input.type === EOnChainHistoryTransferType.Shielded ||
          input.from !== tx.from,
      ) ||
      payment?.type === EOnChainHistoryTransferType.Shielded ||
      payment?.isChange === true ||
      payment?.to !== tx.to ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,8})?$/.test(payment.amount) ||
      !/[1-9]/.test(payment.amount)
    ) {
      return tx;
    }
    const transfer: IOnChainHistoryTxTransfer = {
      ...payment,
      type: EOnChainHistoryTransferType.Transfer,
      from: tx.from,
      key: `${tx.networkId}_`,
      isOwn: true,
      isNative: true,
    };
    return {
      ...tx,
      value: payment.amount,
      sends: [transfer],
      receives: [transfer],
    };
  } catch {
    // Unavailable or ambiguous I/O must not turn a net fee into a payment.
    return tx;
  }
}

export function isZcashBackendPaymentAmountUnknown(tx: IOnChainHistoryTx) {
  return (
    tx.type === EOnChainHistoryTxType.Send &&
    isTransparentSelfTransfer(tx) &&
    !tx.receives?.length
  );
}

function getLocalTransparentPayment({
  txid,
  networkId,
  localTx,
}: {
  txid: string;
  networkId: string;
  localTx?: IAccountHistoryTx;
}) {
  const local = localTx?.decodedTx;
  const encoded = local?.encodedTx as IEncodedTxZcash | undefined;
  const feeZat = String(encoded?.fee);
  // The send path sets this existing marker after matching the signed result.
  // Reuse its compact payment fields rather than retaining signed bytes here.
  if (
    localTx?.privacyChainHistorySide !== 'public' ||
    localTx.isLocalCreated !== true ||
    networkId !== 'zec--0' ||
    local?.networkId !== networkId ||
    local?.txid.toLowerCase() !== txid.toLowerCase() ||
    encoded?.zcashMode !== 'transparent' ||
    !encoded.zcashTo ||
    !/^(0|[1-9][0-9]*)$/.test(encoded.zcashAmountValue) ||
    !/^(0|[1-9][0-9]*)$/.test(feeZat)
  ) {
    return undefined;
  }
  return {
    local,
    encoded,
    amount: zatoshiToZec(encoded.zcashAmountValue),
    fee: zatoshiToZec(feeZat),
  };
}

export function restoreZcashLocalTransparentPayment({
  tx,
  localTx,
  withUTXOs = false,
}: {
  tx: IOnChainHistoryTx;
  localTx?: IAccountHistoryTx;
  withUTXOs?: boolean;
}): IOnChainHistoryTx {
  const payment = getLocalTransparentPayment({
    txid: tx.tx,
    networkId: tx.networkId,
    localTx,
  });
  if (!payment) return tx;
  const { local, encoded, amount, fee } = payment;
  const from = tx.from || local.signer || local.owner;
  const to = encoded.zcashTo;
  const transfer = {
    type: EOnChainHistoryTransferType.Transfer,
    from,
    to,
    token: '',
    key: `${tx.networkId}_`,
    amount,
    label: '',
    isNative: true,
  };
  // The indexer sees only the transparent debit, which can include the fee.
  // Keep the payment verified at signing; raw I/O remains the indexer's data.
  return {
    ...tx,
    type: EOnChainHistoryTxType.Send,
    from,
    to,
    shieldedCounterparty: undefined,
    value: amount,
    gasFee: fee,
    gasFeeFiatValue: tx.gasFee === fee ? tx.gasFeeFiatValue : '',
    ...(withUTXOs
      ? {}
      : {
          sends: [{ ...transfer, isOwn: true }],
          receives: [{ ...transfer, isOwn: from === to }],
        }),
  };
}

export function mergeZcashLocalTransparentPayment({
  localTx,
  onChainHistoryTx,
}: {
  localTx: IAccountHistoryTx;
  onChainHistoryTx: IAccountHistoryTx;
}): IAccountHistoryTx {
  const next = onChainHistoryTx.decodedTx;
  if (
    (onChainHistoryTx.privacyChainHistorySide !== undefined &&
      onChainHistoryTx.privacyChainHistorySide !== 'public') ||
    localTx.decodedTx.accountId !== next.accountId
  ) {
    return onChainHistoryTx;
  }
  const payment = getLocalTransparentPayment({
    txid: next.txid,
    networkId: next.networkId,
    localTx,
  });
  if (!payment) return onChainHistoryTx;
  const { local, encoded, amount, fee } = payment;
  const publicEncoded: IEncodedTxZcash = {
    ...encoded,
    zcashMemoHex: undefined,
    zcashTransparentBuild: undefined,
  };
  const price = next.actions
    .flatMap((action) => [
      ...(action.assetTransfer?.sends ?? []),
      ...(action.assetTransfer?.receives ?? []),
    ])
    .find(
      (transfer) => transfer.isNative && transfer.price !== undefined,
    )?.price;
  return {
    ...onChainHistoryTx,
    isLocalCreated: true,
    privacyChainHistorySide: 'public',
    privacyChainHistoryPoolIds: [0],
    decodedTx: {
      ...next,
      to: encoded.zcashTo,
      nativeAmount: amount,
      nativeAmountValue: encoded.zcashAmountValue,
      nativeAmountIsUnknown: false,
      totalFeeInNative: fee,
      totalFeeFiatValue:
        next.totalFeeInNative === fee ? next.totalFeeFiatValue : undefined,
      encodedTx: publicEncoded,
      payload: next.payload ? { ...next.payload, value: amount } : next.payload,
      actions: local.actions.map((action) =>
        action.assetTransfer && price !== undefined
          ? {
              ...action,
              assetTransfer: {
                ...action.assetTransfer,
                sends: action.assetTransfer.sends.map((transfer) =>
                  transfer.isNative ? { ...transfer, price } : transfer,
                ),
                receives: action.assetTransfer.receives.map((transfer) =>
                  transfer.isNative ? { ...transfer, price } : transfer,
                ),
              },
            }
          : action,
      ),
    },
  };
}

function shieldedCounterparty(amount: string): IOnChainHistoryTxTransfer {
  return {
    type: EOnChainHistoryTransferType.Shielded,
    address: '',
    from: '',
    to: '',
    token: '',
    key: '',
    amount,
    label: '',
    isNative: true,
    isOwn: false,
  };
}

// The indexer only sees the transparent leg. A receive with no inputs it can
// attribute (money arriving from a shielded pool) comes back with `sends: []`
// and an empty `from`; a send whose outputs all went shielded comes back
// with no external receive. The generic UTXO renderer then reads
// `sends[0].from` / `receives[0].to` and shows "unknown". Add the shielded
// side as an entry; it has no address, so the tx marks that side instead.
export function normalizeZcashBackendHistoryTx(
  tx: IOnChainHistoryTx,
): IOnChainHistoryTx {
  const sends = tx.sends ?? [];
  const receives = tx.receives ?? [];
  if (tx.type === EOnChainHistoryTxType.Receive && sends.length === 0) {
    return {
      ...tx,
      ...(tx.from ? {} : { shieldedCounterparty: 'from' as const }),
      sends: [shieldedCounterparty(tx.value ?? '0')],
    };
  }
  if (
    tx.type === EOnChainHistoryTxType.Send &&
    !isTransparentSelfTransfer(tx) &&
    receives.every((receive) => receive.isOwn)
  ) {
    return {
      ...tx,
      ...(tx.to ? {} : { shieldedCounterparty: 'to' as const }),
      receives: [...receives, shieldedCounterparty(tx.value ?? '0')],
    };
  }
  return tx;
}

// Carries the indexer row's shielded side onto the built history action.
export function markZcashBackendShieldedCounterparty({
  onChainHistoryTx,
  historyTx,
}: {
  onChainHistoryTx: IOnChainHistoryTx;
  historyTx: IAccountHistoryTx;
}) {
  const transfer = historyTx.decodedTx.actions[0]?.assetTransfer;
  if (!transfer) return;
  if (onChainHistoryTx.shieldedCounterparty === 'from') {
    transfer.shieldedFrom = {};
  } else if (onChainHistoryTx.shieldedCounterparty === 'to') {
    transfer.shieldedTo = {};
  }
}

export async function fetchCompleteZcashBackendHistory({
  fetchPage,
  buildPage,
  maxItems = 20_000,
  pageSize = 500,
}: {
  fetchPage: (params: {
    limit: number;
    maxTimestampMs?: number;
  }) => Promise<IFetchAccountHistoryResp>;
  buildPage: (params: {
    page: IFetchAccountHistoryResp;
    indexOffset: number;
  }) => Promise<(IAccountHistoryTx | null)[]>;
  maxItems?: number;
  pageSize?: number;
}): Promise<{ txs: IAccountHistoryTx[]; snapshotComplete: boolean }> {
  const txs: IAccountHistoryTx[] = [];
  let maxTimestampMs: number | undefined;
  let snapshotComplete = false;
  let processedItems = 0;
  let hasBuildFailures = false;

  while (processedItems < maxItems) {
    const requestedLimit = Math.min(pageSize, maxItems - processedItems);
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage({
      limit: requestedLimit,
      maxTimestampMs,
    });
    // eslint-disable-next-line no-await-in-loop
    const built = await buildPage({ page, indexOffset: processedItems });
    processedItems += page.data.length;
    if (built.length !== page.data.length || built.some((tx) => !tx)) {
      hasBuildFailures = true;
    }
    txs.push(
      ...built
        .filter((tx): tx is IAccountHistoryTx => !!tx)
        .map((tx) => ({
          ...tx,
          // This source is queried by the account's transparent receiver.
          // Until the local scan sees the same txid and supplies exact pool
          // involvement, it must not leak into every shielded pool tab.
          privacyChainHistoryPoolIds: [0],
          privacyChainHistorySide: 'public' as const,
        })),
    );

    if (!page.hasMore) {
      snapshotComplete =
        !hasBuildFailures && page.data.length <= requestedLimit;
      break;
    }
    if (page.data.length === 0) {
      break;
    }
    if (
      !isHistoryCursorAdvanced(maxTimestampMs?.toString(), page.next, {
        indexerTimestampCursor: true,
      })
    ) {
      break;
    }
    const next = Number(page.next);
    if (!Number.isFinite(next)) {
      break;
    }
    maxTimestampMs = next;
  }

  return { txs: txs.slice(0, maxItems), snapshotComplete };
}
