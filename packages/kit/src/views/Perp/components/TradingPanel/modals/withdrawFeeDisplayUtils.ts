import { BigNumber } from 'bignumber.js';

import {
  type IUsdcWithdrawFeeQuote,
  USDC_WITHDRAW_GAS_RESERVE,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

function formatAmount(amount: string) {
  return new BigNumber(amount).toFixed(2);
}

function formatReserve(reserve: string) {
  const prefix = new BigNumber(reserve).lte(USDC_WITHDRAW_GAS_RESERVE)
    ? '< '
    : '';
  return `${prefix}$${formatAmount(reserve)}`;
}

export function formatUsdcWithdrawFeeText({
  feeQuote,
  reserve,
  includeReserve,
}: {
  feeQuote: IUsdcWithdrawFeeQuote | undefined;
  reserve: string | undefined;
  includeReserve: boolean;
}) {
  if (!feeQuote) return undefined;

  const feeParts = feeQuote.components
    .filter(
      (component) =>
        !includeReserve || !reserve || component.kind !== 'hyperEvmGas',
    )
    .map((component) => {
      const amount = formatAmount(component.amount);
      if (component.kind === 'hyperEvmGas') {
        return `< $${amount}`;
      }
      return `${component.isEstimate ? '≈ ' : ''}$${amount}`;
    });

  if (includeReserve && reserve) {
    feeParts.unshift(formatReserve(reserve));
  }
  return feeParts.join(' + ');
}
