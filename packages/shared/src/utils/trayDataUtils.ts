import BigNumber from 'bignumber.js';

export type ITrayPendingTxType = 'send' | 'swap' | 'contract' | 'approve';

export interface IFormatTrayPendingTxAmountInput {
  firstSend: { amount: string; symbol: string } | undefined;
  txType: ITrayPendingTxType;
}

export function formatTrayPendingTxAmount(
  input: IFormatTrayPendingTxAmountInput,
): string {
  const { firstSend, txType } = input;
  if (firstSend) {
    const bn = new BigNumber(firstSend.amount ?? '');
    let formatted: string;
    if (bn.isNaN()) {
      formatted = firstSend.amount;
    } else if (bn.abs().lt('0.01')) {
      formatted = bn.toPrecision(3);
    } else {
      formatted = bn.toFixed(4).replace(/\.?0+$/, '');
    }
    return `${formatted} ${firstSend.symbol}`;
  }
  if (txType === 'approve') return 'Approve';
  if (txType === 'contract') return 'Contract';
  return '—';
}

// Placeholder for the account-level 24h change calculator. Returns undefined
// so callers (and the UI) handle the "no data" branch uniformly. Replace the
// body when a backend source becomes available. See OK-53612.
export function composeTrayAccountChange24h(): number | undefined {
  return undefined;
}
