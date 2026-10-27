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

export function toXmrSentAmount(
  record: IXmrSentRecord | undefined,
): IXmrSentAmount | undefined {
  if (record?.amountAtomic === undefined || record.feeAtomic === undefined) {
    return undefined;
  }
  return {
    amountAtomic: record.amountAtomic,
    feeAtomic: record.feeAtomic,
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

  // Amount sent = spent minus change and fee; until change is scanned that is the whole
  // input set, so a send from this device uses the broadcast figure.
  let atomic = new BigNumber(item.receivedAtomic);
  if (isSent) {
    atomic = item.outgoingAtomic
      ? new BigNumber(item.outgoingAtomic)
      : BigNumber.max(
          new BigNumber(item.spentAtomic).minus(item.receivedAtomic),
          0,
        );
    if (item.feeAtomic) {
      atomic = BigNumber.max(atomic.minus(item.feeAtomic), 0);
    }
  }
  const amount = atomic.shiftedBy(-XMR_DECIMALS).toFixed();
  const feeAtomic = sentAmount?.feeAtomic ?? item.feeAtomic;
  const paymentAmount =
    isSent && sentAmount
      ? new BigNumber(sentAmount.amountAtomic)
          .shiftedBy(-XMR_DECIMALS)
          .toFixed()
      : amount;

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

  // Which of our addresses received it is unknown (may be a subaddress).
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
    block: item.height ?? undefined,
    confirmations: getXmrConfirmations(item, chainTip),
    networkId,
    accountId,
    extraInfo: null,
    nativeAmount: paymentAmount,
    totalFeeInNative:
      isSent && feeAtomic
        ? new BigNumber(feeAtomic).shiftedBy(-XMR_DECIMALS).toFixed()
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
    privacyChainHistoryPoolIds: [1],
  };
}
