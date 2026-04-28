import BigNumber from 'bignumber.js';

import {
  EDecodedTxActionType,
  type IDecodedTx,
  type IDecodedTxAction,
} from '../../types/tx';

export type ITrayPendingTxType = 'send' | 'swap' | 'contract' | 'approve';

export interface ITrayPendingTxAmountInfo {
  amount: string;
  symbol: string;
}

export interface IFormatTrayPendingTxAmountInput {
  firstSend?: ITrayPendingTxAmountInfo | undefined;
  amountInfo?: ITrayPendingTxAmountInfo | undefined;
}

export function formatTrayPendingTxAmount(
  input: IFormatTrayPendingTxAmountInput,
): string {
  const amountInfo = input.amountInfo ?? input.firstSend;
  if (amountInfo) {
    const bn = new BigNumber(amountInfo.amount ?? '');
    let formatted: string;
    if (bn.isNaN()) {
      formatted = amountInfo.amount;
    } else if (bn.isZero()) {
      formatted = '0';
    } else if (bn.abs().lt('0.01')) {
      formatted = bn.toPrecision(3);
    } else {
      formatted = bn.toFixed(4).replace(/\.?0+$/, '');
    }
    return `${formatted} ${amountInfo.symbol}`;
  }
  // No English label — PendingTransactions renders the i18n'd typeLabel on the row.
  return '—';
}

export function getTrayPendingTxAmountInfo(
  action: IDecodedTxAction | undefined,
): ITrayPendingTxAmountInfo | undefined {
  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    const tokenApprove = action.tokenApprove;
    if (tokenApprove?.symbol) {
      return {
        amount: tokenApprove.amount,
        symbol: tokenApprove.symbol,
      };
    }
  }

  const firstSend = action?.assetTransfer?.sends?.[0];
  if (firstSend?.symbol) {
    return {
      amount: firstSend.amount,
      symbol: firstSend.symbol,
    };
  }

  const firstReceive = action?.assetTransfer?.receives?.[0];
  if (firstReceive?.symbol) {
    return {
      amount: firstReceive.amount,
      symbol: firstReceive.symbol,
    };
  }

  return undefined;
}

export function getTrayPendingTxType({
  decodedTx,
  action,
}: {
  decodedTx?: Pick<IDecodedTx, 'isToContract' | 'interactInfo'> | undefined;
  action?: IDecodedTxAction | undefined;
}): ITrayPendingTxType {
  const transfer = action?.assetTransfer;
  if (
    action?.type === EDecodedTxActionType.INTERNAL_SWAP ||
    transfer?.isInternalSwap
  ) {
    return 'swap';
  }
  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    return 'approve';
  }
  if (action?.type === EDecodedTxActionType.FUNCTION_CALL) {
    return 'contract';
  }
  if (action?.type === EDecodedTxActionType.ASSET_TRANSFER) {
    if (decodedTx?.isToContract || decodedTx?.interactInfo) {
      return 'contract';
    }
    return 'send';
  }
  return 'contract';
}

// Placeholder until backend wires an account-level 24h feed (OK-53612).
export function composeTrayAccountChange24h(): number | undefined {
  return undefined;
}
