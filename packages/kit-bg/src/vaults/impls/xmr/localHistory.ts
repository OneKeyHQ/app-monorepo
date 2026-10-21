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

import { XMR_POOL_IDS } from './types';

import type { IXmrHistoryItem } from './types';
import type {
  IXmrSentAmount,
  IXmrSentRecord,
} from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';

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

// The history row's view of a sent record: amounts only as a recorded pair.
export function toXmrSentAmount(
  record: IXmrSentRecord | undefined,
): IXmrSentAmount | undefined {
  if (record?.amountAtomic === undefined || record.feeAtomic === undefined) {
    return undefined;
  }
  return {
    amountAtomic: record.amountAtomic,
    feeAtomic: record.feeAtomic,
    ...(record.outcomeUnknown ? { broadcastOutcomeUnknown: true } : {}),
  };
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

  // Amount sent = spent minus returned change. Until change is scanned that is
  // the whole input set, so a send from this device uses the broadcast figure.
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

  // Own address fixes direction (buildTxActionDirection compares against it).
  // The counterparty is undiscoverable on Monero, so it is marked private.
  const from = isSent ? ownAddress : '';
  const to = isSent ? recipient || '' : ownAddress;
  const own = { poolId: XMR_POOL_IDS.private, isOwn: true };
  const counterparty = { poolId: XMR_POOL_IDS.private };
  const shieldedSides = {
    shieldedFrom: isSent ? own : counterparty,
    ...(isSent && recipient ? {} : { shieldedTo: isSent ? counterparty : own }),
  };

  const action = await buildTransferAction({
    from,
    to,
    transfers: [
      {
        from,
        to,
        ...shieldedSides,
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

  // Own address only fixed direction above. Which of our addresses a payment
  // reached is unknown (it may be a subaddress), so our side names no address.
  const withoutOwnAddress = <T extends { from: string; to: string }>(
    target: T,
  ): T => ({
    ...target,
    ...shieldedSides,
    from: isSent ? '' : target.from,
    to: isSent ? target.to : '',
  });
  if (action.assetTransfer) {
    action.assetTransfer = {
      ...withoutOwnAddress(action.assetTransfer),
      sends: action.assetTransfer.sends.map(withoutOwnAddress),
      receives: action.assetTransfer.receives.map(withoutOwnAddress),
    };
  }

  // An unmined tx has no block time; without a stand-in it would sort as oldest.
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
    // Every Monero output is private; per-pool filters still need an id.
    privacyChainHistoryPoolIds: [1],
  };
}
