import BigNumber from 'bignumber.js';

import { XMR_DECIMALS } from '@onekeyhq/shared/src/config/xmr';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
} from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import type { IXmrHistoryItem } from './types';
import type { IXmrSentAmount } from '../../../dbs/simple/entity/SimpleDbEntityXmr';

// Labelled, not blank: Monero's design makes the counterparty generally undiscoverable, and an empty value could read as a bug or the user's own address.
export const XMR_UNKNOWN_COUNTERPARTY = 'Private';

function getXmrHistoryStatus(item: IXmrHistoryItem): EDecodedTxStatus {
  if (item.height !== null) {
    return EDecodedTxStatus.Confirmed;
  }
  return item.failed ? EDecodedTxStatus.Failed : EDecodedTxStatus.Pending;
}

function getXmrConfirmations(
  item: IXmrHistoryItem,
  chainTip: number | null | undefined,
): number | undefined {
  return item.height !== null && chainTip !== null && chainTip !== undefined
    ? Math.max(0, chainTip - item.height + 1)
    : undefined;
}

// Status facts only: the page keeps showing the list row for amounts, fee and endpoints.
export function buildXmrLocalHistoryDetail({
  item,
  chainTip,
}: {
  item: IXmrHistoryItem;
  chainTip?: number | null;
}): IOnChainHistoryTx {
  const statusMap: Partial<Record<EDecodedTxStatus, EOnChainHistoryTxStatus>> =
    {
      [EDecodedTxStatus.Confirmed]: EOnChainHistoryTxStatus.Success,
      [EDecodedTxStatus.Failed]: EOnChainHistoryTxStatus.Failed,
    };
  return {
    tx: item.txid,
    status:
      statusMap[getXmrHistoryStatus(item)] ?? EOnChainHistoryTxStatus.Pending,
    block: item.height ?? undefined,
    confirmations: getXmrConfirmations(item, chainTip),
    timestamp: item.timestamp ?? undefined,
  } as IOnChainHistoryTx;
}

export async function buildXmrLocalHistoryTx({
  item,
  chainTip,
  ownAddress,
  recipient,
  sentAmount,
  nativeToken,
  networkId,
  accountId,
  accountAddress,
  buildTransferAction,
}: {
  item: IXmrHistoryItem;
  chainTip?: number | null;
  ownAddress: string;
  /** What we recorded at broadcast time, when this device sent it. */
  recipient?: string;
  sentAmount?: IXmrSentAmount;
  nativeToken:
    | Pick<IToken, 'address' | 'logoURI' | 'name' | 'symbol'>
    | undefined
    | null;
  networkId: string;
  accountId: string;
  accountAddress: string;
  buildTransferAction: (params: {
    from: string;
    to: string;
    transfers: IDecodedTxTransferInfo[];
  }) => Promise<IDecodedTxAction>;
}): Promise<IAccountHistoryTx> {
  const isSent = item.direction === 'out';

  // An outgoing tx's own outputs include the change coming back, so the amount that left is spent minus returned.
  // Until change is scanned that difference is the whole input set, so a send here uses the broadcast-time figure instead.
  let atomic = new BigNumber(item.receivedAtomic);
  if (isSent) {
    atomic = item.outgoingAtomic
      ? new BigNumber(item.outgoingAtomic)
      : BigNumber.max(
          new BigNumber(item.spentAtomic).minus(item.receivedAtomic),
          0,
        );
  }
  const amount = atomic.shiftedBy(-XMR_DECIMALS).toFixed();
  const paymentAmount =
    isSent && sentAmount
      ? new BigNumber(sentAmount.amountAtomic)
          .shiftedBy(-XMR_DECIMALS)
          .toFixed()
      : amount;

  // Own address goes on the side that fixes direction (buildTxActionDirection compares against it); the other side is what the list shows.
  const from = isSent ? ownAddress : XMR_UNKNOWN_COUNTERPARTY;
  const to = isSent ? recipient || XMR_UNKNOWN_COUNTERPARTY : ownAddress;

  const action = await buildTransferAction({
    from,
    to,
    transfers: [
      {
        from,
        to,
        amount: paymentAmount,
        tokenIdOnNetwork: nativeToken?.address ?? '',
        icon: nativeToken?.logoURI ?? '',
        name: nativeToken?.name ?? '',
        symbol: nativeToken?.symbol ?? '',
        isNFT: false,
        isNative: true,
      },
    ],
  });

  // An unmined tx has no block time; without a stand-in it sorts to the bottom (sort key falls back to 0) and the newest transaction would appear oldest.
  const isPending = item.height === null;
  const timestampMs = item.timestamp
    ? item.timestamp * 1000
    : (isPending && Date.now()) || undefined;

  const decodedTx: IDecodedTx = {
    txid: item.txid,
    owner: ownAddress,
    signer: isSent ? ownAddress : '',
    nonce: 0,
    actions: [action],
    status: getXmrHistoryStatus(item),
    broadcastOutcomeUnknown:
      item.height === null &&
      !item.failed &&
      sentAmount?.broadcastOutcomeUnknown,
    block: item.height ?? undefined,
    confirmations: getXmrConfirmations(item, chainTip),
    networkId,
    accountId,
    extraInfo: null,
    nativeAmount: paymentAmount,
    // Scanned net debit includes an unknown fee. Never label it as the payment.
    nativeAmountIsUnknown: isSent && !sentAmount,
    totalFeeInNative:
      isSent && sentAmount
        ? new BigNumber(sentAmount.feeAtomic).shiftedBy(-XMR_DECIMALS).toFixed()
        : undefined,
    createdAt: timestampMs,
    updatedAt: timestampMs,
  };

  return {
    id: accountUtils.buildLocalHistoryId({
      networkId,
      accountAddress,
      txid: item.txid,
    }),
    decodedTx,
    // One pool: every Monero output is private; the generic per-pool plumbing just needs an id to key filters on.
    privacyChainHistoryPoolIds: [1],
  };
}
