import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

import type { IEncodedTxZcash } from './types';
import type { IZcashSentRecord } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainZcashSent';

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

type IRecoveredPayment = Pick<IZcashSentRecord, 'recipient' | 'amountZat'> & {
  feeZat?: string;
};

function getRecordedPayment(sent: IRecoveredPayment | undefined) {
  if (!sent) return undefined;
  return {
    from: '',
    to: sent.recipient,
    amount: zatoshiToZec(sent.amountZat),
    fee: sent.feeZat === undefined ? undefined : zatoshiToZec(sent.feeZat),
  };
}

// Rows rebuilt from this device's signed payment; normalizing again would read our own output as change.
const locallyRestoredRows = new WeakSet<IOnChainHistoryTx>();

export function restoreZcashLocalTransparentPayment({
  tx,
  localTx,
  sent,
  withUTXOs = false,
}: {
  tx: IOnChainHistoryTx;
  localTx?: IAccountHistoryTx;
  // This device's record of a shielded payment; it outlives the local row.
  sent?: IRecoveredPayment;
  withUTXOs?: boolean;
}): IOnChainHistoryTx {
  const local = getLocalTransparentPayment({
    txid: tx.tx,
    networkId: tx.networkId,
    localTx,
  });
  const payment = local
    ? {
        from: local.local.signer || local.local.owner,
        to: local.encoded.zcashTo,
        amount: local.amount,
        fee: local.fee,
      }
    : getRecordedPayment(sent);
  if (!payment) return tx;
  const { to, amount, fee } = payment;
  const from = tx.from || payment.from;
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
  // The indexer sees only the transparent debit, which can include the fee; keep the payment verified at signing.
  const restored: IOnChainHistoryTx = {
    ...tx,
    type: EOnChainHistoryTxType.Send,
    from,
    to,
    shieldedCounterparty: undefined,
    value: amount,
    gasFee: fee ?? tx.gasFee,
    gasFeeFiatValue:
      fee === undefined || tx.gasFee === fee ? tx.gasFeeFiatValue : '',
    ...(withUTXOs
      ? {}
      : {
          sends: [{ ...transfer, isOwn: true }],
          receives: [{ ...transfer, isOwn: from === to }],
        }),
  };
  locallyRestoredRows.add(restored);
  return restored;
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

export function normalizeZcashBackendHistoryTx(
  tx: IOnChainHistoryTx,
): IOnChainHistoryTx {
  if (locallyRestoredRows.has(tx) || tx.shieldedCounterparty) return tx;
  const sends = tx.sends ?? [];
  const receives = tx.receives ?? [];
  const isShieldedEntry = (transfer: IOnChainHistoryTxTransfer) =>
    transfer.type === EOnChainHistoryTransferType.Shielded;
  const isDestination = (transfer: IOnChainHistoryTxTransfer) =>
    (transfer.to || transfer.address) === tx.to;
  const destinationIsOnlyChange =
    !!tx.to &&
    receives.some(
      (receive) =>
        !isShieldedEntry(receive) &&
        receive.isOwn === true &&
        receive.isChange === true &&
        isDestination(receive),
    ) &&
    !receives.some(
      (receive) =>
        !isShieldedEntry(receive) &&
        receive.isChange !== true &&
        isDestination(receive),
    );
  if (
    tx.type === EOnChainHistoryTxType.Receive &&
    sends.length > 0 &&
    sends.every(isShieldedEntry) &&
    !receives.some((receive) => !isShieldedEntry(receive) && !!receive.from) &&
    !tx.from
  ) {
    return { ...tx, shieldedCounterparty: 'from' };
  }
  if (
    tx.type === EOnChainHistoryTxType.Send &&
    (!tx.to || destinationIsOnlyChange) &&
    receives.some(
      (receive) =>
        isShieldedEntry(receive) &&
        receive.isChange !== true &&
        (receive.isOwn === false || receive.isChange === false),
    ) &&
    receives.every(
      (receive) =>
        isShieldedEntry(receive) ||
        (receive.isOwn === true && receive.isChange === true),
    )
  ) {
    return {
      ...tx,
      to: '',
      shieldedCounterparty: 'to',
    };
  }
  // Remove only a destination explicitly identified as change, before the own-address gate hides it.
  if (tx.type === EOnChainHistoryTxType.Send && destinationIsOnlyChange) {
    return { ...tx, to: '' };
  }
  return tx;
}

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

export const ZCASH_BACKEND_HISTORY_PAGE_SIZE = 500;

export async function fetchCompleteZcashBackendHistory({
  fetchPage,
  buildPage,
  maxItems = 20_000,
  pageSize = ZCASH_BACKEND_HISTORY_PAGE_SIZE,
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
          // Queried by the account's transparent receiver; must not leak into shielded pool tabs until the local scan supplies pool involvement.
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
